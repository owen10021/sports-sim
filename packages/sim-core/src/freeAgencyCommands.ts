import type { CanonicalValue, CommandPayloadBase } from './audit';
import { canonicalString } from './canonical';
import { effectiveRightsAt } from './authority';
import type { EventSpec, RouteContext, RouteOutcome } from './commandRouter';
import {
  bad,
  dayBefore,
  denied,
  isFailure,
  isPlainObject,
  mintRecordIds,
  parseActingPerson,
  parseOrganization,
  spec,
  type Cmd,
} from './commandSupport';
import {
  capPosition,
  contractTermsProblems,
  extensionRetainedBonus,
} from './contractMath';
import type {
  ContractAgreement,
  ContractTermination,
  ContractTermsV1,
} from './contracts';
import { latestProposal } from './decisions';
import {
  UnknownTransactionSeasonError,
  moneyAmount,
  transactionSeasonRules,
} from './economy';
import {
  fitProblem,
  offerCharges,
  offerSlot,
  resolveFreeAgencyRound,
} from './freeAgency';
import { entityId, isValidId, type EntityId, type RecordId } from './ids';
import {
  ROLE_COMMITMENTS,
  reservedCap,
  reservedSlots,
  type ContractOfferRecord,
  type ContractOfferResponse,
  type Reservation,
  type RoleCommitment,
} from './market';
import { isUndraftedProspect } from './draft';
import { agentFor } from './playerMarketView';
import { rookieScaleProblem } from './rookieContracts';
import {
  ROSTER_STATUSES,
  activeRightsFor,
  currentRosterMembership,
  rosterCapacity,
  seasonOfDate,
  type PlayerRightsRecord,
  type RosterMembership,
  type RosterStatus,
} from './roster';
import { SimDate } from './simDate';
import { commitAuthorizedDomainChange } from './transactionCommit';
import type { TransactionRulesV1 } from './economy';
import type { FootballWorld } from './world';

export const FREE_AGENCY_COMMAND_TYPES = [
  'SubmitContractOffer',
  'WithdrawContractOffer',
  'ResolveFreeAgencyMarket',
  'CommitContractSigning',
] as const;
export type FreeAgencyCommandType = (typeof FREE_AGENCY_COMMAND_TYPES)[number];

export const CONTRACT_OFFER_TERMS_TYPE = 'contract_offer_v1';

/** Actors that may run the logical-boundary resolution; CPU orgs and delegates may not. */
const RESOLVERS: ReadonlySet<string> = new Set([
  'human_gm',
  'commissioner',
  'system',
  'test_harness',
]);

const LIVE: ReadonlySet<string> = new Set([
  'communicated',
  'countered',
  'accepted_pending_commit',
]);

const text = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const byId = <T extends { readonly id: string }>(a: T, b: T): number =>
  text(a.id, b.id);
const expired = (expiresAt: string | null, today: string): boolean =>
  expiresAt !== null && today >= expiresAt;

// --- terms <-> canonical -------------------------------------------------------

export const contractTermsPayload = (t: ContractTermsV1): CanonicalValue => ({
  startSeason: t.startSeason,
  signingBonus: t.signingBonus,
  years: t.years.map((y) => ({
    season: y.season,
    baseSalary: y.baseSalary,
    rosterBonus: y.rosterBonus,
    guaranteedBase: y.guaranteedBase,
  })),
});

/** The canonical terms of the club's authorizing proposal for an offer. */
export const contractOfferProposalTerms = (o: {
  readonly playerId: EntityId;
  readonly targetRosterStatus: RosterStatus;
  readonly roleCommitment: RoleCommitment;
  readonly terms: ContractTermsV1;
}): CanonicalValue => ({
  playerId: o.playerId,
  targetRosterStatus: o.targetRosterStatus,
  roleCommitment: o.roleCommitment,
  terms: contractTermsPayload(o.terms),
});

const parseTerms = (v: unknown): ContractTermsV1 | string => {
  if (!isPlainObject(v)) return 'terms must be an object';
  try {
    if (!Number.isSafeInteger(v.startSeason))
      return 'terms.startSeason must be an integer';
    if (!Array.isArray(v.years) || v.years.length === 0)
      return 'terms.years must be a non-empty list';
    const years = v.years.map((y: unknown) => {
      if (!isPlainObject(y)) throw new Error('each year must be an object');
      if (!Number.isSafeInteger(y.season))
        throw new Error('year.season must be an integer');
      return {
        season: y.season as number,
        baseSalary: moneyAmount(y.baseSalary),
        rosterBonus: moneyAmount(y.rosterBonus),
        guaranteedBase: moneyAmount(y.guaranteedBase),
      };
    });
    return {
      startSeason: v.startSeason as number,
      years,
      signingBonus: moneyAmount(v.signingBonus),
    };
  } catch (e) {
    return e instanceof Error ? e.message : 'terms are malformed';
  }
};

// --- eligibility ---------------------------------------------------------------

type Eligibility = {
  readonly extension: boolean;
  readonly right: PlayerRightsRecord | undefined;
  readonly membership: RosterMembership | undefined;
  readonly agreement: ContractAgreement | undefined;
};

/** Whether `org` may sign `playerId` today, and by which path; a string explains a refusal. */
const eligibility = (
  world: FootballWorld,
  org: EntityId,
  playerId: EntityId,
  today: string,
): Eligibility | string => {
  const rights = activeRightsFor(world.roster, playerId, today);
  const right = rights[0];
  if (right === undefined) {
    if (isUndraftedProspect(world.draft, playerId))
      return ` is a draft prospect until the draft completes, then an undrafted free agent`;
    return {
      extension: false,
      right: undefined,
      membership: undefined,
      agreement: undefined,
    };
  }
  if (right.holderOrganizationId !== org)
    return `${playerId} is under ${right.holderOrganizationId}'s rights`;
  if (right.kind === 'draft' || right.kind === 'exclusive')
    return {
      extension: false,
      right,
      membership: undefined,
      agreement: undefined,
    };
  const membership = currentRosterMembership(world.roster, playerId, today);
  if (membership === undefined || membership.organizationId !== org)
    return `${playerId} is not on ${org}'s roster, so there is nothing to extend`;
  const agreement = world.contracts.agreements.find(
    (a) =>
      a.playerId === playerId &&
      a.organizationId === org &&
      a.status === 'active',
  );
  if (agreement === undefined)
    return `${playerId} has no active contract to extend`;
  return { extension: true, right, membership, agreement };
};

const releaseReservation = (
  reservations: readonly Reservation[],
  id: RecordId | null,
  to: 'released' | 'consumed' = 'released',
): readonly Reservation[] =>
  id === null
    ? reservations
    : reservations.map((r) =>
        r.id === id && r.status === 'active' ? { ...r, status: to } : r,
      );

const latestOffers = (world: FootballWorld): readonly ContractOfferRecord[] => {
  const latest = new Map<string, ContractOfferRecord>();
  for (const o of world.market.contractOffers) {
    const have = latest.get(o.id);
    if (have === undefined || o.revision > have.revision) latest.set(o.id, o);
  }
  return [...latest.values()].sort(byId);
};
const latestOffer = (world: FootballWorld, id: string) =>
  latestOffers(world).find((o) => o.id === id);

const replaceOffer = (
  offers: readonly ContractOfferRecord[],
  next: ContractOfferRecord,
): readonly ContractOfferRecord[] =>
  offers
    .map((o) => (o.id === next.id && o.revision === next.revision ? next : o))
    .sort((a, b) => text(a.id, b.id) || a.revision - b.revision);

const contractRights = (
  world: FootballWorld,
  org: EntityId,
  person: EntityId,
): readonly string[] =>
  effectiveRightsAt(world, org, person, 'contract', world.simDate).rights;

const window = (
  tx: TransactionRulesV1,
  today: string,
): { open: string; close: string } | string => {
  try {
    const r = transactionSeasonRules(tx, seasonOfDate(today));
    return { open: r.freeAgencyOpen, close: r.freeAgencyClose };
  } catch (e) {
    if (e instanceof UnknownTransactionSeasonError) return e.message;
    throw e;
  }
};

const ok = (
  detail: string,
  authorizationDetail: string,
  nextWorld: FootballWorld,
  eventSpecs: EventSpec[],
): RouteOutcome => ({
  ok: true,
  authorizationDetail,
  resolution: { nextWorld, eventSpecs, detail },
});

// --- SubmitContractOffer -------------------------------------------------------

const routeSubmit = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const tx = ctx.ruleset.rules.transactions;
  if (tx === undefined) return bad('the ruleset has no transaction rules');
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  const org = parseOrganization(ctx, c.organizationId);
  if (isFailure(org)) return org;
  if (!isValidId(c.proposalId)) return bad('proposalId must be a valid id');
  if (
    !isValidId(c.playerId) ||
    !world.roster.players.some((p) => p.personId === c.playerId)
  )
    return bad('playerId must name an existing player');
  const playerId = entityId(c.playerId);
  const today = world.simDate;

  const win = window(tx, today);
  if (typeof win === 'string') return bad(win);
  if (today < win.open) return bad(`free agency opens on ${win.open}`);
  if (today > win.close) return bad(`free agency closed on ${win.close}`);

  if (!contractRights(world, org, by).includes('communicate'))
    return denied(`${by} lacks communicate on contract in ${org}`);

  const proposal = latestProposal(world.decisions, c.proposalId);
  if (proposal === undefined) return bad('proposalId does not name a proposal');
  if (c.expectedRevision !== proposal.revision)
    return bad(`proposal revision is stale: latest is ${proposal.revision}`);
  if (
    proposal.category !== 'contract' ||
    proposal.termsType !== CONTRACT_OFFER_TERMS_TYPE
  )
    return bad(`the proposal is not a ${CONTRACT_OFFER_TERMS_TYPE} contract`);
  if (proposal.organizationId !== org)
    return bad('the proposal belongs to another organization');

  const terms = parseTerms(c.terms);
  if (typeof terms === 'string') return bad(terms);
  const problems = contractTermsProblems(tx, terms);
  if (problems.length > 0) return bad(`illegal terms: ${problems[0]!}`);
  if (terms.startSeason < seasonOfDate(today))
    return bad('the contract cannot start before the current season');
  if (
    typeof c.roleCommitment !== 'string' ||
    !(ROLE_COMMITMENTS as readonly string[]).includes(c.roleCommitment)
  )
    return bad(`roleCommitment must be one of ${ROLE_COMMITMENTS.join(', ')}`);
  const role = c.roleCommitment as RoleCommitment;
  if (
    typeof c.targetRosterStatus !== 'string' ||
    !(ROSTER_STATUSES as readonly string[]).includes(c.targetRosterStatus)
  )
    return bad(
      `targetRosterStatus must be one of ${ROSTER_STATUSES.join(', ')}`,
    );
  const target = c.targetRosterStatus as RosterStatus;
  if (
    typeof c.priority !== 'number' ||
    !Number.isInteger(c.priority) ||
    c.priority < 0 ||
    c.priority > 1000
  )
    return bad('priority must be an integer 0..1000');
  let group: string | null = null;
  if (c.contingencyGroupId !== undefined && c.contingencyGroupId !== null) {
    if (
      typeof c.contingencyGroupId !== 'string' ||
      !isValidId(c.contingencyGroupId)
    )
      return bad('contingencyGroupId must be a valid id');
    group = c.contingencyGroupId;
  }
  let expiresAt: string;
  if (c.expiresAt === undefined || c.expiresAt === null)
    expiresAt = SimDate.parse(today)
      .addDays(tx.market.defaultOfferValidityDays)
      .toISO();
  else if (
    typeof c.expiresAt === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(c.expiresAt)
  )
    expiresAt = c.expiresAt;
  else return bad('expiresAt must be a YYYY-MM-DD date');
  if (expiresAt <= today) return bad('the offer would already be expired');

  const elig = eligibility(world, org, playerId, today);
  if (typeof elig === 'string') return bad(elig);
  if (elig.right?.kind === 'draft') {
    const scale = rookieScaleProblem(world, tx, elig.right, terms);
    if (scale !== null) return bad(scale);
  }
  if (elig.extension && target !== elig.membership!.status)
    return bad(
      `an extension keeps the player on the ${elig.membership!.status} list`,
    );

  const agent = agentFor(world, playerId, today);
  const named =
    c.agentPersonId === undefined || c.agentPersonId === null
      ? null
      : c.agentPersonId;
  if (named !== agent)
    return bad(
      agent === null
        ? `${playerId} is not represented; the offer must not name an agent`
        : `${playerId} is represented by ${agent}; the offer must go through that agent`,
    );

  const proposalTerms = contractOfferProposalTerms({
    playerId,
    targetRosterStatus: target,
    roleCommitment: role,
    terms,
  });
  if (canonicalString(proposal.terms) !== canonicalString(proposalTerms))
    return bad('the proposal does not authorize these offer terms');

  let supersedes: ContractOfferRecord | undefined;
  if (c.supersedesOfferId !== undefined && c.supersedesOfferId !== null) {
    if (!isValidId(c.supersedesOfferId))
      return bad('supersedesOfferId must be a valid id');
    supersedes = latestOffer(world, c.supersedesOfferId);
    if (supersedes === undefined)
      return bad('supersedesOfferId does not name an offer');
    if (supersedes.organizationId !== org)
      return bad('only the offering organization can revise an offer');
    if (
      supersedes.status !== 'communicated' &&
      supersedes.status !== 'countered'
    )
      return bad(
        `offer ${supersedes.id} is ${supersedes.status} and cannot be revised`,
      );
    if (supersedes.playerId !== playerId)
      return bad('a revision must be for the same player');
  }
  const clash = latestOffers(world).find(
    (o) =>
      o.organizationId === org &&
      o.playerId === playerId &&
      LIVE.has(o.status) &&
      o.id !== supersedes?.id,
  );
  if (clash !== undefined)
    return bad(
      `${org} already has a live offer (${clash.id}) to ${playerId}; revise it instead`,
    );

  const minted = mintRecordIds(world, supersedes === undefined ? 2 : 1);
  const offerId = supersedes?.id ?? minted.ids[0]!;
  const reservationId = minted.ids[supersedes === undefined ? 1 : 0]!;
  const draft: ContractOfferRecord = {
    id: offerId,
    revision: supersedes === undefined ? 1 : supersedes.revision + 1,
    organizationId: org,
    playerId,
    agentPersonId: agent,
    submittedBy: by,
    organizationProposalId: proposal.id,
    terms,
    roleCommitment: role,
    targetRosterStatus: target,
    extension: elig.extension,
    contingencyGroupId: group,
    priority: c.priority,
    submittedAt: today,
    expiresAt,
    status: 'communicated',
    supersedesRevision: supersedes?.revision ?? null,
    reservationId,
    communicated: [],
  };
  const charges = offerCharges(world, tx, draft);
  const reservation: Reservation = {
    id: reservationId,
    organizationId: org,
    sourceKind: 'contract_offer',
    sourceRecordId: offerId,
    capBySeason: charges,
    rosterSlotStatus: offerSlot(draft),
    contingencyGroupId: group,
    createdAt: today,
    status: 'active',
  };
  const freed =
    supersedes === undefined
      ? world.market.reservations
      : releaseReservation(world.market.reservations, supersedes.reservationId);
  const hypothetical = { reservations: [...freed, reservation] };
  try {
    for (const charge of charges) {
      const position = capPosition(tx, world.contracts, org, charge.season);
      const held = reservedCap(hypothetical, org, charge.season);
      if (position.committed + held > position.cap)
        return bad(
          `cap: season ${charge.season} would exceed ${position.cap} (committed ${position.committed}, reserved with this offer ${held})`,
        );
    }
    const slot = offerSlot(draft);
    if (slot !== null) {
      const capacity = rosterCapacity(world.roster, tx, org, today)[slot];
      const held = reservedSlots(hypothetical, org, slot);
      if (capacity.count + held > capacity.limit)
        return bad(
          `roster capacity: ${slot} has ${capacity.count} players and ${held} reserved of ${capacity.limit}`,
        );
    }
  } catch (e) {
    if (e instanceof UnknownTransactionSeasonError) return bad(e.message);
    throw e;
  }

  const offers =
    supersedes === undefined
      ? world.market.contractOffers
      : replaceOffer(world.market.contractOffers, {
          ...supersedes,
          status: 'superseded',
        });
  return ok(
    `${org} offers ${playerId} a contract`,
    `${by} holds communicate on contract in ${org}`,
    {
      ...world,
      market: {
        ...world.market,
        contractOffers: [...offers, draft].sort(
          (a, b) => text(a.id, b.id) || a.revision - b.revision,
        ),
        reservations: [...freed, reservation].sort(byId),
      },
      nextIds: { ...world.nextIds, record: minted.next },
    },
    [
      spec('ContractOfferSubmitted', {
        offerId,
        revision: draft.revision,
        organizationId: org,
        playerId,
        agentPersonId: agent,
        extension: elig.extension,
        targetRosterStatus: target,
        roleCommitment: role,
        expiresAt,
        reservationId,
        reservedCapBySeason: charges.map((x) => ({ ...x })),
      }),
    ],
  );
};

// --- WithdrawContractOffer -----------------------------------------------------

const routeWithdraw = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  if (!isValidId(c.offerId)) return bad('offerId must be a valid id');
  const offer = latestOffer(world, c.offerId);
  if (offer === undefined) return bad('offerId does not name an offer');
  if (c.offerRevision !== offer.revision)
    return bad(`offer revision is stale: latest is ${offer.revision}`);
  if (offer.status !== 'communicated' && offer.status !== 'countered')
    return bad(`offer is ${offer.status} and cannot be withdrawn`);
  if (!contractRights(world, offer.organizationId, by).includes('communicate'))
    return denied(
      `${by} lacks communicate on contract in ${offer.organizationId}`,
    );
  return ok(
    `${offer.organizationId} withdraws offer ${offer.id}`,
    `${by} holds communicate on contract in ${offer.organizationId}`,
    {
      ...world,
      market: {
        ...world.market,
        contractOffers: replaceOffer(world.market.contractOffers, {
          ...offer,
          status: 'withdrawn',
        }),
        reservations: releaseReservation(
          world.market.reservations,
          offer.reservationId,
        ),
      },
    },
    [
      spec('ContractOfferWithdrawn', {
        offerId: offer.id,
        revision: offer.revision,
        organizationId: offer.organizationId,
        playerId: offer.playerId,
      }),
    ],
  );
};

// --- ResolveFreeAgencyMarket ---------------------------------------------------

const routeResolve = (ctx: RouteContext): RouteOutcome => {
  if (!RESOLVERS.has(ctx.actor.kind))
    return denied(`${ctx.actor.kind} cannot resolve the free-agency market`);
  const tx = ctx.ruleset.rules.transactions;
  if (tx === undefined) return bad('the ruleset has no transaction rules');
  let world = ctx.world;
  const today = world.simDate;
  const win = window(tx, today);
  if (typeof win === 'string') return bad(win);
  if (today < win.open || today > win.close)
    return bad(`the free-agency window is ${win.open}..${win.close}`);

  const events: EventSpec[] = [];
  // Expiry first: an expired offer can never be resolved or committed.
  const lapsed = latestOffers(world).filter(
    (o) => LIVE.has(o.status) && expired(o.expiresAt, today),
  );
  let offers = world.market.contractOffers;
  let reservations = world.market.reservations;
  for (const o of lapsed) {
    offers = replaceOffer(offers, { ...o, status: 'expired' });
    reservations = releaseReservation(reservations, o.reservationId);
    events.push(
      spec('ContractOfferExpired', {
        offerId: o.id,
        revision: o.revision,
        organizationId: o.organizationId,
        playerId: o.playerId,
      }),
    );
  }
  world = {
    ...world,
    market: { ...world.market, contractOffers: offers, reservations },
  };

  const outcomes = resolveFreeAgencyRound(world, tx);
  if (outcomes.length === 0 && lapsed.length === 0)
    return bad('no live contract offer to resolve');

  const minted = mintRecordIds(world, outcomes.length);
  const responses: ContractOfferResponse[] = [];
  outcomes.forEach((out, i) => {
    offers = replaceOffer(offers, {
      ...out.offer,
      status: out.status,
      communicated: out.communicated,
    });
    if (out.status !== 'accepted_pending_commit')
      reservations = releaseReservation(reservations, out.offer.reservationId);
    responses.push({
      kind: 'contract_response',
      id: minted.ids[i]!,
      offerId: out.offer.id,
      offerRevision: out.offer.revision,
      playerId: out.offer.playerId,
      disposition: out.disposition,
      reasons: out.reasons,
      communicated: out.communicated,
      createdAt: today,
    });
    events.push(
      spec('ContractOfferAnswered', {
        offerId: out.offer.id,
        revision: out.offer.revision,
        organizationId: out.offer.organizationId,
        playerId: out.offer.playerId,
        status: out.status,
        communicated: [...out.communicated],
      }),
    );
  });
  return ok(
    `resolved ${outcomes.length} contract offer(s) on ${today}`,
    `${ctx.actor.kind} may resolve the free-agency market`,
    {
      ...world,
      market: {
        ...world.market,
        contractOffers: offers,
        reservations: [...reservations].sort(byId),
        responses: [...world.market.responses, ...responses].sort(byId),
      },
      nextIds: { ...world.nextIds, record: minted.next },
    },
    events,
  );
};

// --- CommitContractSigning -----------------------------------------------------

const routeCommit = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const tx = ctx.ruleset.rules.transactions;
  if (tx === undefined) return bad('the ruleset has no transaction rules');
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  if (!isValidId(c.offerId)) return bad('offerId must be a valid id');
  const offer = latestOffer(world, c.offerId);
  if (offer === undefined) return bad('offerId does not name an offer');
  if (c.offerRevision !== offer.revision)
    return bad(`offer revision is stale: latest is ${offer.revision}`);
  if (offer.status === 'committed')
    return bad('this offer has already been committed');
  if (offer.status !== 'accepted_pending_commit')
    return bad(`offer is ${offer.status}, not accepted by the player`);
  const today = world.simDate;
  if (expired(offer.expiresAt, today)) return bad('the offer has expired');
  const win = window(tx, today);
  if (typeof win === 'string') return bad(win);
  if (today > win.close) return bad(`free agency closed on ${win.close}`);
  if (typeof c.expectedRevision !== 'number')
    return bad('expectedRevision must be a number');
  const ids = (x: unknown) =>
    Array.isArray(x) && x.every((i) => typeof i === 'string')
      ? (x as string[])
      : null;
  const beliefIds = ids(c.beliefIds);
  const evidenceClaimIds = ids(c.evidenceClaimIds);
  if (beliefIds === null || evidenceClaimIds === null)
    return bad('beliefIds and evidenceClaimIds must be id lists');

  const proposal = latestProposal(
    world.decisions,
    offer.organizationProposalId,
  );
  if (proposal === undefined)
    return bad('the authorizing proposal no longer exists');
  const proposalTerms = contractOfferProposalTerms(offer);
  if (
    proposal.category !== 'contract' ||
    proposal.termsType !== CONTRACT_OFFER_TERMS_TYPE ||
    canonicalString(proposal.terms) !== canonicalString(proposalTerms)
  )
    return bad('the authorizing proposal no longer matches the offered terms');

  // Everything is re-derived from current state; nothing from the offer is trusted.
  const org = offer.organizationId;
  const elig = eligibility(world, org, offer.playerId, today);
  if (typeof elig === 'string') return bad(`stale offer: ${elig}`);
  if (elig.right?.kind === 'draft') {
    const scale = rookieScaleProblem(world, tx, elig.right, offer.terms);
    if (scale !== null) return bad(`stale offer: ${scale}`);
  }
  if (elig.extension !== offer.extension)
    return bad('stale offer: the player changed status since the offer');
  if (agentFor(world, offer.playerId, today) !== offer.agentPersonId)
    return bad('stale offer: the player changed agent since the offer');
  const reservation = world.market.reservations.find(
    (r) => r.id === offer.reservationId,
  );
  if (reservation === undefined || reservation.status !== 'active')
    return bad('the reservation behind this offer is no longer active');
  const blocked = fitProblem(world, tx, [], offer);
  if (blocked !== null) return bad(`stale offer: ${blocked}`);

  const extraIds = 3;
  const minted = mintRecordIds(world, extraIds);
  const agreementId = minted.ids[0]!;
  const rightId = minted.ids[1]!;
  const agreement: ContractAgreement = {
    id: agreementId,
    playerId: offer.playerId,
    organizationId: org,
    terms: offer.terms,
    signedAt: today,
    sourceOfferId: offer.id,
    sourceProposalId: proposal.id,
    supersedesAgreementId: elig.agreement?.id ?? null,
    status: 'active',
  };
  const newRight: PlayerRightsRecord = {
    id: rightId,
    playerId: offer.playerId,
    holderOrganizationId: org,
    kind: 'contract',
    sourceRecordId: agreementId,
    effectiveFrom: today,
    effectiveUntil: null,
  };
  const retained =
    elig.extension && elig.agreement !== undefined
      ? extensionRetainedBonus(
          tx.contracts,
          elig.agreement.terms,
          seasonOfDate(today),
        )
      : [];
  const termination: ContractTermination[] =
    elig.agreement !== undefined && retained.length > 0
      ? [
          {
            id: minted.ids[2]!,
            agreementId: elig.agreement.id,
            organizationId: org,
            playerId: offer.playerId,
            terminatedAt: today,
            reason: 'extension_retained_bonus',
            deadCapBySeason: retained,
            guaranteedCashDue: 0 as ContractTermination['guaranteedCashDue'],
          },
        ]
      : [];
  const memberships = elig.extension
    ? world.roster.memberships
    : [
        ...world.roster.memberships,
        {
          id: minted.ids[2]!,
          playerId: offer.playerId,
          organizationId: org,
          status: offer.targetRosterStatus,
          effectiveFrom: today,
          effectiveUntil: null,
          sourceRecordId: agreementId,
        } satisfies RosterMembership,
      ];
  const rights = [
    ...world.roster.rights.map((r) =>
      elig.right !== undefined && r.id === elig.right.id
        ? { ...r, effectiveUntil: dayBefore(today) }
        : r,
    ),
    newRight,
  ].sort(byId);

  // The signing closes the player's other live offers and the club's fallbacks.
  let offers = replaceOffer(world.market.contractOffers, {
    ...offer,
    status: 'committed',
  });
  let reservations = releaseReservation(
    world.market.reservations,
    offer.reservationId,
    'consumed',
  );
  for (const o of latestOffers(world)) {
    if (o.id === offer.id || !LIVE.has(o.status)) continue;
    const sameGroup =
      o.organizationId === org &&
      offer.contingencyGroupId !== null &&
      o.contingencyGroupId === offer.contingencyGroupId;
    if (o.playerId !== offer.playerId && !sameGroup) continue;
    offers = replaceOffer(offers, {
      ...o,
      status: sameGroup ? 'withdrawn' : 'rejected',
      communicated: sameGroup ? ['club_withdrew'] : ['not_selected'],
    });
    reservations = releaseReservation(reservations, o.reservationId);
  }
  const nextWorld: FootballWorld = {
    ...world,
    roster: {
      ...world.roster,
      rights,
      memberships: memberships.slice().sort(byId),
    },
    contracts: {
      ...world.contracts,
      agreements: [
        ...world.contracts.agreements.map((a) =>
          elig.agreement !== undefined && a.id === elig.agreement.id
            ? { ...a, status: 'superseded' as const }
            : a,
        ),
        agreement,
      ].sort(byId),
      terminations: [...world.contracts.terminations, ...termination].sort(
        byId,
      ),
    },
    market: {
      ...world.market,
      contractOffers: offers,
      reservations: [...reservations].sort(byId),
    },
    nextIds: { ...world.nextIds, record: minted.next },
  };
  return commitAuthorizedDomainChange(ctx, {
    nextWorld,
    domainEvents: [
      spec('ContractSigned', {
        offerId: offer.id,
        offerRevision: offer.revision,
        agreementId,
        organizationId: org,
        playerId: offer.playerId,
        extension: elig.extension,
        targetRosterStatus: offer.targetRosterStatus,
        proposalId: proposal.id,
        signedOn: today,
      }),
    ],
    requests: [
      {
        organizationId: org,
        actorPersonId: by,
        proposalId: proposal.id,
        expectedRevision: c.expectedRevision,
        expectedCategory: 'contract',
        executedTerms: {
          termsType: CONTRACT_OFFER_TERMS_TYPE,
          terms: proposalTerms,
        },
        beliefIds,
        evidenceClaimIds,
        rationale: c.rationale as CanonicalValue,
      },
    ],
  });
};

export const routeFreeAgencyCommand = (
  ctx: RouteContext,
  command: CommandPayloadBase & { readonly type: FreeAgencyCommandType },
): RouteOutcome => {
  const c = command as Cmd;
  switch (command.type) {
    case 'SubmitContractOffer':
      return routeSubmit(ctx, c);
    case 'WithdrawContractOffer':
      return routeWithdraw(ctx, c);
    case 'ResolveFreeAgencyMarket':
      return routeResolve(ctx);
    case 'CommitContractSigning':
      return routeCommit(ctx, c);
    default: {
      const unreachable: never = command.type;
      throw new Error(`unroutable free-agency command: ${String(unreachable)}`);
    }
  }
};
