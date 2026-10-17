import type { CanonicalValue } from './audit';
import {
  activeRightsAt,
  validateMandateAt,
  type DecisionCategory,
  type DecisionRight,
} from './authority';
import { hashCanonical } from './hash';
import type { CommandId, EntityId, EventId, RecordId } from './ids';
import type { SubjectRef } from './information';
import { holdsRoleAt } from './people';
import type { FootballWorld } from './world';

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

/** States that never change again. A retry creates a new, linked revision instead. */
export const TERMINAL_PROPOSAL_STATES: readonly ProposalState[] = [
  'committed',
  'rejected',
  'withdrawn',
  'expired',
];
export const isTerminalProposalState = (state: ProposalState): boolean =>
  TERMINAL_PROPOSAL_STATES.includes(state);

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
  /** Exclusive deadline: the proposal is dead on this date itself. Null means none. */
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
  /** The grant that backed the right when the decision was made. */
  readonly authorityGrantId: RecordId;
  /** Set when the right was exercised through a mandate rather than the person's own grant. */
  readonly mandateId: RecordId | null;
  readonly termsHash: string;
  readonly decidedAt: string;
  /** Cleared (never deleted) when a material revision or a retry makes it incompatible. */
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

// ---------------------------------------------------------------------------
// Pure derivation. Logical dates only; authority is always re-derived, never cached.
// ---------------------------------------------------------------------------

/** The newest revision of a proposal, or undefined. */
export const latestProposal = (
  decisions: DecisionsState,
  id: string,
): ProposalRecord | undefined => {
  let best: ProposalRecord | undefined;
  for (const p of decisions.proposals)
    if (p.id === id && (best === undefined || p.revision > best.revision))
      best = p;
  return best;
};

/** The material terms an approval binds to. Deadlines and contingencies are not material. */
export const proposalTermsHash = (p: {
  readonly category: DecisionCategory;
  readonly subjects: readonly SubjectRef[];
  readonly termsType: string;
  readonly terms: CanonicalValue;
}): string =>
  hashCanonical({
    category: p.category,
    subjects: p.subjects,
    termsType: p.termsType,
    terms: p.terms,
  });

/** Exclusive deadline: alive strictly before `expiresAt`. */
export const isProposalLiveAt = (
  p: Pick<ProposalRecord, 'expiresAt'>,
  date: string,
): boolean => p.expiresAt === null || date < p.expiresAt;

export interface RightBacking {
  /** Grants that provide the right now (the delegator's, when a mandate does). */
  readonly grantIds: readonly RecordId[];
  readonly mandateId: RecordId | null;
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * What currently backs `person` holding `right` in `category`, or null. Own grants win;
 * otherwise the lowest-id valid mandate that delegates the right.
 */
export const rightBackingAt = (
  world: Pick<FootballWorld, 'people' | 'authority'>,
  organizationId: EntityId,
  personId: EntityId,
  category: DecisionCategory,
  right: DecisionRight,
  date: string,
): RightBacking | null => {
  const grantsFor = (holder: EntityId, transferableOnly: boolean) =>
    holdsRoleAt(world.people, organizationId, holder, date)
      ? world.authority.grants
          .filter(
            (g) =>
              g.personId === holder &&
              g.organizationId === organizationId &&
              g.category === category &&
              g.rights.includes(right) &&
              (!transferableOnly || g.transferable) &&
              g.effectiveFrom <= date &&
              (g.effectiveUntil === null || date <= g.effectiveUntil),
          )
          .map((g) => g.id)
          .sort(byText)
      : [];
  const own = grantsFor(personId, false);
  if (own.length > 0) return { grantIds: own, mandateId: null };
  const mandates = [...world.authority.mandates].sort((a, b) =>
    byText(a.id, b.id),
  );
  for (const m of mandates) {
    if (
      m.organizationId !== organizationId ||
      m.delegatePersonId !== personId ||
      m.category !== category
    )
      continue;
    const verdict = validateMandateAt(world, m.id, date);
    if (!verdict.ok || !verdict.rights.includes(right)) continue;
    const backing = grantsFor(m.delegatorPersonId, true);
    if (backing.length > 0) return { grantIds: backing, mandateId: m.id };
  }
  return null;
};

export interface ProposalAuthorization {
  readonly satisfied: boolean;
  /** How it is satisfied: the author's own approve right, or counted approvals. */
  readonly basis: 'author_rights' | 'approvals' | null;
  /** Active approvals that count, and still count today. */
  readonly approvalIds: readonly RecordId[];
  readonly grantIds: readonly RecordId[];
  readonly reasons: readonly string[];
}

/**
 * Whether `proposal` is authorized on `date`, from current rights. Approvals bind to the
 * exact terms hash and only count while their approver still holds the right (DC-04).
 */
export const evaluateProposalAuthority = (
  world: Pick<FootballWorld, 'people' | 'authority' | 'decisions'>,
  proposal: ProposalRecord,
  date: string,
): ProposalAuthorization => {
  const valid = world.decisions.approvals
    .filter(
      (a) =>
        a.proposalId === proposal.id &&
        a.active &&
        a.right === 'approve' &&
        a.termsHash === proposal.termsHash,
    )
    .map((a) => ({
      approval: a,
      backing: rightBackingAt(
        world,
        proposal.organizationId,
        a.approverPersonId,
        proposal.category,
        'approve',
        date,
      ),
    }));
  const counting = valid.filter((v) => v.backing !== null);
  const countedIds = counting.map((v) => v.approval.id).sort(byText);
  const grantsOf = (items: typeof counting) =>
    [...new Set(items.flatMap((v) => v.backing!.grantIds))].sort(byText);

  if (proposal.requiredApproverPersonIds.length > 0) {
    const missing = proposal.requiredApproverPersonIds.filter(
      (p) => !counting.some((v) => v.approval.approverPersonId === p),
    );
    if (missing.length > 0)
      return {
        satisfied: false,
        basis: null,
        approvalIds: countedIds,
        grantIds: [],
        reasons: missing.map(
          (p) => `${p} has no current approval of this revision`,
        ),
      };
    return {
      satisfied: true,
      basis: 'approvals',
      approvalIds: countedIds,
      grantIds: grantsOf(counting),
      reasons: [],
    };
  }
  const own = rightBackingAt(
    world,
    proposal.organizationId,
    proposal.authorPersonId,
    proposal.category,
    'approve',
    date,
  );
  if (own !== null)
    return {
      satisfied: true,
      basis: 'author_rights',
      approvalIds: [],
      grantIds: [...own.grantIds],
      reasons: [],
    };
  if (counting.length > 0)
    return {
      satisfied: true,
      basis: 'approvals',
      approvalIds: countedIds,
      grantIds: grantsOf(counting),
      reasons: [],
    };
  return {
    satisfied: false,
    basis: null,
    approvalIds: [],
    grantIds: [],
    reasons: [
      'no approver currently holds the approve right for this revision',
    ],
  };
};

/** Convenience used by tests and later domain adapters. */
export const authorHoldsRightAt = (
  world: Pick<FootballWorld, 'people' | 'authority'>,
  proposal: ProposalRecord,
  right: DecisionRight,
  date: string,
): boolean =>
  activeRightsAt(
    world,
    proposal.organizationId,
    proposal.authorPersonId,
    proposal.category,
    date,
  ).rights.includes(right);
