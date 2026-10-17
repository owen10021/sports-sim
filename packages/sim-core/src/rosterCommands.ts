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
import { latestProposal } from './decisions';
import {
  MissingTransactionRulesError,
  UnknownTransactionSeasonError,
  requireTransactionRules,
} from './economy';
import { entityId, isValidId, type EntityId } from './ids';
import {
  currentRosterMembership,
  holdsContractRight,
  rosterCapacity,
  type RosterMembership,
  type RosterStatus,
} from './roster';
import { commitAuthorizedDomainChange } from './transactionCommit';

export const ROSTER_COMMAND_TYPES = ['CommitRosterStatusProposal'] as const;
export type RosterCommandType = (typeof ROSTER_COMMAND_TYPES)[number];

export const ROSTER_STATUS_TERMS_TYPE = 'roster_status_v1';

/**
 * The only status moves a roster command can make. A player on the active or reserve list
 * is never demoted straight to the practice squad: that goes through release, waivers and a
 * market signing, which is where contracts and rights are created and priced.
 */
export const ROSTER_STATUS_ACTIONS = {
  active_to_reserve: { from: 'active', to: 'reserve' },
  reserve_to_active: { from: 'reserve', to: 'active' },
  practice_squad_to_active: { from: 'practice_squad', to: 'active' },
  practice_squad_to_reserve: { from: 'practice_squad', to: 'reserve' },
} as const satisfies Record<
  string,
  { readonly from: RosterStatus; readonly to: RosterStatus }
>;
export type RosterStatusAction = keyof typeof ROSTER_STATUS_ACTIONS;

const isAction = (v: unknown): v is RosterStatusAction =>
  typeof v === 'string' &&
  Object.prototype.hasOwnProperty.call(ROSTER_STATUS_ACTIONS, v);

type StatusTerms = {
  readonly playerId: EntityId;
  readonly action: RosterStatusAction;
};

const parseTerms = (
  ctx: RouteContext,
  terms: CanonicalValue,
): StatusTerms | Failure => {
  if (!isPlainObject(terms)) return bad('terms must be an object');
  const keys = Object.keys(terms).sort();
  if (keys.join(',') !== 'action,playerId')
    return bad('roster_status_v1 terms must be exactly { playerId, action }');
  if (!isAction(terms.action))
    return bad(
      `action must be one of ${Object.keys(ROSTER_STATUS_ACTIONS).join(', ')}`,
    );
  if (
    !isValidId(terms.playerId) ||
    !ctx.world.roster.players.some((p) => p.personId === terms.playerId)
  )
    return bad('playerId must name a player');
  return { playerId: entityId(terms.playerId), action: terms.action };
};

const routeCommitStatus = (ctx: RouteContext, c: Cmd): RouteOutcome => {
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
  if (proposal.termsType !== ROSTER_STATUS_TERMS_TYPE)
    return bad(
      `only ${ROSTER_STATUS_TERMS_TYPE} proposals commit as roster status changes`,
    );
  if (proposal.category !== 'roster')
    return bad('roster status changes commit under the roster category');
  if (!Array.isArray(c.beliefIds) || !Array.isArray(c.evidenceClaimIds))
    return bad('beliefIds and evidenceClaimIds must be arrays');
  if (!isPlainObject(c.rationale)) return bad('rationale must be an object');
  if (proposal.state !== 'authorized')
    return bad(
      `proposal is ${proposal.state}; only an authorized proposal commits`,
    );

  const terms = parseTerms(ctx, proposal.terms);
  if (isFailure(terms)) return terms;
  const { from, to } = ROSTER_STATUS_ACTIONS[terms.action];
  const organizationId = proposal.organizationId;
  const today = world.simDate;

  const membership = currentRosterMembership(
    world.roster,
    terms.playerId,
    today,
  );
  if (membership === undefined || membership.organizationId !== organizationId)
    return bad(`${terms.playerId} is not on the roster of ${organizationId}`);
  if (membership.status !== from)
    return bad(
      `${terms.playerId} has status ${membership.status}, not ${from}`,
    );
  if (membership.effectiveFrom >= today)
    return bad(
      `${terms.playerId} membership began today; its status can change from tomorrow`,
    );
  if (!holdsContractRight(world.roster, terms.playerId, organizationId, today))
    return bad(
      `${organizationId} holds no contract right to ${terms.playerId}`,
    );

  let room: number;
  try {
    const tx = requireTransactionRules(ctx.ruleset);
    const capacity = rosterCapacity(world.roster, tx, organizationId, today);
    room = capacity[to].room;
    if (room < 1)
      return bad(
        `${to} capacity is full (${capacity[to].count}/${capacity[to].limit})`,
      );
  } catch (e) {
    if (
      e instanceof MissingTransactionRulesError ||
      e instanceof UnknownTransactionSeasonError
    )
      return bad(e.message);
    throw e;
  }

  const minted = mintRecordId(world);
  const next: RosterMembership = {
    id: minted.id,
    playerId: terms.playerId,
    organizationId,
    status: to,
    effectiveFrom: today,
    effectiveUntil: null,
    sourceRecordId: proposal.id,
  };
  const memberships = [
    ...world.roster.memberships.map((m) =>
      m.id === membership.id ? { ...m, effectiveUntil: dayBefore(today) } : m,
    ),
    next,
  ].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const events: EventSpec[] = [
    spec('RosterStatusChanged', {
      organizationId,
      playerId: terms.playerId,
      action: terms.action,
      from,
      to,
      supersededMembershipId: membership.id,
      membershipId: next.id,
      proposalId: proposal.id,
      proposalRevision: proposal.revision,
    }),
  ];
  return commitAuthorizedDomainChange(ctx, {
    nextWorld: {
      ...world,
      roster: { ...world.roster, memberships },
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
          termsType: ROSTER_STATUS_TERMS_TYPE,
          terms: { playerId: terms.playerId, action: terms.action },
        },
        beliefIds: c.beliefIds as string[],
        evidenceClaimIds: c.evidenceClaimIds as string[],
        rationale: c.rationale,
        protectedChange: {
          subject: { playerId: terms.playerId },
          change: { kind: 'roster_status', action: terms.action },
        },
      },
    ],
  });
};

export const routeRosterCommand = (
  ctx: RouteContext,
  command: CommandPayloadBase & { readonly type: RosterCommandType },
): RouteOutcome => {
  const c = command as Cmd;
  switch (command.type) {
    case 'CommitRosterStatusProposal':
      return routeCommitStatus(ctx, c);
    default: {
      const unreachable: never = command.type;
      throw new Error(`unroutable roster command: ${String(unreachable)}`);
    }
  }
};
