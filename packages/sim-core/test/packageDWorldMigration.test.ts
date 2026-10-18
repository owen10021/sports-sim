import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MemoryCareerStore,
  PACKAGE_D_SCENARIO_SEED,
  SYNTHETIC_PACKAGE_D_RULESET,
  WorldKernel,
  canonicalString,
  fingerprintLegacyPackageDWorld,
  fingerprintWorld,
  isLegacyPackageDWorld,
  loadCareer,
  migrateLegacyPackageDWorld,
  verifyCareerReplay,
  verifySnapshot,
  type CareerSnapshot,
  type CommitRecord,
  type LegacyPackageDWorld,
} from '../src/index';

const FIXTURE_SHA256 =
  '8c7a96f497a097736def54cd9c8de117ce0ebc5571559095e4845f88208809df';
const FIXTURE_BYTES = 20607643;
const ACCEPTED_D_FINGERPRINT =
  '30406fda343b9d8f4c25d560b12033a8bb27eb11de58cb8d5ce14989a2da3849';
const ACCEPTED_D_CHAIN_HEAD =
  'e692b2516edefdaf1475e212cfe90b0d671d0cd77353fbba476afc443215e483';
interface DFixture {
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
  'package-d-world-v4-snapshot.json',
);
const bytes = readFileSync(fixturePath);
const fixture = JSON.parse(bytes.toString('utf8')) as DFixture;
const finalSnapshot = () => fixture.commits.at(-1)!.snapshot;
const modelFour = (s: CareerSnapshot) => s.world as LegacyPackageDWorld;
const storeFromFixture = async () => {
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

describe('frozen Package D v4 career', () => {
  it('is immutable accepted evidence with model-4 fingerprint semantics', () => {
    expect(bytes.length).toBe(FIXTURE_BYTES);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      FIXTURE_SHA256,
    );
    expect(fixture.generatedFromCommit).toBe(
      'cc29f6ebb0c912a3d69d52a67aee8635e703d299',
    );
    expect(fixture.goldenExpected.fingerprint).toBe(ACCEPTED_D_FINGERPRINT);
    expect(fixture.goldenExpected.eventChainHead).toBe(ACCEPTED_D_CHAIN_HEAD);
    expect(fixture.commits).toHaveLength(41);
    const final = finalSnapshot();
    expect(isLegacyPackageDWorld(final.world)).toBe(true);
    expect(verifySnapshot(final)).toEqual({ ok: true });
    expect(fingerprintLegacyPackageDWorld(modelFour(final))).toBe(
      ACCEPTED_D_FINGERPRINT,
    );
  });

  it('migrates model 4 to model 5 by adding only empty football and preserving identity', () => {
    const before = modelFour(finalSnapshot());
    const migrated = migrateLegacyPackageDWorld(before);
    expect(migrated.worldModelVersion).toBe(5);
    expect(migrated.football).toEqual({
      fixtures: [],
      designations: [],
      gamePlans: [],
      games: [],
      plays: [],
      causalLinks: [],
    });
    expect(migrated.worldId).toBe(before.worldId);
    expect(migrated.simDate).toBe(before.simDate);
    expect(migrated.revision).toBe(before.revision);
    expect(migrated.rng).toEqual(before.rng);
    expect(migrated.nextIds).toEqual(before.nextIds);
    const projected = JSON.parse(canonicalString(migrated));
    delete projected.football;
    projected.worldModelVersion = 4;
    expect(projected).toEqual(JSON.parse(canonicalString(before)));
  });

  it('WorldKernel.resume migrates without changing chain/event/RNG identity', () => {
    const final = finalSnapshot();
    const kernel = WorldKernel.resume({
      world: modelFour(final),
      ruleset: SYNTHETIC_PACKAGE_D_RULESET,
      chainHead: final.chainHead,
      eventCount: final.eventCount,
      knownCommandIds: final.knownCommandIds,
    });
    expect(kernel.world.worldModelVersion).toBe(5);
    expect(kernel.chainHead).toBe(ACCEPTED_D_CHAIN_HEAD);
    expect(kernel.eventCount).toBe(125);
    expect(kernel.world.rng.draws).toBe(82);
  });

  it('loadCareer and replay accept the legacy-D store without rewriting it', async () => {
    const store = await storeFromFixture();
    const before = canonicalString(store.exportState());
    const loaded = await loadCareer(store, {
      ruleset: SYNTHETIC_PACKAGE_D_RULESET,
      seed: PACKAGE_D_SCENARIO_SEED,
    });
    expect(loaded.status).toBe('loaded');
    if (loaded.status !== 'loaded') return;
    expect(loaded.kernel.world.worldModelVersion).toBe(5);
    expect(loaded.kernel.chainHead).toBe(ACCEPTED_D_CHAIN_HEAD);
    const replay = await verifyCareerReplay(store, SYNTHETIC_PACKAGE_D_RULESET);
    expect(replay.ok).toBe(true);
    expect(replay.fingerprint).toBe(fingerprintWorld(loaded.kernel.world));
    expect(replay.chainHead).toBe(ACCEPTED_D_CHAIN_HEAD);
    expect(canonicalString(store.exportState())).toBe(before);
  }, 20_000);
});
