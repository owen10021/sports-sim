import type { CanonicalValue } from './audit';
import type { EntityId, RecordId } from './ids';

export type RelationshipPartyRef = {
  readonly kind: 'person' | 'organization';
  readonly entityId: EntityId;
};

/**
 * Categorical levels, not calibrated numbers. They are ordered but carry no arithmetic,
 * and the same scale is used for every dimension (a high `tension` is not a good thing).
 */
export const RELATIONSHIP_LEVELS = [
  'none',
  'low',
  'moderate',
  'high',
  'very_high',
] as const;
export type RelationshipLevel = (typeof RELATIONSHIP_LEVELS)[number];

/** Separate dimensions. There is deliberately no aggregate relationship score. */
export const RELATIONSHIP_DIMENSIONS = [
  'trust',
  'professionalRespect',
  'familiarity',
  'alignment',
  'access',
  'tension',
] as const;
export type RelationshipDimension = (typeof RELATIONSHIP_DIMENSIONS)[number];

/**
 * One relationship between two parties, stored once with `partyA` ordered before `partyB`
 * (see `orderParties`). Current levels are authoritative; `effects` explain how they got here.
 */
export interface RelationshipEdge {
  readonly id: RecordId;
  readonly partyA: RelationshipPartyRef;
  readonly partyB: RelationshipPartyRef;
  readonly trust: RelationshipLevel;
  readonly professionalRespect: RelationshipLevel;
  readonly familiarity: RelationshipLevel;
  readonly alignment: RelationshipLevel;
  /** Opportunity to communicate. Never hidden truth and never claim ownership. */
  readonly access: RelationshipLevel;
  readonly tension: RelationshipLevel;
  readonly createdAt: string;
  readonly revision: number;
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

const compareText = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

/** Canonical order: by kind, then entity id. The same pair always yields the same edge. */
export const orderParties = (
  a: RelationshipPartyRef,
  b: RelationshipPartyRef,
): readonly [RelationshipPartyRef, RelationshipPartyRef] =>
  (compareText(a.kind, b.kind) || compareText(a.entityId, b.entityId)) <= 0
    ? [a, b]
    : [b, a];

export const findRelationshipEdge = (
  state: RelationshipsState,
  a: RelationshipPartyRef,
  b: RelationshipPartyRef,
): RelationshipEdge | undefined => {
  const [first, second] = orderParties(a, b);
  return state.edges.find(
    (e) =>
      e.partyA.kind === first.kind &&
      e.partyA.entityId === first.entityId &&
      e.partyB.kind === second.kind &&
      e.partyB.entityId === second.entityId,
  );
};
