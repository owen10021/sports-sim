import type { CanonicalValue, CommandPayloadBase } from './audit';
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
  parseActingPerson,
  parseDate,
  parseOrganization,
  isPlainObject,
  spec,
  type Cmd,
  type Failure,
} from './commandSupport';
import { requireDevelopmentRules } from './developmentRules';
import { latestProposal } from './decisions';
import { entityId, isValidId, recordId, type RecordId } from './ids';
import type { BeliefRecord, ClaimRecord, ConfidenceBand } from './information';
import { findVisibleClaim, isBeliefVisibleTo } from './knowledgeView';
import {
  MEDICAL_CLEARANCE_TERMS_TYPE,
  MEDICAL_PARTICIPATION_LEVELS,
  PARTICIPATION_PREFERENCES,
  latestMedicalClearance,
  MEDICAL_EPISODE_SOURCE_KINDS,
  latestMedicalProgress,
  type MedicalEpisode,
  type MedicalClearanceRecord,
  type MedicalEpisodeSourceKind,
  type MedicalLimitation,
  type MedicalProgressRecord,
  type MedicalReport,
  type MedicalRecommendationRecord,
  type ParticipationPreferenceRecord,
} from './medical';
import { DeterministicRng } from './rng';
import { SimDate } from './simDate';
import { commitAuthorizedDomainChange } from './transactionCommit';
import type { FootballWorld } from './world';

export const MEDICAL_COMMAND_TYPES = [
  'CreateMedicalEpisode',
  'ReassessMedicalEpisode',
  'RecordParticipationPreference',
  'RecordMedicalRecommendation',
  'CommitMedicalClearanceProposal',
] as const;
export type MedicalCommandType = (typeof MEDICAL_COMMAND_TYPES)[number];

const SIMULATION_ACTORS: ReadonlySet<string> = new Set([
  'system',
  'commissioner',
  'test_harness',
]);
const PREFERENCE_INPUT_ACTORS: ReadonlySet<string> = new Set([
  'system',
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

const parseRecordIds = (
  value: unknown,
  name: string,
): readonly RecordId[] | Failure => {
  if (
    !Array.isArray(value) ||
    !value.every((id) => typeof id === 'string' && isValidId(id)) ||
    new Set(value).size !== value.length
  )
    return bad(`${name} must contain unique valid ids`);
  return (value as string[]).map(recordId);
};

const parseParticipationAndLoad = (
  participation: unknown,
  maxLoadUnits: unknown,
  maxAllowed: number,
):
  | {
      readonly participation: (typeof MEDICAL_PARTICIPATION_LEVELS)[number];
      readonly maxLoadUnits: number | null;
    }
  | Failure => {
  if (
    !(MEDICAL_PARTICIPATION_LEVELS as readonly unknown[]).includes(
      participation,
    )
  )
    return bad('participation is not recognized');
  if (participation === 'out') {
    if (maxLoadUnits !== 0)
      return bad('out participation requires maxLoadUnits 0');
    return { participation: 'out', maxLoadUnits: 0 };
  }
  if (participation === 'limited') {
    if (
      !Number.isSafeInteger(maxLoadUnits) ||
      (maxLoadUnits as number) <= 0 ||
      (maxLoadUnits as number) > maxAllowed
    )
      return bad(
        'limited participation requires a positive integer maxLoadUnits',
      );
    return { participation: 'limited', maxLoadUnits: maxLoadUnits as number };
  }
  if (maxLoadUnits !== null)
    return bad('full participation requires maxLoadUnits null');
  return { participation: 'full', maxLoadUnits: null };
};

const routeRecordParticipationPreference = (
  ctx: RouteContext,
  c: Cmd,
): RouteOutcome => {
  if (!PREFERENCE_INPUT_ACTORS.has(ctx.actor.kind))
    return {
      ok: false,
      stage: 'authorization',
      code: 'UNAUTHORIZED_ACTOR',
      message: `${ctx.actor.kind} cannot record participation preference`,
    };
  if (
    !isValidId(c.playerId) ||
    !ctx.world.roster.players.some((p) => p.personId === c.playerId)
  )
    return bad('playerId must name an existing player');
  const playerId = entityId(c.playerId);
  let episodeId = null;
  if (c.episodeId !== null) {
    if (!isValidId(c.episodeId)) return bad('episodeId must be null or valid');
    const episode = ctx.world.medical.episodes.find(
      (e) => e.id === c.episodeId,
    );
    if (episode === undefined || episode.playerId !== playerId)
      return bad('episodeId must belong to playerId');
    episodeId = episode.id;
  }
  if (!(PARTICIPATION_PREFERENCES as readonly unknown[]).includes(c.preference))
    return bad('preference is not recognized');
  const sourceClaimIds = parseRecordIds(c.sourceClaimIds, 'sourceClaimIds');
  if (isFailure(sourceClaimIds)) return sourceClaimIds;
  if (
    sourceClaimIds.some((id) => {
      const claim = ctx.world.information.claims.find(
        (entry) => entry.id === id,
      );
      return (
        claim === undefined ||
        claim.subject.kind !== 'entity' ||
        claim.subject.id !== playerId
      );
    })
  )
    return bad('sourceClaimIds must name existing claims about the player');

  const minted = mintRecordId(ctx.world);
  const preference: ParticipationPreferenceRecord = {
    id: minted.id,
    playerId,
    episodeId,
    preference: c.preference as ParticipationPreferenceRecord['preference'],
    recordedAt: ctx.world.simDate,
    sourceClaimIds,
  };
  return {
    ok: true,
    authorizationDetail:
      'simulation-owned factual player communication ingress',
    resolution: {
      nextWorld: {
        ...ctx.world,
        medical: {
          ...ctx.world.medical,
          preferences: [...ctx.world.medical.preferences, preference].sort(
            byId,
          ),
        },
        nextIds: { ...ctx.world.nextIds, record: minted.next },
      },
      eventSpecs: [
        spec('ParticipationPreferenceRecorded', {
          preferenceId: preference.id,
          playerId,
          episodeId,
          preference: preference.preference,
          sourceClaimIds,
        }),
      ],
      detail: `recorded participation preference ${preference.id}`,
    },
  };
};

const routeRecordMedicalRecommendation = (
  ctx: RouteContext,
  c: Cmd,
): RouteOutcome => {
  const organizationId = parseOrganization(ctx, c.organizationId);
  if (isFailure(organizationId)) return organizationId;
  const actingPersonId = parseActingPerson(ctx, c);
  if (isFailure(actingPersonId)) return actingPersonId;
  if (!isValidId(c.episodeId)) return bad('episodeId must be valid');
  const episode = ctx.world.medical.episodes.find((e) => e.id === c.episodeId);
  if (episode === undefined || episode.status !== 'open')
    return bad('episodeId must name an open medical episode');
  const rights = new Set(
    effectiveRightsAt(
      ctx.world,
      organizationId,
      actingPersonId,
      'medical_clearance',
      ctx.world.simDate,
    ).rights,
  );
  if (!rights.has('advise') || !rights.has('communicate'))
    return denied(
      `${actingPersonId} needs advise and communicate on medical_clearance in ${organizationId}`,
    );
  const participation = parseParticipationAndLoad(
    c.participation,
    c.maxLoadUnits,
    requireDevelopmentRules(ctx.ruleset).maxPlayerLoadUnitsPerCheckpoint,
  );
  if (isFailure(participation)) return participation;
  const basisClaimIds = parseRecordIds(c.basisClaimIds, 'basisClaimIds');
  if (isFailure(basisClaimIds)) return basisClaimIds;
  const basisBeliefIds = parseRecordIds(c.basisBeliefIds, 'basisBeliefIds');
  if (isFailure(basisBeliefIds)) return basisBeliefIds;
  if (basisClaimIds.length + basisBeliefIds.length === 0)
    return bad('medical recommendation requires legitimate evidence');
  for (const id of basisClaimIds) {
    const claim = findVisibleClaim(
      ctx.world,
      organizationId,
      actingPersonId,
      id,
    );
    if (
      claim === undefined ||
      claim.subject.kind !== 'entity' ||
      claim.subject.id !== episode.playerId
    )
      return bad('basisClaimIds must name visible evidence about this player');
  }
  for (const id of basisBeliefIds) {
    const belief = ctx.world.information.beliefs.find((b) => b.id === id);
    if (
      belief === undefined ||
      !isBeliefVisibleTo(ctx.world, organizationId, actingPersonId, belief) ||
      belief.subject.kind !== 'entity' ||
      belief.subject.id !== episode.playerId
    )
      return bad('basisBeliefIds must name visible beliefs about this player');
  }

  const minted = mintRecordId(ctx.world);
  const recommendation: MedicalRecommendationRecord = {
    id: minted.id,
    episodeId: episode.id,
    medicalPersonId: actingPersonId,
    participation: participation.participation,
    maxLoadUnits: participation.maxLoadUnits,
    basisClaimIds,
    basisBeliefIds,
    issuedAt: ctx.world.simDate,
  };
  return {
    ok: true,
    authorizationDetail: `${actingPersonId} may advise and communicate on medical_clearance in ${organizationId}`,
    resolution: {
      nextWorld: {
        ...ctx.world,
        medical: {
          ...ctx.world.medical,
          recommendations: [
            ...ctx.world.medical.recommendations,
            recommendation,
          ].sort(byId),
        },
        nextIds: { ...ctx.world.nextIds, record: minted.next },
      },
      eventSpecs: [
        spec('MedicalRecommendationRecorded', {
          recommendationId: recommendation.id,
          episodeId: episode.id,
          medicalPersonId: actingPersonId,
          participation: recommendation.participation,
          maxLoadUnits: recommendation.maxLoadUnits,
          basisClaimIds,
          basisBeliefIds,
        }),
      ],
      detail: `recorded medical recommendation ${recommendation.id}`,
    },
  };
};

const routeCommitMedicalClearance = (
  ctx: RouteContext,
  c: Cmd,
): RouteOutcome => {
  const actingPersonId = parseActingPerson(ctx, c);
  if (isFailure(actingPersonId)) return actingPersonId;
  if (!isValidId(c.proposalId)) return bad('proposalId must be valid');
  const proposal = latestProposal(ctx.world.decisions, c.proposalId);
  if (proposal === undefined) return bad('proposalId must name a proposal');
  if (
    proposal.category !== 'medical_clearance' ||
    proposal.termsType !== MEDICAL_CLEARANCE_TERMS_TYPE
  )
    return bad('proposal must be a medical_clearance_v1 proposal');
  if (!isPlainObject(proposal.terms))
    return bad('medical clearance terms must be an object');
  const terms = proposal.terms;
  if (
    Object.keys(terms).sort().join(',') !==
    'episodeId,maxLoadUnits,participation,playerId'
  )
    return bad('medical clearance terms contain unsupported or missing fields');
  if (!isValidId(terms.episodeId) || !isValidId(terms.playerId))
    return bad('medical clearance terms require valid episodeId and playerId');
  const episode = ctx.world.medical.episodes.find(
    (e) => e.id === terms.episodeId,
  );
  if (episode === undefined || episode.status !== 'open')
    return bad('clearance episode must be open');
  if (episode.playerId !== terms.playerId)
    return bad('clearance playerId must match the episode player');
  if (
    !proposal.subjects.some(
      (subject) => subject.kind === 'entity' && subject.id === episode.playerId,
    )
  )
    return bad('medical clearance proposal must name the player as a subject');
  const participation = parseParticipationAndLoad(
    terms.participation,
    terms.maxLoadUnits,
    requireDevelopmentRules(ctx.ruleset).maxPlayerLoadUnitsPerCheckpoint,
  );
  if (isFailure(participation)) return participation;
  if (
    !Number.isSafeInteger(c.expectedRevision) ||
    (c.expectedRevision as number) <= 0
  )
    return bad('expectedRevision must be a positive integer');
  const beliefIds = parseRecordIds(c.beliefIds, 'beliefIds');
  if (isFailure(beliefIds)) return beliefIds;
  const evidenceClaimIds = parseRecordIds(
    c.evidenceClaimIds,
    'evidenceClaimIds',
  );
  if (isFailure(evidenceClaimIds)) return evidenceClaimIds;
  if (!isPlainObject(c.rationale)) return bad('rationale must be an object');

  const supersedes = latestMedicalClearance(
    ctx.world.medical,
    episode.id,
    proposal.organizationId,
  );
  const minted = mintRecordId(ctx.world);
  const clearance: MedicalClearanceRecord = {
    id: minted.id,
    episodeId: episode.id,
    organizationId: proposal.organizationId,
    playerId: episode.playerId,
    participation: participation.participation,
    maxLoadUnits: participation.maxLoadUnits,
    sourceProposalId: proposal.id,
    committedAt: ctx.world.simDate,
    supersedesClearanceId: supersedes?.id ?? null,
  };
  const nextWorld: FootballWorld = {
    ...ctx.world,
    medical: {
      ...ctx.world.medical,
      clearances: [...ctx.world.medical.clearances, clearance].sort(byId),
    },
    nextIds: { ...ctx.world.nextIds, record: minted.next },
  };
  return commitAuthorizedDomainChange(ctx, {
    nextWorld,
    domainEvents: [
      spec('MedicalClearanceCommitted', {
        clearanceId: clearance.id,
        episodeId: episode.id,
        organizationId: proposal.organizationId,
        playerId: episode.playerId,
        participation: clearance.participation,
        maxLoadUnits: clearance.maxLoadUnits,
        sourceProposalId: proposal.id,
        supersedesClearanceId: clearance.supersedesClearanceId,
      }),
    ],
    requests: [
      {
        organizationId: proposal.organizationId,
        actorPersonId: actingPersonId,
        proposalId: proposal.id,
        expectedRevision: c.expectedRevision as number,
        expectedCategory: 'medical_clearance',
        executedTerms: {
          termsType: MEDICAL_CLEARANCE_TERMS_TYPE,
          terms: proposal.terms,
        },
        beliefIds,
        evidenceClaimIds,
        rationale: c.rationale as CanonicalValue,
      },
    ],
  });
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
    case 'RecordParticipationPreference':
      return routeRecordParticipationPreference(ctx, c);
    case 'RecordMedicalRecommendation':
      return routeRecordMedicalRecommendation(ctx, c);
    case 'CommitMedicalClearanceProposal':
      return routeCommitMedicalClearance(ctx, c);
    default: {
      const unreachable: never = command.type;
      throw new Error(`unroutable medical command: ${String(unreachable)}`);
    }
  }
};
