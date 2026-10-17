import type { CanonicalValue } from './audit';
import type { EntityId, RecordId } from './ids';

export interface RelationshipPartyRef {
  readonly kind: 'person' | 'organization';
  readonly entityId: EntityId;
}

/**
 * A multidimensional relationship between two parties. Task 6 defines the separate
 * dimensions (trust, professional respect, familiarity, alignment, access, tension);
 * there is deliberately no aggregate relationship score.
 */
export interface RelationshipEdge {
  readonly id: RecordId;
}

/** Append-only cause record explaining one relationship change. */
export interface RelationshipEffect {
  readonly id: RecordId;
  readonly relationshipId: RecordId;
  readonly causeType: string;
  readonly causeId: string;
  readonly occurredAt: string;
  readonly changes: CanonicalValue;
}

export interface RelationshipsState {
  readonly edges: readonly RelationshipEdge[];
  readonly effects: readonly RelationshipEffect[];
}

export const emptyRelationshipsState = (): RelationshipsState => ({
  edges: [],
  effects: [],
});
