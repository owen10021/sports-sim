import { auditAcquisitionWorld } from './acquisitionAudit';
import type { CommandEnvelope } from './audit';
import { canonicalString } from './canonical';
import { fingerprintWorld, createWorld } from './world';
import { auditDevelopmentWorld } from './developmentAudit';
import { requireDevelopmentRules } from './developmentRules';
import { requireTransactionRules } from './economy';
import { functionalReadiness } from './medical';
import { commandId, entityId, worldId, worldRevision } from './ids';
import { WorldKernel, type RejectionCode } from './kernel';
import { loadCareer } from './recovery';
import { verifyCareerReplay } from './replay';
import type { RngState } from './rng';
import {
  sealSnapshot,
  type CareerStore,
  type CommitRecord,
} from './persistence';
import { SYNTHETIC_PACKAGE_D_RULESET } from './syntheticFixtures';
import {
  MEDICAL_PLAYER,
  PACKAGE_D_SCENARIO_ID,
  PACKAGE_D_SCENARIO_SEED,
  PACKAGE_D_STEPS,
  PackageDScenarioError,
  SCHEME_PLAYER,
  VETERAN_QB,
  YOUNG_QB,
  ZERO_GROWTH_PLAYER,
  type PackageDMemo,
  type PackageDScenarioContext,
  type PackageDVariant,
} from './packageDScenario';

export interface PackageDStepResult {
  readonly label: string;
  readonly outcome: 'committed' | RejectionCode;
  readonly revision: number;
  readonly rngDraws: number;
  readonly fingerprint: string;
  readonly chainHead: string;
  readonly stateUnchanged: boolean;
  readonly rngUnchanged: boolean;
}

export interface PackageDEvidence {
  readonly qbSuccession: {
    readonly veteranPlayerId: string;
    readonly developmentalPlayerId: string;
    readonly veteranFirstTeamUnits: number;
    readonly developmentalFirstTeamUnits: number;
    readonly developmentalDevelopmentUnits: number;
    readonly firstTeamCapacityUnits: number;
  };
  readonly schemeTransition: {
    readonly playerId: string;
    readonly sourceFamiliarityBp: number;
    readonly targetFamiliarityBeforeWorkBp: number;
    readonly targetFamiliarityAfterWorkBp: number;
    readonly capabilityUnchangedAtTransition: boolean;
  };
  readonly roleTransition: {
    readonly playerId: string;
    readonly roleLabelChanged: boolean;
    readonly capabilityUnchangedAtTransition: boolean;
    readonly knowledgeCreatedAtTransition: boolean;
  };
  readonly medical: {
    readonly playerId: string;
    readonly episodeId: string;
    readonly reportCount: number;
    readonly firstUncertainty: string;
    readonly secondUncertainty: string;
    readonly structuralHealingBp: number;
    readonly reinjuryRiskBp: number;
    readonly functionalReadinessBp: number;
    readonly conditioningBp: number;
    readonly preference: string;
    readonly recommendationParticipation: string;
    readonly recommendationMaxLoadUnits: number | null;
    readonly clearanceParticipation: string;
    readonly clearanceMaxLoadUnits: number | null;
    readonly usageUnits: number;
  };
  readonly lateBloomer: {
    readonly playerAId: string;
    readonly playerBId: string;
    readonly initialBeliefParity: boolean;
    readonly playerANetCapabilityDeltaBp: number;
    readonly playerBNetCapabilityDeltaBp: number;
  };
  readonly acquisitionSqueeze: {
    readonly incomingPlayerId: string;
    readonly crowdingBand: string;
    readonly planRevisionBefore: number;
    readonly planRevisionAfter: number;
  };
}

export interface PackageDResult {
  readonly scenario: typeof PACKAGE_D_SCENARIO_ID;
  readonly worldId: string;
  readonly finalSimDate: string;
  readonly revision: number;
  readonly eventCount: number;
  readonly rngDraws: number;
  readonly rngState: RngState;
  readonly fingerprint: string;
  readonly eventChainHead: string;
  readonly auditErrorFindings: {
    readonly acquisition: number;
    readonly development: number;
  };
  readonly evidence: PackageDEvidence;
  readonly zeroGrowthCheckpointIds: readonly string[];
  readonly keyRecordIds: Readonly<Record<string, string>>;
  readonly steps: readonly PackageDStepResult[];
}

const stateOf = (kernel: WorldKernel) => ({
  fingerprint: fingerprintWorld(kernel.world),
  rngDraws: kernel.world.rng.draws,
  chainHead: kernel.chainHead,
  events: kernel.eventCount,
});

export const createPackageDGenesisKernel = (): WorldKernel =>
  WorldKernel.fromGenesis(
    createWorld(PACKAGE_D_SCENARIO_SEED, SYNTHETIC_PACKAGE_D_RULESET, {
      newWorldId: () => worldId('world-package-d-golden-v1'),
    }),
    SYNTHETIC_PACKAGE_D_RULESET,
  );

export interface PackageDRunOptions {
  readonly variant?: PackageDVariant;
  readonly onCommit?: (record: CommitRecord) => void;
  readonly beforeStep?: (
    index: number,
    kernel: WorldKernel,
  ) => WorldKernel | void;
}

const initialCapabilityTotal = (playerId: string): number =>
  PACKAGE_D_SCENARIO_SEED.packageCSubstrate!.players.find(
    (player) => player.personId === playerId,
  )!.capabilities.reduce((sum, capability) => sum + capability.valueBp, 0);

const finalCapabilityTotal = (kernel: WorldKernel, playerId: string): number =>
  kernel.world.roster.players
    .find((player) => player.personId === playerId)!
    .capabilities.reduce((sum, capability) => sum + capability.valueBp, 0);

const subjectBeliefsAtGenesis = (playerId: string): string => {
  const genesis = createPackageDGenesisKernel();
  return JSON.stringify(
    genesis.world.information.beliefs.filter(
      (belief) =>
        belief.subject.kind === 'entity' && belief.subject.id === playerId,
    ),
  );
};

const sumAllocations = (
  kernel: WorldKernel,
  windowId: string,
  playerId: string,
  resourceKey: string,
): number =>
  kernel.world.development.opportunityAllocations
    .filter(
      (allocation) =>
        allocation.windowId === windowId &&
        allocation.playerId === playerId &&
        allocation.resourceKey === resourceKey,
    )
    .reduce((sum, allocation) => sum + allocation.units, 0);

const zeroGrowthCheckpoints = (
  kernel: WorldKernel,
  windowId: string,
): readonly string[] =>
  kernel.world.development.checkpoints
    .filter((checkpoint) => checkpoint.windowId === windowId)
    .filter((checkpoint) => {
      const growth = kernel.world.development.events.filter(
        (event) =>
          event.checkpointId === checkpoint.id &&
          event.playerId === ZERO_GROWTH_PLAYER &&
          (event.kind === 'capability_adaptation' ||
            event.kind === 'role_learning') &&
          event.beforeBp !== null &&
          event.afterBp !== null &&
          event.afterBp > event.beforeBp,
      );
      return growth.length === 0;
    })
    .map((checkpoint) => checkpoint.id);

const resultFrom = (
  kernel: WorldKernel,
  memo: PackageDMemo,
  steps: readonly PackageDStepResult[],
): PackageDResult => {
  const world = kernel.world;
  const tx = requireTransactionRules(SYNTHETIC_PACKAGE_D_RULESET);
  const developmentRules = requireDevelopmentRules(SYNTHETIC_PACKAGE_D_RULESET);
  const acquisitionErrors = auditAcquisitionWorld(world, tx).filter(
    (finding) => finding.severity === 'error',
  );
  const developmentErrors = auditDevelopmentWorld(
    world,
    developmentRules,
  ).filter((finding) => finding.severity === 'error');
  if (acquisitionErrors.length > 0)
    throw new PackageDScenarioError(
      `acquisition audit failed: ${acquisitionErrors[0]!.code}: ${acquisitionErrors[0]!.detail}`,
    );
  if (developmentErrors.length > 0)
    throw new PackageDScenarioError(
      `development audit failed: ${developmentErrors[0]!.code}: ${developmentErrors[0]!.detail}`,
    );

  const successionWindow = world.development.opportunityWindows.find(
    (window) => window.id === memo.successionWindow,
  )!;
  const qbPool = successionWindow.pools.find(
    (pool) =>
      pool.resourceKey === 'first_team_reps' && pool.scopeKey === 'quarterback',
  )!;
  const episodeId = memo.medicalEpisode!;
  const progress = world.medical.progress
    .filter((entry) => entry.episodeId === episodeId)
    .sort((a, b) => (a.assessedAt < b.assessedAt ? -1 : 1))
    .at(-1)!;
  const recommendation = world.medical.recommendations
    .filter((entry) => entry.episodeId === episodeId)
    .at(-1)!;
  const clearance = world.medical.clearances
    .filter((entry) => entry.episodeId === episodeId)
    .at(-1)!;
  const preference = world.medical.preferences
    .filter((entry) => entry.episodeId === episodeId)
    .at(-1)!;
  const readiness = world.development.readiness.find(
    (entry) => entry.playerId === MEDICAL_PLAYER,
  )!;
  const functional = functionalReadiness(world, MEDICAL_PLAYER, 'burst');
  if (functional === undefined)
    throw new PackageDScenarioError(
      'medical player has no functional readiness',
    );

  const youngSeed = PACKAGE_D_SCENARIO_SEED.packageCSubstrate!.players.find(
    (player) => player.personId === YOUNG_QB,
  )!;

  return {
    scenario: PACKAGE_D_SCENARIO_ID,
    worldId: world.worldId,
    finalSimDate: world.simDate,
    revision: Number(world.revision),
    eventCount: kernel.eventCount,
    rngDraws: world.rng.draws,
    rngState: { ...world.rng },
    fingerprint: fingerprintWorld(world),
    eventChainHead: kernel.chainHead,
    auditErrorFindings: {
      acquisition: acquisitionErrors.length,
      development: developmentErrors.length,
    },
    evidence: {
      qbSuccession: {
        veteranPlayerId: VETERAN_QB,
        developmentalPlayerId: YOUNG_QB,
        veteranFirstTeamUnits: sumAllocations(
          kernel,
          memo.successionWindow!,
          VETERAN_QB,
          'first_team_reps',
        ),
        developmentalFirstTeamUnits: sumAllocations(
          kernel,
          memo.successionWindow!,
          YOUNG_QB,
          'first_team_reps',
        ),
        developmentalDevelopmentUnits: sumAllocations(
          kernel,
          memo.successionWindow!,
          YOUNG_QB,
          'development_reps',
        ),
        firstTeamCapacityUnits: qbPool.capacityUnits,
      },
      schemeTransition: {
        playerId: SCHEME_PLAYER,
        sourceFamiliarityBp: Number(memo.lineSourceFamiliarity),
        targetFamiliarityBeforeWorkBp: Number(memo.lineTargetFamiliarityBefore),
        targetFamiliarityAfterWorkBp: Number(
          memo.lineTargetFamiliarityAfterWork,
        ),
        capabilityUnchangedAtTransition:
          memo.lineCapabilitiesBefore === memo.lineCapabilitiesAfterTransition,
      },
      roleTransition: {
        playerId: YOUNG_QB,
        roleLabelChanged: youngSeed.primaryRole !== memo.youngRoleAfter,
        capabilityUnchangedAtTransition:
          memo.youngCapabilitiesBefore ===
          memo.youngCapabilitiesAfterTransition,
        knowledgeCreatedAtTransition:
          memo.youngTargetKnowledgeBefore !==
          memo.youngTargetKnowledgeAfterTransition,
      },
      medical: {
        playerId: MEDICAL_PLAYER,
        episodeId,
        reportCount: world.medical.reports.filter(
          (report) => report.episodeId === episodeId,
        ).length,
        firstUncertainty: memo.firstMedicalUncertainty!,
        secondUncertainty: memo.secondMedicalUncertainty!,
        structuralHealingBp: progress.structuralHealingBp,
        reinjuryRiskBp: progress.reinjuryRiskBp,
        functionalReadinessBp: functional,
        conditioningBp: readiness.conditioningBp,
        preference: preference.preference,
        recommendationParticipation: recommendation.participation,
        recommendationMaxLoadUnits: recommendation.maxLoadUnits,
        clearanceParticipation: clearance.participation,
        clearanceMaxLoadUnits: clearance.maxLoadUnits,
        usageUnits: sumAllocations(
          kernel,
          memo.marchWindow!,
          MEDICAL_PLAYER,
          'first_team_reps',
        ),
      },
      lateBloomer: {
        playerAId: YOUNG_QB,
        playerBId: MEDICAL_PLAYER,
        initialBeliefParity:
          subjectBeliefsAtGenesis(YOUNG_QB) ===
          subjectBeliefsAtGenesis(MEDICAL_PLAYER),
        playerANetCapabilityDeltaBp:
          finalCapabilityTotal(kernel, YOUNG_QB) -
          initialCapabilityTotal(YOUNG_QB),
        playerBNetCapabilityDeltaBp:
          finalCapabilityTotal(kernel, MEDICAL_PLAYER) -
          initialCapabilityTotal(MEDICAL_PLAYER),
      },
      acquisitionSqueeze: {
        incomingPlayerId: VETERAN_QB,
        crowdingBand: memo.squeezeBand!,
        planRevisionBefore: Number(memo.planRevisionBefore),
        planRevisionAfter: Number(memo.planRevisionAfter),
      },
    },
    zeroGrowthCheckpointIds: zeroGrowthCheckpoints(kernel, memo.zeroWindow!),
    keyRecordIds: { ...memo },
    steps,
  };
};

export const runPackageDScenario = (
  options: PackageDRunOptions = {},
): PackageDResult => {
  const variant = options.variant ?? 'primary';
  let kernel = createPackageDGenesisKernel();
  const memo: PackageDMemo = {};
  const stepResults: PackageDStepResult[] = [];

  PACKAGE_D_STEPS.forEach((spec, index) => {
    kernel = options.beforeStep?.(index, kernel) ?? kernel;
    const context = (): PackageDScenarioContext => ({
      k: kernel,
      variant,
      m: memo,
    });
    spec.before?.(context());
    const command =
      typeof spec.command === 'function'
        ? spec.command(context())
        : spec.command;
    const nextCommandNumber = kernel.knownCommandIds.length + 1;
    const envelope = {
      commandId: commandId(`cmd-${String(nextCommandNumber).padStart(6, '0')}`),
      expectedRevision: worldRevision(
        spec.staleRevision === true ? 0 : Number(kernel.world.revision),
      ),
      actor: {
        kind: spec.actorKind ?? 'test_harness',
        id: entityId('package-d-harness'),
      },
      command,
    } as unknown as CommandEnvelope;
    const before = stateOf(kernel);
    const execution = kernel.execute(envelope);

    if (spec.expect === 'committed') {
      if (!execution.ok)
        throw new PackageDScenarioError(
          `${spec.label} should commit but was rejected: ${execution.rejection.code}: ${execution.rejection.message}`,
        );
      options.onCommit?.({
        snapshot: sealSnapshot({
          world: kernel.world,
          chainHead: kernel.chainHead,
          eventCount: kernel.eventCount,
          knownCommandIds: kernel.knownCommandIds,
        }),
        commands: [
          { envelope, resultRevision: Number(execution.world.revision) },
        ],
        events: execution.events,
      });
      spec.after?.(context());
    } else {
      if (execution.ok)
        throw new PackageDScenarioError(
          `${spec.label} should reject as ${spec.expect} but committed`,
        );
      if (execution.rejection.code !== spec.expect)
        throw new PackageDScenarioError(
          `${spec.label} rejected as ${execution.rejection.code}, expected ${spec.expect}: ${execution.rejection.message}`,
        );
    }

    const after = stateOf(kernel);
    stepResults.push({
      label: spec.label,
      outcome: spec.expect,
      revision: Number(kernel.world.revision),
      rngDraws: kernel.world.rng.draws,
      fingerprint: after.fingerprint,
      chainHead: after.chainHead,
      stateUnchanged:
        after.fingerprint === before.fingerprint &&
        after.chainHead === before.chainHead &&
        after.events === before.events,
      rngUnchanged: after.rngDraws === before.rngDraws,
    });
  });

  return resultFrom(kernel, memo, stepResults);
};

export interface PackageDStoreRun {
  readonly result: PackageDResult;
  readonly loadStatus: string;
  readonly replayOk: boolean;
  readonly reloadedFingerprint: string | null;
  readonly reloadedChainHead: string | null;
  readonly reloadedRngState: RngState | null;
}

export const runPackageDThroughStore = async (
  store: CareerStore,
): Promise<PackageDStoreRun> => {
  const genesis = createPackageDGenesisKernel();
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
  const result = runPackageDScenario({
    onCommit: (record) => commits.push(record),
  });
  for (const record of commits) await store.saveCommit(record);
  const loaded = await loadCareer(store, {
    ruleset: SYNTHETIC_PACKAGE_D_RULESET,
    seed: PACKAGE_D_SCENARIO_SEED,
  });
  const replay = await verifyCareerReplay(store, SYNTHETIC_PACKAGE_D_RULESET);
  return {
    result,
    loadStatus: loaded.status,
    replayOk: replay.ok,
    reloadedFingerprint:
      loaded.status === 'loaded' ? fingerprintWorld(loaded.kernel.world) : null,
    reloadedChainHead:
      loaded.status === 'loaded' ? loaded.kernel.chainHead : null,
    reloadedRngState:
      loaded.status === 'loaded' ? { ...loaded.kernel.world.rng } : null,
  };
};
export const diffPackageD = (
  actual: PackageDResult,
  expected: PackageDResult,
): string[] => {
  const diffs: string[] = [];
  const scalarKeys = [
    'scenario',
    'worldId',
    'finalSimDate',
    'revision',
    'eventCount',
    'rngDraws',
    'fingerprint',
    'eventChainHead',
  ] as const;
  scalarKeys.forEach((key) => {
    if (actual[key] !== expected[key])
      diffs.push(`${key}: ${String(actual[key])} != ${String(expected[key])}`);
  });
  const structuredKeys = [
    'rngState',
    'auditErrorFindings',
    'evidence',
    'zeroGrowthCheckpointIds',
    'keyRecordIds',
    'steps',
  ] as const;
  structuredKeys.forEach((key) => {
    if (canonicalString(actual[key]) !== canonicalString(expected[key]))
      diffs.push(`${key} differ`);
  });
  return diffs;
};
