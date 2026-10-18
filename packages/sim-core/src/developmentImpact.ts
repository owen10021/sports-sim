import type { OpportunityResourceKey, OpportunityWindow } from './development';
import { entityId, type EntityId, type RecordId } from './ids';
import { currentRosterMembership } from './roster';
import type { FootballWorld } from './world';

export const OPPORTUNITY_IMPACT_BANDS = [
  'none',
  'low',
  'meaningful',
  'severe',
] as const;
export type OpportunityImpactBand = (typeof OPPORTUNITY_IMPACT_BANDS)[number];

export interface OpportunityPoolImpact {
  readonly windowId: RecordId;
  readonly resourceKey: OpportunityResourceKey;
  readonly scopeKey: string;
  readonly capacityUnits: number;
  readonly allocatedUnits: number;
  readonly openUnits: number;
  readonly incomingCompetitionPlayerIds: readonly EntityId[];
  readonly outgoingCompetitionPlayerIds: readonly EntityId[];
  readonly crowdingBand: OpportunityImpactBand;
  readonly reliefBand: OpportunityImpactBand;
  readonly linkedPlanIds: readonly RecordId[];
}

/**
 * Derived consequence preview only. It is not authoritative state and deliberately contains
 * no capability, latent development, medical, RNG or predicted-career information.
 */
export interface OpportunityImpactPreview {
  readonly organizationId: EntityId;
  readonly asOf: string;
  readonly incomingPlayerIds: readonly EntityId[];
  readonly outgoingPlayerIds: readonly EntityId[];
  readonly pools: readonly OpportunityPoolImpact[];
  readonly uncertaintyNotes: readonly string[];
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const uniqueSorted = <T extends string>(values: readonly T[]): T[] =>
  [...new Set(values)].sort(byText) as T[];

const activeOpportunityWindows = (
  world: FootballWorld,
  organizationId: EntityId,
): readonly OpportunityWindow[] =>
  world.development.opportunityWindows
    .filter(
      (window) =>
        window.organizationId === organizationId &&
        window.status === 'open' &&
        window.fromDate <= world.simDate &&
        world.simDate < window.toDate,
    )
    .sort((a, b) => byText(a.id, b.id));

const pressureBand = (
  capacityUnits: number,
  openUnits: number,
  hasDirection: boolean,
): OpportunityImpactBand => {
  if (!hasDirection || capacityUnits <= 0) return 'none';
  if (openUnits <= 0) return 'severe';
  if (openUnits * 4 <= capacityUnits) return 'meaningful';
  if (openUnits * 2 <= capacityUnits) return 'low';
  return 'none';
};

const matchesScope = (
  world: FootballWorld,
  playerId: EntityId,
  scopeKey: string,
): boolean => {
  const player = world.roster.players.find(
    (entry) => entry.personId === playerId,
  );
  return (
    player !== undefined &&
    (player.primaryRole === scopeKey || player.roleTags.includes(scopeKey))
  );
};

const resolvedIncoming = (
  world: FootballWorld,
  ids: readonly string[],
  notes: Set<string>,
): readonly EntityId[] => {
  const resolved: EntityId[] = [];
  for (const id of uniqueSorted(ids)) {
    if (!world.roster.players.some((player) => player.personId === id)) {
      notes.add(`unknown_incoming_player:${id}`);
      continue;
    }
    resolved.push(entityId(id));
  }
  return resolved;
};

const resolvedOutgoing = (
  world: FootballWorld,
  organizationId: EntityId,
  ids: readonly string[],
  notes: Set<string>,
): readonly EntityId[] => {
  const resolved: EntityId[] = [];
  for (const id of uniqueSorted(ids)) {
    const player = world.roster.players.find((entry) => entry.personId === id);
    if (player === undefined) {
      notes.add(`unknown_outgoing_player:${id}`);
      continue;
    }
    const playerId = entityId(id);
    if (
      currentRosterMembership(world.roster, playerId, world.simDate)
        ?.organizationId !== organizationId
    ) {
      notes.add(`outgoing_player_not_on_roster:${id}`);
      continue;
    }
    resolved.push(playerId);
  }
  return resolved;
};

const linkedPlanIdsForPool = (
  world: FootballWorld,
  organizationId: EntityId,
  windowId: RecordId,
  resourceKey: OpportunityResourceKey,
  scopeKey: string,
): readonly RecordId[] => {
  const linked = new Set<RecordId>();
  for (const plan of world.plans.plans) {
    if (
      plan.organizationId === organizationId &&
      plan.status === 'active' &&
      (plan.kind === 'development' || plan.kind === 'succession') &&
      plan.scopeKey === scopeKey
    )
      linked.add(plan.id);
  }
  for (const allocation of world.development.opportunityAllocations) {
    if (
      allocation.windowId !== windowId ||
      allocation.organizationId !== organizationId ||
      allocation.resourceKey !== resourceKey ||
      allocation.scopeKey !== scopeKey
    )
      continue;
    for (const planId of allocation.basisPlanIds) {
      const plan = world.plans.plans.find((entry) => entry.id === planId);
      if (
        plan !== undefined &&
        plan.organizationId === organizationId &&
        (plan.kind === 'development' || plan.kind === 'succession')
      )
        linked.add(planId);
    }
  }
  return [...linked].sort(byText);
};

/**
 * Preview structural developmental opportunity consequences of a hypothetical roster change.
 * It reads only current roster labels, finite opportunity windows/allocations, and plans owned
 * by the organization. It never predicts whether any player will develop well.
 */
export const previewOpportunityImpactForRosterChange = (
  world: FootballWorld,
  organizationId: EntityId,
  incomingPlayerIds: readonly string[],
  outgoingPlayerIds: readonly string[],
): OpportunityImpactPreview => {
  const notes = new Set<string>([
    'structural_projection_only',
    'role_labels_do_not_predict_usage',
  ]);
  const incoming = resolvedIncoming(world, incomingPlayerIds, notes);
  const outgoing = resolvedOutgoing(
    world,
    organizationId,
    outgoingPlayerIds,
    notes,
  );
  const windows = activeOpportunityWindows(world, organizationId);
  if (windows.length === 0) notes.add('no_current_open_opportunity_window');

  const pools: OpportunityPoolImpact[] = [];
  const incomingMatched = new Set<EntityId>();
  const outgoingMatched = new Set<EntityId>();
  for (const window of windows) {
    for (const pool of window.pools) {
      const incomingCompetition = incoming.filter((playerId) =>
        matchesScope(world, playerId, pool.scopeKey),
      );
      const outgoingCompetition = outgoing.filter((playerId) =>
        matchesScope(world, playerId, pool.scopeKey),
      );
      if (incomingCompetition.length === 0 && outgoingCompetition.length === 0)
        continue;
      incomingCompetition.forEach((id) => incomingMatched.add(id));
      outgoingCompetition.forEach((id) => outgoingMatched.add(id));

      const allocatedUnits = world.development.opportunityAllocations
        .filter(
          (allocation) =>
            allocation.windowId === window.id &&
            allocation.organizationId === organizationId &&
            allocation.resourceKey === pool.resourceKey &&
            allocation.scopeKey === pool.scopeKey,
        )
        .reduce((sum, allocation) => sum + allocation.units, 0);
      const openUnits = Math.max(0, pool.capacityUnits - allocatedUnits);
      pools.push({
        windowId: window.id,
        resourceKey: pool.resourceKey,
        scopeKey: pool.scopeKey,
        capacityUnits: pool.capacityUnits,
        allocatedUnits,
        openUnits,
        incomingCompetitionPlayerIds: uniqueSorted(incomingCompetition),
        outgoingCompetitionPlayerIds: uniqueSorted(outgoingCompetition),
        crowdingBand: pressureBand(
          pool.capacityUnits,
          openUnits,
          incomingCompetition.length > 0,
        ),
        reliefBand: pressureBand(
          pool.capacityUnits,
          openUnits,
          outgoingCompetition.length > 0,
        ),
        linkedPlanIds: linkedPlanIdsForPool(
          world,
          organizationId,
          window.id,
          pool.resourceKey,
          pool.scopeKey,
        ),
      });
    }
  }

  for (const id of incoming)
    if (!incomingMatched.has(id))
      notes.add(`no_current_pool_for_incoming:${id}`);
  for (const id of outgoing)
    if (!outgoingMatched.has(id))
      notes.add(`no_current_pool_for_outgoing:${id}`);

  pools.sort(
    (a, b) =>
      byText(a.windowId, b.windowId) ||
      byText(a.scopeKey, b.scopeKey) ||
      byText(a.resourceKey, b.resourceKey),
  );
  return {
    organizationId,
    asOf: world.simDate,
    incomingPlayerIds: uniqueSorted(incoming),
    outgoingPlayerIds: uniqueSorted(outgoing),
    pools,
    uncertaintyNotes: [...notes].sort(byText),
  };
};
