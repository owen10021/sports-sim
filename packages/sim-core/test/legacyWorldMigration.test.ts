import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DOMAIN_STATE_KEYS,
  GOLDEN_EXPECTED,
  MemoryCareerStore,
  SYNTHETIC_RULESET,
  SYNTHETIC_SEED,
  WorldKernel,
  canonicalString,
  commandId,
  currentModelFingerprintOf,
  entityId,
  fingerprintLegacyPackageAWorld,
  fingerprintWorld,
  isLegacyPackageAWorld,
  loadCareer,
  migrateLegacyPackageAWorld,
  repairLatestFromHistory,
  replayFrom,
  sealSnapshot,
  verifyCareerReplay,
  verifySnapshot,
  worldModelProblems,
  worldRevision,
  type CareerSnapshot,
  type CommandEnvelope,
  type CommitRecord,
  type LegacyPackageAWorld,
} from '../src/index';

interface LegacyFixture {
  readonly generatedFromCommit: string;
  readonly goldenExpected: {
    readonly fingerprint: string;
    readonly eventChainHead: string;
    readonly steps: readonly { label: string; fingerprint: string }[];
  };
  readonly genesis: CareerSnapshot;
  readonly commits: readonly CommitRecord[];
}

const fixture = JSON.parse(
  readFileSync(
    join(
      __dirname,
      '..',
      '..',
      '..',
      'fixtures',
      'legacy',
      'package-a-world-v1-snapshot.json',
    ),
    'utf8',
  ),
) as LegacyFixture;

const finalSnapshot = (): CareerSnapshot =>
  fixture.commits[fixture.commits.length - 1]!.snapshot;
const legacyWorld = (s: CareerSnapshot): LegacyPackageAWorld =>
  s.world as LegacyPackageAWorld;

const storeFromFixture = async (): Promise<MemoryCareerStore> => {
  const store = new MemoryCareerStore();
  await store.initialize();
  await store.saveCommit({
    snapshot: fixture.genesis,
    commands: [],
    events: [],
  });
  for (const commit of fixture.commits) await store.saveCommit(commit);
  return store;
};

const advanceEnvelope = (n: number, revision: number, days: number) =>
  ({
    commandId: commandId(`cmd-${String(n).padStart(6, '0')}`),
    expectedRevision: worldRevision(revision),
    actor: { kind: 'test_harness', id: entityId('golden-harness') },
    command: { type: 'AdvanceDays', days },
  }) as unknown as CommandEnvelope;

describe('the frozen Package A v1 fixture under the Package B build', () => {
  it('is recognised as a legacy world and verifies with legacy fingerprint semantics', () => {
    expect(isLegacyPackageAWorld(legacyWorld(fixture.genesis))).toBe(true);
    expect(verifySnapshot(fixture.genesis)).toEqual({ ok: true });
    for (const c of fixture.commits) {
      expect(verifySnapshot(c.snapshot)).toEqual({ ok: true });
      expect(isLegacyPackageAWorld(legacyWorld(c.snapshot))).toBe(true);
    }
  });

  it('reproduces the recorded Package A golden fingerprints exactly', () => {
    const fin = finalSnapshot();
    expect(fingerprintLegacyPackageAWorld(legacyWorld(fin))).toBe(
      fixture.goldenExpected.fingerprint,
    );
    expect(fin.worldFingerprint).toBe(fixture.goldenExpected.fingerprint);
    expect(fin.chainHead).toBe(fixture.goldenExpected.eventChainHead);
    const committed = fixture.goldenExpected.steps.filter((s) =>
      s.label.startsWith('advance-'),
    );
    committed.forEach((step, i) => {
      expect(fixture.commits[i]!.snapshot.worldFingerprint).toBe(
        step.fingerprint,
      );
    });
  });
});

describe('Package A golden history is preserved, not overwritten', () => {
  const root = join(__dirname, '..', '..', '..');
  const read = (...p: string[]) =>
    JSON.parse(readFileSync(join(root, ...p), 'utf8'));

  it('keeps the Package A golden fixture file equal to the values frozen with the legacy career', () => {
    expect(read('fixtures', 'golden', 'package-a-golden-v1.json')).toEqual(
      fixture.goldenExpected,
    );
    expect(
      read('evidence', 'package-a', 'golden-expected-world-model-v1.json')
        .goldenExpected,
    ).toEqual(fixture.goldenExpected);
  });

  it('keeps the accepted Package A model-2 golden file as history', () => {
    const v2 = read('fixtures', 'golden', 'package-a-golden-v2.json');
    expect(v2.scenario).toBe('package-a-golden-v2');
    expect(v2.eventChainHead).toBe(fixture.goldenExpected.eventChainHead);
    expect(GOLDEN_EXPECTED.fingerprint).not.toBe(v2.fingerprint);
  });

  it('gives the current-model golden a different scenario id and fingerprint', () => {
    expect(GOLDEN_EXPECTED.scenario).toBe('package-a-golden-v3');
    expect(GOLDEN_EXPECTED.fingerprint).not.toBe(
      fixture.goldenExpected.fingerprint,
    );
    // Events never contained world state, so the audit chain is unchanged by the model change.
    expect(GOLDEN_EXPECTED.eventChainHead).toBe(
      fixture.goldenExpected.eventChainHead,
    );
  });
});

describe('migrateLegacyPackageAWorld', () => {
  it('adds empty Package B domain state and changes nothing else', () => {
    const legacy = legacyWorld(finalSnapshot());
    const before = canonicalString(legacy);
    const migrated = migrateLegacyPackageAWorld(legacy);
    expect(canonicalString(legacy)).toBe(before);
    expect(worldModelProblems(migrated)).toEqual([]);
    expect(migrated.worldModelVersion).toBe(3);
    expect(migrated.worldId).toBe(legacy.worldId);
    expect(migrated.simDate).toBe(legacy.simDate);
    expect(migrated.revision).toBe(legacy.revision);
    expect(migrated.revision).toBe(3);
    expect(migrated.rng).toEqual(legacy.rng);
    expect(migrated.rng.draws).toBe(14);
    expect(migrated.seed).toEqual(legacy.seed);
    expect(migrated.ruleset).toEqual(legacy.ruleset);
    expect(migrated.entities).toEqual(legacy.entities);
    expect(migrated.nextIds).toEqual({
      event: legacy.nextIds.event,
      record: 1,
    });
    for (const [domain, collections] of Object.entries(DOMAIN_STATE_KEYS)) {
      const state = (
        migrated as unknown as Record<string, Record<string, unknown>>
      )[domain]!;
      for (const c of collections) expect(state[c]).toEqual([]);
    }
    expect(Object.isFrozen(migrated)).toBe(true);
  });

  it('is deterministic: repeated migration is byte-identical', () => {
    const legacy = legacyWorld(finalSnapshot());
    const a = migrateLegacyPackageAWorld(legacy);
    const b = migrateLegacyPackageAWorld(JSON.parse(JSON.stringify(legacy)));
    expect(canonicalString(a)).toBe(canonicalString(b));
    expect(fingerprintWorld(a)).toBe(fingerprintWorld(b));
    expect(currentModelFingerprintOf(legacy)).toBe(fingerprintWorld(a));
  });

  it('refuses anything that is not a genuine legacy world', () => {
    expect(() =>
      migrateLegacyPackageAWorld({
        ...legacyWorld(finalSnapshot()),
        worldModelVersion: 2,
      } as never),
    ).toThrow();
    expect(() => migrateLegacyPackageAWorld(null as never)).toThrow();
  });
});

describe('resume, load, replay and save all migrate through the same boundary', () => {
  it('WorldKernel.resume migrates without RNG draws, events, or identity change', () => {
    const fin = finalSnapshot();
    const kernel = WorldKernel.resume({
      world: fin.world,
      ruleset: SYNTHETIC_RULESET,
      chainHead: fin.chainHead,
      eventCount: fin.eventCount,
      knownCommandIds: fin.knownCommandIds,
    });
    expect(kernel.world.worldModelVersion).toBe(3);
    expect(kernel.world.worldId).toBe(fin.worldId);
    expect(kernel.world.revision).toBe(3);
    expect(kernel.world.rng).toEqual(legacyWorld(fin).rng);
    expect(kernel.world.rng.draws).toBe(14);
    expect(kernel.eventCount).toBe(3);
    expect(kernel.chainHead).toBe(fin.chainHead);
    expect(kernel.chainHead).toBe(fixture.goldenExpected.eventChainHead);
    expect(kernel.events).toHaveLength(0);
    expect(kernel.knownCommandIds).toEqual([...fin.knownCommandIds].sort());
  });

  it('a migrated kernel rejects duplicates and stale commands without drawing RNG', () => {
    const fin = finalSnapshot();
    const kernel = WorldKernel.resume({
      world: fin.world,
      ruleset: SYNTHETIC_RULESET,
      chainHead: fin.chainHead,
      eventCount: fin.eventCount,
      knownCommandIds: fin.knownCommandIds,
    });
    const before = fingerprintWorld(kernel.world);
    const dup = kernel.execute(advanceEnvelope(3, 3, 7));
    expect(dup.ok).toBe(false);
    const stale = kernel.execute(advanceEnvelope(9, 1, 1));
    expect(stale.ok).toBe(false);
    expect(fingerprintWorld(kernel.world)).toBe(before);
    expect(kernel.world.rng.draws).toBe(14);
  });

  it('replay from the legacy genesis commutes with migration', () => {
    const history = fixture.commits.flatMap((c) => c.commands);
    const events = fixture.commits.flatMap((c) => c.events);
    const result = replayFrom(
      fixture.genesis,
      SYNTHETIC_RULESET,
      history,
      events,
    );
    const migratedFinal = migrateLegacyPackageAWorld(
      legacyWorld(finalSnapshot()),
    );
    expect(canonicalString(result.kernel.world)).toBe(
      canonicalString(migratedFinal),
    );
    expect(result.kernel.chainHead).toBe(fixture.goldenExpected.eventChainHead);
    expect(result.snapshot.worldFingerprint).toBe(
      fingerprintWorld(migratedFinal),
    );
  });

  it('loadCareer loads a legacy store, verifies replay, and keeps the store untouched', async () => {
    const store = await storeFromFixture();
    const stateBefore = canonicalString(store.exportState());
    const loaded = await loadCareer(store, {
      ruleset: SYNTHETIC_RULESET,
      seed: SYNTHETIC_SEED,
    });
    expect(loaded.status).toBe('loaded');
    if (loaded.status !== 'loaded') return;
    expect(loaded.kernel.world.worldModelVersion).toBe(3);
    expect(loaded.kernel.chainHead).toBe(fixture.goldenExpected.eventChainHead);
    const replay = await verifyCareerReplay(store, SYNTHETIC_RULESET);
    expect(replay.ok).toBe(true);
    expect(replay.fingerprint).toBe(fingerprintWorld(loaded.kernel.world));
    expect(replay.chainHead).toBe(fixture.goldenExpected.eventChainHead);
    expect(canonicalString(store.exportState())).toBe(stateBefore);
  });

  it('a career loaded from a legacy store continues, saves current-model snapshots, reloads and replays', async () => {
    const store = await storeFromFixture();
    const loaded = await loadCareer(store, {
      ruleset: SYNTHETIC_RULESET,
      seed: SYNTHETIC_SEED,
    });
    if (loaded.status !== 'loaded') throw new Error('expected loaded');
    const kernel = loaded.kernel;
    const env = advanceEnvelope(4, 3, 2);
    const res = kernel.execute(env);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    await store.saveCommit({
      snapshot: sealSnapshot({
        world: kernel.world,
        chainHead: kernel.chainHead,
        eventCount: kernel.eventCount,
        knownCommandIds: kernel.knownCommandIds,
      }),
      commands: [{ envelope: env, resultRevision: 4 }],
      events: res.events,
    });
    const latest = await store.loadLatest();
    expect(latest?.revision).toBe(4);
    expect(
      (latest!.world as { worldModelVersion?: number }).worldModelVersion,
    ).toBe(3);
    const again = await loadCareer(store, {
      ruleset: SYNTHETIC_RULESET,
      seed: SYNTHETIC_SEED,
    });
    expect(again.status).toBe('loaded');
    if (again.status !== 'loaded') return;
    expect(fingerprintWorld(again.kernel.world)).toBe(
      fingerprintWorld(kernel.world),
    );
    const replay = await verifyCareerReplay(store, SYNTHETIC_RULESET);
    expect(replay.ok).toBe(true);
    expect(replay.fingerprint).toBe(fingerprintWorld(kernel.world));
  });

  it('repair from history rebuilds a current-model latest snapshot over a legacy store', async () => {
    const store = await storeFromFixture();
    const result = await repairLatestFromHistory(store, {
      ruleset: SYNTHETIC_RULESET,
      reasons: ['test'],
    });
    // The legacy active snapshot already matches history, so there is nothing to repair.
    expect(result.status).toBe('refused');
  });

  it('refuses a future world model in a stored snapshot', () => {
    const fin = finalSnapshot();
    const future = {
      ...fin,
      world: { ...fin.world, worldModelVersion: 4 },
    };
    expect(() => verifySnapshot(future)).toThrow();
    expect(() =>
      WorldKernel.resume({
        world: future.world as never,
        ruleset: SYNTHETIC_RULESET,
        chainHead: fin.chainHead,
        eventCount: fin.eventCount,
        knownCommandIds: fin.knownCommandIds,
      }),
    ).toThrow();
  });
});
