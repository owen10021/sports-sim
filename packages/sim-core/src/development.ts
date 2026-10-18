import { entityId, type EntityId, type RecordId } from './ids';
import type { PackageDSubstrateSeed } from './packageDSeedParse';

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
  /** Exact intent revisions bound into the approved proposal, never live plan pointers. */
  readonly basisPlanRevisions?: readonly {
    readonly planId: RecordId;
    readonly revision: number;
  }[];
  readonly sourceProposalId: RecordId;
  readonly committedAt: string;
}

export interface DevelopmentCheckpointRecord {
  readonly id: RecordId;
  /** Passive ticks own person-time; opportunity checkpoints own only committed work. */
  readonly kind?: 'passive';
  readonly organizationId: EntityId | null;
  readonly windowId: RecordId | null;
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

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Initial development state from the seed's Package D block, in canonical (stable id)
 * order. Role knowledge starts with no meaningful rep; readiness starts at the seed date.
 */
export const seededDevelopmentState = (
  sub: PackageDSubstrateSeed | undefined,
  startDate: string,
): DevelopmentState => {
  if (sub === undefined) return emptyDevelopmentState();
  return {
    playerProfiles: sub.playerProfiles
      .map((p) => ({
        personId: entityId(p.personId),
        capabilityResponses: p.capabilityResponses
          .map((r) => ({
            capabilityKey: r.capabilityKey,
            malleabilityBp: r.malleabilityBp,
          }))
          .sort((a, b) => byText(a.capabilityKey, b.capabilityKey)),
        processingBp: p.processingBp,
        adaptabilityBp: p.adaptabilityBp,
        recoveryBp: p.recoveryBp,
        durabilityBp: p.durabilityBp,
      }))
      .sort((a, b) => byText(a.personId, b.personId)),
    teachingProfiles: sub.teachingProfiles
      .map((t) => ({
        personId: entityId(t.personId),
        bandwidthUnits: t.bandwidthUnits,
        expertise: t.expertise
          .map((e) => ({
            responsibilityKey: e.responsibilityKey,
            teachingBp: e.teachingBp,
          }))
          .sort((a, b) => byText(a.responsibilityKey, b.responsibilityKey)),
      }))
      .sort((a, b) => byText(a.personId, b.personId)),
    roleKnowledge: sub.roleKnowledge
      .map((k) => ({
        playerId: entityId(k.playerId),
        schemeKey: k.schemeKey,
        responsibilityKey: k.responsibilityKey,
        transferFamilyKey: k.transferFamilyKey,
        familiarityBp: k.familiarityBp,
        lastMeaningfulRepAt: null,
      }))
      .sort(
        (a, b) =>
          byText(a.playerId, b.playerId) ||
          byText(a.schemeKey, b.schemeKey) ||
          byText(a.responsibilityKey, b.responsibilityKey),
      ),
    readiness: sub.readiness
      .map((r) => ({
        playerId: entityId(r.playerId),
        conditioningBp: r.conditioningBp,
        acuteFatigueBp: r.acuteFatigueBp,
        accumulatedLoadUnits: r.accumulatedLoadUnits,
        updatedAt: startDate,
      }))
      .sort((a, b) => byText(a.playerId, b.playerId)),
    opportunityWindows: [],
    opportunityAllocations: [],
    checkpoints: [],
    events: [],
  };
};

/** Private simulation query, never an organization decision view or inferred default. */
export const developmentProfileFor = (
  development: Pick<DevelopmentState, 'playerProfiles'>,
  playerId: EntityId,
): PlayerDevelopmentProfile | undefined =>
  development.playerProfiles.find((p) => p.personId === playerId);

/** Missing readiness remains missing; callers must choose an explicit resolution policy. */
export const readinessFor = (
  development: Pick<DevelopmentState, 'readiness'>,
  playerId: EntityId,
): PlayerReadinessRecord | undefined =>
  development.readiness.find((r) => r.playerId === playerId);
