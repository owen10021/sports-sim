/**
 * Market & Contract domain: market state (Package C). Agents, player-side private
 * preferences, inquiries, offers, reservations and recorded responses. Immutable as-of
 * records; element types are refined by Tasks 3, 9 and 10.
 */
export type MarketState = {
  readonly agentClients: readonly unknown[];
  readonly playerPreferences: readonly unknown[];
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
