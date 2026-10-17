import type { EntityId, RecordId } from './ids';

/**
 * Package D development state (world model 4).
 *
 * AUTHORITY: this domain holds the PRIVATE causal substrate of development: latent traits
 * the simulation uses to resolve checkpoints, finite opportunity, learned role knowledge,
 * readiness and the append-only record of what development did. It never holds a copy of
 * a player's capabilities: the only authoritative football-capability ledger remains
 * `roster.players[].capabilities`. There is deliberately no summary rating, ceiling,
 * potential, XP, tier or coach multiplier anywhere in this domain.
 */

/** One capability family's private responsiveness for one player (not a ceiling). */
export interface CapabilityResponse {
  readonly capabilityKey: string;
  readonly malleabilityBp: number;
}

/** A player's private causal traits. No current capability copy, no final destination. */
export interface PlayerDevelopmentProfile {
  readonly personId: EntityId;
  readonly capabilityResponses: readonly CapabilityResponse[];
  readonly processingBp: number;
  readonly adaptabilityBp: number;
  readonly recoveryBp: number;
  readonly durabilityBp: number;
}

/** Responsibility-specific teaching skill; there is no global coach score. */
export interface TeachingExpertise {
  readonly responsibilityKey: string;
  readonly teachingBp: number;
}

export interface TeachingProfile {
  readonly personId: EntityId;
  readonly bandwidthUnits: number;
  readonly expertise: readonly TeachingExpertise[];
}

/** Person-owned learned knowledge, keyed by player + scheme + responsibility. */
export interface RoleKnowledgeRecord {
  readonly playerId: EntityId;
  readonly schemeKey: string;
  readonly responsibilityKey: string;
  readonly transferFamilyKey: string;
  readonly familiarityBp: number;
  readonly lastMeaningfulRepAt: string | null;
}

export interface PlayerReadinessRecord {
  readonly playerId: EntityId;
  readonly conditioningBp: number;
  readonly acuteFatigueBp: number;
  readonly accumulatedLoadUnits: number;
  readonly updatedAt: string;
}

export const OPPORTUNITY_RESOURCE_KEYS = [
  'first_team_reps',
  'development_reps',
  'meeting_attention',
  'installation_work',
] as const;
export type OpportunityResourceKey = (typeof OPPORTUNITY_RESOURCE_KEYS)[number];

export interface OpportunityPool {
  readonly resourceKey: OpportunityResourceKey;
  readonly scopeKey: string;
  readonly capacityUnits: number;
}

export type OpportunityWindowStatus = 'open' | 'resolved';

export interface OpportunityWindow {
  readonly id: RecordId;
  readonly organizationId: EntityId;
  readonly phaseKey: string;
  readonly fromDate: string;
  readonly toDate: string;
  readonly pools: readonly OpportunityPool[];
  readonly status: OpportunityWindowStatus;
}

export interface OpportunityAllocation {
  readonly id: RecordId;
  readonly windowId: RecordId;
  readonly organizationId: EntityId;
  readonly playerId: EntityId;
  readonly resourceKey: OpportunityResourceKey;
  readonly scopeKey: string;
  readonly units: number;
  readonly teacherPersonId: EntityId | null;
  readonly responsibilityKeys: readonly string[];
  readonly basisPlanIds: readonly RecordId[];
  readonly sourceProposalId: RecordId;
  readonly committedAt: string;
}

export interface DevelopmentCheckpointRecord {
  readonly id: RecordId;
  readonly organizationId: EntityId;
  readonly windowId: RecordId;
  readonly fromDate: string;
  readonly toDate: string;
  readonly resolvedAt: string;
  readonly allocationIds: readonly RecordId[];
  readonly rngDrawStart: number;
  readonly rngDrawCount: number;
  readonly eventIds: readonly RecordId[];
}

/**
 * Immutable append-only fact about what development did. Private truth: it never becomes
 * an organization claim automatically.
 */
export interface DevelopmentEvent {
  readonly id: RecordId;
  readonly playerId: EntityId;
  readonly checkpointId: RecordId;
  readonly occurredAt: string;
  readonly kind: string;
  readonly capabilityKeys: readonly string[];
  readonly responsibilityKeys: readonly string[];
  readonly beforeBp: number | null;
  readonly afterBp: number | null;
  readonly causalRecordIds: readonly RecordId[];
}

export interface DevelopmentState {
  readonly playerProfiles: readonly PlayerDevelopmentProfile[];
  readonly teachingProfiles: readonly TeachingProfile[];
  readonly roleKnowledge: readonly RoleKnowledgeRecord[];
  readonly readiness: readonly PlayerReadinessRecord[];
  readonly opportunityWindows: readonly OpportunityWindow[];
  readonly opportunityAllocations: readonly OpportunityAllocation[];
  readonly checkpoints: readonly DevelopmentCheckpointRecord[];
  readonly events: readonly DevelopmentEvent[];
}

export const emptyDevelopmentState = (): DevelopmentState => ({
  playerProfiles: [],
  teachingProfiles: [],
  roleKnowledge: [],
  readiness: [],
  opportunityWindows: [],
  opportunityAllocations: [],
  checkpoints: [],
  events: [],
});
