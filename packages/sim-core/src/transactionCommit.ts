import type { CanonicalValue } from './audit';
import {
  isProtectedAt,
  validateMandateAt,
  type DecisionCategory,
  type MandateUsage,
} from './authority';
import type { EventSpec, RouteContext, RouteOutcome } from './commandRouter';
import {
  bad,
  denied,
  isFailure,
  protectedBy,
  type Failure,
} from './commandSupport';
import {
  PACKAGE_C_PROPOSAL_CATEGORIES,
  PACKAGE_D_PROPOSAL_CATEGORIES,
  commitProposals,
  type CommitPart,
} from './decisionCommands';
import { latestProposal, proposalTermsHash, rightBackingAt } from './decisions';
import type { EntityId } from './ids';
import type { FootballWorld } from './world';

/**
 * One organization's side of a domain transaction (a signing, a release, a roster move, one
 * half of a trade). Domain routers never touch proposals, approvals or receipts themselves:
 * they describe the executed terms here and the shared Package B gate does the rest.
 */
export interface DomainCommitRequest {
  readonly organizationId: EntityId;
  readonly actorPersonId: EntityId;
  readonly proposalId: string;
  /** The exact revision the caller was shown; anything newer makes the commit stale. */
  readonly expectedRevision: number;
  readonly expectedCategory: DecisionCategory;
  /** The canonical terms the domain change actually executes; must hash to the authorized terms. */
  readonly executedTerms: {
    readonly termsType: string;
    readonly terms: CanonicalValue;
  };
  readonly beliefIds: readonly string[];
  readonly evidenceClaimIds: readonly string[];
  readonly rationale: CanonicalValue;
  /** Required whenever execute rights come from a mandate; checked against its scope and limits. */
  readonly mandateUsage?: MandateUsage;
  /** The protected change this transaction would make, checked against active constraints. */
  readonly protectedChange?: {
    readonly subject: CanonicalValue;
    readonly change: CanonicalValue;
  };
}

export const isDomainCommitCategory = (category: DecisionCategory): boolean =>
  PACKAGE_C_PROPOSAL_CATEGORIES.includes(category) ||
  PACKAGE_D_PROPOSAL_CATEGORIES.includes(category);

/**
 * Validates everything that is specific to a domain commit, against the live world at the
 * instant of commit, and returns the part the shared gate commits. The gate then re-derives
 * the common checks (live proposal, exact revision, deadline, current approval/authority
 * backing, execute right, cited-knowledge visibility), so nothing here is trusted later.
 */
export const prepareAuthorizedDomainCommit = (
  ctx: RouteContext,
  request: DomainCommitRequest,
): CommitPart | Failure => {
  const world = ctx.world;
  const today = world.simDate;
  if (!isDomainCommitCategory(request.expectedCategory))
    return bad(
      `category ${request.expectedCategory} is not a domain transaction category`,
    );
  const proposal = latestProposal(world.decisions, request.proposalId);
  if (proposal === undefined) return bad('proposalId does not name a proposal');
  if (request.expectedRevision !== proposal.revision)
    return bad(
      `proposal revision is stale: expected ${request.expectedRevision}, latest is ${proposal.revision}`,
    );
  if (proposal.organizationId !== request.organizationId)
    return bad(`proposal belongs to ${proposal.organizationId}`);
  if (proposal.category !== request.expectedCategory)
    return bad(
      `proposal category is ${proposal.category}, not ${request.expectedCategory}`,
    );
  if (proposal.termsType !== request.executedTerms.termsType)
    return bad(
      `executed termsType ${request.executedTerms.termsType} differs from the authorized ${proposal.termsType}`,
    );
  const executedHash = proposalTermsHash({
    category: proposal.category,
    subjects: proposal.subjects,
    termsType: proposal.termsType,
    terms: request.executedTerms.terms,
  });
  if (executedHash !== proposal.termsHash)
    return bad('executed terms differ from the authorized terms');

  if (request.protectedChange !== undefined) {
    const hits = isProtectedAt(
      world,
      request.organizationId,
      request.protectedChange.subject,
      request.protectedChange.change,
      today,
    );
    if (hits.length > 0)
      return protectedBy(
        `protected constraint ${hits[0]!.id} forbids this change`,
      );
  }

  const backing = rightBackingAt(
    world,
    request.organizationId,
    request.actorPersonId,
    proposal.category,
    'execute',
    today,
  );
  if (backing === null)
    return denied(
      `${request.actorPersonId} lacks execute on ${proposal.category} in ${request.organizationId}`,
    );
  if (backing.mandateId !== null) {
    if (request.mandateUsage === undefined)
      return bad('mandateUsage is required when executing under a mandate');
    const verdict = validateMandateAt(
      world,
      backing.mandateId,
      today,
      request.mandateUsage,
    );
    if (!verdict.ok)
      return denied(
        `${verdict.outcome === 'escalate' ? 'escalation required: ' : ''}${verdict.reasons.join('; ')}`,
      );
  }
  return {
    proposalId: request.proposalId,
    expectedRevision: request.expectedRevision,
    actorPersonId: request.actorPersonId,
    beliefIds: request.beliefIds,
    evidenceClaimIds: request.evidenceClaimIds,
    rationale: request.rationale,
  };
};

export interface AuthorizedDomainChange {
  /** The world after the domain's own changes; decision state is layered on by the gate. */
  readonly nextWorld: FootballWorld;
  readonly domainEvents: readonly EventSpec[];
  /** One request per organization taking part; a trade supplies two and gets two receipts. */
  readonly requests: readonly DomainCommitRequest[];
}

/**
 * The single entry point domain routers use to commit. All requests are prepared and
 * revalidated first; either every proposal commits with its immutable receipt in this one
 * resolution, or nothing changes.
 */
export const commitAuthorizedDomainChange = (
  ctx: RouteContext,
  change: AuthorizedDomainChange,
): RouteOutcome => {
  if (change.requests.length === 0)
    return bad('a domain commit needs at least one request');
  const parts: CommitPart[] = [];
  for (const request of change.requests) {
    const part = prepareAuthorizedDomainCommit(ctx, request);
    if (isFailure(part)) return part;
    parts.push(part);
  }
  return commitProposals(ctx, {
    nextWorld: change.nextWorld,
    parts,
    domainEvents: change.domainEvents,
  });
};
