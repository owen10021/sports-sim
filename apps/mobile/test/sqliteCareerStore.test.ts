import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PersistenceError,
  UnsupportedSchemaVersionError,
  WorldKernel,
  careerStoreContractCases,
  commandId,
  createWorld,
  entityId,
  rulesetRefOf,
  sealRuleset,
  sealSeed,
  sealSnapshot,
  worldId,
  worldRevision,
  SCHEMA_VERSION,
  type CommandEnvelope,
  type CommitRecord,
} from '@sport-sim/sim-core';
import { SqliteCareerStore } from '../src/persistence/sqliteCareerStore';
import { NodeSqliteDatabase } from './support/nodeSqliteDatabase';

const provenance = {
  sourceId: 'sqlite-test',
  sourceKind: 'synthetic',
  retrievedAt: '2026-10-16T00:00:00Z',
  effectiveAsOf: '2026-10-16',
  validationStatus: 'synthetic',
  note: 'sqlite store test',
} as const;

const newCareer = () => {
  const ruleset = sealRuleset({
    schemaVersion: SCHEMA_VERSION,
    rulesetId: 'sqlite-test-rules',
    rulesetVersion: 1,
    displayName: 'SQLite Test Rules',
    provenance: [provenance],
    rules: { maxAdvanceDaysPerCommand: 30 },
  });
  const seed = sealSeed({
    schemaVersion: SCHEMA_VERSION,
    seedId: 'sqlite-test-seed',
    seedVersion: 1,
    ruleset: rulesetRefOf(ruleset),
    rngSeed32: 4242,
    startDate: '2026-10-16',
    provenance: [provenance],
    initialEntities: [],
  });
  const world = createWorld(seed, ruleset, {
    newWorldId: () => worldId('world-sqlite-1'),
  });
  const kernel = WorldKernel.fromGenesis(world, ruleset);
  const snap = () =>
    sealSnapshot({
      world: kernel.world,
      chainHead: kernel.chainHead,
      eventCount: kernel.eventCount,
      knownCommandIds: kernel.knownCommandIds,
    });
  const genesis = (): CommitRecord => ({
    snapshot: snap(),
    commands: [],
    events: [],
  });
  const step = (n: number): CommitRecord => {
    const envelope = {
      commandId: commandId(`cmd-${n}`),
      expectedRevision: worldRevision(n - 1),
      actor: { kind: 'test_harness', id: entityId('actor-1') },
      command: { type: 'AdvanceDays', days: 1 },
    } as unknown as CommandEnvelope;
    const res = kernel.execute(envelope);
    if (!res.ok) throw new Error('fixture rejected');
    return {
      snapshot: snap(),
      commands: [{ envelope, resultRevision: Number(res.world.revision) }],
      events: res.events,
    };
  };
  return { kernel, genesis, step };
};

const open = async (path = ':memory:') => {
  const db = new NodeSqliteDatabase(path);
  const store = new SqliteCareerStore(db);
  await store.initialize();
  return { db, store };
};

const count = async (db: NodeSqliteDatabase, table: string) =>
  (
    (await db.all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))[0] as {
      n: number;
    }
  ).n;

describe('SqliteCareerStore (node:sqlite) satisfies the shared CareerStore contract', () => {
  for (const c of careerStoreContractCases(async () => {
    const db = new NodeSqliteDatabase();
    const store = new SqliteCareerStore(db);
    return { store, failNextCommit: () => store.failNextCommit() };
  })) {
    it(c.name, async () => {
      await c.run();
    });
  }
});

describe('SqliteCareerStore transactions and fault injection', () => {
  it('rolls back every table when a fault fires immediately before commit', async () => {
    const { db, store } = await open();
    const career = newCareer();
    await store.saveCommit(career.genesis());
    const good = (await store.loadLatest())!;
    const next = career.step(1);
    store.failNextCommit();
    await expect(store.saveCommit(next)).rejects.toMatchObject({
      code: 'WRITE_FAILED',
    });
    expect(await count(db, 'events')).toBe(0);
    expect(await count(db, 'commands')).toBe(0);
    expect(await count(db, 'snapshots')).toBe(1);
    expect(await store.loadLatest()).toEqual(good);
    await store.saveCommit(next);
    expect((await store.loadLatest())?.revision).toBe(1);
  });

  it('a fault injected via the constructor option also preserves the previous snapshot', async () => {
    const db = new NodeSqliteDatabase();
    let armed = false;
    const store = new SqliteCareerStore(db, {
      faultBeforeCommit: () => {
        if (armed) throw new Error('boom');
      },
    });
    await store.initialize();
    const career = newCareer();
    await store.saveCommit(career.genesis());
    armed = true;
    await expect(store.saveCommit(career.step(1))).rejects.toBeInstanceOf(
      PersistenceError,
    );
    expect((await store.loadLatest())?.revision).toBe(0);
    expect(await count(db, 'events')).toBe(0);
  });

  it('moves the active pointer only with the final statement (pointer follows committed data)', async () => {
    const { db, store } = await open();
    const career = newCareer();
    await store.saveCommit(career.genesis());
    await store.saveCommit(career.step(1));
    const meta = await db.all<{ active_revision: number }>(
      'SELECT active_revision FROM metadata',
    );
    expect(meta).toEqual([{ active_revision: 1 }]);
  });

  it('enforces foreign keys: an event must reference a stored command', async () => {
    const { db } = await open();
    await expect(
      db.run(
        "INSERT INTO events (ordinal, event_id, revision, command_id, hash, event_json) VALUES (1, 'e', 1, 'nope', 'h', '{}')",
      ),
    ).rejects.toThrow(/FOREIGN KEY/i);
  });

  it('enforces foreign keys: the active pointer must reference a stored snapshot', async () => {
    const { db } = await open();
    await expect(
      db.transaction(async (tx) => {
        await tx.run(
          'INSERT INTO metadata (id, schema_version, world_id, active_revision) VALUES (1, 1, ?, 99)',
          ['w'],
        );
      }),
    ).rejects.toThrow(/FOREIGN KEY/i);
  });
});

describe('SqliteCareerStore durability, restart and corruption signals', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  const tempDb = () => {
    const dir = mkdtempSync(join(tmpdir(), 'sport-sim-'));
    dirs.push(dir);
    return join(dir, 'career.db');
  };

  it('a career survives closing and reopening the database file (process restart)', async () => {
    const path = tempDb();
    const career = newCareer();
    const first = await open(path);
    await first.store.saveCommit(career.genesis());
    for (let n = 1; n <= 3; n++) await first.store.saveCommit(career.step(n));
    const before = (await first.store.loadLatest())!;
    first.db.close();

    const second = await open(path);
    expect(await second.store.loadLatest()).toEqual(before);
    expect((await second.store.loadHistorySince(0)).events).toHaveLength(3);
    second.db.close();
  });

  it('refuses a database written by a newer store layout', async () => {
    const path = tempDb();
    const first = new NodeSqliteDatabase(path);
    first.raw.exec('PRAGMA user_version = 7');
    first.close();
    const db = new NodeSqliteDatabase(path);
    await expect(new SqliteCareerStore(db).initialize()).rejects.toBeInstanceOf(
      UnsupportedSchemaVersionError,
    );
    db.close();
  });

  it('fails closed when the stored active snapshot declares a future schema', async () => {
    const { db, store } = await open();
    const career = newCareer();
    await store.saveCommit(career.genesis());
    const row = (
      await db.all<{ snapshot_json: string }>(
        'SELECT snapshot_json FROM snapshots',
      )
    )[0]!;
    const tampered = JSON.stringify({
      ...JSON.parse(row.snapshot_json),
      schemaVersion: 2,
    });
    await db.run('UPDATE snapshots SET snapshot_json = ?', [tampered]);
    await expect(store.loadLatest()).rejects.toBeInstanceOf(
      UnsupportedSchemaVersionError,
    );
  });

  it('reports unreadable snapshot text as CORRUPT_STORE and omits it from the verified list', async () => {
    const { db, store } = await open();
    const career = newCareer();
    await store.saveCommit(career.genesis());
    await store.saveCommit(career.step(1));
    await db.run('UPDATE snapshots SET snapshot_json = ? WHERE revision = 1', [
      '{not json',
    ]);
    await expect(store.loadLatest()).rejects.toMatchObject({
      code: 'CORRUPT_STORE',
    });
    expect(
      (await store.listVerifiedSnapshots()).map((s) => s.revision),
    ).toEqual([0]);
  });

  it('omits a snapshot whose stored content no longer matches its hash', async () => {
    const { db, store } = await open();
    const career = newCareer();
    await store.saveCommit(career.genesis());
    await store.saveCommit(career.step(1));
    const row = (
      await db.all<{ snapshot_json: string }>(
        'SELECT snapshot_json FROM snapshots WHERE revision = 1',
      )
    )[0]!;
    const flipped = row.snapshot_json.replace('2026-10-17', '2026-10-18');
    expect(flipped).not.toBe(row.snapshot_json);
    await db.run('UPDATE snapshots SET snapshot_json = ? WHERE revision = 1', [
      flipped,
    ]);
    expect(
      (await store.listVerifiedSnapshots()).map((s) => s.revision),
    ).toEqual([0]);
  });

  it('refuses to save while stored history is ahead of the active snapshot', async () => {
    const { db, store } = await open();
    const career = newCareer();
    await store.saveCommit(career.genesis());
    await store.saveCommit(career.step(1));
    const second = career.step(2);
    // Simulate a lost pointer update: point back at genesis while history keeps event 1.
    await db.run('UPDATE metadata SET active_revision = 0');
    await expect(store.saveCommit(second)).rejects.toMatchObject({
      code: 'COMMIT_REJECTED',
    });
  });
});
