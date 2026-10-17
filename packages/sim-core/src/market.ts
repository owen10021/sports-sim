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

export type MarketState = {
  readonly agentClients: readonly AgentClientRecord[];
  readonly playerPreferences: readonly PlayerMarketPreferenceProfile[];
  readonly inquiries: readonly unknown[];
  readonly tradeOffers: readonly unknown[];
  readonly contractOffers: readonly unknown[];
  readonly reservations: readonly Reservation[];
  readonly responses: readonly unknown[];
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
