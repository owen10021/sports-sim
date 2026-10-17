import type { CanonicalValue } from './audit';
import type { EntityId, RecordId } from './ids';

/** Explicit decision rights. One right never implies another. */
export const DECISION_RIGHTS = [
  'propose',
  'advise',
  'approve',
  'veto',
  'execute',
  'communicate',
] as const;
export type DecisionRight = (typeof DECISION_RIGHTS)[number];

/**
 * Package B exercises the first three. The rest are reserved for later packages and have
 * no transaction implementation in Package B.
 */
export const DECISION_CATEGORIES = [
  'organizational_authority',
  'staff_role',
  'organizational_plan',
  'acquisition',
  'contract',
  'roster',
  'game_day_activation',
  'medical_clearance',
  'workload_usage',
  'major_trade',
  'staff_hiring',
  'scheme',
] as const;
export type DecisionCategory = (typeof DECISION_CATEGORIES)[number];

/** Rights held by a person in an organization for one category over an interval. */
export interface AuthorityGrant {
  readonly id: RecordId;
  readonly personId: EntityId;
  readonly organizationId: EntityId;
  readonly category: DecisionCategory;
  readonly rights: readonly DecisionRight[];
  readonly transferable: boolean;
  readonly effectiveFrom: string;
  /** Inclusive end date, or null while open-ended. */
  readonly effectiveUntil: string | null;
  readonly sourcePersonId: EntityId | null;
  readonly revision: number;
}

/** A narrowing delegation. It can never manufacture authority. */
export interface Mandate {
  readonly id: RecordId;
  readonly organizationId: EntityId;
  readonly delegatorPersonId: EntityId;
  readonly delegatePersonId: EntityId;
  readonly category: DecisionCategory;
  readonly scope: CanonicalValue;
  readonly hardConstraints: CanonicalValue;
  readonly preferences: CanonicalValue;
  readonly allowedRights: readonly DecisionRight[];
  readonly fallback: CanonicalValue;
  readonly escalationRules: CanonicalValue;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly revision: number;
  readonly active: boolean;
}

export interface ProtectedConstraint {
  readonly id: RecordId;
  readonly organizationId: EntityId;
  readonly subject: CanonicalValue;
  readonly prohibitedChange: CanonicalValue;
  readonly originRecordId: RecordId | null;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly amendableByPersonIds: readonly EntityId[];
  readonly revision: number;
  readonly active: boolean;
}

export interface AuthorityState {
  readonly grants: readonly AuthorityGrant[];
  readonly mandates: readonly Mandate[];
  readonly protectedConstraints: readonly ProtectedConstraint[];
}

export const emptyAuthorityState = (): AuthorityState => ({
  grants: [],
  mandates: [],
  protectedConstraints: [],
});
