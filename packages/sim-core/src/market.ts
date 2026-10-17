import type { AcquisitionAssetRef, TradePackageV1 } from './assets';
import type { SeasonAmount } from './contracts';
import { entityId, recordId, type EntityId, type RecordId } from './ids';
import type { RosterStatus } from './roster';
import type { PackageCSubstrateSeed } from './packageCSeedParse';

/**
 * Market & Contract domain: market state (Package C). Agents, player-side private
 * preferences, inquiries, offers, reservations and recorded responses. Immutable as-of
 * records; offer/inquiry element types are refined by Tasks 9 and 10.
 */

export const PREFERENCE_LEVELS = ['low', 'medium', 'high'] as const;
export type PreferenceLevel = (typeof PREFERENCE_LEVELS)[number];

/** A persistent agent <-> client relationship over an interval. */
export type AgentClientRecord = {
  readonly id: RecordId;
  readonly agentPersonId: EntityId;
  readonly playerPersonId: EntityId;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
};

/**
 * PRIVATE player-side preferences. Never automatically visible to any organization; only
 * the player-side market view (Task 10) may read them.
 */
export type PlayerMarketPreferenceProfile = {
  readonly playerPersonId: EntityId;
  readonly security: PreferenceLevel;
  readonly earlyCash: PreferenceLevel;
  readonly roleOpportunity: PreferenceLevel;
  readonly contenderPreference: PreferenceLevel;
  readonly flexibility: PreferenceLevel;
};

export const RESERVATION_SOURCE_KINDS = [
  'waiver_claim',
  'contract_offer',
  'trade_offer',
] as const;
export type ReservationSourceKind = (typeof RESERVATION_SOURCE_KINDS)[number];
export const RESERVATION_STATUSES = ['active', 'released', 'consumed'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/**
 * Cap room and a roster slot held for a pending commitment, so two pending commitments can
 * never spend the same room. Active reservations count against availability; released and
 * consumed ones are history.
 */
export type Reservation = {
  readonly id: RecordId;
  readonly organizationId: EntityId;
  readonly sourceKind: ReservationSourceKind;
  readonly sourceRecordId: RecordId;
  readonly capBySeason: readonly SeasonAmount[];
  readonly rosterSlotStatus: RosterStatus | null;
  readonly createdAt: string;
  readonly status: ReservationStatus;
};

/**
 * What a club chooses to communicate when asked about an asset. It is a contextual
 * communication, never a statement of what the asset is worth: `none` means nothing was
 * communicated and says nothing about hidden interest.
 */
export const TRADE_INTEREST_BANDS = [
  'none',
  'open',
  'interested',
  'priority',
] as const;
export type TradeInterestBand = (typeof TRADE_INTEREST_BANDS)[number];

export const INQUIRY_DIRECTIONS = ['seek', 'shop'] as const;
export type InquiryDirection = (typeof INQUIRY_DIRECTIONS)[number];

/** One club contacting one other club about one asset; who was contacted is preserved. */
export type MarketInquiry = {
  readonly id: RecordId;
  readonly askingOrganizationId: EntityId;
  readonly askedBy: EntityId;
  readonly contactedOrganizationId: EntityId;
  readonly asset: AcquisitionAssetRef;
  readonly direction: InquiryDirection;
  readonly createdAt: string;
};

export type InquiryResponse = {
  readonly kind: 'inquiry_response';
  readonly id: RecordId;
  readonly inquiryId: RecordId;
  readonly respondingOrganizationId: EntityId;
  readonly band: TradeInterestBand;
  /** Hash of the responder's relevant state when it answered; an unchanged hash reuses this. */
  readonly basisHash: string;
  readonly createdAt: string;
};

export const TRADE_OFFER_STATUSES = [
  'open',
  'accepted',
  'declined',
  'countered',
  'withdrawn',
  'expired',
  'executed',
] as const;
export type TradeOfferStatus = (typeof TRADE_OFFER_STATUSES)[number];

/** One revision of a trade offer. Revisions are never edited; a change is a new revision. */
export type TradeOfferRecord = {
  readonly id: RecordId;
  readonly revision: number;
  readonly proposerOrganizationId: EntityId;
  readonly counterpartyOrganizationId: EntityId;
  readonly package: TradePackageV1;
  readonly proposerProposalId: RecordId;
  readonly counterpartyProposalId: RecordId | null;
  readonly termsHash: string;
  readonly status: TradeOfferStatus;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly supersedesRevision: number | null;
};

export const TRADE_DISPOSITIONS = [
  'reject',
  'counter',
  'accept',
  'defer',
] as const;
export type TradeDisposition = (typeof TRADE_DISPOSITIONS)[number];

/** A reason names the part of the responder's own view it rests on; it carries no score. */
export type TradeReason = {
  readonly code: string;
  readonly source:
    | 'own_roster'
    | 'own_cap'
    | 'own_picks'
    | 'own_plan'
    | 'own_belief'
    | 'public'
    | 'authority';
  readonly detail: string;
};

export type TradeOfferResponse = {
  readonly kind: 'trade_response';
  readonly id: RecordId;
  readonly offerId: RecordId;
  readonly offerRevision: number;
  readonly respondingOrganizationId: EntityId;
  readonly disposition: TradeDisposition;
  /** Private to the responding club: its own reasons, citing only its own view. */
  readonly reasons: readonly TradeReason[];
  readonly uncertainties: readonly string[];
  /** What the responder actually told the other club; never its private reasons. */
  readonly communicated: readonly string[];
  readonly basisHash: string;
  readonly createdAt: string;
};

export type MarketResponse = InquiryResponse | TradeOfferResponse;

export type MarketState = {
  readonly agentClients: readonly AgentClientRecord[];
  readonly playerPreferences: readonly PlayerMarketPreferenceProfile[];
  readonly inquiries: readonly MarketInquiry[];
  readonly tradeOffers: readonly TradeOfferRecord[];
  readonly contractOffers: readonly unknown[];
  readonly reservations: readonly Reservation[];
  readonly responses: readonly MarketResponse[];
};

export const emptyMarketState = (): MarketState => ({
  agentClients: [],
  playerPreferences: [],
  inquiries: [],
  tradeOffers: [],
  contractOffers: [],
  reservations: [],
  responses: [],
});

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Initial market state from the seed's Package C block, in canonical order. */
export const seededMarketState = (
  sub: PackageCSubstrateSeed | undefined,
): MarketState => {
  if (sub === undefined) return emptyMarketState();
  return {
    ...emptyMarketState(),
    agentClients: sub.agentClients
      .map((a): AgentClientRecord => ({
        id: recordId(a.id),
        agentPersonId: entityId(a.agentPersonId),
        playerPersonId: entityId(a.playerPersonId),
        effectiveFrom: a.effectiveFrom,
        effectiveUntil: a.effectiveUntil,
      }))
      .sort((a, b) => byText(a.id, b.id)),
    playerPreferences: sub.playerPreferences
      .map((p): PlayerMarketPreferenceProfile => ({
        playerPersonId: entityId(p.playerPersonId),
        security: p.security,
        earlyCash: p.earlyCash,
        roleOpportunity: p.roleOpportunity,
        contenderPreference: p.contenderPreference,
        flexibility: p.flexibility,
      }))
      .sort((a, b) => byText(a.playerPersonId, b.playerPersonId)),
  };
};

/** Cap room held for an organization's pending commitments in a season. */
export const reservedCap = (
  market: Pick<MarketState, 'reservations'>,
  organizationId: EntityId,
  season: number,
): number =>
  market.reservations
    .filter((r) => r.organizationId === organizationId && r.status === 'active')
    .reduce(
      (sum, r) =>
        sum + (r.capBySeason.find((x) => x.season === season)?.amount ?? 0),
      0,
    );

/** Roster slots held for an organization's pending commitments on one list. */
export const reservedSlots = (
  market: Pick<MarketState, 'reservations'>,
  organizationId: EntityId,
  status: RosterStatus,
): number =>
  market.reservations.filter(
    (r) =>
      r.organizationId === organizationId &&
      r.status === 'active' &&
      r.rosterSlotStatus === status,
  ).length;
