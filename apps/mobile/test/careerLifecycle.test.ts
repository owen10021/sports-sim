import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  MemoryCareerStore,
  SYNTHETIC_RULESET,
  SYNTHETIC_SEED,
  entityId,
  fingerprintWorld,
  worldId,
  type CareerSnapshot,
  type CareerStore,
  type CommitRecord,
  type HistorySlice,
  type RecoveryReport,
} from '@sport-sim/sim-core';
import { CareerLifecycle } from '../src/lifecycle/careerLifecycle';
import { SqliteCareerStore } from '../src/persistence/sqliteCareerStore';
import { NodeSqliteDatabase } from './support/nodeSqliteDatabase';

/** Wraps a store so tests can hold a save open, count saves, and inject one failure. */
class ObservedStore implements CareerStore {
  saveCalls = 0;
  gate: Promise<void> | null = null;
  failNext = false;
  constructor(readonly inner: CareerStore) {}
  initialize = () => this.inner.initialize();
  async saveCommit(commit: CommitRecord): Promise<void> {
    this.saveCalls += 1;
    if (this.gate) await this.gate;
    if (this.failNext) {
      this.failNext = false;
      throw new Error('disk is full');
    }
    await this.inner.saveCommit(commit);
  }
  loadLatest = (): Promise<CareerSnapshot | null> => this.inner.loadLatest();
  listVerifiedSnapshots = () => this.inner.listVerifiedSnapshots();
  loadHistorySince = (r: number): Promise<HistorySlice> =>
    this.inner.loadHistorySince(r);
  markRecovery = (r: RecoveryReport, s?: CareerSnapshot) =>
    this.inner.markRecovery(r, s);
  loadRecoveryLog = () => this.inner.loadRecoveryLog();
}

const lifecycleFor = (store: CareerStore) =>
  new CareerLifecycle({
    store,
    ruleset: SYNTHETIC_RULESET,
    seed: SYNTHETIC_SEED,
    idSource: { newWorldId: () => worldId('world-lifecycle-1') },
    actor: { kind: 'human_gm', id: entityId('gm-1') },
  });

const started = async () => {
  const store = new ObservedStore(new MemoryCareerStore());
  const life = lifecycleFor(store);
  await life.open();
  await life.createCareer();
  return { store, life };
};

describe('CareerLifecycle', () => {
  it('opens an empty store as empty, then loads what createCareer saved', async () => {
    const store = new MemoryCareerStore();
    const first = lifecycleFor(store);
    expect((await first.open()).status).toBe('empty');
    await first.createCareer();
    const second = lifecycleFor(store);
    expect((await second.open()).status).toBe('loaded');
    expect(second.view().fingerprint).toBe(first.view().fingerprint);
  });

  it('refuses to overwrite an existing career', async () => {
    const { life } = await started();
    await expect(life.createCareer()).rejects.toThrow(/already exists/i);
  });

  it('advance commits through the kernel and persists before reporting saved', async () => {
    const { store, life } = await started();
    const res = await life.advance(3);
    expect(res).toMatchObject({ ok: true, saved: true });
    expect(life.view()).toMatchObject({
      revision: 1,
      simDate: '2026-10-19',
      pendingCommits: 0,
    });
    expect((await store.loadLatest())?.revision).toBe(1);
  });

  it('a rejected command mutates nothing, consumes no RNG, and saves nothing', async () => {
    const { store, life } = await started();
    await life.advance(1);
    const before = life.view();
    const saves = store.saveCalls;
    const res = await life.advance(0);
    expect(res.ok).toBe(false);
    expect(life.view()).toEqual(before);
    expect(store.saveCalls).toBe(saves);
  });

  it('backgrounding during a pending save waits for that save and writes it exactly once', async () => {
    const { store, life } = await started();
    let release!: () => void;
    store.gate = new Promise<void>((resolve) => (release = resolve));
    const saves = store.saveCalls;
    const advancing = life.advance(2);
    await Promise.resolve();
    const backgrounding = life.handleLifecycle('background');
    release();
    await Promise.all([advancing, backgrounding]);
    expect(store.saveCalls - saves).toBe(1);
    expect((await store.loadLatest())?.revision).toBe(1);
    expect(life.view().pendingCommits).toBe(0);
  });

  it('resuming after a successful save changes nothing and saves nothing', async () => {
    const { store, life } = await started();
    await life.advance(1);
    const view = life.view();
    const saves = store.saveCalls;
    await life.handleLifecycle('background');
    await life.handleLifecycle('active');
    expect(life.view()).toEqual(view);
    expect(store.saveCalls).toBe(saves);
  });

  it('repeated lifecycle events are idempotent', async () => {
    const { store, life } = await started();
    await life.advance(1);
    const view = life.view();
    const saves = store.saveCalls;
    for (const e of [
      'background',
      'background',
      'inactive',
      'active',
      'active',
      'background',
    ] as const) {
      await life.handleLifecycle(e);
    }
    expect(life.view()).toEqual(view);
    expect(store.saveCalls).toBe(saves);
  });

  it('lifecycle events never invent a simulation command', async () => {
    const { life } = await started();
    const before = life.view();
    for (const e of ['inactive', 'background', 'active'] as const)
      await life.handleLifecycle(e);
    expect(life.view()).toEqual(before);
    expect(life.kernel?.world.rng.draws).toBe(0);
  });

  it('a failed save stays pending and is retried (not re-simulated) on the next lifecycle event', async () => {
    const { store, life } = await started();
    store.failNext = true;
    const res = await life.advance(2);
    expect(res).toMatchObject({ ok: true, saved: false });
    expect(life.view()).toMatchObject({ revision: 1, pendingCommits: 1 });
    const fingerprint = life.view().fingerprint;
    await life.handleLifecycle('active');
    expect(life.view()).toMatchObject({
      revision: 1,
      pendingCommits: 0,
      fingerprint,
    });
    expect((await store.loadLatest())?.revision).toBe(1);
  });

  it('persists several fast commands in order', async () => {
    const { store, life } = await started();
    await Promise.all([life.advance(1), life.advance(2), life.advance(3)]);
    expect((await store.loadLatest())?.revision).toBe(3);
    expect(life.view()).toMatchObject({
      revision: 3,
      simDate: '2026-10-22',
      pendingCommits: 0,
    });
  });

  it('repairs a corrupt newest snapshot on open and reports it', async () => {
    const memory = new MemoryCareerStore();
    const first = lifecycleFor(memory);
    await first.open();
    await first.createCareer();
    await first.advance(1);
    await first.advance(1);
    const expected = first.view().fingerprint;
    memory.tamperWithSnapshotForTest(2, (s) => ({
      ...s,
      contentHash: 'f'.repeat(64),
    }));
    const second = lifecycleFor(memory);
    const outcome = await second.open();
    expect(outcome.status).toBe('recovered');
    expect(second.view().fingerprint).toBe(expected);
    expect(second.view().recovery?.action).toBe('REPAIRED_LATEST_FROM_REPLAY');
  });
});

describe('CareerLifecycle across a process restart (real SQLite file)', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('create -> advance -> save -> reload yields the identical fingerprint and continues deterministically', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sport-sim-life-'));
    dirs.push(dir);
    const path = join(dir, 'career.db');

    const db1 = new NodeSqliteDatabase(path);
    const first = lifecycleFor(new SqliteCareerStore(db1));
    await first.open();
    await first.createCareer();
    await first.advance(1);
    await first.advance(6);
    await first.handleLifecycle('background');
    const savedView = first.view();
    db1.close();

    const db2 = new NodeSqliteDatabase(path);
    const second = lifecycleFor(new SqliteCareerStore(db2));
    expect((await second.open()).status).toBe('loaded');
    expect(second.view()).toMatchObject({
      revision: 2,
      simDate: savedView.simDate,
      fingerprint: savedView.fingerprint,
      chainHead: savedView.chainHead,
    });
    expect(fingerprintWorld(second.kernel!.world)).toBe(savedView.fingerprint);

    // An uninterrupted career and a restarted one stay identical.
    const control = lifecycleFor(new MemoryCareerStore());
    await control.open();
    await control.createCareer();
    for (const days of [1, 6, 7]) await control.advance(days);
    await second.advance(7);
    expect(second.view().fingerprint).toBe(control.view().fingerprint);
    expect(second.view().chainHead).toBe(control.view().chainHead);
    db2.close();
  });
});
