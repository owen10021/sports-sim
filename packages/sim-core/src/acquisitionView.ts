import { effectiveRightsAt } from './authority';
import {
  agreementCapCharge,
  capPosition,
  tradeImpact,
  type CapPosition,
} from './contractMath';
import {
  UnknownTransactionSeasonError,
  type TransactionRulesV1,
} from './economy';
import type { EntityId, RecordId } from './ids';
import {
  buildOrganizationKnowledgeView,
  type OrganizationKnowledgeView,
} from './knowledgeView';
import type {
  InquiryResponse,
  MarketInquiry,
  TradeOfferRecord,
  TradeOfferResponse,
} from './market';
import { holdsRoleAt } from './people';
import type { PlanConstraint, PlanObjective } from './plans';
import {
  activeRightsFor,
  currentRosterMembership,
  rosterCapacity,
  seasonOfDate,
  type RosterCapacity,
  type RosterStatus,
} from './roster';
import type { SeasonAmount } from './contracts';
import { reservedCap, reservedSlots } from './market';
import type { FootballWorld } from './world';

/**
 * The belief convention the acquisition market reads. A club's evaluation of a player is an
 * ordinary Package B belief (`assessmentType` below) with a coarse tier, so it carries the
 * author, evidence, confidence and as-of date of any other belief. A tier is a statement
 * about the club's own plan ("we want him", "we would use him as depth"), never a value.
 */
export const ACQUISITION_TIER_ASSESSMENT = 'acquisition_tier';
export const ACQUISITION_TIERS = [
  'priority',
  'target',
  'depth',
  'avoid',
] as const;
export type AcquisitionTier = (typeof ACQUISITION_TIERS)[number];

/** The plan objective that states a club's competitive posture. */
export const COMPETITIVE_WINDOW_KEY = 'competitive_window';
export const COMPETITIVE_WINDOWS = ['contend', 'rebuild'] as const;
export type CompetitiveWindow = (typeof COMPETITIVE_WINDOWS)[number];

export type PublicPickFact = {
  readonly pickId: RecordId;
  readonly season: number;
  readonly round: number;
  readonly slot: number | null;
  readonly originalOrganizationId: EntityId;
  readonly ownerOrganizationId: EntityId;
  readonly status: 'available' | 'used';
};

/** League-record facts about a player: position, birth date and who holds the rights. */
export type PublicPlayerFact = {
  readonly playerId: EntityId;
  readonly primaryRole: string;
  readonly birthDate: string;
  readonly holderOrganizationId: EntityId | null;
  readonly rosterStatus: RosterStatus | null;
};

/** Signed contracts are a public league record. */
export type PublicContractFact = {
  readonly playerId: EntityId;
  readonly organizationId: EntityId;
  readonly agreementId: RecordId;
  readonly finalSeason: number;
  /** The current holder's whole cap charge by season, from this season on. */
  readonly capChargeBySeason: readonly SeasonAmount[];
  /** What a club acquiring the contract now would be charged under the ruleset. */
  readonly receiverChargeBySeason: readonly SeasonAmount[];
  /** What the current holder keeps as dead cap if the contract is traded now. */
  readonly retainedDeadCapBySeason: readonly SeasonAmount[];
};

export type OwnPlanFact = {
  readonly planId: RecordId;
  readonly kind: string;
  readonly scopeKey: string;
  readonly objectives: readonly PlanObjective[];
  readonly constraints: readonly PlanConstraint[];
};

/**
 * Everything one organization may legitimately use when it decides on an acquisition. It
 * holds the club's own state, what it has legitimately learned or been told, and the public
 * league record. It has no field for another club's board, plan, offer or limit, for a
 * player's private preferences, or for any latent capability.
 */
export interface AcquisitionDecisionView {
  readonly organizationId: EntityId;
  readonly actorPersonId: EntityId;
  readonly asOf: string;
  readonly authority: {
    readonly acquisition: readonly string[];
    readonly roster: readonly string[];
  };
  readonly own: {
    readonly roster: readonly PublicPlayerFact[];
    readonly capBySeason: readonly CapPosition[];
    readonly capacity: RosterCapacity;
    readonly picks: readonly PublicPickFact[];
    readonly reservationIds: readonly RecordId[];
    readonly reserved: {
      readonly capBySeason: readonly SeasonAmount[];
      readonly slots: Readonly<Record<RosterStatus, number>>;
    };
  };
  readonly plans: readonly OwnPlanFact[];
  readonly knowledge: OrganizationKnowledgeView;
  /** Only communications this club sent or received. */
  readonly market: {
    readonly inquiries: readonly MarketInquiry[];
    readonly receivedInquiries: readonly MarketInquiry[];
    readonly inquiryResponses: readonly InquiryResponse[];
    readonly offers: readonly TradeOfferRecord[];
    readonly offerResponses: readonly TradeOfferResponse[];
  };
  readonly publicContext: {
    readonly players: readonly PublicPlayerFact[];
    readonly contracts: readonly PublicContractFact[];
    readonly picks: readonly PublicPickFact[];
  };
  readonly candidateIds: {
    readonly playerIds: readonly EntityId[];
    readonly pickIds: readonly RecordId[];
  };
}

export type AcquisitionViewResult =
  | { readonly ok: true; readonly view: AcquisitionDecisionView }
  | { readonly ok: false; readonly reason: string };

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const pickFact = (
  p: FootballWorld['draft']['picks'][number],
): PublicPickFact => ({
  pickId: p.id,
  season: p.season,
  round: p.round,
  slot: p.slot,
  originalOrganizationId: p.originalOrganizationId,
  ownerOrganizationId: p.ownerOrganizationId,
  status: p.status,
});

export const buildAcquisitionDecisionView = (
  world: FootballWorld,
  organizationId: EntityId,
  actorPersonId: EntityId,
  tx: TransactionRulesV1,
): AcquisitionViewResult => {
  const today = world.simDate;
  if (!holdsRoleAt(world.people, organizationId, actorPersonId, today))
    return {
      ok: false,
      reason: `${actorPersonId} holds no role in ${organizationId}`,
    };
  const season = seasonOfDate(today);

  const players: PublicPlayerFact[] = world.roster.players
    .map((p): PublicPlayerFact => {
      const rights = activeRightsFor(world.roster, p.personId, today);
      const membership = currentRosterMembership(
        world.roster,
        p.personId,
        today,
      );
      return {
        playerId: p.personId,
        primaryRole: p.primaryRole,
        birthDate: p.birthDate,
        holderOrganizationId:
          rights.find((r) => r.kind === 'contract')?.holderOrganizationId ??
          rights[0]?.holderOrganizationId ??
          null,
        rosterStatus: membership?.status ?? null,
      };
    })
    .sort((a, b) => byText(a.playerId, b.playerId));

  const contracts: PublicContractFact[] = world.contracts.agreements
    .filter((a) => a.status === 'active')
    .map((a) => ({
      playerId: a.playerId,
      organizationId: a.organizationId,
      agreementId: a.id,
      finalSeason: a.terms.years[a.terms.years.length - 1]!.season,
      capChargeBySeason: a.terms.years
        .filter((y) => y.season >= season)
        .map((y) => ({
          season: y.season,
          amount: agreementCapCharge(tx.contracts, a, y.season),
        })),
      receiverChargeBySeason: tradeImpact(tx.contracts, a.terms, season)
        .receiverCapBySeason,
      retainedDeadCapBySeason: tradeImpact(tx.contracts, a.terms, season)
        .senderDeadCapBySeason,
    }))
    .sort((a, b) => byText(a.agreementId, b.agreementId));

  const capBySeason: CapPosition[] = [];
  for (let s = season; s < season + 4; s += 1) {
    try {
      capBySeason.push(capPosition(tx, world.contracts, organizationId, s));
    } catch (e) {
      if (!(e instanceof UnknownTransactionSeasonError)) throw e;
    }
  }

  const picks = world.draft.picks
    .map(pickFact)
    .sort((a, b) => byText(a.pickId, b.pickId));
  const mine = (id: EntityId) => id === organizationId;
  const offers = world.market.tradeOffers
    .filter(
      (o) =>
        mine(o.proposerOrganizationId) || mine(o.counterpartyOrganizationId),
    )
    .sort((a, b) => byText(a.id, b.id) || a.revision - b.revision);
  const ownInquiryIds = new Set(
    world.market.inquiries
      .filter((i) => mine(i.askingOrganizationId))
      .map((i) => i.id),
  );
  const responses = world.market.responses;

  return {
    ok: true,
    view: {
      organizationId,
      actorPersonId,
      asOf: today,
      authority: {
        acquisition: [
          ...effectiveRightsAt(
            world,
            organizationId,
            actorPersonId,
            'acquisition',
            today,
          ).rights,
        ],
        roster: [
          ...effectiveRightsAt(
            world,
            organizationId,
            actorPersonId,
            'roster',
            today,
          ).rights,
        ],
      },
      own: {
        roster: players.filter(
          (p) => p.holderOrganizationId === organizationId,
        ),
        capBySeason,
        capacity: rosterCapacity(world.roster, tx, organizationId, today),
        picks: picks.filter((p) => p.ownerOrganizationId === organizationId),
        reserved: {
          capBySeason: capBySeason.map((c) => ({
            season: c.season,
            amount: reservedCap(
              world.market,
              organizationId,
              c.season,
            ) as SeasonAmount['amount'],
          })),
          slots: {
            active: reservedSlots(world.market, organizationId, 'active'),
            reserve: reservedSlots(world.market, organizationId, 'reserve'),
            practice_squad: reservedSlots(
              world.market,
              organizationId,
              'practice_squad',
            ),
          },
        },
        reservationIds: world.market.reservations
          .filter(
            (r) => r.organizationId === organizationId && r.status === 'active',
          )
          .map((r) => r.id)
          .sort(byText),
      },
      plans: world.plans.plans
        .filter(
          (p) => p.organizationId === organizationId && p.status === 'active',
        )
        .map((p): OwnPlanFact => {
          const rev = p.revisions.find(
            (r) => r.revision === p.currentRevision,
          )!;
          return {
            planId: p.id,
            kind: p.kind,
            scopeKey: p.scopeKey,
            objectives: rev.objectives,
            constraints: rev.constraints,
          };
        })
        .sort((a, b) => byText(a.planId, b.planId)),
      knowledge: buildOrganizationKnowledgeView(
        world,
        organizationId,
        actorPersonId,
      ),
      market: {
        inquiries: world.market.inquiries.filter((i) =>
          mine(i.askingOrganizationId),
        ),
        receivedInquiries: world.market.inquiries.filter((i) =>
          mine(i.contactedOrganizationId),
        ),
        inquiryResponses: responses
          .filter(
            (r): r is InquiryResponse =>
              r.kind === 'inquiry_response' && ownInquiryIds.has(r.inquiryId),
          )
          .map((r) => ({ ...r, basisHash: '' })),
        offers,
        offerResponses: responses
          .filter(
            (r): r is TradeOfferResponse =>
              r.kind === 'trade_response' &&
              offers.some((o) => o.id === r.offerId),
          )
          .map((r) =>
            r.respondingOrganizationId === organizationId
              ? r
              : { ...r, reasons: [], uncertainties: [], basisHash: '' },
          ),
      },
      publicContext: { players, contracts, picks },
      candidateIds: {
        playerIds: players
          .filter(
            (p) =>
              p.holderOrganizationId !== null &&
              p.holderOrganizationId !== organizationId,
          )
          .map((p) => p.playerId),
        pickIds: picks
          .filter(
            (p) =>
              p.ownerOrganizationId !== organizationId &&
              p.status === 'available',
          )
          .map((p) => p.pickId),
      },
    },
  };
};
