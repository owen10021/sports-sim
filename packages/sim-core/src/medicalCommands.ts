import type { CommandPayloadBase } from './audit';
import { effectiveRightsAt } from './authority';
import type { EventSpec, RouteContext, RouteOutcome } from './commandRouter';
import {
  bad,
  byId,
  denied,
  hasKind,
  isFailure,
  mintRecordId,
  mintRecordIds,
  parseDate,
  parseOrganization,
  spec,
  type Cmd,
  type Failure,
} from './commandSupport';
import { requireDevelopmentRules } from './developmentRules';
import { entityId, isValidId } from './ids';
import type { BeliefRecord, ClaimRecord, ConfidenceBand } from './information';
import {
  MEDICAL_EPISODE_SOURCE_KINDS,
  latestMedicalProgress,
  type MedicalEpisode,
  type MedicalEpisodeSourceKind,
  type MedicalLimitation,
  type MedicalProgressRecord,
  type MedicalReport,
} from './medical';
import { DeterministicRng } from './rng';
import { SimDate } from './simDate';
import type { FootballWorld } from './world';

export const MEDICAL_COMMAND_TYPES = [
  'CreateMedicalEpisode',
  'ReassessMedicalEpisode',
] as const;
export type MedicalCommandType = (typeof MEDICAL_COMMAND_TYPES)[number];

const SIMULATION_ACTORS: ReadonlySet<string> = new Set([
  'system',
  'commissioner',
  'test_harness',
]);

const clampBp = (value: number): number =>
  Math.max(0, Math.min(10000, Math.floor(value)));
const mulBp = (value: number, factorBp: number): number =>
  Math.floor((value * factorBp) / 10000);
const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export interface CreateMedicalEpisodeInput {
  readonly playerId: string;
  readonly conditionKey: string;
  readonly onsetAt: string;
  readonly sourceKind: MedicalEpisodeSourceKind;
  readonly affectedActionKeys: readonly string[];
  readonly initialStructuralSeverityBp: number;
  readonly recoveryResponsivenessBp: number;
  readonly baselineReinjuryRiskBp: number;
}

export class MedicalResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MedicalResolutionError';
  }
}

const fail = (message: string): never => {
  throw new MedicalResolutionError(message);
};

const validBp = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= 10000;

const validateEpisodeInput = (
  world: FootballWorld,
  input: CreateMedicalEpisodeInput,
): void => {
  if (
    !isValidId(input.playerId) ||
    !world.roster.players.some((p) => p.personId === input.playerId)
  )
    return fail('playerId must name an existing player');
  if (!isValidId(input.conditionKey)) return fail('conditionKey must be valid');
  if (!SimDate.isValidISO(input.onsetAt) || input.onsetAt !== world.simDate)
    return fail('onsetAt must equal the current logical simulation date');
  if (
    !(MEDICAL_EPISODE_SOURCE_KINDS as readonly unknown[]).includes(
      input.sourceKind,
    )
  )
    return fail('sourceKind is not recognized');
  if (
    !Array.isArray(input.affectedActionKeys) ||
    input.affectedActionKeys.length === 0 ||
    !input.affectedActionKeys.every((key) => isValidId(key)) ||
    new Set(input.affectedActionKeys).size !== input.affectedActionKeys.length
  )
    return fail('affectedActionKeys must contain unique valid action keys');
  if (!validBp(input.initialStructuralSeverityBp))
    return fail(
      'initialStructuralSeverityBp must be an integer basis point value',
    );
  if (!validBp(input.recoveryResponsivenessBp))
    return fail(
      'recoveryResponsivenessBp must be an integer basis point value',
    );
  if (!validBp(input.baselineReinjuryRiskBp))
    return fail('baselineReinjuryRiskBp must be an integer basis point value');
};

/**
 * Pure Package E-facing medical ingress. It creates authoritative D episode truth but
 * commits nothing; a caller can compose the returned world/event specs into one kernel
 * resolution. No football injury is generated here and no return date is invented.
 */
export const createMedicalEpisodeChange = (
  world: FootballWorld,
  input: CreateMedicalEpisodeInput,
): {
  readonly nextWorld: FootballWorld;
  readonly eventSpecs: readonly EventSpec[];
} => {
  validateEpisodeInput(world, input);
  const minted = mintRecordId(world);
  const episode: MedicalEpisode = {
    id: minted.id,
    playerId: entityId(input.playerId),
    conditionKey: input.conditionKey,
    onsetAt: input.onsetAt,
    sourceKind: input.sourceKind,
    affectedActionKeys: [...input.affectedActionKeys].sort(byText),
    initialStructuralSeverityBp: input.initialStructuralSeverityBp,
    recoveryResponsivenessBp: input.recoveryResponsivenessBp,
    baselineReinjuryRiskBp: input.baselineReinjuryRiskBp,
    status: 'open',
  };
  return {
    nextWorld: {
      ...world,
      medical: {
        ...world.medical,
        episodes: [...world.medical.episodes, episode].sort(byId),
      },
      nextIds: { ...world.nextIds, record: minted.next },
    },
    eventSpecs: [
      spec('MedicalEpisodeCreated', {
        episodeId: episode.id,
        playerId: episode.playerId,
        conditionKey: episode.conditionKey,
        sourceKind: episode.sourceKind,
        affectedActionKeys: [...episode.affectedActionKeys],
      }),
    ],
  };
};

const parseCreateInput = (
  ctx: RouteContext,
  c: Cmd,
): CreateMedicalEpisodeInput | Failure => {
  if (
    !isValidId(c.playerId) ||
    !ctx.world.roster.players.some((p) => p.personId === c.playerId)
  )
    return bad('playerId must name an existing player');
  if (!isValidId(c.conditionKey)) return bad('conditionKey must be valid');
  const onsetAt = parseDate(c.onsetAt, 'onsetAt');
  if (isFailure(onsetAt)) return onsetAt;
  if (onsetAt !== ctx.world.simDate)
    return bad('onsetAt must equal the current logical simulation date');
  if (
    !(MEDICAL_EPISODE_SOURCE_KINDS as readonly unknown[]).includes(c.sourceKind)
  )
    return bad('sourceKind is not recognized');
  if (
    !Array.isArray(c.affectedActionKeys) ||
    c.affectedActionKeys.length === 0 ||
    !c.affectedActionKeys.every(
      (key) => typeof key === 'string' && isValidId(key),
    ) ||
    new Set(c.affectedActionKeys).size !== c.affectedActionKeys.length
  )
    return bad('affectedActionKeys must contain unique valid action keys');
  if (!validBp(c.initialStructuralSeverityBp))
    return bad(
      'initialStructuralSeverityBp must be an integer basis point value',
    );
  if (!validBp(c.recoveryResponsivenessBp))
    return bad('recoveryResponsivenessBp must be an integer basis point value');
  if (!validBp(c.baselineReinjuryRiskBp))
    return bad('baselineReinjuryRiskBp must be an integer basis point value');
  return {
    playerId: c.playerId,
    conditionKey: c.conditionKey,
    onsetAt,
    sourceKind: c.sourceKind as MedicalEpisodeSourceKind,
    affectedActionKeys: c.affectedActionKeys as string[],
    initialStructuralSeverityBp: c.initialStructuralSeverityBp,
    recoveryResponsivenessBp: c.recoveryResponsivenessBp,
    baselineReinjuryRiskBp: c.baselineReinjuryRiskBp,
  };
};

const routeCreateEpisode = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  if (!SIMULATION_ACTORS.has(ctx.actor.kind))
    return {
      ok: false,
      stage: 'authorization',
      code: 'UNAUTHORIZED_ACTOR',
      message: `${ctx.actor.kind} cannot create medical episodes`,
    };
  const input = parseCreateInput(ctx, c);
  if (isFailure(input)) return input;
  const change = createMedicalEpisodeChange(ctx.world, input);
  return {
    ok: true,
    authorizationDetail: 'simulation-owned external medical episode ingress',
    resolution: {
      nextWorld: change.nextWorld,
      eventSpecs: change.eventSpecs,
      detail: 'created medical episode',
    },
  };
};

type UncertaintyBand = 'broad' | 'moderate' | 'narrow';
type StructuralFinding =
  | 'early_recovery'
  | 'recovery_in_progress'
  | 'substantial_progress'
  | 'near_healed';
type RiskFinding = 'high' | 'elevated' | 'moderate' | 'low';
type LimitationFinding = 'substantial' | 'moderate' | 'mild' | 'minimal';

const uncertaintyFor = (priorReportCount: number): UncertaintyBand =>
  priorReportCount === 0
    ? 'broad'
    : priorReportCount === 1
      ? 'moderate'
      : 'narrow';

const confidenceFor = (uncertainty: UncertaintyBand): ConfidenceBand =>
  uncertainty === 'broad'
    ? 'low'
    : uncertainty === 'moderate'
      ? 'medium'
      : 'high';

const observationAmplitude = (uncertainty: UncertaintyBand): number =>
  uncertainty === 'broad' ? 1200 : uncertainty === 'moderate' ? 600 : 300;

const noisy = (value: number, roll: number, amplitude: number): number => {
  const width = amplitude * 2 + 1;
  return clampBp(value + (roll % width) - amplitude);
};

const structuralFinding = (value: number): StructuralFinding =>
  value < 2500
    ? 'early_recovery'
    : value < 6000
      ? 'recovery_in_progress'
      : value < 8500
        ? 'substantial_progress'
        : 'near_healed';
const riskFinding = (value: number): RiskFinding =>
  value >= 7500
    ? 'high'
    : value >= 5000
      ? 'elevated'
      : value >= 2500
        ? 'moderate'
        : 'low';
const limitationFinding = (value: number): LimitationFinding =>
  value >= 6500
    ? 'substantial'
    : value >= 3500
      ? 'moderate'
      : value >= 1000
        ? 'mild'
        : 'minimal';

const outlookFor = (
  structural: StructuralFinding,
  risk: RiskFinding,
  limitation: LimitationFinding,
): string => {
  if (risk === 'high' || limitation === 'substantial') return 'guarded';
  if (
    structural === 'near_healed' &&
    risk === 'low' &&
    limitation === 'minimal'
  )
    return 'favorable_but_uncertain';
  return 'improving_but_uncertain';
};

const routeReassess = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  if (!SIMULATION_ACTORS.has(ctx.actor.kind))
    return {
      ok: false,
      stage: 'authorization',
      code: 'UNAUTHORIZED_ACTOR',
      message: `${ctx.actor.kind} cannot resolve medical reassessments`,
    };
  if (!isValidId(c.episodeId)) return bad('episodeId must be valid');
  const episode = ctx.world.medical.episodes.find((e) => e.id === c.episodeId);
  if (episode === undefined)
    return bad('episodeId must name a medical episode');
  if (episode.status !== 'open')
    return bad('medical episode is already resolved');
  const organizationId = parseOrganization(ctx, c.organizationId);
  if (isFailure(organizationId)) return organizationId;
  if (
    !isValidId(c.evaluatorPersonId) ||
    !hasKind(ctx.world, c.evaluatorPersonId, 'person')
  )
    return bad('evaluatorPersonId must name an existing person');
  const evaluatorPersonId = entityId(c.evaluatorPersonId);
  if (
    !effectiveRightsAt(
      ctx.world,
      organizationId,
      evaluatorPersonId,
      'medical_clearance',
      ctx.world.simDate,
    ).rights.includes('advise')
  )
    return denied(
      `${evaluatorPersonId} lacks advise on medical_clearance in ${organizationId}`,
    );

  const prior = latestMedicalProgress(ctx.world.medical, episode.id);
  const priorDate = prior?.assessedAt ?? episode.onsetAt;
  const elapsedDays = SimDate.parse(ctx.world.simDate).daysSince(
    SimDate.parse(priorDate),
  );
  if (elapsedDays <= 0)
    return bad(
      'medical episode has already been assessed at this logical state',
    );

  const rules = requireDevelopmentRules(ctx.ruleset);
  const minted = mintRecordIds(ctx.world, 4);
  const [progressId, claimId, beliefId, reportId] = minted.ids;
  if (!progressId || !claimId || !beliefId || !reportId)
    throw new Error('medical reassessment id allocation failed');

  const rng = DeterministicRng.fromState(ctx.world.rng);
  const rngDrawStart = rng.snapshot().draws;
  const recoveryRoll = rng.nextU32();
  const observationRoll = rng.nextU32();

  const priorHealing =
    prior?.structuralHealingBp ?? 10000 - episode.initialStructuralSeverityBp;
  const priorRisk = prior?.reinjuryRiskBp ?? episode.baselineReinjuryRiskBp;
  const priorLimitations: readonly MedicalLimitation[] =
    prior?.limitations ??
    episode.affectedActionKeys.map((actionKey) => ({
      actionKey,
      severityBp: episode.initialStructuralSeverityBp,
    }));
  const readiness = ctx.world.development.readiness.find(
    (r) => r.playerId === episode.playerId,
  );
  const fatigueBp = clampBp(readiness?.acuteFatigueBp ?? 0);
  const cadenceRecovery = Math.floor(
    (rules.medicalRecoveryScaleBp * elapsedDays) / rules.checkpointCadenceDays,
  );
  const responseAdjusted = mulBp(
    cadenceRecovery,
    episode.recoveryResponsivenessBp,
  );
  const fatigueAdjusted = mulBp(
    responseAdjusted,
    10000 - Math.floor(fatigueBp / 2),
  );
  const randomFactorBp = 8500 + (recoveryRoll % 3001);
  const healingGain = mulBp(fatigueAdjusted, randomFactorBp);
  const nextHealing = clampBp(priorHealing + healingGain);
  const limitationDrop = Math.floor((healingGain * 3) / 4);
  const limitations = priorLimitations
    .map((l) => ({
      actionKey: l.actionKey,
      severityBp: clampBp(l.severityBp - limitationDrop),
    }))
    .sort((a, b) => byText(a.actionKey, b.actionKey));
  const riskDrop = Math.floor(healingGain / 3);
  const workloadRisk = Math.floor(fatigueBp / 20);
  const nextRisk = clampBp(priorRisk - riskDrop + workloadRisk);
  const maxLimitation = limitations.reduce(
    (max, limitation) => Math.max(max, limitation.severityBp),
    0,
  );
  const resolved =
    nextHealing === 10000 && nextRisk <= 1000 && maxLimitation === 0;

  const progress: MedicalProgressRecord = {
    id: progressId,
    episodeId: episode.id,
    assessedAt: ctx.world.simDate,
    structuralHealingBp: nextHealing,
    reinjuryRiskBp: nextRisk,
    limitations,
    rngDrawStart,
    rngDrawCount: rng.snapshot().draws - rngDrawStart,
  };

  const priorReports = ctx.world.medical.reports
    .filter(
      (r) => r.episodeId === episode.id && r.organizationId === organizationId,
    )
    .sort(byId);
  const uncertainty = uncertaintyFor(priorReports.length);
  const amplitude = observationAmplitude(uncertainty);
  const observedHealing = noisy(nextHealing, observationRoll, amplitude);
  const rotatedRoll =
    ((observationRoll >>> 11) | (observationRoll << 21)) >>> 0;
  const observedRisk = noisy(nextRisk, rotatedRoll, amplitude);
  const observedLimitation = noisy(
    maxLimitation,
    (observationRoll ^ 0x9e3779b9) >>> 0,
    Math.floor(amplitude / 2),
  );
  const structural = structuralFinding(observedHealing);
  const risk = riskFinding(observedRisk);
  const limitation = limitationFinding(observedLimitation);
  const confidence = confidenceFor(uncertainty);

  const claim: ClaimRecord = {
    id: claimId,
    subject: { kind: 'entity', id: episode.playerId },
    propositionType: 'medical_recheck_observation',
    proposition: {
      episodeId: episode.id,
      conditionKey: episode.conditionKey,
      structuralFinding: structural,
      riskFinding: risk,
      limitationFinding: limitation,
      uncertainty,
      affectedActionKeys: [...episode.affectedActionKeys],
    },
    sourcePersonId: evaluatorPersonId,
    sourceFamilyId: `medical-${episode.id}`,
    observedAt: ctx.world.simDate,
    acquiredAt: ctx.world.simDate,
    visibility: 'organization',
    holderOrganizationIds: [organizationId],
    confidence,
    possibleBias: null,
    corroboratesClaimIds: [],
    contradictsClaimIds: [],
    sharedFromClaimId: null,
  };
  const priorBeliefId = priorReports.at(-1)?.beliefId ?? null;
  const belief: BeliefRecord = {
    id: beliefId,
    organizationId,
    authorPersonId: evaluatorPersonId,
    subject: { kind: 'entity', id: episode.playerId },
    assessmentType: 'medical_status',
    assessment: {
      episodeId: episode.id,
      structuralFinding: structural,
      riskFinding: risk,
      limitationFinding: limitation,
      outlook: outlookFor(structural, risk, limitation),
      uncertainty,
    },
    confidence,
    evidenceClaimIds: [claim.id],
    formedAt: ctx.world.simDate,
    supersedesBeliefId: priorBeliefId,
  };
  const report: MedicalReport = {
    id: reportId,
    episodeId: episode.id,
    organizationId,
    evaluatorPersonId,
    evidenceClaimIds: [claim.id],
    beliefId: belief.id,
    formedAt: ctx.world.simDate,
  };
  const episodes = ctx.world.medical.episodes.map((e) =>
    e.id === episode.id && resolved ? { ...e, status: 'resolved' as const } : e,
  );

  return {
    ok: true,
    authorizationDetail: `${evaluatorPersonId} may advise on medical_clearance in ${organizationId}`,
    resolution: {
      nextWorld: {
        ...ctx.world,
        rng: rng.snapshot(),
        medical: {
          ...ctx.world.medical,
          episodes: episodes.sort(byId),
          progress: [...ctx.world.medical.progress, progress].sort(byId),
          reports: [...ctx.world.medical.reports, report].sort(byId),
        },
        information: {
          ...ctx.world.information,
          claims: [...ctx.world.information.claims, claim].sort(byId),
          beliefs: [...ctx.world.information.beliefs, belief].sort(byId),
        },
        nextIds: { ...ctx.world.nextIds, record: minted.next },
      },
      eventSpecs: [
        spec('MedicalEpisodeReassessed', {
          episodeId: episode.id,
          playerId: episode.playerId,
          organizationId,
          evaluatorPersonId,
          progressId: progress.id,
          reportId: report.id,
          evidenceClaimIds: [claim.id],
          beliefId: belief.id,
        }),
      ],
      detail: `reassessed medical episode ${episode.id}`,
    },
  };
};

export const routeMedicalCommand = (
  ctx: RouteContext,
  command: CommandPayloadBase & { readonly type: MedicalCommandType },
): RouteOutcome => {
  const c = command as Cmd;
  switch (command.type) {
    case 'CreateMedicalEpisode':
      return routeCreateEpisode(ctx, c);
    case 'ReassessMedicalEpisode':
      return routeReassess(ctx, c);
    default: {
      const unreachable: never = command.type;
      throw new Error(`unroutable medical command: ${String(unreachable)}`);
    }
  }
};
