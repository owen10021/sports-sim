import type { CanonicalValue } from './audit';
import type { RouteContext } from './commandRouter';
import {
  bad,
  dayBefore,
  isFailure,
  isPlainObject,
  parseActingPerson,
  type Cmd,
  type Failure,
} from './commandSupport';
import { releaseImpact } from './contractMath';
import {
  activeAgreementFor,
  type ContractAgreement,
  type ContractTermination,
  type ContractsState,
  type TerminationReason,
} from './contracts';
import { latestProposal, type ProposalRecord } from './decisions';
import {
  MissingTransactionRulesError,
  requireTransactionRules,
  type TransactionRulesV1,
} from './economy';
import { entityId, isValidId, type EntityId, type RecordId } from './ids';
import {
  activeRightsFor,
  currentRosterMembership,
  seasonOfDate,
  type PlayerRightsRecord,
  type RosterMembership,
  type RosterState,
} from './roster';
import type { FootballWorld } from './world';

/**
 * Shared machinery for ending a player's tenure with a club: the validation every
 * release-style command performs, and the single place a contract is terminated and the
 * roster membership and rights end. The release and waiver paths both use it, so the
 * obligations that survive a termination are computed one way only.
 */

/** Everything a release-style command has established before it changes anything. */
export interface ReleaseTarget {
  readonly by: EntityId;
  readonly c: Cmd;
  readonly proposal: ProposalRecord;
  readonly playerId: EntityId;
  readonly organizationId: EntityId;
  readonly today: string;
  readonly tx: TransactionRulesV1;
  readonly membership: RosterMembership;
  readonly agreement: ContractAgreement;
  readonly right: PlayerRightsRecord;
}

const parsePlayerTerms = (
  ctx: RouteContext,
  terms: CanonicalValue,
  termsType: string,
): EntityId | Failure => {
  if (!isPlainObject(terms)) return bad('terms must be an object');
  if (Object.keys(terms).join(',') !== 'playerId')
    return bad(`${termsType} terms must be exactly { playerId }`);
  if (
    !isValidId(terms.playerId) ||
    !ctx.world.roster.players.some((p) => p.personId === terms.playerId)
  )
    return bad('playerId must name a player');
  return entityId(terms.playerId);
};

/**
 * Validates a release-style commit command (`CommitReleaseProposal`,
 * `CommitWaivePlayerProposal`): the proposal, the player's current membership, active
 * contract and contract right. It does not look at the ruleset's waiver policy.
 */
export const parseReleaseCommand = (
  ctx: RouteContext,
  c: Cmd,
  termsType: string,
  what: string,
): ReleaseTarget | Failure => {
  const { world } = ctx;
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  if (!isValidId(c.proposalId)) return bad('proposalId must be a valid id');
  const proposal = latestProposal(world.decisions, c.proposalId);
  if (proposal === undefined) return bad('proposalId does not name a proposal');
  if (typeof c.expectedRevision !== 'number')
    return bad('expectedRevision must be the proposal revision');
  if (c.expectedRevision !== proposal.revision)
    return bad(
      `proposal revision is stale: expected ${c.expectedRevision}, latest is ${proposal.revision}`,
    );
  if (proposal.termsType !== termsType)
    return bad(`only ${termsType} proposals commit as ${what}`);
  if (proposal.category !== 'roster')
    return bad(`${what} commit under the roster category`);
  if (!Array.isArray(c.beliefIds) || !Array.isArray(c.evidenceClaimIds))
    return bad('beliefIds and evidenceClaimIds must be arrays');
  if (!isPlainObject(c.rationale)) return bad('rationale must be an object');
  if (proposal.state !== 'authorized')
    return bad(
      `proposal is ${proposal.state}; only an authorized proposal commits`,
    );
  const playerId = parsePlayerTerms(ctx, proposal.terms, termsType);
  if (isFailure(playerId)) return playerId;

  const organizationId = proposal.organizationId;
  const today = world.simDate;
  let tx: TransactionRulesV1;
  try {
    tx = requireTransactionRules(ctx.ruleset);
  } catch (e) {
    if (e instanceof MissingTransactionRulesError) return bad(e.message);
    throw e;
  }
  const membership = currentRosterMembership(world.roster, playerId, today);
  if (membership === undefined || membership.organizationId !== organizationId)
    return bad(`${playerId} is not on the roster of ${organizationId}`);
  if (membership.effectiveFrom >= today)
    return bad(`${playerId} membership began today; it can end from tomorrow`);
  const agreement = activeAgreementFor(
    world.contracts,
    playerId,
    organizationId,
  );
  if (agreement === undefined)
    return bad(`${organizationId} has no active contract with ${playerId}`);
  const right = activeRightsFor(world.roster, playerId, today).find(
    (r) => r.holderOrganizationId === organizationId && r.kind === 'contract',
  );
  if (right === undefined)
    return bad(`${organizationId} holds no contract right to ${playerId}`);
  if (right.effectiveFrom >= today)
    return bad(
      `${playerId} contract right began today; it can end from tomorrow`,
    );
  return {
    by,
    c,
    proposal,
    playerId,
    organizationId,
    today,
    tx,
    membership,
    agreement,
    right,
  };
};

export interface TerminationInput {
  readonly world: FootballWorld;
  readonly agreement: ContractAgreement;
  readonly date: string;
  readonly reason: TerminationReason;
  readonly tx: TransactionRulesV1;
  /** The membership to end now; `null` when it already ended (a waived player). */
  readonly endMembershipId: RecordId | null;
  readonly terminationId: RecordId;
}

export interface TerminationResult {
  readonly contracts: ContractsState;
  readonly roster: RosterState;
  readonly termination: ContractTermination;
  readonly endedRightsId: RecordId;
}

const byId = <T extends { readonly id: string }>(a: T, b: T): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/**
 * Terminates a contract: marks the agreement terminated, records the obligations that
 * survive (dead cap by season, guaranteed cash due), ends the contract right and optionally
 * the roster membership. The player becomes unrestricted once the right has ended.
 */
export const terminateAgreement = (
  input: TerminationInput,
): TerminationResult => {
  const { world, agreement, date } = input;
  const impact = releaseImpact(
    input.tx.contracts,
    agreement.terms,
    seasonOfDate(date),
  );
  const right = activeRightsFor(world.roster, agreement.playerId, date).find(
    (r) =>
      r.holderOrganizationId === agreement.organizationId &&
      r.kind === 'contract',
  );
  if (right === undefined)
    throw new Error(`no contract right to end for ${agreement.id}`);
  const ended = dayBefore(date);
  const termination: ContractTermination = {
    id: input.terminationId,
    agreementId: agreement.id,
    organizationId: agreement.organizationId,
    playerId: agreement.playerId,
    terminatedAt: date,
    reason: input.reason,
    deadCapBySeason: impact.deadCapBySeason,
    guaranteedCashDue: impact.guaranteedCashDue,
  };
  return {
    contracts: {
      agreements: world.contracts.agreements.map((a) =>
        a.id === agreement.id ? { ...a, status: 'terminated' as const } : a,
      ),
      terminations: [...world.contracts.terminations, termination].sort(byId),
    },
    roster: {
      ...world.roster,
      memberships: world.roster.memberships.map((m) =>
        m.id === input.endMembershipId ? { ...m, effectiveUntil: ended } : m,
      ),
      rights: world.roster.rights.map((r) =>
        r.id === right.id ? { ...r, effectiveUntil: ended } : r,
      ),
    },
    termination,
    endedRightsId: right.id,
  };
};
