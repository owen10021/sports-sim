import type { CanonicalValue, CommandPayloadBase } from './audit';
import type { EventSpec, RouteContext, RouteOutcome } from './commandRouter';
import {
  bad,
  dayBefore,
  isFailure,
  isPlainObject,
  mintRecordId,
  parseActingPerson,
  spec,
  type Cmd,
  type Failure,
} from './commandSupport';
import { releaseImpact } from './contractMath';
import {
  activeAgreementFor,
  type ContractAgreement,
  type ContractTermination,
} from './contracts';
import { latestProposal } from './decisions';
import {
  MissingTransactionRulesError,
  UnknownTransactionSeasonError,
  requireTransactionRules,
} from './economy';
import { entityId, isValidId, type EntityId } from './ids';
import {
  activeRightsFor,
  currentRosterMembership,
  seasonOfDate,
} from './roster';
import { commitAuthorizedDomainChange } from './transactionCommit';

export const CONTRACT_COMMAND_TYPES = ['CommitReleaseProposal'] as const;
export type ContractCommandType = (typeof CONTRACT_COMMAND_TYPES)[number];

export const RELEASE_TERMS_TYPE = 'release_player_v1';

type ReleaseTerms = { readonly playerId: EntityId };

const parseTerms = (
  ctx: RouteContext,
  terms: CanonicalValue,
): ReleaseTerms | Failure => {
  if (!isPlainObject(terms)) return bad('terms must be an object');
  if (Object.keys(terms).join(',') !== 'playerId')
    return bad('release_player_v1 terms must be exactly { playerId }');
  if (
    !isValidId(terms.playerId) ||
    !ctx.world.roster.players.some((p) => p.personId === terms.playerId)
  )
    return bad('playerId must name a player');
  return { playerId: entityId(terms.playerId) };
};

const routeRelease = (ctx: RouteContext, c: Cmd): RouteOutcome => {
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
  if (proposal.termsType !== RELEASE_TERMS_TYPE)
    return bad(`only ${RELEASE_TERMS_TYPE} proposals commit as releases`);
  if (proposal.category !== 'roster')
    return bad('releases commit under the roster category');
  if (!Array.isArray(c.beliefIds) || !Array.isArray(c.evidenceClaimIds))
    return bad('beliefIds and evidenceClaimIds must be arrays');
  if (!isPlainObject(c.rationale)) return bad('rationale must be an object');
  if (proposal.state !== 'authorized')
    return bad(
      `proposal is ${proposal.state}; only an authorized proposal commits`,
    );
  const terms = parseTerms(ctx, proposal.terms);
  if (isFailure(terms)) return terms;

  const organizationId = proposal.organizationId;
  const today = world.simDate;
  let tx;
  try {
    tx = requireTransactionRules(ctx.ruleset);
  } catch (e) {
    if (e instanceof MissingTransactionRulesError) return bad(e.message);
    throw e;
  }
  // Under a waive-all ruleset a released player must pass through waivers; that path owns
  // the contract termination (Task 7). Nothing here may shortcut it into free agency.
  if (tx.waivers.releasedPlayerWaiverPolicy !== 'none')
    return bad(
      `this ruleset routes releases through waivers (releasedPlayerWaiverPolicy=${tx.waivers.releasedPlayerWaiverPolicy})`,
    );

  const membership = currentRosterMembership(
    world.roster,
    terms.playerId,
    today,
  );
  if (membership === undefined || membership.organizationId !== organizationId)
    return bad(`${terms.playerId} is not on the roster of ${organizationId}`);
  if (membership.effectiveFrom >= today)
    return bad(
      `${terms.playerId} membership began today; it can end from tomorrow`,
    );
  const agreement = activeAgreementFor(
    world.contracts,
    terms.playerId,
    organizationId,
  );
  if (agreement === undefined)
    return bad(
      `${organizationId} has no active contract with ${terms.playerId}`,
    );
  const right = activeRightsFor(world.roster, terms.playerId, today).find(
    (r) => r.holderOrganizationId === organizationId && r.kind === 'contract',
  );
  if (right === undefined)
    return bad(
      `${organizationId} holds no contract right to ${terms.playerId}`,
    );
  if (right.effectiveFrom >= today)
    return bad(
      `${terms.playerId} contract right began today; it can end from tomorrow`,
    );

  let impact;
  try {
    impact = releaseImpact(tx.contracts, agreement.terms, seasonOfDate(today));
  } catch (e) {
    if (e instanceof UnknownTransactionSeasonError) return bad(e.message);
    throw e;
  }

  const minted = mintRecordId(world);
  const termination: ContractTermination = {
    id: minted.id,
    agreementId: agreement.id,
    organizationId,
    playerId: terms.playerId,
    terminatedAt: today,
    reason: 'release',
    deadCapBySeason: impact.deadCapBySeason,
    guaranteedCashDue: impact.guaranteedCashDue,
  };
  const ended = dayBefore(today);
  const agreements: ContractAgreement[] = world.contracts.agreements.map((a) =>
    a.id === agreement.id ? { ...a, status: 'terminated' as const } : a,
  );
  const events: EventSpec[] = [
    spec('ContractTerminated', {
      terminationId: termination.id,
      agreementId: agreement.id,
      organizationId,
      playerId: terms.playerId,
      reason: 'release',
      terminatedAt: today,
      deadCapBySeason: impact.deadCapBySeason.map((x) => ({ ...x })),
      guaranteedCashDue: impact.guaranteedCashDue,
      proposalId: proposal.id,
      proposalRevision: proposal.revision,
    }),
    spec('PlayerReleased', {
      organizationId,
      playerId: terms.playerId,
      endedMembershipId: membership.id,
      endedRightsId: right.id,
      terminationId: termination.id,
    }),
  ];
  return commitAuthorizedDomainChange(ctx, {
    nextWorld: {
      ...world,
      contracts: {
        agreements,
        terminations: [...world.contracts.terminations, termination].sort(
          (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
        ),
      },
      roster: {
        ...world.roster,
        memberships: world.roster.memberships.map((m) =>
          m.id === membership.id ? { ...m, effectiveUntil: ended } : m,
        ),
        rights: world.roster.rights.map((r) =>
          r.id === right.id ? { ...r, effectiveUntil: ended } : r,
        ),
      },
      nextIds: { ...world.nextIds, record: minted.next },
    },
    domainEvents: events,
    requests: [
      {
        organizationId,
        actorPersonId: by,
        proposalId: proposal.id,
        expectedRevision: proposal.revision,
        expectedCategory: 'roster',
        executedTerms: {
          termsType: RELEASE_TERMS_TYPE,
          terms: { playerId: terms.playerId },
        },
        beliefIds: c.beliefIds as string[],
        evidenceClaimIds: c.evidenceClaimIds as string[],
        rationale: c.rationale,
        protectedChange: {
          subject: { playerId: terms.playerId },
          change: { kind: 'release' },
        },
      },
    ],
  });
};

export const routeContractCommand = (
  ctx: RouteContext,
  command: CommandPayloadBase & { readonly type: ContractCommandType },
): RouteOutcome => {
  const c = command as Cmd;
  switch (command.type) {
    case 'CommitReleaseProposal':
      return routeRelease(ctx, c);
    default: {
      const unreachable: never = command.type;
      throw new Error(`unroutable contract command: ${String(unreachable)}`);
    }
  }
};
