import { entityId, recordId, type EntityId, type RecordId } from './ids';
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

export type MarketState = {
  readonly agentClients: readonly AgentClientRecord[];
  readonly playerPreferences: readonly PlayerMarketPreferenceProfile[];
  readonly inquiries: readonly unknown[];
  readonly tradeOffers: readonly unknown[];
  readonly contractOffers: readonly unknown[];
  readonly reservations: readonly unknown[];
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
