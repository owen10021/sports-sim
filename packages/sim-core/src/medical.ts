import { entityId, recordId, type EntityId, type RecordId } from './ids';
import type { PackageDSubstrateSeed } from './packageDSeedParse';

/**
 * Package D medical state (world model 4).
 *
 * Diagnosis, structural healing, functional readiness, conditioning, reinjury risk,
 * performance limitation, player preference, recommendation, clearance and actual usage
 * are DISTINCT concepts and are never collapsed into one health number. This domain holds
 * the private medical truth and the immutable organizational records about it; what an
 * organization knows about an episode lives in Package B claims and beliefs.
 */

export const MEDICAL_EPISODE_SOURCE_KINDS = [
  'football',
  'synthetic_test',
] as const;
export type MedicalEpisodeSourceKind =
  (typeof MEDICAL_EPISODE_SOURCE_KINDS)[number];

export type MedicalEpisodeStatus = 'open' | 'resolved';

export interface MedicalEpisode {
  readonly id: RecordId;
  readonly playerId: EntityId;
  readonly conditionKey: string;
  readonly onsetAt: string;
  readonly sourceKind: MedicalEpisodeSourceKind;
  readonly affectedActionKeys: readonly string[];
  readonly initialStructuralSeverityBp: number;
  readonly recoveryResponsivenessBp: number;
  readonly baselineReinjuryRiskBp: number;
  readonly status: MedicalEpisodeStatus;
}

export interface MedicalLimitation {
  readonly actionKey: string;
  readonly severityBp: number;
}

/** Append-only private truth about an episode at one checkpoint. */
export interface MedicalProgressRecord {
  readonly id: RecordId;
  readonly episodeId: RecordId;
  readonly assessedAt: string;
  readonly structuralHealingBp: number;
  readonly reinjuryRiskBp: number;
  readonly limitations: readonly MedicalLimitation[];
  readonly rngDrawStart: number;
  readonly rngDrawCount: number;
}

/** Links an organization's medical work to Package B knowledge records. */
export interface MedicalReport {
  readonly id: RecordId;
  readonly episodeId: RecordId;
  readonly organizationId: EntityId;
  readonly evaluatorPersonId: EntityId;
  readonly evidenceClaimIds: readonly RecordId[];
  readonly beliefId: RecordId;
  readonly formedAt: string;
}

export const PARTICIPATION_PREFERENCES = [
  'willing',
  'prefer_limit',
  'unwilling',
] as const;
export type ParticipationPreference =
  (typeof PARTICIPATION_PREFERENCES)[number];

export interface ParticipationPreferenceRecord {
  readonly id: RecordId;
  readonly playerId: EntityId;
  readonly episodeId: RecordId | null;
  readonly preference: ParticipationPreference;
  readonly recordedAt: string;
  readonly sourceClaimIds: readonly RecordId[];
}

export const MEDICAL_CLEARANCE_TERMS_TYPE = 'medical_clearance_v1';

export const MEDICAL_PARTICIPATION_LEVELS = ['out', 'limited', 'full'] as const;
export type MedicalParticipation =
  (typeof MEDICAL_PARTICIPATION_LEVELS)[number];

export interface MedicalRecommendationRecord {
  readonly id: RecordId;
  readonly episodeId: RecordId;
  readonly medicalPersonId: EntityId;
  readonly participation: MedicalParticipation;
  readonly maxLoadUnits: number | null;
  readonly basisClaimIds: readonly RecordId[];
  readonly basisBeliefIds: readonly RecordId[];
  readonly issuedAt: string;
}

export interface MedicalClearanceRecord {
  readonly id: RecordId;
  readonly episodeId: RecordId;
  readonly organizationId: EntityId;
  readonly playerId: EntityId;
  readonly participation: MedicalParticipation;
  readonly maxLoadUnits: number | null;
  readonly sourceProposalId: RecordId;
  readonly committedAt: string;
  readonly supersedesClearanceId: RecordId | null;
}

export interface MedicalState {
  readonly episodes: readonly MedicalEpisode[];
  readonly progress: readonly MedicalProgressRecord[];
  readonly reports: readonly MedicalReport[];
  readonly preferences: readonly ParticipationPreferenceRecord[];
  readonly recommendations: readonly MedicalRecommendationRecord[];
  readonly clearances: readonly MedicalClearanceRecord[];
}

export const emptyMedicalState = (): MedicalState => ({
  episodes: [],
  progress: [],
  reports: [],
  preferences: [],
  recommendations: [],
  clearances: [],
});

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Initial medical state from the seed's Package D block: only synthetic-test episodes can
 * be seeded, in canonical (stable id) order. No progress, report or clearance is invented.
 */
export const seededMedicalState = (
  sub: PackageDSubstrateSeed | undefined,
): MedicalState => {
  const episodes = sub?.medicalEpisodes ?? [];
  return {
    ...emptyMedicalState(),
    episodes: episodes
      .map((e): MedicalEpisode => ({
        id: recordId(e.id),
        playerId: entityId(e.playerId),
        conditionKey: e.conditionKey,
        onsetAt: e.onsetAt,
        sourceKind: 'synthetic_test',
        affectedActionKeys: [...e.affectedActionKeys].sort(byText),
        initialStructuralSeverityBp: e.initialStructuralSeverityBp,
        recoveryResponsivenessBp: e.recoveryResponsivenessBp,
        baselineReinjuryRiskBp: e.baselineReinjuryRiskBp,
        status: 'open',
      }))
      .sort((a, b) => byText(a.id, b.id)),
  };
};

const clampBp = (value: number): number =>
  Math.max(0, Math.min(10000, Math.floor(value)));

/** Latest private checkpoint truth for an episode, if it has been reassessed. */
export const latestMedicalProgress = (
  medical: MedicalState,
  episodeId: RecordId,
): MedicalProgressRecord | undefined =>
  medical.progress
    .filter((p) => p.episodeId === episodeId)
    .sort((a, b) =>
      a.assessedAt === b.assessedAt
        ? a.id < b.id
          ? -1
          : a.id > b.id
            ? 1
            : 0
        : a.assessedAt < b.assessedAt
          ? -1
          : 1,
    )
    .at(-1);

/**
 * Engine-facing functional readiness for one football action. This is intentionally not
 * an organization knowledge view: exact readiness is derived from current conditioning,
 * fatigue and active medical limitations. Structural healing and reinjury risk remain
 * separate causal facts and are not collapsed into this value.
 */
export const functionalReadiness = (
  world: import('./world').FootballWorld,
  playerId: string,
  actionKey: string,
): number | undefined => {
  const readiness = world.development.readiness.find(
    (r) => r.playerId === playerId,
  );
  if (readiness === undefined) return undefined;

  let limitationSeverityBp = 0;
  for (const episode of world.medical.episodes) {
    if (
      episode.playerId !== playerId ||
      episode.status !== 'open' ||
      !episode.affectedActionKeys.includes(actionKey)
    )
      continue;
    const progress = latestMedicalProgress(world.medical, episode.id);
    const severity =
      progress?.limitations.find((l) => l.actionKey === actionKey)
        ?.severityBp ?? episode.initialStructuralSeverityBp;
    limitationSeverityBp = Math.max(limitationSeverityBp, severity);
  }

  const afterFatigue = Math.floor(
    (readiness.conditioningBp * (10000 - clampBp(readiness.acuteFatigueBp))) /
      10000,
  );
  return clampBp(
    Math.floor((afterFatigue * (10000 - limitationSeverityBp)) / 10000),
  );
};

/** Latest immutable clearance for one episode and organization. */
export const latestMedicalClearance = (
  medical: MedicalState,
  episodeId: RecordId,
  organizationId: EntityId,
): MedicalClearanceRecord | undefined =>
  medical.clearances
    .filter(
      (c) => c.episodeId === episodeId && c.organizationId === organizationId,
    )
    .sort((a, b) =>
      a.committedAt === b.committedAt
        ? byText(a.id, b.id)
        : byText(a.committedAt, b.committedAt),
    )
    .at(-1);

/**
 * Hard workload cap from current legal clearance only. Advice and player preference are
 * intentionally not vetoes. `null` means no medical clearance cap applies.
 */
export const medicalWorkloadCap = (
  world: Pick<import('./world').FootballWorld, 'medical'>,
  organizationId: EntityId,
  playerId: EntityId,
): number | null => {
  let cap: number | null = null;
  for (const episode of world.medical.episodes) {
    if (episode.playerId !== playerId || episode.status !== 'open') continue;
    const clearance = latestMedicalClearance(
      world.medical,
      episode.id,
      organizationId,
    );
    if (clearance === undefined || clearance.participation === 'full') continue;
    const episodeCap =
      clearance.participation === 'out' ? 0 : clearance.maxLoadUnits;
    if (episodeCap === null) continue;
    cap = cap === null ? episodeCap : Math.min(cap, episodeCap);
  }
  return cap;
};
