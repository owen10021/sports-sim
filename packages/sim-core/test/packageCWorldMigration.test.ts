import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DOMAIN_STATE_KEYS,
  MemoryCareerStore,
  PACKAGE_C_EXPECTED,
  PACKAGE_C_SEED,
  SYNTHETIC_PACKAGE_C_RULESET,
  WorldKernel,
  canonicalString,
  commandId,
  currentModelFingerprintOf,
  entityId,
  fingerprintLegacyPackageCWorld,
  fingerprintWorld,
  isLegacyPackageCWorld,
  loadCareer,
  migrateLegacyPackageCWorld,
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
  type LegacyPackageCWorld,
} from '../src/index';

/** Immutable: generated from the accepted Package C code before the Package D change. */
const FIXTURE_SHA256 =
  '1cd132df373ccabdf5093079fed48d35ed1854807729edf1c505dffcad44aafe';
const FIXTURE_BYTES = 10233474;
const ACCEPTED_C_FINGERPRINT =
  'bf2e44d0c2609b59d506f90560e4248a5fe97664bb316b968f4f96fe34e055d4';
const ACCEPTED_C_CHAIN_HEAD =
  '3f847dec6c81e179bb285617a9d8ae9eadf7c5e7e6bea2dd0edf2f61e2424e76';

interface CFixture {
  readonly generatedFromCommit: string;
  readonly goldenExpected: {
    readonly fingerprint: string;
    readonly eventChainHead: string;
    readonly rngDraws: number;
    readonly revision: number;
    readonly eventCount: number;
  };
  readonly genesis: CareerSnapshot;
  readonly commits: readonly CommitRecord[];
}

const root = join(__dirname, '..', '..', '..');
const fixturePath = join(
  root,
  'fixtures',
  'legacy',
  'package-c-world-v3-snapshot.json',
);
const bytes = readFileSync(fixturePath);
const fixture = JSON.parse(bytes.toString('utf8')) as CFixture;

const finalSnapshot = (): CareerSnapshot =>
  fixture.commits[fixture.commits.length - 1]!.snapshot;
const modelThree = (s: CareerSnapshot): LegacyPackageCWorld =>
  s.world as LegacyPackageCWorld;

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

describe('the frozen Package C v3 fixture', () => {
  it('matches its recorded SHA-256 and size and the checked-in manifest', () => {
    expect(bytes.length).toBe(FIXTURE_BYTES);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      FIXTURE_SHA256,
    );
    const sums = readFileSync(
      join(root, 'fixtures', 'legacy', 'SHA256SUMS.txt'),
      'utf8',
    );
    expect(sums).toContain(
      `${FIXTURE_SHA256}  package-c-world-v3-snapshot.json`,
    );
  });

  it('is a genuine model-3 career that verifies with model-3 fingerprint semantics', () => {
    expect(fixture.generatedFromCommit).toBe(
      'dd80769755145c6fba8c156ae68ff6cdcf1fe408',
    );
    expect(modelThree(fixture.genesis).worldModelVersion).toBe(3);
    expect(isLegacyPackageCWorld(modelThree(fixture.genesis))).toBe(true);
    expect(verifySnapshot(fixture.genesis)).toEqual({ ok: true });
    for (const c of fixture.commits) {
      expect(verifySnapshot(c.snapshot)).toEqual({ ok: true });
      expect(isLegacyPackageCWorld(modelThree(c.snapshot))).toBe(true);
    }
    const fin = finalSnapshot();
    expect(fingerprintLegacyPackageCWorld(modelThree(fin))).toBe(
      ACCEPTED_C_FINGERPRINT,
    );
    expect(fin.worldFingerprint).toBe(ACCEPTED_C_FINGERPRINT);
    expect(fin.chainHead).toBe(ACCEPTED_C_CHAIN_HEAD);
    expect(fixture.goldenExpected.fingerprint).toBe(ACCEPTED_C_FINGERPRINT);
    expect(fixture.goldenExpected.eventChainHead).toBe(ACCEPTED_C_CHAIN_HEAD);
  });

  it('is not mistaken for a current-model world, and a current world is not legacy C', () => {
    expect(
      worldModelProblems(modelThree(finalSnapshot())).length,
    ).toBeGreaterThan(0);
    const migrated = migrateLegacyPackageCWorld(modelThree(finalSnapshot()));
    expect(isLegacyPackageCWorld(migrated)).toBe(false);
  });
});

describe('Package C accepted history is preserved, not overwritten', () => {
  const read = (...p: string[]) =>
    JSON.parse(readFileSync(join(root, ...p), 'utf8'));

  it('keeps the accepted Package C golden file and evidence equal to the frozen values', () => {
    expect(read('fixtures', 'golden', 'package-c-golden-v1.json')).toEqual(
      fixture.goldenExpected,
    );
    expect(
      read('evidence', 'package-c', 'golden-expected-world-model-v3.json')
        .goldenExpected,
    ).toEqual(fixture.goldenExpected);
  });

  it('gives the current-model Package C golden a new scenario id and fingerprint, same audit chain', () => {
    expect(PACKAGE_C_EXPECTED.scenario).toBe('package-c-golden-v2');
    expect(PACKAGE_C_EXPECTED.fingerprint).not.toBe(ACCEPTED_C_FINGERPRINT);
    expect(PACKAGE_C_EXPECTED.eventChainHead).toBe(ACCEPTED_C_CHAIN_HEAD);
    expect(PACKAGE_C_EXPECTED.rngDraws).toBe(fixture.goldenExpected.rngDraws);
    expect(PACKAGE_C_EXPECTED.revision).toBe(fixture.goldenExpected.revision);
    expect(PACKAGE_C_EXPECTED.eventCount).toBe(
      fixture.goldenExpected.eventCount,
    );
  });
});

describe('migrateLegacyPackageCWorld on the real Package C bytes', () => {
  it('adds empty Package D state and changes nothing else', () => {
    const legacy = modelThree(finalSnapshot());
    const before = canonicalString(legacy);
    const migrated = migrateLegacyPackageCWorld(legacy);
    expect(canonicalString(legacy)).toBe(before);
    expect(worldModelProblems(migrated)).toEqual([]);
    expect(migrated.worldModelVersion).toBe(4);
    expect(migrated.worldId).toBe(legacy.worldId);
    expect(migrated.simDate).toBe(legacy.simDate);
    expect(migrated.revision).toBe(legacy.revision);
    expect(migrated.rng).toEqual(legacy.rng);
    expect(migrated.rng.draws).toBe(fixture.goldenExpected.rngDraws);
    expect(migrated.seed).toEqual(legacy.seed);
    expect(migrated.ruleset).toEqual(legacy.ruleset);
    expect(migrated.entities).toEqual(legacy.entities);
    expect(migrated.nextIds).toEqual(legacy.nextIds);
    const legacyDomains = [
      'people',
      'organizations',
      'authority',
      'information',
      'relationships',
      'plans',
      'decisions',
      'roster',
      'contracts',
      'market',
      'scouting',
      'draft',
    ] as const;
    for (const domain of legacyDomains)
      expect(canonicalString((migrated as never)[domain])).toBe(
        canonicalString((legacy as never)[domain]),
      );
    for (const domain of ['development', 'medical'] as const) {
      const state = (
        migrated as unknown as Record<string, Record<string, unknown>>
      )[domain]!;
      expect(Object.keys(state)).toEqual([...DOMAIN_STATE_KEYS[domain]]);
      for (const c of DOMAIN_STATE_KEYS[domain]) expect(state[c]).toEqual([]);
    }
    expect(Object.isFrozen(migrated)).toBe(true);
  });

  it('is deterministic: repeated migration is byte-identical', () => {
    const legacy = modelThree(finalSnapshot());
    const a = migrateLegacyPackageCWorld(legacy);
    const b = migrateLegacyPackageCWorld(JSON.parse(JSON.stringify(legacy)));
    expect(canonicalString(a)).toBe(canonicalString(b));
    expect(fingerprintWorld(a)).toBe(fingerprintWorld(b));
    expect(currentModelFingerprintOf(legacy)).toBe(fingerprintWorld(a));
    expect(fingerprintWorld(a)).toBe(PACKAGE_C_EXPECTED.fingerprint);
  });

  it('refuses a world that is not a genuine model-3 world', () => {
    const legacy = modelThree(finalSnapshot());
    expect(() =>
      migrateLegacyPackageCWorld({ ...legacy, worldModelVersion: 4 } as never),
    ).toThrow();
    const { draft: _draft, ...incomplete } = legacy;
    expect(() => migrateLegacyPackageCWorld(incomplete as never)).toThrow();
    expect(() =>
      migrateLegacyPackageCWorld({
        ...legacy,
        development: { playerProfiles: [] },
      } as never),
    ).toThrow();
  });
});

describe('resume, load, replay and save all migrate through the same boundary', () => {
  const resume = () => {
    const fin = finalSnapshot();
    return WorldKernel.resume({
      world: fin.world,
      ruleset: SYNTHETIC_PACKAGE_C_RULESET,
      chainHead: fin.chainHead,
      eventCount: fin.eventCount,
      knownCommandIds: fin.knownCommandIds,
    });
  };

  it('WorldKernel.resume migrates without RNG draws, events or identity change', () => {
    const fin = finalSnapshot();
    const kernel = resume();
    expect(kernel.world.worldModelVersion).toBe(4);
    expect(kernel.world.worldId).toBe(fin.worldId);
    expect(kernel.world.revision).toBe(fin.revision);
    expect(kernel.world.rng).toEqual(modelThree(fin).rng);
    expect(kernel.eventCount).toBe(fin.eventCount);
    expect(kernel.chainHead).toBe(ACCEPTED_C_CHAIN_HEAD);
    expect(kernel.events).toHaveLength(0);
    expect(kernel.knownCommandIds).toEqual([...fin.knownCommandIds].sort());
    expect(fingerprintWorld(kernel.world)).toBe(PACKAGE_C_EXPECTED.fingerprint);
  });

  it('a migrated kernel rejects duplicates and stale commands without drawing RNG', () => {
    const kernel = resume();
    const before = fingerprintWorld(kernel.world);
    const draws = kernel.world.rng.draws;
    const rev = Number(kernel.world.revision);
    const env = (n: number, revision: number) =>
      ({
        commandId: commandId(`cmd-${String(n).padStart(6, '0')}`),
        expectedRevision: worldRevision(revision),
        actor: { kind: 'test_harness', id: entityId('package-c-harness') },
        command: { type: 'AdvanceDays', days: 1 },
      }) as unknown as CommandEnvelope;
    expect(kernel.execute(env(1, rev)).ok).toBe(false);
    expect(kernel.execute(env(900, 0)).ok).toBe(false);
    expect(fingerprintWorld(kernel.world)).toBe(before);
    expect(kernel.world.rng.draws).toBe(draws);
  });

  it('replay from the model-3 genesis commutes with migration', () => {
    const history = fixture.commits.flatMap((c) => c.commands);
    const events = fixture.commits.flatMap((c) => c.events);
    const result = replayFrom(
      fixture.genesis,
      SYNTHETIC_PACKAGE_C_RULESET,
      history,
      events,
    );
    const migratedFinal = migrateLegacyPackageCWorld(
      modelThree(finalSnapshot()),
    );
    expect(canonicalString(result.kernel.world)).toBe(
      canonicalString(migratedFinal),
    );
    expect(result.kernel.chainHead).toBe(ACCEPTED_C_CHAIN_HEAD);
    expect(result.snapshot.worldFingerprint).toBe(
      fingerprintWorld(migratedFinal),
    );
  });

  it('loadCareer loads a model-3 store, verifies replay, and keeps the store untouched', async () => {
    const store = await storeFromFixture();
    const stateBefore = canonicalString(store.exportState());
    const loaded = await loadCareer(store, {
      ruleset: SYNTHETIC_PACKAGE_C_RULESET,
      seed: PACKAGE_C_SEED,
    });
    expect(loaded.status).toBe('loaded');
    if (loaded.status !== 'loaded') return;
    expect(loaded.kernel.world.worldModelVersion).toBe(4);
    expect(loaded.kernel.chainHead).toBe(ACCEPTED_C_CHAIN_HEAD);
    const replay = await verifyCareerReplay(store, SYNTHETIC_PACKAGE_C_RULESET);
    expect(replay.ok).toBe(true);
    expect(replay.fingerprint).toBe(fingerprintWorld(loaded.kernel.world));
    expect(replay.chainHead).toBe(ACCEPTED_C_CHAIN_HEAD);
    expect(canonicalString(store.exportState())).toBe(stateBefore);
  }, 10_000);

  it('a career loaded from a model-3 store continues, saves model-4 snapshots, reloads and replays', async () => {
    const store = await storeFromFixture();
    const loaded = await loadCareer(store, {
      ruleset: SYNTHETIC_PACKAGE_C_RULESET,
      seed: PACKAGE_C_SEED,
    });
    if (loaded.status !== 'loaded') throw new Error('expected loaded');
    const kernel = loaded.kernel;
    const n = kernel.knownCommandIds.length + 1;
    const env = {
      commandId: commandId(`cmd-${String(n).padStart(6, '0')}`),
      expectedRevision: kernel.world.revision,
      actor: { kind: 'test_harness', id: entityId('package-c-harness') },
      command: { type: 'AdvanceDays', days: 2 },
    } as unknown as CommandEnvelope;
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
      commands: [{ envelope: env, resultRevision: Number(res.world.revision) }],
      events: res.events,
    });
    const latest = await store.loadLatest();
    expect(
      (latest!.world as { worldModelVersion?: number }).worldModelVersion,
    ).toBe(4);
    const again = await loadCareer(store, {
      ruleset: SYNTHETIC_PACKAGE_C_RULESET,
      seed: PACKAGE_C_SEED,
    });
    expect(again.status).toBe('loaded');
    if (again.status !== 'loaded') return;
    expect(fingerprintWorld(again.kernel.world)).toBe(
      fingerprintWorld(kernel.world),
    );
    const replay = await verifyCareerReplay(store, SYNTHETIC_PACKAGE_C_RULESET);
    expect(replay.ok).toBe(true);
    expect(replay.fingerprint).toBe(fingerprintWorld(kernel.world));
  }, 10_000);

  it('repair from history leaves a healthy model-3 store alone', async () => {
    const store = await storeFromFixture();
    const result = await repairLatestFromHistory(store, {
      ruleset: SYNTHETIC_PACKAGE_C_RULESET,
      reasons: ['test'],
    });
    expect(result.status).toBe('refused');
  });

  it('a tampered legacy-C snapshot fingerprint is rejected, and a future model is refused', () => {
    const fin = finalSnapshot();
    const tampered = {
      ...fin,
      worldFingerprint: PACKAGE_C_EXPECTED.fingerprint,
    };
    const verdict = verifySnapshot(tampered);
    expect(verdict.ok).toBe(false);
    const future = { ...fin, world: { ...fin.world, worldModelVersion: 5 } };
    expect(() => verifySnapshot(future)).toThrow();
    expect(() =>
      WorldKernel.resume({
        world: future.world as never,
        ruleset: SYNTHETIC_PACKAGE_C_RULESET,
        chainHead: fin.chainHead,
        eventCount: fin.eventCount,
        knownCommandIds: fin.knownCommandIds,
      }),
    ).toThrow();
  });
});
