import type { CanonicalValue } from './audit';
import type { EntityId, RecordId } from './ids';

/** Only `strategy` is fully exercised in Package B; the rest are structural hooks. */
export const PLAN_KINDS = [
  'strategy',
  'roster_group',
  'succession',
  'acquisition',
  'staff',
] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

export type PlanStatus = 'active' | 'superseded' | 'closed';
export type PlanPriority = 'low' | 'medium' | 'high' | 'critical';

export interface PlanObjective {
  readonly key: string;
  readonly priority: PlanPriority;
  readonly target: CanonicalValue;
}

export interface PlanConstraint {
  readonly key: string;
  readonly kind: 'hard' | 'preference';
  readonly value: CanonicalValue;
}

export interface PlanTrigger {
  readonly kind: 'date' | 'claim' | 'event' | 'manual_review';
  readonly refId: string;
  readonly note: string;
}

export interface PlanRevision {
  readonly revision: number;
  readonly ownerPersonId: EntityId;
  readonly effectiveAt: string;
  readonly horizon: CanonicalValue;
  readonly objectives: readonly PlanObjective[];
  readonly constraints: readonly PlanConstraint[];
  readonly triggerRefs: readonly PlanTrigger[];
  readonly fallbackPlanIds: readonly RecordId[];
  readonly basisBeliefIds: readonly RecordId[];
  readonly changeReasonRefs: readonly RecordId[];
}

export interface OrganizationPlan {
  readonly id: RecordId;
  readonly organizationId: EntityId;
  readonly kind: PlanKind;
  readonly scopeKey: string;
  readonly status: PlanStatus;
  readonly currentRevision: number;
  readonly revisions: readonly PlanRevision[];
}

export interface PlansState {
  readonly plans: readonly OrganizationPlan[];
}

export const emptyPlansState = (): PlansState => ({ plans: [] });
