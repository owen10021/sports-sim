import type { ContractTermsV1 } from './contracts';
import type { EntityId, RecordId } from './ids';
import {
  PREFERENCE_LEVELS,
  type PlayerDisposition,
  type PlayerMarketPreferenceProfile,
  type PreferenceLevel,
  type RoleCommitment,
} from './market';
import { activeRightsFor, type RosterStatus } from './roster';
import type { FootballWorld } from './world';

/**
 * The player side's decision view (Package C, Task 10). It is what a player and his agent
 * can see and reason from: the player's own PRIVATE preference profile and the offers made
 * to him through his agent. It is never handed to an organization.
 *
 * It contains no organization-private structure (priority, fallback groups, reservations),
 * no relationship data, and no latent truth about any club. Evaluation is qualitative:
 * offers are described in bands, checked against the player's requirements, and compared
 * lexicographically by what the player cares about most. There is no numeric offer score,
 * and nothing here discounts or inflates terms for any organization.
 */

export const MARKET_DIMENSIONS = [
  'security',
  'earlyCash',
  'roleOpportunity',
] as const;
export type MarketDimension = (typeof MARKET_DIMENSIONS)[number];

const levelIndex = (l: PreferenceLevel): number => PREFERENCE_LEVELS.indexOf(l);

export type OfferBands = { readonly [D in MarketDimension]: PreferenceLevel };

/** One offer exactly as the player side sees it. */
export type OfferAsSeenByPlayer = {
  readonly offerId: RecordId;
  readonly revision: number;
  readonly organizationId: EntityId;
  readonly terms: ContractTermsV1;
  readonly roleCommitment: RoleCommitment;
  readonly targetRosterStatus: RosterStatus;
  readonly extension: boolean;
  /** The offering club holds this player's draft right: rookie scale terms, no negotiation. */
  readonly rookieSlot: boolean;
  readonly expiresAt: string | null;
  readonly totalCash: number;
  readonly bands: OfferBands;
};

export type PlayerMarketDecisionView = {
  readonly asOf: string;
  readonly playerId: EntityId;
  readonly agentPersonId: EntityId | null;
  /** Null when the player has no recorded profile; defaults are then used and flagged. */
  readonly preferences: PlayerMarketPreferenceProfile | null;
  readonly offers: readonly OfferAsSeenByPlayer[];
  readonly uncertainties: readonly string[];
};

/** The agent representing a player on `date`, or null. */
export const agentFor = (
  world: FootballWorld,
  playerId: EntityId,
  date: string,
): EntityId | null => {
  const link = world.market.agentClients
    .filter(
      (a) =>
        a.playerPersonId === playerId &&
        a.effectiveFrom <= date &&
        (a.effectiveUntil === null || date <= a.effectiveUntil),
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
  return link?.agentPersonId ?? null;
};

const cashOfYear = (terms: ContractTermsV1, i: number): number => {
  const y = terms.years[i]!;
  return y.baseSalary + y.rosterBonus;
};

/** Total cash the contract pays if it runs its course. */
export const totalCashOf = (terms: ContractTermsV1): number =>
  terms.signingBonus +
  terms.years.reduce((sum, _y, i) => sum + cashOfYear(terms, i), 0);

/** Cash the contract guarantees whatever happens. */
export const guaranteedCashOf = (terms: ContractTermsV1): number =>
  terms.signingBonus +
  terms.years.reduce((sum, y) => sum + y.guaranteedBase, 0);

const ROLE_BAND: Record<RoleCommitment, PreferenceLevel> = {
  starter: 'high',
  rotation: 'medium',
  depth: 'low',
  developmental: 'low',
};

/** Describes an offer in bands, from its terms alone. Integer arithmetic only. */
export const bandsOf = (
  terms: ContractTermsV1,
  role: RoleCommitment,
): OfferBands => {
  const total = totalCashOf(terms);
  const guaranteed = guaranteedCashOf(terms);
  const security: PreferenceLevel =
    guaranteed * 3 < total
      ? 'low'
      : guaranteed * 3 < total * 2
        ? 'medium'
        : 'high';
  const first = terms.signingBonus + cashOfYear(terms, 0);
  const n = terms.years.length;
  const earlyCash: PreferenceLevel =
    first * n * 10 >= total * 13
      ? 'high'
      : first * n >= total
        ? 'medium'
        : 'low';
  return { security, earlyCash, roleOpportunity: ROLE_BAND[role] };
};

/** The view's offers that are live for the player's current agent, in a stable order. */
export const buildPlayerMarketDecisionView = (
  world: FootballWorld,
  playerId: EntityId,
): PlayerMarketDecisionView => {
  const today = world.simDate;
  const agent = agentFor(world, playerId, today);
  const preferences =
    world.market.playerPreferences.find((p) => p.playerPersonId === playerId) ??
    null;
  const offers = world.market.contractOffers
    .filter(
      (o) =>
        o.playerId === playerId &&
        o.status === 'communicated' &&
        o.agentPersonId === agent &&
        (o.expiresAt === null || today < o.expiresAt),
    )
    .map((o): OfferAsSeenByPlayer => ({
      offerId: o.id,
      revision: o.revision,
      organizationId: o.organizationId,
      terms: o.terms,
      roleCommitment: o.roleCommitment,
      targetRosterStatus: o.targetRosterStatus,
      extension: o.extension,
      rookieSlot: activeRightsFor(world.roster, playerId, today).some(
        (r) =>
          r.kind === 'draft' && r.holderOrganizationId === o.organizationId,
      ),
      expiresAt: o.expiresAt,
      totalCash: totalCashOf(o.terms),
      bands: bandsOf(o.terms, o.roleCommitment),
    }))
    .sort((a, b) =>
      a.organizationId < b.organizationId
        ? -1
        : a.organizationId > b.organizationId
          ? 1
          : a.revision - b.revision,
    );
  const uncertainties = [
    // Contender preference needs team-results data, which this world does not have yet.
    'contender_preference_not_applied: no team-results data exists yet',
    ...(preferences === null
      ? ['no_preference_profile: defaults of medium were used']
      : []),
  ];
  return {
    asOf: today,
    playerId,
    agentPersonId: agent,
    preferences,
    offers,
    uncertainties,
  };
};

// --- evaluation ----------------------------------------------------------------

const DEFAULT_PROFILE = (
  playerId: EntityId,
): PlayerMarketPreferenceProfile => ({
  playerPersonId: playerId,
  security: 'medium',
  earlyCash: 'medium',
  roleOpportunity: 'medium',
  contenderPreference: 'medium',
  flexibility: 'medium',
});

/** What the player requires in a dimension: his preference, eased one step by flexibility. */
export const requirementFor = (
  profile: PlayerMarketPreferenceProfile,
  dimension: MarketDimension,
): PreferenceLevel => {
  const want = levelIndex(profile[dimension]);
  const eased = profile.flexibility === 'high' ? Math.max(0, want - 1) : want;
  return PREFERENCE_LEVELS[eased]!;
};

/** Dimensions the player cares about most first; ties by the fixed dimension order. */
const dimensionsByImportance = (
  profile: PlayerMarketPreferenceProfile,
): readonly MarketDimension[] =>
  [...MARKET_DIMENSIONS].sort(
    (a, b) =>
      levelIndex(profile[b]) - levelIndex(profile[a]) ||
      MARKET_DIMENSIONS.indexOf(a) - MARKET_DIMENSIONS.indexOf(b),
  );

export const unmetDimensions = (
  profile: PlayerMarketPreferenceProfile,
  bands: OfferBands,
): readonly MarketDimension[] =>
  MARKET_DIMENSIONS.filter(
    (d) => levelIndex(bands[d]) < levelIndex(requirementFor(profile, d)),
  );

/** A rookie-scale offer from the draft-rights holder is not negotiated: nothing is unmet. */
const unmetFor = (
  profile: PlayerMarketPreferenceProfile,
  o: OfferAsSeenByPlayer,
): readonly MarketDimension[] =>
  o.rookieSlot ? [] : unmetDimensions(profile, o.bands);

const compareOffers = (
  profile: PlayerMarketPreferenceProfile,
  a: OfferAsSeenByPlayer,
  b: OfferAsSeenByPlayer,
): number => {
  for (const d of dimensionsByImportance(profile)) {
    const diff = levelIndex(b.bands[d]) - levelIndex(a.bands[d]);
    if (diff !== 0) return diff;
  }
  if (a.totalCash !== b.totalCash) return b.totalCash - a.totalCash;
  // Content-only final tie-break so ordering never depends on record ids or arrival order.
  return a.organizationId < b.organizationId
    ? -1
    : a.organizationId > b.organizationId
      ? 1
      : 0;
};

/** The offers this player would accept, best first. Depends only on offer content. */
export const rankAcceptableOffers = (
  profile: PlayerMarketPreferenceProfile | null,
  playerId: EntityId,
  offers: readonly OfferAsSeenByPlayer[],
): readonly OfferAsSeenByPlayer[] => {
  const p = profile ?? DEFAULT_PROFILE(playerId);
  return offers
    .filter((o) => unmetFor(p, o).length === 0)
    .sort((a, b) => compareOffers(p, a, b));
};

const COMMUNICATED_DIMENSION: Record<MarketDimension, string> = {
  security: 'security',
  earlyCash: 'cash_timing',
  roleOpportunity: 'role',
};

export type PlayerOfferEvaluation = {
  readonly offerId: RecordId;
  readonly revision: number;
  readonly organizationId: EntityId;
  readonly disposition: PlayerDisposition;
  /** Private to the player side. */
  readonly reasons: readonly string[];
  /** The coarse answer the offering club may see. */
  readonly communicated: readonly string[];
  readonly unmet: readonly MarketDimension[];
};

/**
 * The player's answer to every live offer at once: the best acceptable offer is accepted,
 * other acceptable ones are deferred (held pending the best), an offer short on exactly one
 * requirement draws a counter naming that requirement, and anything further off is rejected.
 */
export const evaluatePlayerOfferSet = (
  view: PlayerMarketDecisionView,
): readonly PlayerOfferEvaluation[] => {
  const profile = view.preferences ?? DEFAULT_PROFILE(view.playerId);
  const ranked = rankAcceptableOffers(
    view.preferences,
    view.playerId,
    view.offers,
  );
  const best = ranked[0]?.offerId;
  return view.offers.map((o): PlayerOfferEvaluation => {
    const unmet = unmetFor(profile, o);
    const base = {
      offerId: o.offerId,
      revision: o.revision,
      organizationId: o.organizationId,
      unmet,
    };
    const detail = MARKET_DIMENSIONS.map((d) =>
      unmet.includes(d)
        ? `requirement_unmet:${d}(needs ${requirementFor(profile, d)}, offer ${o.bands[d]})`
        : `requirement_met:${d}(needs ${requirementFor(profile, d)}, offer ${o.bands[d]})`,
    );
    if (unmet.length === 0) {
      if (o.offerId === best)
        return {
          ...base,
          disposition: 'accept',
          reasons: [...detail, 'best_acceptable_offer'],
          communicated: ['interested'],
        };
      return {
        ...base,
        disposition: 'defer',
        reasons: [...detail, 'acceptable_but_another_offer_ranks_higher'],
        communicated: ['considering'],
      };
    }
    if (unmet.length === 1)
      return {
        ...base,
        disposition: 'counter',
        reasons: detail,
        communicated: [`wants_more_${COMMUNICATED_DIMENSION[unmet[0]!]}`],
      };
    return {
      ...base,
      disposition: 'reject',
      reasons: detail,
      communicated: ['not_a_fit'],
    };
  });
};
