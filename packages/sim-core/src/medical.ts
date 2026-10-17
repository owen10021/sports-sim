import type { EntityId, RecordId } from './ids';

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
