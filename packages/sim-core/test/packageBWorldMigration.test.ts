import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DOMAIN_STATE_KEYS,
  MemoryCareerStore,
  ORG_SUBSTRATE_SEED,
  PACKAGE_B_DOMAIN_STATE_KEYS,
  PACKAGE_B_EXPECTED,
  SYNTHETIC_RULESET,
  WorldKernel,
  canonicalString,
  commandId,
  currentModelFingerprintOf,
  entityId,
  fingerprintLegacyPackageBWorld,
  fingerprintWorld,
  isLegacyPackageBWorld,
  loadCareer,
  migrateLegacyPackageBWorld,
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
  type LegacyPackageBWorld,
} from '../src/index';

/** Immutable: generated from the accepted Package B code before the Package C change. */
const FIXTURE_SHA256 =
  '68a6bbc87cecc252a6695be284bf0ba0796a3d383388c561d3f5dd5352b86d84';
const FIXTURE_BYTES = 542740;
const ACCEPTED_B_FINGERPRINT =
  'fc1163b8df89db98d951a6393341986c72992853eea4198bb678c941a36c064c';
const ACCEPTED_B_CHAIN_HEAD =
  '934b6d86fe79af00c6de40da67e64e1b4bdb7039701c7c45af1598a61ed4f9d0';

interface BFixture {
  readonly generatedFromCommit: string;
  readonly goldenExpected: {
    readonly fingerprint: string;
    readonly eventChainHead: string;
    readonly rngDraws: number;
    readonly revision: number;
    readonly eventCount: number;
    readonly steps: readonly { label: string; fingerprint: string }[];
  };
  readonly genesis: CareerSnapshot;
  readonly commits: readonly CommitRecord[];
}

const root = join(__dirname, '..', '..', '..');
const fixturePath = join(
  root,
  'fixtures',
  'legacy',
  'package-b-world-v2-snapshot.json',
);
const bytes = readFileSync(fixturePath);
const fixture = JSON.parse(bytes.toString('utf8')) as BFixture;

const finalSnapshot = (): CareerSnapshot =>
  fixture.commits[fixture.commits.length - 1]!.snapshot;
const modelTwo = (s: CareerSnapshot): LegacyPackageBWorld =>
  s.world as LegacyPackageBWorld;

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

describe('the frozen Package B v2 fixture', () => {
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
      `${FIXTURE_SHA256}  package-b-world-v2-snapshot.json`,
    );
  });

  it('is a genuine model-2 career that verifies with model-2 fingerprint semantics', () => {
    expect(fixture.generatedFromCommit).toBe(
      'd6fe95e73b7bf7916be3949f8c8a1deea595480e',
    );
    expect(modelTwo(fixture.genesis).worldModelVersion).toBe(2);
    expect(isLegacyPackageBWorld(modelTwo(fixture.genesis))).toBe(true);
    expect(verifySnapshot(fixture.genesis)).toEqual({ ok: true });
    for (const c of fixture.commits) {
      expect(verifySnapshot(c.snapshot)).toEqual({ ok: true });
      expect(isLegacyPackageBWorld(modelTwo(c.snapshot))).toBe(true);
    }
    const fin = finalSnapshot();
    expect(fingerprintLegacyPackageBWorld(modelTwo(fin))).toBe(
      ACCEPTED_B_FINGERPRINT,
    );
    expect(fin.worldFingerprint).toBe(ACCEPTED_B_FINGERPRINT);
    expect(fin.chainHead).toBe(ACCEPTED_B_CHAIN_HEAD);
    expect(fixture.goldenExpected.fingerprint).toBe(ACCEPTED_B_FINGERPRINT);
    expect(fixture.goldenExpected.eventChainHead).toBe(ACCEPTED_B_CHAIN_HEAD);
  });
});

describe('Package B accepted history is preserved, not overwritten', () => {
  const read = (...p: string[]) =>
    JSON.parse(readFileSync(join(root, ...p), 'utf8'));

  it('keeps the accepted Package B golden file and evidence equal to the frozen values', () => {
    expect(read('fixtures', 'golden', 'package-b-golden-v1.json')).toEqual(
      fixture.goldenExpected,
    );
    expect(
      read('evidence', 'package-b', 'golden-expected-world-model-v2.json')
        .goldenExpected,
    ).toEqual(fixture.goldenExpected);
  });

  it('gives the current-model Package B golden a new scenario id and fingerprint, same audit chain', () => {
    expect(PACKAGE_B_EXPECTED.scenario).toBe('package-b-golden-v4');
    expect(PACKAGE_B_EXPECTED.fingerprint).not.toBe(ACCEPTED_B_FINGERPRINT);
    expect(PACKAGE_B_EXPECTED.eventChainHead).toBe(ACCEPTED_B_CHAIN_HEAD);
    expect(PACKAGE_B_EXPECTED.rngDraws).toBe(fixture.goldenExpected.rngDraws);
    expect(PACKAGE_B_EXPECTED.revision).toBe(fixture.goldenExpected.revision);
  });
});

describe('migrateLegacyPackageBWorld on the real Package B bytes', () => {
  it('adds empty Package C state and changes nothing else', () => {
    const legacy = modelTwo(finalSnapshot());
    const before = canonicalString(legacy);
    const migrated = migrateLegacyPackageBWorld(legacy);
    expect(canonicalString(legacy)).toBe(before);
    expect(worldModelProblems(migrated)).toEqual([]);
    expect(migrated.worldModelVersion).toBe(5);
    expect(migrated.worldId).toBe(legacy.worldId);
    expect(migrated.simDate).toBe(legacy.simDate);
    expect(migrated.revision).toBe(legacy.revision);
    expect(migrated.rng).toEqual(legacy.rng);
    expect(migrated.rng.draws).toBe(fixture.goldenExpected.rngDraws);
    expect(migrated.seed).toEqual(legacy.seed);
    expect(migrated.ruleset).toEqual(legacy.ruleset);
    expect(migrated.entities).toEqual(legacy.entities);
    expect(migrated.nextIds).toEqual(legacy.nextIds);
    for (const domain of Object.keys(PACKAGE_B_DOMAIN_STATE_KEYS))
      expect(canonicalString((migrated as never)[domain])).toBe(
        canonicalString((legacy as never)[domain]),
      );
    for (const [domain, collections] of Object.entries(DOMAIN_STATE_KEYS)) {
      if (domain in PACKAGE_B_DOMAIN_STATE_KEYS) continue;
      const state = (
        migrated as unknown as Record<string, Record<string, unknown>>
      )[domain]!;
      for (const c of collections) expect(state[c]).toEqual([]);
    }
    expect(Object.isFrozen(migrated)).toBe(true);
  });

  it('is deterministic: repeated migration is byte-identical', () => {
    const legacy = modelTwo(finalSnapshot());
    const a = migrateLegacyPackageBWorld(legacy);
    const b = migrateLegacyPackageBWorld(JSON.parse(JSON.stringify(legacy)));
    expect(canonicalString(a)).toBe(canonicalString(b));
    expect(fingerprintWorld(a)).toBe(fingerprintWorld(b));
    expect(currentModelFingerprintOf(legacy)).toBe(fingerprintWorld(a));
    expect(fingerprintWorld(a)).toBe(PACKAGE_B_EXPECTED.fingerprint);
  });

  it('refuses a world that is not a genuine model-2 world', () => {
    expect(() =>
      migrateLegacyPackageBWorld({
        ...modelTwo(finalSnapshot()),
        worldModelVersion: 3,
      } as never),
    ).toThrow();
  });
});

describe('resume, load, replay and save all migrate through the same boundary', () => {
  const resume = () => {
    const fin = finalSnapshot();
    return WorldKernel.resume({
      world: fin.world,
      ruleset: SYNTHETIC_RULESET,
      chainHead: fin.chainHead,
      eventCount: fin.eventCount,
      knownCommandIds: fin.knownCommandIds,
    });
  };

  it('WorldKernel.resume migrates without RNG draws, events or identity change', () => {
    const fin = finalSnapshot();
    const kernel = resume();
    expect(kernel.world.worldModelVersion).toBe(5);
    expect(kernel.world.worldId).toBe(fin.worldId);
    expect(kernel.world.revision).toBe(fin.revision);
    expect(kernel.world.rng).toEqual(modelTwo(fin).rng);
    expect(kernel.eventCount).toBe(fin.eventCount);
    expect(kernel.chainHead).toBe(ACCEPTED_B_CHAIN_HEAD);
    expect(kernel.events).toHaveLength(0);
    expect(kernel.knownCommandIds).toEqual([...fin.knownCommandIds].sort());
    expect(fingerprintWorld(kernel.world)).toBe(PACKAGE_B_EXPECTED.fingerprint);
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
        actor: { kind: 'test_harness', id: entityId('package-b-harness') },
        command: { type: 'AdvanceDays', days: 1 },
      }) as unknown as CommandEnvelope;
    expect(kernel.execute(env(1, rev)).ok).toBe(false);
    expect(kernel.execute(env(900, 0)).ok).toBe(false);
    expect(fingerprintWorld(kernel.world)).toBe(before);
    expect(kernel.world.rng.draws).toBe(draws);
  });

  it('replay from the model-2 genesis commutes with migration', () => {
    const history = fixture.commits.flatMap((c) => c.commands);
    const events = fixture.commits.flatMap((c) => c.events);
    const result = replayFrom(
      fixture.genesis,
      SYNTHETIC_RULESET,
      history,
      events,
    );
    const migratedFinal = migrateLegacyPackageBWorld(modelTwo(finalSnapshot()));
    expect(canonicalString(result.kernel.world)).toBe(
      canonicalString(migratedFinal),
    );
    expect(result.kernel.chainHead).toBe(ACCEPTED_B_CHAIN_HEAD);
    expect(result.snapshot.worldFingerprint).toBe(
      fingerprintWorld(migratedFinal),
    );
  });

  it('loadCareer loads a model-2 store, verifies replay, and keeps the store untouched', async () => {
    const store = await storeFromFixture();
    const stateBefore = canonicalString(store.exportState());
    const loaded = await loadCareer(store, {
      ruleset: SYNTHETIC_RULESET,
      seed: ORG_SUBSTRATE_SEED,
    });
    expect(loaded.status).toBe('loaded');
    if (loaded.status !== 'loaded') return;
    expect(loaded.kernel.world.worldModelVersion).toBe(5);
    expect(loaded.kernel.chainHead).toBe(ACCEPTED_B_CHAIN_HEAD);
    const replay = await verifyCareerReplay(store, SYNTHETIC_RULESET);
    expect(replay.ok).toBe(true);
    expect(replay.fingerprint).toBe(fingerprintWorld(loaded.kernel.world));
    expect(replay.chainHead).toBe(ACCEPTED_B_CHAIN_HEAD);
    expect(canonicalString(store.exportState())).toBe(stateBefore);
  });

  it('a career loaded from a model-2 store continues, saves model-3 snapshots, reloads and replays', async () => {
    const store = await storeFromFixture();
    const loaded = await loadCareer(store, {
      ruleset: SYNTHETIC_RULESET,
      seed: ORG_SUBSTRATE_SEED,
    });
    if (loaded.status !== 'loaded') throw new Error('expected loaded');
    const kernel = loaded.kernel;
    const n = kernel.knownCommandIds.length + 1;
    const env = {
      commandId: commandId(`cmd-${String(n).padStart(6, '0')}`),
      expectedRevision: kernel.world.revision,
      actor: { kind: 'test_harness', id: entityId('package-b-harness') },
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
    ).toBe(5);
    const again = await loadCareer(store, {
      ruleset: SYNTHETIC_RULESET,
      seed: ORG_SUBSTRATE_SEED,
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

  it('repair from history leaves a healthy model-2 store alone', async () => {
    const store = await storeFromFixture();
    const result = await repairLatestFromHistory(store, {
      ruleset: SYNTHETIC_RULESET,
      reasons: ['test'],
    });
    expect(result.status).toBe('refused');
  });

  it('refuses a future world model in a stored snapshot', () => {
    const fin = finalSnapshot();
    const future = { ...fin, world: { ...fin.world, worldModelVersion: 6 } };
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
