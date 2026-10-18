import { auditAcquisitionWorld } from './acquisitionAudit';
import type { CommandEnvelope } from './audit';
import { canonicalString } from './canonical';
import { auditDevelopmentWorld } from './developmentAudit';
import { requireDevelopmentRules } from './developmentRules';
import { requireTransactionRules } from './economy';
import { auditFootballWorld } from './footballAudit';
import { reconcileFinalGame } from './footballStats';
import {
  fastSimSummary,
  footballReplayFacts,
  gameCastFrames,
} from './gameCast';
import { hashCanonical } from './hash';
import { commandId, entityId, worldId, worldRevision } from './ids';
import { WorldKernel, type RejectionCode } from './kernel';
import {
  sealSnapshot,
  type CareerStore,
  type CommitRecord,
} from './persistence';
import { loadCareer } from './recovery';
import { verifyCareerReplay } from './replay';
import type { RngState } from './rng';
import { createWorld, fingerprintWorld } from './world';
import {
  LIMITED_BACKUP_E,
  LIMITED_CAP_UNITS_E,
  LIMITED_PLAYER_E,
  PACKAGE_E_FIXTURE_ID,
  PACKAGE_E_GAME_DAY,
  PACKAGE_E_SCENARIO_ID,
  PACKAGE_E_SCENARIO_RULESET,
  PACKAGE_E_SCENARIO_SEED,
  PACKAGE_E_STEPS,
  PACKAGE_E_WORLD_ID,
  type PackageEMemo,
  type PackageEScenarioContext,
  type PackageEVariant,
} from './packageEScenario';

export interface PackageEStepResult {
  readonly label: string;
  readonly outcome: 'committed' | RejectionCode;
  readonly revision: number;
  readonly rngDraws: number;
  readonly fingerprint: string;
  readonly chainHead: string;
  readonly stateUnchanged: boolean;
  readonly rngUnchanged: boolean;
}

export interface PackageEGameIdentity {
  readonly id: string;
  readonly fixtureId: string;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly playCount: number;
  readonly ledgerHash: string;
}

export interface PackageEResult {
  readonly scenario: typeof PACKAGE_E_SCENARIO_ID;
  readonly worldId: string;
  readonly finalSimDate: string;
  readonly revision: number;
  readonly eventCount: number;
  readonly rngDraws: number;
  readonly rngState: RngState;
  readonly fingerprint: string;
  readonly eventChainHead: string;
  readonly game: PackageEGameIdentity;
  readonly auditErrorFindings: {
    readonly football: number;
    readonly development: number;
    readonly acquisition: number;
  };
  readonly evidence: {
    readonly gamePlanSnapshotIds: readonly string[];
    readonly activeDesignationOrganizations: readonly string[];
    readonly authorityReceiptIds: readonly string[];
    readonly advanceReachedGameDate: boolean;
    readonly crossingRejectedAtomically: boolean;
    readonly duplicateResolutionRejectedAtomically: boolean;
    readonly playCategories: readonly string[];
    readonly allPlaysHaveTwoCommittedCalls: boolean;
    readonly reconciliationClean: boolean;
    readonly limitedUsage: {
      readonly playerId: string;
      readonly capUnits: number;
      readonly workloadUnits: number;
      readonly backupPlayerId: string;
      readonly backupWorkloadUnits: number;
    };
    readonly footballUsageCheckpointCount: number;
    readonly capabilitiesUnchangedByGameResolution: boolean;
    readonly footballInjuryEpisodeIds: readonly string[];
    readonly postInjuryParticipationCount: number;
    readonly footballObservationClaimIds: readonly string[];
    readonly sundayProofLinkCount: number;
    readonly presentationEquivalent: boolean;
    readonly noTeamStrengthOrControlOracle: boolean;
  };
  readonly keyRecordIds: Readonly<Record<string, string>>;
  readonly steps: readonly PackageEStepResult[];
}

export interface PackageERunOptions {
  readonly variant?: PackageEVariant;
  readonly onCommit?: (record: CommitRecord) => void;
  readonly beforeStep?: (
    index: number,
    kernel: WorldKernel,
  ) => WorldKernel | void;
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const stateOf = (kernel: WorldKernel) => ({
  fingerprint: fingerprintWorld(kernel.world),
  rngDraws: kernel.world.rng.draws,
  chainHead: kernel.chainHead,
  events: kernel.eventCount,
});

export const createPackageEGenesisKernel = (): WorldKernel =>
  WorldKernel.fromGenesis(
    createWorld(PACKAGE_E_SCENARIO_SEED, PACKAGE_E_SCENARIO_RULESET, {
      newWorldId: () => worldId(PACKAGE_E_WORLD_ID),
    }),
    PACKAGE_E_SCENARIO_RULESET,
  );

const gameIdentity = (kernel: WorldKernel): PackageEGameIdentity | null => {
  const game = kernel.world.football.games.find(
    (candidate) => candidate.fixtureId === PACKAGE_E_FIXTURE_ID,
  );
  if (game === undefined) return null;
  const plays = kernel.world.football.plays
    .filter((play) => play.gameId === game.id)
    .sort((a, b) => a.sequence - b.sequence);
  return {
    id: game.id,
    fixtureId: game.fixtureId,
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    playCount: plays.length,
    ledgerHash: hashCanonical({
      domain: 'sport-sim/package-e-accepted-ledger',
      version: 1,
      gameId: game.id,
      plays,
    }),
  };
};

const workloadFor = (kernel: WorldKernel, playerId: string): number =>
  kernel.world.football.plays.reduce(
    (sum, play) =>
      sum +
      play.participation
        .filter((participant) => participant.playerId === playerId)
        .reduce((inner, participant) => inner + participant.workloadUnits, 0),
    0,
  );

const forbiddenOracle = (value: unknown): boolean => {
  const text = canonicalString(value).toLowerCase();
  return [
    'overallrating',
    'overall_rating',
    'teamstrength',
    'team_strength',
    'usercontrolled',
    'user_controlled',
  ].some((key) => text.includes(key));
};

const resultFrom = (
  kernel: WorldKernel,
  memo: PackageEMemo,
  steps: readonly PackageEStepResult[],
): PackageEResult => {
  const world = kernel.world;
  const game = world.football.games.find(
    (candidate) => candidate.fixtureId === PACKAGE_E_FIXTURE_ID,
  );
  if (game === undefined)
    throw new Error('Package E scenario produced no final game');
  const plays = world.football.plays
    .filter((play) => play.gameId === game.id)
    .sort((a, b) => a.sequence - b.sequence);
  const identity = gameIdentity(kernel)!;

  const footballErrors = auditFootballWorld(
    world,
    PACKAGE_E_SCENARIO_RULESET,
  ).filter((finding) => finding.severity === 'error');
  const developmentErrors = auditDevelopmentWorld(
    world,
    requireDevelopmentRules(PACKAGE_E_SCENARIO_RULESET),
  ).filter((finding) => finding.severity === 'error');
  const acquisitionErrors = auditAcquisitionWorld(
    world,
    requireTransactionRules(PACKAGE_E_SCENARIO_RULESET),
  ).filter((finding) => finding.severity === 'error');
  if (footballErrors.length > 0)
    throw new Error(
      `football audit failed: ${footballErrors[0]!.code}: ${footballErrors[0]!.detail}`,
    );
  if (developmentErrors.length > 0)
    throw new Error(
      `development audit failed: ${developmentErrors[0]!.code}: ${developmentErrors[0]!.detail}`,
    );
  if (acquisitionErrors.length > 0)
    throw new Error(
      `acquisition audit failed: ${acquisitionErrors[0]!.code}: ${acquisitionErrors[0]!.detail}`,
    );

  const crossing = steps.find(
    (step) => step.label === 'reject-crossing-unresolved-game',
  );
  const duplicate = steps.find(
    (step) => step.label === 'reject-duplicate-game-resolution',
  );
  const pregameCaps = memo.preGameCapabilities ?? '';
  const finalCaps = JSON.stringify(
    world.roster.players.map((player) => ({
      id: player.personId,
      capabilities: player.capabilities,
    })),
  );
  const footballInjuries = world.medical.episodes.filter(
    (episode) => episode.sourceKind === 'football',
  );
  const firstInjury = footballInjuries[0];
  let postInjuryParticipationCount = 0;
  if (firstInjury !== undefined) {
    const injuryPlay = plays.find((play) =>
      play.medicalEpisodeIds.includes(firstInjury.id),
    );
    if (injuryPlay !== undefined)
      postInjuryParticipationCount = plays
        .filter((play) => play.sequence > injuryPlay.sequence)
        .reduce(
          (sum, play) =>
            sum +
            play.participation.filter(
              (participant) => participant.playerId === firstInjury.playerId,
            ).length,
          0,
        );
  }

  const fast = fastSimSummary(world, game.id);
  const cast = gameCastFrames(world, game.id);
  const replay = footballReplayFacts(world, game.id);
  const presentationEquivalent =
    fast.homeScore === game.homeScore &&
    fast.awayScore === game.awayScore &&
    fast.playCount === game.playIds.length &&
    canonicalString(cast.map((frame) => frame.playId)) ===
      canonicalString(replay.map((play) => play.id)) &&
    canonicalString(replay) === canonicalString(plays);

  const authorityProposalIds = new Set(
    world.decisions.proposals
      .filter((proposal) =>
        [
          'organizational_plan',
          'game_day_activation',
          'scheme',
          'medical_clearance',
        ].includes(proposal.category),
      )
      .map((proposal) => proposal.id),
  );

  return {
    scenario: PACKAGE_E_SCENARIO_ID,
    worldId: world.worldId,
    finalSimDate: world.simDate,
    revision: Number(world.revision),
    eventCount: kernel.eventCount,
    rngDraws: world.rng.draws,
    rngState: { ...world.rng },
    fingerprint: fingerprintWorld(world),
    eventChainHead: kernel.chainHead,
    game: identity,
    auditErrorFindings: {
      football: footballErrors.length,
      development: developmentErrors.length,
      acquisition: acquisitionErrors.length,
    },
    evidence: {
      gamePlanSnapshotIds: [...game.gamePlanSnapshotIds],
      activeDesignationOrganizations: [
        ...new Set(
          world.football.designations
            .filter((designation) => designation.status === 'active')
            .map((designation) => designation.organizationId),
        ),
      ].sort(byText),
      authorityReceiptIds: world.decisions.receipts
        .filter((receipt) => authorityProposalIds.has(receipt.proposalId))
        .map((receipt) => receipt.id)
        .sort(byText),
      advanceReachedGameDate: memo.reachedGameDay === PACKAGE_E_GAME_DAY,
      crossingRejectedAtomically:
        crossing?.outcome === 'INVALID_PAYLOAD' &&
        crossing.stateUnchanged &&
        crossing.rngUnchanged,
      duplicateResolutionRejectedAtomically:
        duplicate?.outcome === 'INVALID_PAYLOAD' &&
        duplicate.stateUnchanged &&
        duplicate.rngUnchanged,
      playCategories: [...new Set(plays.map((play) => play.playCategory))].sort(
        byText,
      ),
      allPlaysHaveTwoCommittedCalls: plays.every(
        (play) =>
          play.offense.conceptKey.length > 0 &&
          play.offense.formationKey.length > 0 &&
          play.offense.personnelKey.length > 0 &&
          play.defense.conceptKey.length > 0 &&
          play.defense.formationKey.length > 0 &&
          play.defense.personnelKey.length > 0,
      ),
      reconciliationClean: reconcileFinalGame(game, plays).length === 0,
      limitedUsage: {
        playerId: LIMITED_PLAYER_E,
        capUnits: LIMITED_CAP_UNITS_E,
        workloadUnits: workloadFor(kernel, LIMITED_PLAYER_E),
        backupPlayerId: LIMITED_BACKUP_E,
        backupWorkloadUnits: workloadFor(kernel, LIMITED_BACKUP_E),
      },
      footballUsageCheckpointCount: world.development.checkpoints.filter(
        (checkpoint) => checkpoint.kind === 'football_usage',
      ).length,
      capabilitiesUnchangedByGameResolution: pregameCaps === finalCaps,
      footballInjuryEpisodeIds: footballInjuries.map((episode) => episode.id),
      postInjuryParticipationCount,
      footballObservationClaimIds: world.information.claims
        .filter((claim) => claim.propositionType.startsWith('football_'))
        .map((claim) => claim.id)
        .sort(byText),
      sundayProofLinkCount: world.football.causalLinks.length,
      presentationEquivalent,
      noTeamStrengthOrControlOracle: !forbiddenOracle(world.football),
    },
    keyRecordIds: {
      nfStrategyProposal: memo.nfStrategyProposal!,
      nfStrategyPlan: memo.nfStrategyPlan!,
      spStrategyProposal: memo.spStrategyProposal!,
      spStrategyPlan: memo.spStrategyPlan!,
      pregameMedicalEpisode: memo.pregameMedicalEpisode!,
      pregameClearanceProposal: memo.pregameClearanceProposal!,
      pregameClearance: memo.pregameClearance!,
      nfActivationProposal: memo.nfActivationProposal!,
      nfGamePlanProposal: memo.nfGamePlanProposal!,
      nfGamePlan: memo.nfGamePlan!,
      spActivationProposal: memo.spActivationProposal!,
      spGamePlanProposal: memo.spGamePlanProposal!,
      spGamePlan: memo.spGamePlan!,
      gameId: memo.gameId!,
    },
    steps,
  };
};

export const executePackageEScenario = (
  options: PackageERunOptions = {},
): { readonly result: PackageEResult; readonly kernel: WorldKernel } => {
  const variant = options.variant ?? 'primary';
  let kernel = createPackageEGenesisKernel();
  const memo: PackageEMemo = {};
  const stepResults: PackageEStepResult[] = [];

  PACKAGE_E_STEPS.forEach((step, index) => {
    kernel = options.beforeStep?.(index, kernel) ?? kernel;
    const context = (): PackageEScenarioContext => ({
      k: kernel,
      variant,
      m: memo,
    });
    step.before?.(context());
    const command =
      typeof step.command === 'function'
        ? step.command(context())
        : step.command;
    const commandNumber = kernel.knownCommandIds.length + 1;
    const envelope = {
      commandId: commandId(`cmd-${String(commandNumber).padStart(6, '0')}`),
      expectedRevision: worldRevision(Number(kernel.world.revision)),
      actor: {
        kind: step.actorKind ?? 'test_harness',
        id: entityId('package-e-harness'),
      },
      command,
    } as unknown as CommandEnvelope;
    const before = stateOf(kernel);
    const execution = kernel.execute(envelope);

    let actualOutcome: 'committed' | RejectionCode;
    if (step.expect === 'committed') {
      if (!execution.ok)
        throw new Error(
          `${step.label} should commit but was rejected: ${execution.rejection.code}: ${execution.rejection.message}`,
        );
      actualOutcome = 'committed';
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
      step.after?.(context());
    } else {
      if (execution.ok)
        throw new Error(
          `${step.label} should reject as ${step.expect} but committed`,
        );
      actualOutcome = execution.rejection.code;
      if (execution.rejection.code !== step.expect)
        throw new Error(
          `${step.label} rejected as ${execution.rejection.code}, expected ${step.expect}: ${execution.rejection.message}`,
        );
    }

    const after = stateOf(kernel);
    stepResults.push({
      label: step.label,
      outcome: actualOutcome,
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

  return { result: resultFrom(kernel, memo, stepResults), kernel };
};

export const runPackageEScenario = (
  options: PackageERunOptions = {},
): PackageEResult => executePackageEScenario(options).result;

export interface PackageEStoreRun {
  readonly result: PackageEResult;
  readonly loadStatus: string;
  readonly replayOk: boolean;
  readonly reloadedFingerprint: string | null;
  readonly reloadedChainHead: string | null;
  readonly reloadedRngState: RngState | null;
  readonly reloadedGameIdentity: PackageEGameIdentity | null;
}

export const runPackageEThroughStore = async (
  store: CareerStore,
): Promise<PackageEStoreRun> => {
  const genesis = createPackageEGenesisKernel();
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
  const executed = executePackageEScenario({
    onCommit: (record) => commits.push(record),
  });
  for (const record of commits) await store.saveCommit(record);
  const loaded = await loadCareer(store, {
    ruleset: PACKAGE_E_SCENARIO_RULESET,
    seed: PACKAGE_E_SCENARIO_SEED,
  });
  const replay = await verifyCareerReplay(store, PACKAGE_E_SCENARIO_RULESET);
  return {
    result: executed.result,
    loadStatus: loaded.status,
    replayOk: replay.ok,
    reloadedFingerprint:
      loaded.status === 'loaded' ? fingerprintWorld(loaded.kernel.world) : null,
    reloadedChainHead:
      loaded.status === 'loaded' ? loaded.kernel.chainHead : null,
    reloadedRngState:
      loaded.status === 'loaded' ? { ...loaded.kernel.world.rng } : null,
    reloadedGameIdentity:
      loaded.status === 'loaded' ? gameIdentity(loaded.kernel) : null,
  };
};

export const diffPackageE = (
  actual: PackageEResult,
  expected: PackageEResult,
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
  for (const key of scalarKeys)
    if (actual[key] !== expected[key])
      diffs.push(`${key}: ${String(actual[key])} != ${String(expected[key])}`);
  for (const key of [
    'rngState',
    'game',
    'auditErrorFindings',
    'evidence',
    'keyRecordIds',
    'steps',
  ] as const)
    if (canonicalString(actual[key]) !== canonicalString(expected[key]))
      diffs.push(`${key} differ`);
  return diffs;
};
