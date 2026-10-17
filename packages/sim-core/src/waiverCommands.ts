import { effectiveRightsAt } from './authority';
import type { CommandPayloadBase } from './audit';
import type { EventSpec, RouteContext, RouteOutcome } from './commandRouter';
import {
  bad,
  dayBefore,
  denied,
  hasKind,
  isFailure,
  mintRecordId,
  mintRecordIds,
  parseActingPerson,
  parseOrganization,
  spec,
  type Cmd,
} from './commandSupport';
import {
  parseReleaseCommand,
  terminateAgreement,
  type ReleaseTarget,
} from './contractLifecycle';
import { capChargeBySeason, capPosition } from './contractMath';
import type { ContractAgreement, SeasonAmount } from './contracts';
import { UnknownTransactionSeasonError, moneyAmount } from './economy';
import type { TransactionRulesV1 } from './economy';
import { entityId, isValidId, type EntityId, type RecordId } from './ids';
import { reservedCap, reservedSlots, type Reservation } from './market';
import {
  activeRightsFor,
  rosterCapacity,
  seasonOfDate,
  type RosterMembership,
  type RosterState,
  type WaiverClaim,
  type WaiverRecord,
} from './roster';
import { SimDate } from './simDate';
import { commitAuthorizedDomainChange } from './transactionCommit';
import type { FootballWorld } from './world';

export const WAIVER_COMMAND_TYPES = [
  'CommitWaivePlayerProposal',
  'SubmitWaiverClaim',
  'ResolveWaivers',
] as const;
export type WaiverCommandType = (typeof WAIVER_COMMAND_TYPES)[number];

export const WAIVE_TERMS_TYPE = 'waive_player_v1';

/** Actors that may run the logical-boundary resolution; CPU orgs and delegates may not. */
const RESOLVERS: ReadonlySet<string> = new Set([
  'human_gm',
  'commissioner',
  'system',
  'test_harness',
]);

const byId = <T extends { readonly id: string }>(a: T, b: T): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

// --- opening a waiver ---------------------------------------------------------

/**
 * Takes a released player off the roster and opens a waiver. The contract agreement and the
 * contract right stay with the waiving club, so its cap charge and obligations are not
 * erased; only the roster membership ends. Used by `CommitWaivePlayerProposal` and by
 * `CommitReleaseProposal` under a waive-all ruleset.
 */
export const openWaiver = (
  ctx: RouteContext,
  target: ReleaseTarget,
  termsType: string,
): RouteOutcome => {
  const { world } = ctx;
  const { proposal, by, tx, membership, agreement, today, playerId } = target;
  const minted = mintRecordId(world);
  const waiver: WaiverRecord = {
    id: minted.id,
    playerId,
    waivingOrganizationId: target.organizationId,
    contractAgreementId: agreement.id,
    openedAt: today,
    claimDeadline: SimDate.parse(today)
      .addDays(tx.waivers.claimWindowDays)
      .toISO(),
    status: 'open',
    winnerOrganizationId: null,
    resolvedAt: null,
  };
  const memberships = world.roster.memberships.map((m) =>
    m.id === membership.id ? { ...m, effectiveUntil: dayBefore(today) } : m,
  );
  const events: EventSpec[] = [
    spec('WaiverOpened', {
      waiverId: waiver.id,
      playerId,
      waivingOrganizationId: waiver.waivingOrganizationId,
      contractAgreementId: agreement.id,
      openedAt: waiver.openedAt,
      claimDeadline: waiver.claimDeadline,
      endedMembershipId: membership.id,
      proposalId: proposal.id,
      proposalRevision: proposal.revision,
    }),
  ];
  return commitAuthorizedDomainChange(ctx, {
    nextWorld: {
      ...world,
      roster: {
        ...world.roster,
        memberships,
        waivers: [...world.roster.waivers, waiver].sort(byId),
      },
      nextIds: { ...world.nextIds, record: minted.next },
    },
    domainEvents: events,
    requests: [
      {
        organizationId: target.organizationId,
        actorPersonId: by,
        proposalId: proposal.id,
        expectedRevision: proposal.revision,
        expectedCategory: 'roster',
        executedTerms: { termsType, terms: { playerId } },
        beliefIds: target.c.beliefIds as string[],
        evidenceClaimIds: target.c.evidenceClaimIds as string[],
        rationale: target.c.rationale as string,
        protectedChange: {
          subject: { playerId },
          change: { kind: 'release' },
        },
      },
    ],
  });
};

const routeWaive = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const target = parseReleaseCommand(ctx, c, WAIVE_TERMS_TYPE, 'waivers');
  if (isFailure(target)) return target;
  if (target.tx.waivers.releasedPlayerWaiverPolicy !== 'all')
    return bad('this ruleset does not waive released players');
  if (target.membership.status === 'practice_squad')
    return bad('practice-squad players are released, not waived');
  return openWaiver(ctx, target, WAIVE_TERMS_TYPE);
};

// --- legality shared by claims and resolution ---------------------------------

/** The cap charges a claimant would take on, for the current and later seasons. */
const claimCharges = (
  tx: TransactionRulesV1,
  agreement: ContractAgreement,
  today: string,
): readonly SeasonAmount[] =>
  capChargeBySeason(tx.contracts, agreement.terms).filter(
    (x) => x.season >= seasonOfDate(today),
  );

/**
 * Why a club cannot take on this contract and roster slot now, or `null` when it can.
 * Reservations are counted only when asked: submitting a claim must respect room already
 * held for other pending commitments; resolving one is checked against actual state.
 */
const claimObstacle = (
  world: FootballWorld,
  tx: TransactionRulesV1,
  organizationId: EntityId,
  status: 'active' | 'reserve',
  charges: readonly SeasonAmount[],
  withReservations: boolean,
): string | null => {
  const today = world.simDate;
  try {
    for (const charge of charges) {
      const position = capPosition(
        tx,
        world.contracts,
        organizationId,
        charge.season,
      );
      const held = withReservations
        ? reservedCap(world.market, organizationId, charge.season)
        : 0;
      if (position.committed + held + charge.amount > position.cap)
        return `cap: season ${charge.season} would exceed ${position.cap} (committed ${position.committed}, reserved ${held}, incoming ${charge.amount})`;
    }
    const capacity = rosterCapacity(world.roster, tx, organizationId, today)[
      status
    ];
    const held = withReservations
      ? reservedSlots(world.market, organizationId, status)
      : 0;
    if (capacity.count + held + 1 > capacity.limit)
      return `roster capacity: ${status} has ${capacity.count} players and ${held} reserved of ${capacity.limit}`;
  } catch (e) {
    if (e instanceof UnknownTransactionSeasonError) return e.message;
    throw e;
  }
  return null;
};

// --- SubmitWaiverClaim --------------------------------------------------------

const CLAIM_STATUSES = ['active', 'reserve'] as const;

const routeClaim = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  const organizationId = parseOrganization(ctx, c.organizationId);
  if (isFailure(organizationId)) return organizationId;
  if (!isValidId(c.waiverId)) return bad('waiverId must be a valid id');
  const waiver = world.roster.waivers.find((w) => w.id === c.waiverId);
  if (waiver === undefined) return bad('waiverId does not name a waiver');
  if (
    !(CLAIM_STATUSES as readonly unknown[]).includes(c.rosterStatus) ||
    typeof c.rosterStatus !== 'string'
  )
    return bad('rosterStatus must be active or reserve');
  const status = c.rosterStatus as 'active' | 'reserve';
  const today = world.simDate;
  if (waiver.status !== 'open') return bad(`waiver is ${waiver.status}`);
  if (today > waiver.claimDeadline)
    return bad(`the claim window closed on ${waiver.claimDeadline}`);
  if (organizationId === waiver.waivingOrganizationId)
    return bad('an organization cannot claim a player it waived');
  if (
    world.roster.waiverClaims.some(
      (x) =>
        x.waiverId === waiver.id &&
        x.claimingOrganizationId === organizationId &&
        x.active,
    )
  )
    return bad('this organization already has an active claim on the waiver');
  if (
    !effectiveRightsAt(
      world,
      organizationId,
      by,
      'acquisition',
      today,
    ).rights.includes('execute')
  )
    return denied(`${by} lacks execute on acquisition in ${organizationId}`);

  const agreement = world.contracts.agreements.find(
    (a) => a.id === waiver.contractAgreementId && a.status === 'active',
  );
  if (agreement === undefined) return bad('the waived contract is not active');
  const tx = ctx.ruleset.rules.transactions;
  if (tx === undefined) return bad('the ruleset has no transaction rules');
  const charges = claimCharges(tx, agreement, today);
  const obstacle = claimObstacle(
    world,
    tx,
    organizationId,
    status,
    charges,
    true,
  );
  if (obstacle !== null) return bad(obstacle);

  const minted = mintRecordIds(world, 2);
  const claimId = minted.ids[0]!;
  const reservationId = minted.ids[1]!;
  const reservation: Reservation = {
    id: reservationId,
    organizationId,
    sourceKind: 'waiver_claim',
    sourceRecordId: claimId,
    capBySeason: charges,
    rosterSlotStatus: status,
    createdAt: today,
    status: 'active',
  };
  const claim: WaiverClaim = {
    id: claimId,
    waiverId: waiver.id,
    claimingOrganizationId: organizationId,
    submittedBy: by,
    submittedAt: today,
    rosterStatus: status,
    reservationId,
    active: true,
  };
  return {
    ok: true,
    authorizationDetail: `${by} holds execute on acquisition in ${organizationId}`,
    resolution: {
      nextWorld: {
        ...world,
        roster: {
          ...world.roster,
          waiverClaims: [...world.roster.waiverClaims, claim].sort(byId),
        },
        market: {
          ...world.market,
          reservations: [...world.market.reservations, reservation].sort(byId),
        },
        nextIds: { ...world.nextIds, record: minted.next },
      },
      eventSpecs: [
        spec('WaiverClaimSubmitted', {
          claimId,
          waiverId: waiver.id,
          playerId: waiver.playerId,
          claimingOrganizationId: organizationId,
          submittedBy: by,
          rosterStatus: status,
          reservationId,
          reservedCapBySeason: charges.map((x) => ({ ...x })),
        }),
      ],
      detail: `${organizationId} claims ${waiver.playerId}`,
    },
  };
};

// --- ResolveWaivers -----------------------------------------------------------

type Resolution = {
  readonly world: FootballWorld;
  readonly events: readonly EventSpec[];
};

const setReservations = (
  world: FootballWorld,
  ids: ReadonlyMap<RecordId, 'consumed' | 'released'>,
): FootballWorld => ({
  ...world,
  market: {
    ...world.market,
    reservations: world.market.reservations.map((r) => {
      const next = ids.get(r.id);
      return next === undefined ? r : { ...r, status: next };
    }),
  },
});

const resolveOne = (
  start: FootballWorld,
  waiver: WaiverRecord,
  tx: TransactionRulesV1,
): Resolution => {
  let world = start;
  const today = world.simDate;
  const agreement = world.contracts.agreements.find(
    (a) => a.id === waiver.contractAgreementId,
  )!;
  const priority = world.roster.waiverPriority;
  const rank = (org: EntityId): number => priority.indexOf(org);
  const claims = world.roster.waiverClaims
    .filter((x) => x.waiverId === waiver.id && x.active)
    .sort(
      (a, b) =>
        rank(a.claimingOrganizationId) - rank(b.claimingOrganizationId) ||
        (a.id < b.id ? -1 : 1),
    );
  const charges = claimCharges(tx, agreement, today);
  const winning = claims.find(
    (x) =>
      claimObstacle(
        world,
        tx,
        x.claimingOrganizationId,
        x.rosterStatus,
        charges,
        false,
      ) === null,
  );

  const reservationFate = new Map<RecordId, 'consumed' | 'released'>();
  for (const x of claims)
    reservationFate.set(
      x.reservationId,
      x === winning ? 'consumed' : 'released',
    );
  const closedClaims = world.roster.waiverClaims.map((x) =>
    x.waiverId === waiver.id && x.active ? { ...x, active: false } : x,
  );
  const events: EventSpec[] = [];

  if (winning !== undefined) {
    const minted = mintRecordIds(world, 3);
    const [agreementId, rightId, membershipId] = minted.ids as [
      RecordId,
      RecordId,
      RecordId,
    ];
    const oldRight = activeRightsFor(world.roster, waiver.playerId, today).find(
      (r) =>
        r.holderOrganizationId === waiver.waivingOrganizationId &&
        r.kind === 'contract',
    )!;
    const winner = winning.claimingOrganizationId;
    const assumed: ContractAgreement = {
      id: agreementId,
      playerId: waiver.playerId,
      organizationId: winner,
      terms: agreement.terms,
      signedAt: agreement.signedAt,
      sourceOfferId: null,
      sourceProposalId: null,
      supersedesAgreementId: agreement.id,
      status: 'active',
    };
    const membership: RosterMembership = {
      id: membershipId,
      playerId: waiver.playerId,
      organizationId: winner,
      status: winning.rosterStatus,
      effectiveFrom: today,
      effectiveUntil: null,
      sourceRecordId: agreementId,
    };
    const roster: RosterState = {
      ...world.roster,
      rights: [
        ...world.roster.rights.map((r) =>
          r.id === oldRight.id ? { ...r, effectiveUntil: dayBefore(today) } : r,
        ),
        {
          id: rightId,
          playerId: waiver.playerId,
          holderOrganizationId: winner,
          kind: 'contract' as const,
          sourceRecordId: agreementId,
          effectiveFrom: today,
          effectiveUntil: null,
        },
      ].sort(byId),
      memberships: [...world.roster.memberships, membership].sort(byId),
      waivers: world.roster.waivers.map((w) =>
        w.id === waiver.id
          ? {
              ...w,
              status: 'awarded' as const,
              winnerOrganizationId: winner,
              resolvedAt: today,
            }
          : w,
      ),
      waiverClaims: closedClaims,
      waiverPriority: tx.waivers.claimWinnerMovesToEnd
        ? [...priority.filter((o) => o !== winner), winner]
        : priority,
    };
    world = setReservations(
      {
        ...world,
        roster,
        contracts: {
          ...world.contracts,
          agreements: [
            ...world.contracts.agreements.map((a) =>
              a.id === agreement.id
                ? { ...a, status: 'superseded' as const }
                : a,
            ),
            assumed,
          ].sort(byId),
        },
        nextIds: { ...world.nextIds, record: minted.next },
      },
      reservationFate,
    );
    events.push(
      spec('WaiverAwarded', {
        waiverId: waiver.id,
        playerId: waiver.playerId,
        fromOrganizationId: waiver.waivingOrganizationId,
        winnerOrganizationId: winner,
        claimId: winning.id,
        supersededAgreementId: agreement.id,
        assumedAgreementId: agreementId,
        endedRightsId: oldRight.id,
        newRightsId: rightId,
        membershipId,
        rosterStatus: winning.rosterStatus,
        resolvedAt: today,
        competingClaimIds: claims.filter((x) => x !== winning).map((x) => x.id),
      }),
    );
    return { world, events };
  }

  const minted = mintRecordId(world);
  const result = terminateAgreement({
    world,
    agreement,
    date: today,
    reason: 'waiver_unclaimed',
    tx,
    endMembershipId: null,
    terminationId: minted.id,
  });
  world = setReservations(
    {
      ...world,
      contracts: result.contracts,
      roster: {
        ...result.roster,
        waivers: result.roster.waivers.map((w) =>
          w.id === waiver.id
            ? { ...w, status: 'unclaimed' as const, resolvedAt: today }
            : w,
        ),
        waiverClaims: closedClaims,
      },
      nextIds: { ...world.nextIds, record: minted.next },
    },
    reservationFate,
  );
  const t = result.termination;
  events.push(
    spec('WaiverUnclaimed', {
      waiverId: waiver.id,
      playerId: waiver.playerId,
      waivingOrganizationId: waiver.waivingOrganizationId,
      resolvedAt: today,
      releasedClaimIds: claims.map((x) => x.id),
    }),
    spec('ContractTerminated', {
      terminationId: t.id,
      agreementId: agreement.id,
      organizationId: t.organizationId,
      playerId: t.playerId,
      reason: 'waiver_unclaimed',
      terminatedAt: today,
      deadCapBySeason: t.deadCapBySeason.map((x) => ({ ...x })),
      guaranteedCashDue: t.guaranteedCashDue,
      endedRightsId: result.endedRightsId,
    }),
  );
  return { world, events };
};

const routeResolve = (ctx: RouteContext): RouteOutcome => {
  if (!RESOLVERS.has(ctx.actor.kind))
    return denied(`${ctx.actor.kind} cannot resolve waivers`);
  const tx = ctx.ruleset.rules.transactions;
  if (tx === undefined) return bad('the ruleset has no transaction rules');
  const today = ctx.world.simDate;
  const due = ctx.world.roster.waivers
    .filter((w) => w.status === 'open' && today >= w.claimDeadline)
    .sort(byId);
  if (due.length === 0) return bad('no waiver is due');
  let world = ctx.world;
  const events: EventSpec[] = [];
  for (const waiver of due) {
    const step = resolveOne(world, waiver, tx);
    world = step.world;
    events.push(...step.events);
  }
  return {
    ok: true,
    authorizationDetail: `${ctx.actor.kind} may resolve waivers`,
    resolution: {
      nextWorld: world,
      eventSpecs: events,
      detail: `resolved ${due.length} waiver(s) on ${today}`,
    },
  };
};

export const routeWaiverCommand = (
  ctx: RouteContext,
  command: CommandPayloadBase & { readonly type: WaiverCommandType },
): RouteOutcome => {
  const c = command as Cmd;
  switch (command.type) {
    case 'CommitWaivePlayerProposal':
      return routeWaive(ctx, c);
    case 'SubmitWaiverClaim':
      return routeClaim(ctx, c);
    case 'ResolveWaivers':
      return routeResolve(ctx);
    default: {
      const unreachable: never = command.type;
      throw new Error(`unroutable waiver command: ${String(unreachable)}`);
    }
  }
};

void entityId;
void hasKind;
void moneyAmount;
