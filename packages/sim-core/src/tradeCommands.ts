import {
  buildAcquisitionDecisionView,
  type AcquisitionDecisionView,
} from './acquisitionView';
import { tradeCapacityProblems } from './acquisitionImpact';
import {
  applyTradePackage,
  assetKey,
  tradePackageProblems,
  type AcquisitionAssetRef,
  type TradePackageV1,
} from './assets';
import { canonicalString } from './canonical';
import type { CanonicalValue } from './audit';
import { effectiveRightsAt, isProtectedAt } from './authority';
import type { CommandPayloadBase } from './audit';
import type { EventSpec, RouteContext, RouteOutcome } from './commandRouter';
import {
  bad,
  denied,
  isFailure,
  isPlainObject,
  mintRecordIds,
  parseActingPerson,
  parseOrganization,
  protectedBy,
  spec,
  type Cmd,
  type Failure,
} from './commandSupport';
import { latestProposal } from './decisions';
import {
  UnknownTransactionSeasonError,
  transactionSeasonRules,
} from './economy';
import { entityId, isValidId, type EntityId, type RecordId } from './ids';
import type {
  InquiryResponse,
  MarketInquiry,
  TradeOfferRecord,
  TradeOfferResponse,
  TradeReason,
} from './market';
import { INQUIRY_DIRECTIONS } from './market';
import { holdsRoleAt } from './people';
import { seasonOfDate } from './roster';
import {
  evaluateTradeForOrganization,
  inquiryBandFor,
  responseBasisHash,
} from './tradeReasoning';
import { commitAuthorizedDomainChange } from './transactionCommit';
import type { FootballWorld } from './world';

export const TRADE_COMMAND_TYPES = [
  'SubmitMarketInquiry',
  'PostTradeOffer',
  'RequestTradeResponse',
  'AnswerTradeOffer',
  'CommitTradeAgreement',
] as const;
export type TradeCommandType = (typeof TRADE_COMMAND_TYPES)[number];

export const TRADE_TERMS_TYPE = 'trade_package_v1';

// --- package <-> canonical terms ----------------------------------------------

const assetTerms = (a: AcquisitionAssetRef): CanonicalValue =>
  a.kind === 'player_rights'
    ? { kind: a.kind, playerId: a.playerId, rightsId: a.rightsId }
    : { kind: a.kind, pickId: a.pickId };

const sortedAssets = (xs: readonly AcquisitionAssetRef[]) =>
  [...xs].sort((a, b) =>
    assetKey(a) < assetKey(b) ? -1 : assetKey(a) > assetKey(b) ? 1 : 0,
  );

/** The one canonical form of a package inside a proposal's terms (assets sorted by key). */
export const tradePackageTerms = (pkg: TradePackageV1): CanonicalValue => ({
  organizationAId: pkg.organizationAId,
  organizationBId: pkg.organizationBId,
  assetsFromA: sortedAssets(pkg.assetsFromA).map(assetTerms),
  assetsFromB: sortedAssets(pkg.assetsFromB).map(assetTerms),
  validity: { expiresAt: pkg.validity.expiresAt },
  contingencies: { ...pkg.contingencies },
});

const parseAsset = (v: unknown): AcquisitionAssetRef | null => {
  if (!isPlainObject(v)) return null;
  if (
    v.kind === 'player_rights' &&
    isValidId(v.playerId) &&
    isValidId(v.rightsId)
  )
    return {
      kind: 'player_rights',
      playerId: entityId(v.playerId),
      rightsId: v.rightsId as RecordId,
    };
  if (v.kind === 'draft_pick' && isValidId(v.pickId))
    return { kind: 'draft_pick', pickId: v.pickId as RecordId };
  return null;
};

export const parseTradePackage = (v: unknown): TradePackageV1 | string => {
  if (!isPlainObject(v)) return 'a trade package must be an object';
  if (!isValidId(v.organizationAId) || !isValidId(v.organizationBId))
    return 'a trade package names two organizations';
  const side = (x: unknown): AcquisitionAssetRef[] | null => {
    if (!Array.isArray(x)) return null;
    const out = x.map(parseAsset);
    return out.some((a) => a === null) ? null : (out as AcquisitionAssetRef[]);
  };
  const a = side(v.assetsFromA);
  const b = side(v.assetsFromB);
  if (a === null || b === null)
    return 'every asset must be player_rights or draft_pick by id';
  if (!isPlainObject(v.validity)) return 'validity must be an object';
  const expiresAt = v.validity.expiresAt;
  if (expiresAt !== null && typeof expiresAt !== 'string')
    return 'validity.expiresAt must be a date or null';
  if (!isPlainObject(v.contingencies)) return 'contingencies must be an object';
  const pkg: TradePackageV1 = {
    organizationAId: entityId(v.organizationAId),
    organizationBId: entityId(v.organizationBId),
    assetsFromA: a,
    assetsFromB: b,
    validity: { expiresAt: expiresAt as string | null },
    contingencies: v.contingencies,
  };
  if (canonicalString(tradePackageTerms(pkg)) !== canonicalString(v))
    return 'the package is not in canonical form (use tradePackageTerms)';
  return pkg;
};

// --- helpers ------------------------------------------------------------------

const rights = (
  world: FootballWorld,
  org: EntityId,
  person: EntityId,
): readonly string[] =>
  effectiveRightsAt(world, org, person, 'acquisition', world.simDate).rights;

/** An organization's own decision-maker: the person who holds its general manager role. */
const decisionMaker = (
  world: FootballWorld,
  org: EntityId,
): EntityId | null => {
  for (const e of world.people.roleEpisodes)
    if (
      e.organizationId === org &&
      e.role === 'general_manager' &&
      holdsRoleAt(world.people, org, e.personId, world.simDate)
    )
      return e.personId;
  return null;
};

const viewOf = (
  ctx: RouteContext,
  org: EntityId,
): AcquisitionDecisionView | Failure => {
  const tx = ctx.ruleset.rules.transactions;
  if (tx === undefined) return bad('the ruleset has no transaction rules');
  const gm = decisionMaker(ctx.world, org);
  if (gm === null) return bad(`${org} has no decision-maker to answer`);
  const built = buildAcquisitionDecisionView(ctx.world, org, gm, tx);
  return built.ok ? built.view : bad(built.reason);
};

/** What a response tells the other club. It never repeats the responder's private reasons. */
const communicatedOf = (reasons: readonly TradeReason[]): string[] => {
  const out = new Set<string>();
  for (const r of reasons)
    switch (r.code) {
      case 'CAP_INFEASIBLE':
      case 'ROSTER_INFEASIBLE':
        out.add('cannot_fit');
        break;
      case 'KEEP_CORE_PLAYER':
      case 'WEAKENS_CURRENT_ROSTER':
      case 'PLAN_HARD_CONSTRAINT':
        out.add('player_not_available');
        break;
      case 'SPENDS_PREMIUM_CAPITAL':
      case 'AGING_ACQUISITION':
      case 'UNWANTED_PLAYER':
      case 'NOTHING_FOR_PLAN':
        out.add('package_not_right');
        break;
      default:
        break;
    }
  return [...out].sort();
};

const latestOffer = (
  world: FootballWorld,
  offerId: string,
): TradeOfferRecord | undefined =>
  world.market.tradeOffers
    .filter((o) => o.id === offerId)
    .sort((a, b) => b.revision - a.revision)[0];

const withOffer = (
  world: FootballWorld,
  offer: TradeOfferRecord,
): FootballWorld['market']['tradeOffers'] =>
  world.market.tradeOffers.map((o) =>
    o.id === offer.id && o.revision === offer.revision ? offer : o,
  );

const expired = (expiresAt: string | null, today: string): boolean =>
  expiresAt !== null && today >= expiresAt;

const sortById = <T extends { readonly id: string }>(xs: readonly T[]) =>
  [...xs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

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

// --- SubmitMarketInquiry ------------------------------------------------------

const routeInquiry = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  const asking = parseOrganization(ctx, c.organizationId);
  if (isFailure(asking)) return asking;
  const contacted = parseOrganization(ctx, c.contactedOrganizationId);
  if (isFailure(contacted)) return contacted;
  if (asking === contacted)
    return bad('an organization cannot inquire of itself');
  const asset = parseAsset(c.asset);
  if (asset === null)
    return bad('asset must be player_rights or draft_pick by id');
  if (!(INQUIRY_DIRECTIONS as readonly unknown[]).includes(c.direction))
    return bad('direction must be seek or shop');
  const direction = c.direction as 'seek' | 'shop';
  if (!rights(world, asking, by).includes('communicate'))
    return denied(`${by} lacks communicate on acquisition in ${asking}`);
  const owner = direction === 'seek' ? contacted : asking;
  const problems = tradePackageProblems(
    world,
    ctx.ruleset.rules.transactions!,
    {
      organizationAId: owner,
      organizationBId: owner === asking ? contacted : asking,
      assetsFromA: [asset],
      assetsFromB: [],
      validity: { expiresAt: null },
      contingencies: {},
    },
    world.simDate,
  ).filter((p) => p.code !== 'PLAYER_ON_WAIVERS');
  if (problems.length > 0) return bad(problems[0]!.message);

  const view = viewOf(ctx, contacted);
  if (isFailure(view)) return view;
  const basisHash = responseBasisHash(view, asset);
  const previous = world.market.inquiries.find(
    (i) =>
      i.askingOrganizationId === asking &&
      i.contactedOrganizationId === contacted &&
      i.direction === direction &&
      assetKey(i.asset) === assetKey(asset) &&
      world.market.responses.some(
        (r) =>
          r.kind === 'inquiry_response' &&
          r.inquiryId === i.id &&
          (r.basisHash === basisHash || r.createdAt === world.simDate),
      ),
  );
  if (previous !== undefined)
    return bad(
      `the question stands unchanged for now: the recorded answer to inquiry ${previous.id} stands`,
    );

  const minted = mintRecordIds(world, 2);
  const inquiry: MarketInquiry = {
    id: minted.ids[0]!,
    askingOrganizationId: asking,
    askedBy: by,
    contactedOrganizationId: contacted,
    asset,
    direction,
    createdAt: world.simDate,
  };
  const response: InquiryResponse = {
    kind: 'inquiry_response',
    id: minted.ids[1]!,
    inquiryId: inquiry.id,
    respondingOrganizationId: contacted,
    band: inquiryBandFor(view, asset, direction),
    basisHash,
    createdAt: world.simDate,
  };
  return ok(
    `${asking} asks ${contacted} about ${assetKey(asset)}`,
    `${by} holds communicate on acquisition in ${asking}`,
    {
      ...world,
      market: {
        ...world.market,
        inquiries: sortById([...world.market.inquiries, inquiry]),
        responses: sortById([...world.market.responses, response]),
      },
      nextIds: { ...world.nextIds, record: minted.next },
    },
    [
      spec('MarketInquirySent', {
        inquiryId: inquiry.id,
        askingOrganizationId: asking,
        contactedOrganizationId: contacted,
        asset: assetTerms(asset),
        direction,
      }),
      spec('MarketInquiryAnswered', {
        responseId: response.id,
        inquiryId: inquiry.id,
        respondingOrganizationId: contacted,
        band: response.band,
      }),
    ],
  );
};

// --- PostTradeOffer -----------------------------------------------------------

const routePost = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const tx = ctx.ruleset.rules.transactions;
  if (tx === undefined) return bad('the ruleset has no transaction rules');
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  if (!isValidId(c.proposalId)) return bad('proposalId must be a valid id');
  const proposal = latestProposal(world.decisions, c.proposalId);
  if (proposal === undefined) return bad('proposalId does not name a proposal');
  if (c.expectedRevision !== proposal.revision)
    return bad(`proposal revision is stale: latest is ${proposal.revision}`);
  if (
    proposal.category !== 'acquisition' ||
    proposal.termsType !== TRADE_TERMS_TYPE
  )
    return bad(`the proposal is not a ${TRADE_TERMS_TYPE} acquisition`);
  const pkg = parseTradePackage(proposal.terms);
  if (typeof pkg === 'string') return bad(pkg);
  const proposer = proposal.organizationId;
  if (proposer !== pkg.organizationAId && proposer !== pkg.organizationBId)
    return bad('the proposing organization is not a party to the package');
  const counterparty =
    proposer === pkg.organizationAId
      ? pkg.organizationBId
      : pkg.organizationAId;
  if (!rights(world, proposer, by).includes('communicate'))
    return denied(`${by} lacks communicate on acquisition in ${proposer}`);
  const today = world.simDate;
  const problems = tradePackageProblems(world, tx, pkg, today);
  if (problems.length > 0)
    return bad(`illegal package: ${problems[0]!.message}`);
  if (expired(pkg.validity.expiresAt, today))
    return bad('the package has already expired');

  let supersedes: TradeOfferRecord | undefined;
  if (c.supersedesOfferId !== undefined) {
    if (!isValidId(c.supersedesOfferId))
      return bad('supersedesOfferId must be a valid id');
    supersedes = latestOffer(world, c.supersedesOfferId);
    if (supersedes === undefined)
      return bad('supersedesOfferId does not name an offer');
    if (supersedes.status !== 'open')
      return bad(
        `offer ${supersedes.id} is ${supersedes.status} and cannot be revised`,
      );
    if (
      supersedes.proposerOrganizationId !== proposer &&
      supersedes.counterpartyOrganizationId !== proposer
    )
      return bad('only a party to the offer can revise it');
  }
  const minted = mintRecordIds(world, supersedes === undefined ? 1 : 0);
  const offer: TradeOfferRecord = {
    id: supersedes?.id ?? minted.ids[0]!,
    revision: supersedes === undefined ? 1 : supersedes.revision + 1,
    proposerOrganizationId: proposer,
    counterpartyOrganizationId: counterparty,
    package: pkg,
    proposerProposalId: proposal.id,
    counterpartyProposalId: null,
    termsHash: proposal.termsHash,
    status: 'open',
    createdAt: today,
    expiresAt: pkg.validity.expiresAt,
    supersedesRevision: supersedes?.revision ?? null,
  };
  const prior =
    supersedes === undefined
      ? world.market.tradeOffers
      : withOffer(world, { ...supersedes, status: 'countered' });
  return ok(
    `${proposer} offers ${counterparty} a trade`,
    `${by} holds communicate on acquisition in ${proposer}`,
    {
      ...world,
      market: { ...world.market, tradeOffers: [...prior, offer] },
      nextIds: { ...world.nextIds, record: minted.next },
    },
    [
      spec('TradeOfferPosted', {
        offerId: offer.id,
        revision: offer.revision,
        proposerOrganizationId: proposer,
        counterpartyOrganizationId: counterparty,
        proposerProposalId: proposal.id,
        termsHash: offer.termsHash,
        supersedesRevision: offer.supersedesRevision,
      }),
    ],
  );
};

// --- RequestTradeResponse / AnswerTradeOffer ----------------------------------

const routeRequestResponse = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  if (!isValidId(c.offerId)) return bad('offerId must be a valid id');
  const offer = latestOffer(world, c.offerId);
  if (offer === undefined) return bad('offerId does not name an offer');
  if (c.offerRevision !== offer.revision)
    return bad(`offer revision is stale: latest is ${offer.revision}`);
  if (offer.status !== 'open') return bad(`offer is ${offer.status}`);
  if (!rights(world, offer.proposerOrganizationId, by).includes('communicate'))
    return denied(
      `${by} lacks communicate on acquisition in ${offer.proposerOrganizationId}`,
    );
  if (expired(offer.expiresAt, world.simDate))
    return bad('the offer has expired');
  const view = viewOf(ctx, offer.counterpartyOrganizationId);
  if (isFailure(view)) return view;
  const basisHash = responseBasisHash(view, offer.package);
  const recorded = world.market.responses.find(
    (r): r is TradeOfferResponse =>
      r.kind === 'trade_response' &&
      r.offerId === offer.id &&
      r.offerRevision === offer.revision &&
      (r.basisHash === basisHash || r.createdAt === world.simDate),
  );
  if (recorded !== undefined)
    return bad(
      `unchanged offer or same day: the recorded response ${recorded.id} stands`,
    );

  const evaluation = evaluateTradeForOrganization(view, offer.package);
  const minted = mintRecordIds(world, 1);
  const response: TradeOfferResponse = {
    kind: 'trade_response',
    id: minted.ids[0]!,
    offerId: offer.id,
    offerRevision: offer.revision,
    respondingOrganizationId: offer.counterpartyOrganizationId,
    disposition: evaluation.disposition,
    reasons: evaluation.reasons,
    communicated: communicatedOf(evaluation.reasons),
    uncertainties: evaluation.uncertainties,
    basisHash,
    createdAt: world.simDate,
  };
  const status =
    evaluation.disposition === 'accept'
      ? 'accepted'
      : evaluation.disposition === 'reject'
        ? 'declined'
        : 'open';
  return ok(
    `${offer.counterpartyOrganizationId} responds ${evaluation.disposition}`,
    `${by} holds communicate on acquisition in ${offer.proposerOrganizationId}`,
    {
      ...world,
      market: {
        ...world.market,
        tradeOffers: withOffer(world, { ...offer, status }),
        responses: sortById([...world.market.responses, response]),
      },
      nextIds: { ...world.nextIds, record: minted.next },
    },
    [
      spec('TradeResponseRecorded', {
        responseId: response.id,
        offerId: offer.id,
        offerRevision: offer.revision,
        respondingOrganizationId: response.respondingOrganizationId,
        disposition: response.disposition,
        communicated: response.communicated as string[],
      }),
    ],
  );
};

const ANSWERS = ['accept', 'decline'] as const;

const routeAnswer = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  if (!isValidId(c.offerId)) return bad('offerId must be a valid id');
  const offer = latestOffer(world, c.offerId);
  if (offer === undefined) return bad('offerId does not name an offer');
  if (c.offerRevision !== offer.revision)
    return bad(`offer revision is stale: latest is ${offer.revision}`);
  if (offer.status !== 'open') return bad(`offer is ${offer.status}`);
  if (!(ANSWERS as readonly unknown[]).includes(c.answer))
    return bad('answer must be accept or decline');
  const org = offer.counterpartyOrganizationId;
  if (!rights(world, org, by).includes('communicate'))
    return denied(`${by} lacks communicate on acquisition in ${org}`);
  if (expired(offer.expiresAt, world.simDate))
    return bad('the offer has expired');
  const status = c.answer === 'accept' ? 'accepted' : 'declined';
  return ok(
    `${org} answers ${c.answer as string}`,
    `${by} holds communicate on acquisition in ${org}`,
    {
      ...world,
      market: {
        ...world.market,
        tradeOffers: withOffer(world, { ...offer, status }),
      },
    },
    [
      spec('TradeOfferAnswered', {
        offerId: offer.id,
        offerRevision: offer.revision,
        answeringOrganizationId: org,
        answer: c.answer as string,
        answeredBy: by,
      }),
    ],
  );
};

// --- CommitTradeAgreement -----------------------------------------------------

type Side = {
  readonly actingPersonId: EntityId;
  readonly expectedRevision: number;
  readonly beliefIds: string[];
  readonly evidenceClaimIds: string[];
  readonly rationale: CanonicalValue;
};

const parseSide = (
  ctx: RouteContext,
  v: unknown,
  label: string,
): Side | Failure => {
  if (!isPlainObject(v)) return bad(`${label} must be an object`);
  const person = parseActingPerson(ctx, v as Cmd);
  if (isFailure(person))
    return bad(`${label}.actingPersonId must name an existing person`);
  if (typeof v.expectedRevision !== 'number')
    return bad(`${label}.expectedRevision must be a number`);
  const ids = (x: unknown) =>
    Array.isArray(x) && x.every((i) => typeof i === 'string')
      ? (x as string[])
      : null;
  const beliefIds = ids(v.beliefIds);
  const evidenceClaimIds = ids(v.evidenceClaimIds);
  if (beliefIds === null || evidenceClaimIds === null)
    return bad(`${label} beliefIds and evidenceClaimIds must be id lists`);
  return {
    actingPersonId: person,
    expectedRevision: v.expectedRevision,
    beliefIds,
    evidenceClaimIds,
    rationale: v.rationale as CanonicalValue,
  };
};

const routeCommit = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const tx = ctx.ruleset.rules.transactions;
  if (tx === undefined) return bad('the ruleset has no transaction rules');
  const submitter = parseActingPerson(ctx, c);
  if (isFailure(submitter)) return submitter;
  if (!isValidId(c.offerId)) return bad('offerId must be a valid id');
  const offer = latestOffer(world, c.offerId);
  if (offer === undefined) return bad('offerId does not name an offer');
  if (c.offerRevision !== offer.revision)
    return bad(`offer revision is stale: latest is ${offer.revision}`);
  if (offer.status === 'executed')
    return bad('this offer has already been executed');
  if (offer.status !== 'accepted')
    return bad(`offer is ${offer.status}, not accepted`);
  const today = world.simDate;
  if (expired(offer.expiresAt, today)) return bad('the offer has expired');
  if (!isValidId(c.counterpartyProposalId))
    return bad('counterpartyProposalId must be a valid id');
  const proposerSide = parseSide(ctx, c.proposerSide, 'proposerSide');
  if (isFailure(proposerSide)) return proposerSide;
  const counterpartySide = parseSide(
    ctx,
    c.counterpartySide,
    'counterpartySide',
  );
  if (isFailure(counterpartySide)) return counterpartySide;

  const counterProposal = latestProposal(
    world.decisions,
    c.counterpartyProposalId,
  );
  if (counterProposal === undefined)
    return bad('counterpartyProposalId does not name a proposal');
  if (counterProposal.organizationId !== offer.counterpartyOrganizationId)
    return bad('the counterparty proposal belongs to another organization');
  if (
    counterProposal.category !== 'acquisition' ||
    counterProposal.termsType !== TRADE_TERMS_TYPE ||
    canonicalString(counterProposal.terms) !==
      canonicalString(tradePackageTerms(offer.package))
  )
    return bad(
      'the counterparty proposal does not authorize the offered terms',
    );

  const pkg = offer.package;
  try {
    const rules = transactionSeasonRules(tx, seasonOfDate(today));
    if (today > rules.tradeDeadline)
      return bad(`the trade deadline ${rules.tradeDeadline} has passed`);
  } catch (e) {
    if (e instanceof UnknownTransactionSeasonError) return bad(e.message);
    throw e;
  }
  const problems = tradePackageProblems(world, tx, pkg, today);
  if (problems.length > 0) return bad(`stale package: ${problems[0]!.message}`);
  const capacity = tradeCapacityProblems(world, tx, pkg, today);
  if (capacity.length > 0)
    return bad(`${capacity[0]!.organizationId}: ${capacity[0]!.message}`);

  for (const [org, assets] of [
    [pkg.organizationAId, pkg.assetsFromA],
    [pkg.organizationBId, pkg.assetsFromB],
  ] as const)
    for (const a of assets)
      if (
        a.kind === 'player_rights' &&
        isProtectedAt(
          world,
          org,
          { playerId: a.playerId },
          { kind: 'trade' },
          today,
        ).length > 0
      )
        return protectedBy(
          `${a.playerId} is protected from being traded by ${org}`,
        );

  const traded = applyTradePackage(world, tx, pkg, today);
  const executedOffer: TradeOfferRecord = {
    ...offer,
    counterpartyProposalId: counterProposal.id,
    status: 'executed',
  };
  const nextWorld: FootballWorld = {
    ...traded,
    market: { ...traded.market, tradeOffers: withOffer(traded, executedOffer) },
  };
  const request = (org: EntityId, proposalId: string, side: Side) => ({
    organizationId: org,
    actorPersonId: side.actingPersonId,
    proposalId,
    expectedRevision: side.expectedRevision,
    expectedCategory: 'acquisition' as const,
    executedTerms: {
      termsType: TRADE_TERMS_TYPE,
      terms: tradePackageTerms(pkg),
    },
    beliefIds: side.beliefIds,
    evidenceClaimIds: side.evidenceClaimIds,
    rationale: side.rationale,
  });
  return commitAuthorizedDomainChange(ctx, {
    nextWorld,
    domainEvents: [
      spec('TradeExecuted', {
        offerId: offer.id,
        offerRevision: offer.revision,
        organizationAId: pkg.organizationAId,
        organizationBId: pkg.organizationBId,
        assetsFromA: sortedAssets(pkg.assetsFromA).map(assetTerms),
        assetsFromB: sortedAssets(pkg.assetsFromB).map(assetTerms),
        proposerProposalId: offer.proposerProposalId,
        counterpartyProposalId: counterProposal.id,
        executedOn: today,
      }),
    ],
    requests: [
      request(
        offer.proposerOrganizationId,
        offer.proposerProposalId,
        proposerSide,
      ),
      request(
        offer.counterpartyOrganizationId,
        counterProposal.id,
        counterpartySide,
      ),
    ],
  });
};

export const routeTradeCommand = (
  ctx: RouteContext,
  command: CommandPayloadBase & { readonly type: TradeCommandType },
): RouteOutcome => {
  const c = command as Cmd;
  switch (command.type) {
    case 'SubmitMarketInquiry':
      return routeInquiry(ctx, c);
    case 'PostTradeOffer':
      return routePost(ctx, c);
    case 'RequestTradeResponse':
      return routeRequestResponse(ctx, c);
    case 'AnswerTradeOffer':
      return routeAnswer(ctx, c);
    case 'CommitTradeAgreement':
      return routeCommit(ctx, c);
    default: {
      const unreachable: never = command.type;
      throw new Error(`unroutable trade command: ${String(unreachable)}`);
    }
  }
};
