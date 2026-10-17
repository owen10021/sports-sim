import type { CanonicalValue } from './audit';
import type { EntityId, RecordId } from './ids';

export type ClaimVisibility = 'public' | 'organization' | 'restricted';
/** Confidence in evidence/belief, never a probability that a hidden rating is correct. */
export type ConfidenceBand =
  'very_low' | 'low' | 'medium' | 'high' | 'very_high';

export interface SubjectRef {
  readonly kind: 'entity' | 'plan' | 'proposal' | 'world';
  readonly id: string;
}

/** Immutable as-of statement with provenance. Later knowledge links forward. */
export interface ClaimRecord {
  readonly id: RecordId;
  readonly subject: SubjectRef;
  readonly propositionType: string;
  readonly proposition: CanonicalValue;
  readonly sourcePersonId: EntityId;
  readonly sourceFamilyId: string;
  readonly observedAt: string;
  readonly acquiredAt: string;
  readonly visibility: ClaimVisibility;
  readonly holderOrganizationIds: readonly EntityId[];
  readonly confidence: ConfidenceBand;
  readonly possibleBias: string | null;
  readonly corroboratesClaimIds: readonly RecordId[];
  readonly contradictsClaimIds: readonly RecordId[];
}

/** An organization's immutable as-of assessment. A newer belief supersedes by link. */
export interface BeliefRecord {
  readonly id: RecordId;
  readonly organizationId: EntityId;
  readonly authorPersonId: EntityId;
  readonly subject: SubjectRef;
  readonly assessmentType: string;
  readonly assessment: CanonicalValue;
  readonly confidence: ConfidenceBand;
  readonly evidenceClaimIds: readonly RecordId[];
  readonly formedAt: string;
  readonly supersedesBeliefId: RecordId | null;
}

export interface InformationState {
  readonly claims: readonly ClaimRecord[];
  readonly beliefs: readonly BeliefRecord[];
}

export const emptyInformationState = (): InformationState => ({
  claims: [],
  beliefs: [],
});
