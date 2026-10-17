import type { CommandEnvelope } from './audit';
import { commandId, entityId, worldId, worldRevision, type ActorRef } from './ids';
import { WorldKernel, type RejectionCode } from './kernel';
import { loadCareer } from './recovery';
import { verifyCareerReplay } from './replay';
import { sealSnapshot, type CareerStore, type CommitRecord } from './persistence';
import { SYNTHETIC_RULESET, SYNTHETIC_SEED } from './syntheticFixtures';
import { createWorld, fingerprintWorld } from './world';

/**
 * The Package A golden scenario. It is defined ONCE, here, in pure sim-core, so Node (the
 * headless runner and Vitest) and the Expo/Hermes app run literally the same code on the
 * same inputs. Matching outputs across runtimes is the cross-runtime determinism proof.
 *
 * It mixes accepted commands with rejected ones (duplicate, stale, invalid, unauthorized)
 * and checks that every rejection leaves the world, the RNG and the audit chain untouched.
 */
export const GOLDEN_SCENARIO_ID = 'package-a-golden-v1';
export const GOLDEN_WORLD_ID = 'world-golden-1';

const harness: ActorRef = { kind: 'test_harness', id: entityId('golden-harness') };
const cpu: ActorRef = { kind: 'cpu_org', id: entityId('golden-cpu') };

const envelope = (n: number, days: number, revision: number, actor: ActorRef = harness): CommandEnvelope =>
  ({
    commandId: commandId(`cmd-${String(n).padStart(6, '0')}`),
    expectedRevision: worldRevision(revision),
    actor,
    command: { type: 'AdvanceDays', days },
  }) as unknown as CommandEnvelope;

interface GoldenStepSpec {
  readonly label: string;
  readonly expect: 'committed' | RejectionCode;
  build(kernel: WorldKernel): CommandEnvelope;
}

const rev = (k: WorldKernel): number => Number(k.world.revision);

export const GOLDEN_STEPS: readonly GoldenStepSpec[] = [
  { label: 'advance-1', expect: 'committed', build: (k) => envelope(1, 1, rev(k)) },
  { label: 'advance-6', expect: 'committed', build: (k) => envelope(2, 6, rev(k)) },
  { label: 'duplicate-command', expect: 'DUPLICATE_COMMAND', build: (k) => envelope(2, 6, rev(k)) },
  { label: 'stale-revision', expect: 'STALE_REVISION', build: () => envelope(3, 1, 0) },
  { label: 'invalid-days', expect: 'INVALID_PAYLOAD', build: (k) => envelope(3, 0, rev(k)) },
  { label: 'unauthorized-actor', expect: 'UNAUTHORIZED_ACTOR', build: (k) => envelope(3, 1, rev(k), cpu) },
  { label: 'advance-7', expect: 'committed', build: (k) => envelope(3, 7, rev(k)) },
];

export interface GoldenStepResult {
  readonly label: string;
  readonly outcome: 'committed' | RejectionCode;
  readonly revision: number;
  readonly rngDraws: number;
  readonly fingerprint: string;
  readonly chainHead: string;
}

export interface GoldenResult {
  readonly scenario: typeof GOLDEN_SCENARIO_ID;
  readonly worldId: string;
  readonly finalSimDate: string;
  readonly revision: number;
  readonly eventCount: number;
  readonly rngDraws: number;
  readonly commandDays: readonly number[];
  /** SHA-256 fingerprint of the entire final authoritative world. */
  readonly fingerprint: string;
  /** Audit-chain head after the last committed event. */
  readonly eventChainHead: string;
  readonly steps: readonly GoldenStepResult[];
}

export class GoldenScenarioError extends Error {
  constructor(message: string) {
    super(`Golden scenario violated: ${message}`);
    this.name = 'GoldenScenarioError';
  }
}

const stateOf = (k: WorldKernel) => ({
  fingerprint: fingerprintWorld(k.world),
  rngDraws: k.world.rng.draws,
  chainHead: k.chainHead,
  events: k.eventCount,
});

/** Run the scenario on a fresh kernel. `onCommit` receives each committed commit record. */
export const runGoldenScenario = (onCommit?: (record: CommitRecord) => void): GoldenResult => {
  const world = createWorld(SYNTHETIC_SEED, SYNTHETIC_RULESET, { newWorldId: () => worldId(GOLDEN_WORLD_ID) });
  const kernel = WorldKernel.fromGenesis(world, SYNTHETIC_RULESET);
  const steps: GoldenStepResult[] = [];
  const commandDays: number[] = [];
  for (const spec of GOLDEN_STEPS) {
    const env = spec.build(kernel);
    const before = stateOf(kernel);
    const result = kernel.execute(env);
    if (spec.expect === 'committed') {
      if (!result.ok) throw new GoldenScenarioError(`${spec.label} should commit but was rejected: ${result.rejection.code}`);
      commandDays.push((env.command as unknown as { days: number }).days);
      onCommit?.({
        snapshot: sealSnapshot({
          world: kernel.world,
          chainHead: kernel.chainHead,
          eventCount: kernel.eventCount,
          knownCommandIds: kernel.knownCommandIds,
        }),
        commands: [{ envelope: env, resultRevision: Number(result.world.revision) }],
        events: result.events,
      });
    } else {
      if (result.ok) throw new GoldenScenarioError(`${spec.label} should be rejected as ${spec.expect} but committed`);
      if (result.rejection.code !== spec.expect) {
        throw new GoldenScenarioError(`${spec.label} rejected as ${result.rejection.code}, expected ${spec.expect}`);
      }
      const after = stateOf(kernel);
      if (after.fingerprint !== before.fingerprint || after.rngDraws !== before.rngDraws || after.chainHead !== before.chainHead) {
        throw new GoldenScenarioError(`${spec.label} changed state or consumed randomness`);
      }
    }
    steps.push({
      label: spec.label,
      outcome: spec.expect,
      revision: Number(kernel.world.revision),
      rngDraws: kernel.world.rng.draws,
      fingerprint: fingerprintWorld(kernel.world),
      chainHead: kernel.chainHead,
    });
  }
  return {
    scenario: GOLDEN_SCENARIO_ID,
    worldId: kernel.world.worldId,
    finalSimDate: kernel.world.simDate,
    revision: Number(kernel.world.revision),
    eventCount: kernel.eventCount,
    rngDraws: kernel.world.rng.draws,
    commandDays,
    fingerprint: fingerprintWorld(kernel.world),
    eventChainHead: kernel.chainHead,
    steps,
  };
};

export interface GoldenStoreRun {
  readonly result: GoldenResult;
  readonly loadStatus: string;
  readonly replayOk: boolean;
  /** Fingerprint of the world loaded back from the store (null if it did not load cleanly). */
  readonly reloadedFingerprint: string | null;
  readonly reloadedChainHead: string | null;
}

/**
 * Run the golden scenario, persist every commit through `store`, reload the career from the
 * store and replay the stored history. Used to prove storage + reload + replay agree with
 * the kernel inside each runtime.
 */
export const runGoldenThroughStore = async (store: CareerStore): Promise<GoldenStoreRun> => {
  const world = createWorld(SYNTHETIC_SEED, SYNTHETIC_RULESET, { newWorldId: () => worldId(GOLDEN_WORLD_ID) });
  const genesisKernel = WorldKernel.fromGenesis(world, SYNTHETIC_RULESET);
  await store.initialize();
  await store.saveCommit({
    snapshot: sealSnapshot({
      world: genesisKernel.world,
      chainHead: genesisKernel.chainHead,
      eventCount: 0,
      knownCommandIds: [],
    }),
    commands: [],
    events: [],
  });
  const commits: CommitRecord[] = [];
  const result = runGoldenScenario((record) => commits.push(record));
  for (const record of commits) await store.saveCommit(record);
  const loaded = await loadCareer(store, { ruleset: SYNTHETIC_RULESET, seed: SYNTHETIC_SEED });
  const replay = await verifyCareerReplay(store, SYNTHETIC_RULESET);
  return {
    result,
    loadStatus: loaded.status,
    replayOk: replay.ok,
    reloadedFingerprint: loaded.status === 'loaded' ? fingerprintWorld(loaded.kernel.world) : null,
    reloadedChainHead: loaded.status === 'loaded' ? loaded.kernel.chainHead : null,
  };
};

/** Compare a run against recorded expectations; returns human-readable differences. */
export const diffGolden = (actual: GoldenResult, expected: GoldenResult): string[] => {
  const diffs: string[] = [];
  const keys = ['scenario', 'worldId', 'finalSimDate', 'revision', 'eventCount', 'rngDraws', 'fingerprint', 'eventChainHead'] as const;
  for (const k of keys) if (actual[k] !== expected[k]) diffs.push(`${k}: ${String(actual[k])} != ${String(expected[k])}`);
  if (JSON.stringify(actual.commandDays) !== JSON.stringify(expected.commandDays)) diffs.push('commandDays differ');
  if (JSON.stringify(actual.steps) !== JSON.stringify(expected.steps)) diffs.push('per-step results differ');
  return diffs;
};
