import type { CanonicalValue } from './audit';
import type { CommandId, EntityId, EventId, RecordId } from './ids';
import type { DecisionCategory, DecisionRight } from './authority';
import type { SubjectRef } from './information';

export const PROPOSAL_STATES = [
  'draft',
  'submitted',
  'awaiting_approval',
  'authorized',
  'committed',
  'rejected',
  'withdrawn',
  'expired',
] as const;
export type ProposalState = (typeof PROPOSAL_STATES)[number];

/** One revision of a proposal. Revisions link; they never overwrite. */
export interface ProposalRecord {
  readonly id: RecordId;
  readonly revision: number;
  readonly organizationId: EntityId;
  readonly authorPersonId: EntityId;
  readonly category: DecisionCategory;
  readonly subjects: readonly SubjectRef[];
  readonly termsType: string;
  readonly terms: CanonicalValue;
  readonly termsHash: string;
  readonly relevantWorldRevision: number;
  readonly requiredApproverPersonIds: readonly EntityId[];
  readonly expiresAt: string | null;
  readonly contingencies: CanonicalValue;
  readonly state: ProposalState;
  readonly createdAt: string;
  readonly supersedesRevision: number | null;
}

/** Binds one approver's decision to an exact proposal revision and terms hash. */
export interface ApprovalRecord {
  readonly id: RecordId;
  readonly proposalId: RecordId;
  readonly proposalRevision: number;
  readonly approverPersonId: EntityId;
  readonly right: DecisionRight;
  readonly authorityGrantId: RecordId;
  readonly termsHash: string;
  readonly decidedAt: string;
  readonly active: boolean;
}

/** Immutable record of what was known, authorized and executed when a decision committed. */
export interface DecisionReceipt {
  readonly id: RecordId;
  readonly proposalId: RecordId;
  readonly proposalRevision: number;
  readonly commandId: CommandId;
  readonly actorPersonId: EntityId;
  readonly authorityGrantIds: readonly RecordId[];
  readonly evidenceClaimIds: readonly RecordId[];
  readonly beliefIds: readonly RecordId[];
  readonly approvalIds: readonly RecordId[];
  readonly mandateId: RecordId | null;
  readonly executedTermsHash: string;
  readonly committedAt: string;
  readonly outcomeEventIds: readonly EventId[];
  readonly originalRationale: CanonicalValue;
}

export interface DecisionsState {
  readonly proposals: readonly ProposalRecord[];
  readonly approvals: readonly ApprovalRecord[];
  readonly receipts: readonly DecisionReceipt[];
}

export const emptyDecisionsState = (): DecisionsState => ({
  proposals: [],
  approvals: [],
  receipts: [],
});
