import { auditAcquisitionWorld } from './acquisitionAudit';
import type { CommandEnvelope } from './audit';
import { capPosition } from './contractMath';
import { commandId, entityId, worldId, worldRevision } from './ids';
import { WorldKernel, type RejectionCode } from './kernel';
import { PACKAGE_C_WORLD_ID } from './packageCScenario';
import { PACKAGE_C_SEED } from './packageCWorldSeed';
import { loadCareer } from './recovery';
import { verifyCareerReplay } from './replay';
import { activeRightsFor, rosterCapacity } from './roster';
import {
  sealSnapshot,
  type CareerStore,
  type CommitRecord,
} from './persistence';
import { SYNTHETIC_PACKAGE_C_RULESET } from './syntheticFixtures';
import { createWorld, fingerprintWorld } from './world';
import {
  NF,
  SP,
  EB,
  WL,
  PACKAGE_C_SCENARIO_ID,
  PACKAGE_C_STEPS,
  PackageCScenarioError,
  harness,
  tx,
  type Context,
  type Memo,
  type PackageCVariant,
} from './packageCScenario';

export interface PackageCStepResult {
  readonly label: string;
  readonly outcome: 'committed' | RejectionCode;
  readonly revision: number;
  readonly rngDraws: number;
  readonly fingerprint: string;
  readonly chainHead: string;
}

export interface PackageCOrgSummary {
  readonly organizationId: string;
  readonly committed2027: number;
  readonly committed2028: number;
  readonly active: number;
  readonly reserve: number;
  readonly practiceSquad: number;
  readonly picksOwned: number;
}

export interface PackageCResult {
  readonly scenario: typeof PACKAGE_C_SCENARIO_ID;
  readonly worldId: string;
  readonly finalSimDate: string;
  readonly revision: number;
  readonly eventCount: number;
  readonly rngDraws: number;
  readonly fingerprint: string;
  readonly eventChainHead: string;
  /** Cap and roster summaries per organization at the end. */
  readonly organizations: readonly PackageCOrgSummary[];
  /** Cap figures captured at named moments (signing, extension, release). */
  readonly capCheckpoints: Readonly<Record<string, number>>;
  /** Final holder of each player right in the draft class and of every 2027 pick. */
  readonly assetOwnership: Readonly<Record<string, string>>;
  readonly auditErrorFindings: number;
  /** Stable ids of the records the scenario creates, for human inspection. */
  readonly keyRecordIds: Readonly<Record<string, string>>;
  readonly steps: readonly PackageCStepResult[];
}

const stateOf = (k: WorldKernel) => ({
  fingerprint: fingerprintWorld(k.world),
  rngDraws: k.world.rng.draws,
  chainHead: k.chainHead,
  events: k.eventCount,
});

export const createPackageCGenesisKernel = (): WorldKernel =>
  WorldKernel.fromGenesis(
    createWorld(PACKAGE_C_SEED, SYNTHETIC_PACKAGE_C_RULESET, {
      newWorldId: () => worldId(PACKAGE_C_WORLD_ID),
    }),
    SYNTHETIC_PACKAGE_C_RULESET,
  );

export interface PackageCRunOptions {
  readonly variant?: PackageCVariant;
  readonly onCommit?: (record: CommitRecord) => void;
  /** Called before each step; may return a replacement kernel (e.g. one reloaded from storage). */
  readonly beforeStep?: (
    index: number,
    kernel: WorldKernel,
  ) => WorldKernel | void;
}

export const runPackageCScenario = (
  options: PackageCRunOptions = {},
): PackageCResult => {
  const variant = options.variant ?? 'primary';
  let kernel = createPackageCGenesisKernel();
  const memo: Memo = {};
  const steps_: PackageCStepResult[] = [];
  PACKAGE_C_STEPS.forEach((spec, index) => {
    kernel = options.beforeStep?.(index, kernel) ?? kernel;
    const ctx = (): Context => ({ k: kernel, m: memo, variant });
    spec.before?.(ctx());
    const known = kernel.knownCommandIds;
    const n = spec.duplicate === true ? known.length : known.length + 1;
    const envelope = {
      commandId: commandId(`cmd-${String(n).padStart(6, '0')}`),
      expectedRevision: worldRevision(
        spec.staleRevision === true ? 0 : Number(kernel.world.revision),
      ),
      actor: harness,
      command: spec.command(ctx()),
    } as unknown as CommandEnvelope;
    const before = stateOf(kernel);
    const result = kernel.execute(envelope);
    if (spec.expect === 'committed') {
      if (!result.ok)
        throw new PackageCScenarioError(
          `${spec.label} should commit but was rejected: ${result.rejection.code}: ${result.rejection.message}`,
        );
      options.onCommit?.({
        snapshot: sealSnapshot({
          world: kernel.world,
          chainHead: kernel.chainHead,
          eventCount: kernel.eventCount,
          knownCommandIds: kernel.knownCommandIds,
        }),
        commands: [{ envelope, resultRevision: Number(result.world.revision) }],
        events: result.events,
      });
      spec.after?.(ctx());
    } else {
      if (result.ok)
        throw new PackageCScenarioError(
          `${spec.label} should be rejected as ${spec.expect} but committed`,
        );
      if (result.rejection.code !== spec.expect)
        throw new PackageCScenarioError(
          `${spec.label} rejected as ${result.rejection.code}, expected ${spec.expect}: ${result.rejection.message}`,
        );
      const after = stateOf(kernel);
      if (
        after.fingerprint !== before.fingerprint ||
        after.rngDraws !== before.rngDraws ||
        after.chainHead !== before.chainHead ||
        after.events !== before.events
      )
        throw new PackageCScenarioError(
          `${spec.label} changed state or consumed randomness`,
        );
    }
    steps_.push({
      label: spec.label,
      outcome: spec.expect,
      revision: Number(kernel.world.revision),
      rngDraws: kernel.world.rng.draws,
      fingerprint: fingerprintWorld(kernel.world),
      chainHead: kernel.chainHead,
    });
  });
  const w = kernel.world;
  const findings = auditAcquisitionWorld(w, tx).filter(
    (f) => f.severity === 'error',
  );
  if (findings.length > 0)
    throw new PackageCScenarioError(
      `the final audit has ${findings.length} error finding(s): ${findings[0]!.code}: ${findings[0]!.detail}`,
    );
  const summaries = [NF, SP, EB, WL].map((o): PackageCOrgSummary => {
    const cap = rosterCapacity(w.roster, tx, entityId(o.org), w.simDate);
    return {
      organizationId: o.org,
      committed2027: capPosition(tx, w.contracts, entityId(o.org), 2027)
        .committed,
      committed2028: capPosition(tx, w.contracts, entityId(o.org), 2028)
        .committed,
      active: cap.active.count,
      reserve: cap.reserve.count,
      practiceSquad: cap.practice_squad.count,
      picksOwned: w.draft.picks.filter(
        (p) => p.ownerOrganizationId === o.org && p.status === 'available',
      ).length,
    };
  });
  const ownership: Record<string, string> = {};
  for (const p of w.draft.picks.filter((x) => x.season === 2027))
    ownership[p.id] = `${p.ownerOrganizationId}:${p.status}`;
  for (const id of w.draft.classes[0]!.eligiblePlayerIds) {
    const r = activeRightsFor(w.roster, id, w.simDate)[0];
    ownership[id] =
      r === undefined ? 'unattached' : `${r.holderOrganizationId}:${r.kind}`;
  }
  return {
    scenario: PACKAGE_C_SCENARIO_ID,
    worldId: w.worldId,
    finalSimDate: w.simDate,
    revision: Number(w.revision),
    eventCount: kernel.eventCount,
    rngDraws: w.rng.draws,
    fingerprint: fingerprintWorld(w),
    eventChainHead: kernel.chainHead,
    organizations: summaries,
    capCheckpoints: Object.fromEntries(
      Object.entries(memo)
        .filter(([k]) => k.startsWith('cap:'))
        .map(([k, v]) => [k.slice(4), Number(v)]),
    ),
    assetOwnership: ownership,
    auditErrorFindings: findings.length,
    keyRecordIds: Object.fromEntries(
      Object.entries(memo).filter(([k]) => !k.startsWith('cap:')),
    ),
    steps: steps_,
  };
};

export interface PackageCStoreRun {
  readonly result: PackageCResult;
  readonly loadStatus: string;
  readonly replayOk: boolean;
  readonly reloadedFingerprint: string | null;
  readonly reloadedChainHead: string | null;
}

/** Run the scenario, persist every commit, reload from the store and replay stored history. */
export const runPackageCThroughStore = async (
  store: CareerStore,
): Promise<PackageCStoreRun> => {
  const genesis = createPackageCGenesisKernel();
  await store.initialize();
  await store.saveCommit({
    snapshot: sealSnapshot({
      world: genesis.world,
      chainHead: genesis.chainHead,
      eventCount: 0,
      knownCommandIds: [],
    }),
    commands: [],
    events: [],
  });
  const commits: CommitRecord[] = [];
  const result = runPackageCScenario({ onCommit: (r) => commits.push(r) });
  for (const record of commits) await store.saveCommit(record);
  const loaded = await loadCareer(store, {
    ruleset: SYNTHETIC_PACKAGE_C_RULESET,
    seed: PACKAGE_C_SEED,
  });
  const replay = await verifyCareerReplay(store, SYNTHETIC_PACKAGE_C_RULESET);
  return {
    result,
    loadStatus: loaded.status,
    replayOk: replay.ok,
    reloadedFingerprint:
      loaded.status === 'loaded' ? fingerprintWorld(loaded.kernel.world) : null,
    reloadedChainHead:
      loaded.status === 'loaded' ? loaded.kernel.chainHead : null,
  };
};

/** Compare a run against recorded expectations; returns human-readable differences. */
export const diffPackageC = (
  actual: PackageCResult,
  expected: PackageCResult,
): string[] => {
  const diffs: string[] = [];
  const keys = [
    'scenario',
    'worldId',
    'finalSimDate',
    'revision',
    'eventCount',
    'rngDraws',
    'fingerprint',
    'eventChainHead',
    'auditErrorFindings',
  ] as const;
  for (const k of keys)
    if (actual[k] !== expected[k])
      diffs.push(`${k}: ${String(actual[k])} != ${String(expected[k])}`);
  for (const k of [
    'organizations',
    'capCheckpoints',
    'assetOwnership',
    'keyRecordIds',
    'steps',
  ] as const)
    if (JSON.stringify(actual[k]) !== JSON.stringify(expected[k]))
      diffs.push(`${k} differ`);
  return diffs;
};
