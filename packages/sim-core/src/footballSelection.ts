import type { CanonicalValue } from './audit';
import type {
  FootballSelectionSituation,
  FootballState,
  GamePlanExecutionSnapshot,
} from './football';
import {
  requireFootballRules,
  type FootballFormationRule,
  type FootballMatchupEdge,
  type FootballRulesV1,
  type PlayCategory,
} from './footballRules';
import type { EntityId, RecordId } from './ids';
import type { LeagueRulesetManifest } from './ruleset';

/**
 * Independent pre-play call selection (Package E design basis section 9).
 *
 * The offense and the defense each choose from their OWN selection view. The two view
 * types are structurally distinct, and neither can carry the other side's final call: the
 * only things a view holds are the selecting club's own committed game plan, its own
 * designated players, the public scoreboard situation, the ruleset vocabulary, and
 * tendencies observable from plays that have already been run. Nothing here reads player
 * capabilities, readiness, medical truth, the opponent's plan or designations, or the
 * world RNG: the builders accept only `{ football }` and the selectors only a view plus
 * explicit rolls. The reality resolver (Task 7) is the only consumer of latent truth.
 */

export type SelectionSide = 'offense' | 'defense';

export class FootballSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FootballSelectionError';
  }
}

const fail = (message: string): never => {
  throw new FootballSelectionError(message);
};

/** The scoreboard as the selecting side sees it. */
export interface SelectionSituation {
  readonly period: number;
  readonly clockSecondsRemaining: number;
  readonly down: number;
  readonly yardsToGo: number;
  /** Yards the offense has advanced from its own goal line. */
  readonly offenseYardLine: number;
  /** Own points minus opponent points. */
  readonly scoreDifferential: number;
  readonly timeoutsRemaining: number;
}

export interface SelectionGamePlan {
  readonly gamePlanId: RecordId;
  readonly schemeKey: string;
  readonly conceptKeys: readonly string[];
  readonly personnelPreferenceKeys: readonly string[];
  readonly constraints: { readonly [key: string]: CanonicalValue };
}

export interface SelectionParticipant {
  readonly playerId: EntityId;
  readonly roleKey: string;
  readonly depthOrder: number;
}

export interface SelectionFormation {
  readonly formationKey: string;
  readonly personnelKey: string;
  readonly slots: readonly {
    readonly slotKey: string;
    readonly eligibleRoles: readonly string[];
  }[];
}

export interface SelectionConcept {
  readonly conceptKey: string;
  readonly playCategory: PlayCategory;
  /** The fieldable formations this concept can be run from, in canonical order. */
  readonly formationKeys: readonly string[];
}

export interface ObservedConceptCount {
  readonly conceptKey: string;
  readonly count: number;
}

interface SelectionViewBase {
  readonly fixtureId: RecordId;
  readonly organizationId: EntityId;
  readonly situation: SelectionSituation;
  readonly gamePlan: SelectionGamePlan;
  readonly participants: readonly SelectionParticipant[];
  readonly formations: readonly SelectionFormation[];
  readonly concepts: readonly SelectionConcept[];
  /** Ruleset tactical edges (offense perspective) among this view's candidate concepts. */
  readonly tacticalEdges: readonly FootballMatchupEdge[];
}

export interface OffensiveSelectionView extends SelectionViewBase {
  readonly side: 'offense';
  /** How often the defense has used each concept so far in this game. */
  readonly observedDefensiveConcepts: readonly ObservedConceptCount[];
}

export interface DefensiveSelectionView extends SelectionViewBase {
  readonly side: 'defense';
  /** How often the offense has used each concept so far in this game. */
  readonly observedOffensiveConcepts: readonly ObservedConceptCount[];
}

/** The snaps taken by the special-teams units. */
export type SpecialTeamsCategory =
  'kickoff' | 'punt' | 'field_goal' | 'extra_point';

/** The kicking unit's own view: its plan, its designated kickers and the public scoreboard. */
export interface KickingSelectionView extends SelectionViewBase {
  readonly side: 'kicking';
  readonly playCategory: SpecialTeamsCategory;
}

/** The receiving / blocking unit's own view; it never carries the kicking side's call. */
export interface ReturningSelectionView extends SelectionViewBase {
  readonly side: 'returning';
  readonly playCategory: SpecialTeamsCategory;
}

export interface LineupSlot {
  readonly slotKey: string;
  readonly playerId: EntityId;
}

interface CommittedCallBase {
  readonly fixtureId: RecordId;
  readonly organizationId: EntityId;
  readonly conceptKey: string;
  readonly formationKey: string;
  readonly personnelKey: string;
  readonly playCategory: PlayCategory;
  readonly lineup: readonly LineupSlot[];
}

export interface CommittedOffensiveCall extends CommittedCallBase {
  readonly side: 'offense';
}

export interface CommittedDefensiveCall extends CommittedCallBase {
  readonly side: 'defense';
}

export interface CommittedKickingCall extends CommittedCallBase {
  readonly side: 'kicking';
}

export interface CommittedReturningCall extends CommittedCallBase {
  readonly side: 'returning';
}

/** The two explicit unsigned 32-bit draws one side's selection consumes. */
export interface SelectorRolls {
  readonly conceptRoll: number;
  readonly formationRoll: number;
}

// ---------------------------------------------------------------------------
// Synthetic selector heuristics (engineering fixtures, not football claims)
// ---------------------------------------------------------------------------

const BASE_WEIGHT = 1000;
const MIN_WEIGHT = 100;
const PREFERRED_PERSONNEL_BONUS = 2000;
const SHORT_YARDAGE_TO_GO = 3;
const LONG_YARDAGE_TO_GO = 7;
const SITUATIONAL_BONUS = 1500;

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const isU32 = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 0xffffffff;

const cloneCanonical = (v: CanonicalValue): CanonicalValue =>
  JSON.parse(JSON.stringify(v)) as CanonicalValue;

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

const isNonNegInt = (n: unknown): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;

const validateSituation = (
  s: FootballSelectionSituation,
  rules: FootballRulesV1,
): void => {
  const counts: [string, unknown][] = [
    ['period', s.period],
    ['clockSecondsRemaining', s.clockSecondsRemaining],
    ['yardsToGo', s.yardsToGo],
    ['yardLine', s.yardLine],
    ['homeScore', s.homeScore],
    ['awayScore', s.awayScore],
    ['homeTimeoutsRemaining', s.homeTimeoutsRemaining],
    ['awayTimeoutsRemaining', s.awayTimeoutsRemaining],
  ];
  counts.forEach(([name, value]) => {
    if (!isNonNegInt(value))
      fail(`situation.${name} must be a non-negative integer`);
  });
  if (
    s.down < 1 ||
    s.down > rules.field.downsPerSeries ||
    !Number.isInteger(s.down)
  )
    fail('situation.down is outside the ruleset downs per series');
  if (s.yardLine > rules.field.fieldLengthYards)
    fail('situation.yardLine is outside the field');
  if (!Array.isArray(s.resolvedCalls))
    fail('situation.resolvedCalls must be an array');
  s.resolvedCalls.forEach((c, i) => {
    const off = rules.concepts.find(
      (x) => x.conceptKey === c.offenseConceptKey,
    );
    const def = rules.concepts.find(
      (x) => x.conceptKey === c.defenseConceptKey,
    );
    if (off === undefined || off.side !== 'offense')
      fail(`situation.resolvedCalls[${i}] has an unknown offensive concept`);
    if (def === undefined || def.side !== 'defense')
      fail(`situation.resolvedCalls[${i}] has an unknown defensive concept`);
  });
};

const countConcepts = (keys: readonly string[]): ObservedConceptCount[] => {
  const counts = new Map<string, number>();
  keys.forEach((k) => counts.set(k, (counts.get(k) ?? 0) + 1));
  return [...counts.entries()]
    .map(([conceptKey, count]) => ({ conceptKey, count }))
    .sort((a, b) => byText(a.conceptKey, b.conceptKey));
};

const orderParticipants = (
  a: SelectionParticipant,
  b: SelectionParticipant,
): number => a.depthOrder - b.depthOrder || byText(a.playerId, b.playerId);

/** Greedy, deterministic slot fill from the designated players; `null` when a slot is empty. */
const fillLineup = (
  formation: SelectionFormation,
  participants: readonly SelectionParticipant[],
): LineupSlot[] | null => {
  const used = new Set<string>();
  const lineup: LineupSlot[] = [];
  for (let i = 0; i < formation.slots.length; i++) {
    const slot = formation.slots[i]!;
    const pick = firstUnusedEligible(slot.eligibleRoles, participants, used);
    if (pick === undefined) return null;
    used.add(pick.playerId);
    lineup.push({ slotKey: slot.slotKey, playerId: pick.playerId });
  }
  return lineup;
};

// A helper rather than an inline closure inside the loop: Hermes mis-binds closure-captured
// loop variables, and selection must give identical answers on Node and Hermes.
const firstUnusedEligible = (
  eligibleRoles: readonly string[],
  participants: readonly SelectionParticipant[],
  used: ReadonlySet<string>,
): SelectionParticipant | undefined =>
  participants
    .filter((p) => !used.has(p.playerId) && eligibleRoles.includes(p.roleKey))
    .sort(orderParticipants)[0];

const buildSideView = (
  world: { readonly football: FootballState },
  ruleset: Pick<LeagueRulesetManifest, 'rulesetId' | 'rules'>,
  fixtureId: string,
  situation: FootballSelectionSituation,
  side: SelectionSide | 'kicking' | 'returning',
  playCategory: SpecialTeamsCategory | null = null,
) => {
  const rules = requireFootballRules(ruleset);
  const fixture = world.football.fixtures.find((f) => f.id === fixtureId);
  if (fixture === undefined) return fail(`unknown fixture "${fixtureId}"`);
  if (fixture.status !== 'scheduled')
    return fail(`fixture "${fixtureId}" is already final`);
  validateSituation(situation, rules);

  const { homeOrganizationId: home, awayOrganizationId: away } = fixture;
  if (
    situation.possessionOrganizationId !== home &&
    situation.possessionOrganizationId !== away
  )
    return fail('possession organization does not play in this fixture');
  const offenseOrg = situation.possessionOrganizationId;
  const defenseOrg = offenseOrg === home ? away : home;
  // The organization with the ball (the possessor, or the kicker) fields the offense or
  // the kicking unit; the other organization fields the defense or the returning unit.
  const organizationId =
    side === 'offense' || side === 'kicking' ? offenseOrg : defenseOrg;

  const plans = world.football.gamePlans.filter(
    (p) => p.fixtureId === fixtureId && p.organizationId === organizationId,
  );
  if (plans.length !== 1)
    return fail(
      `organization needs exactly one committed game plan for "${fixtureId}"`,
    );
  const plan: GamePlanExecutionSnapshot = plans[0]!;

  const participants: SelectionParticipant[] = world.football.designations
    .filter(
      (d) =>
        d.fixtureId === fixtureId &&
        d.organizationId === organizationId &&
        d.status === 'active' &&
        d.unitKey === side &&
        d.roleKey !== null &&
        d.depthOrder !== null,
    )
    .map((d) => ({
      playerId: d.playerId,
      roleKey: d.roleKey!,
      depthOrder: d.depthOrder!,
    }))
    .sort(orderParticipants);

  const formations: SelectionFormation[] = rules.formations
    .filter((f: FootballFormationRule) => f.side === side)
    .map((f) => ({
      formationKey: f.formationKey,
      personnelKey: f.personnelKey,
      slots: f.slots.map((s) => ({
        slotKey: s.slotKey,
        eligibleRoles: [...s.eligibleRoles],
      })),
    }))
    .filter((f) => fillLineup(f, participants) !== null)
    .sort((a, b) => byText(a.formationKey, b.formationKey));
  const fieldable = new Set(formations.map((f) => f.formationKey));

  const concepts: SelectionConcept[] = rules.concepts
    .filter(
      (c) =>
        c.side === side &&
        (playCategory === null || c.playCategory === playCategory) &&
        plan.conceptKeys.includes(c.conceptKey),
    )
    .map((c) => ({
      conceptKey: c.conceptKey,
      playCategory: c.playCategory,
      formationKeys: c.formationKeys
        .filter((k) => fieldable.has(k))
        .sort(byText),
    }))
    .filter((c) => c.formationKeys.length > 0)
    .sort((a, b) => byText(a.conceptKey, b.conceptKey));

  const ownScore =
    organizationId === home ? situation.homeScore : situation.awayScore;
  const otherScore =
    organizationId === home ? situation.awayScore : situation.homeScore;
  const view: SelectionViewBase = {
    fixtureId: fixture.id,
    organizationId,
    situation: {
      period: situation.period,
      clockSecondsRemaining: situation.clockSecondsRemaining,
      down: situation.down,
      yardsToGo: situation.yardsToGo,
      offenseYardLine: situation.yardLine,
      scoreDifferential: ownScore - otherScore,
      timeoutsRemaining:
        organizationId === home
          ? situation.homeTimeoutsRemaining
          : situation.awayTimeoutsRemaining,
    },
    gamePlan: {
      gamePlanId: plan.id,
      schemeKey: plan.schemeKey,
      conceptKeys: [...plan.conceptKeys].sort(byText),
      personnelPreferenceKeys: [...plan.personnelPreferenceKeys].sort(byText),
      constraints: cloneCanonical(plan.constraints) as {
        readonly [key: string]: CanonicalValue;
      },
    },
    participants,
    formations,
    concepts,
    tacticalEdges: rules.matchupEdges
      .filter((e) => {
        if (side === 'kicking' || side === 'returning') return false;
        const own =
          side === 'offense' ? e.offenseConceptKey : e.defenseConceptKey;
        return concepts.some((c) => c.conceptKey === own);
      })
      .map((e) => ({ ...e }))
      .sort(
        (a, b) =>
          byText(a.offenseConceptKey, b.offenseConceptKey) ||
          byText(a.defenseConceptKey, b.defenseConceptKey),
      ),
  };
  return { view, resolvedCalls: situation.resolvedCalls };
};

export const buildOffensiveSelectionView = (
  world: { readonly football: FootballState },
  ruleset: Pick<LeagueRulesetManifest, 'rulesetId' | 'rules'>,
  fixtureId: string,
  gameState: FootballSelectionSituation,
): OffensiveSelectionView => {
  const { view, resolvedCalls } = buildSideView(
    world,
    ruleset,
    fixtureId,
    gameState,
    'offense',
  );
  return {
    side: 'offense',
    ...view,
    observedDefensiveConcepts: countConcepts(
      resolvedCalls.map((c) => c.defenseConceptKey),
    ),
  };
};

export const buildDefensiveSelectionView = (
  world: { readonly football: FootballState },
  ruleset: Pick<LeagueRulesetManifest, 'rulesetId' | 'rules'>,
  fixtureId: string,
  gameState: FootballSelectionSituation,
): DefensiveSelectionView => {
  const { view, resolvedCalls } = buildSideView(
    world,
    ruleset,
    fixtureId,
    gameState,
    'defense',
  );
  return {
    side: 'defense',
    ...view,
    observedOffensiveConcepts: countConcepts(
      resolvedCalls.map((c) => c.offenseConceptKey),
    ),
  };
};

/**
 * The kicking unit's view. The organization with the ball (`possessionOrganizationId`,
 * which is the kicker for a kickoff) kicks; its plan must list a kicking concept for the
 * play category, and its designated `kicking` unit must be able to field the formation.
 */
export const buildKickingSelectionView = (
  world: { readonly football: FootballState },
  ruleset: Pick<LeagueRulesetManifest, 'rulesetId' | 'rules'>,
  fixtureId: string,
  gameState: FootballSelectionSituation,
  playCategory: SpecialTeamsCategory,
): KickingSelectionView => {
  const { view } = buildSideView(
    world,
    ruleset,
    fixtureId,
    gameState,
    'kicking',
    playCategory,
  );
  return { side: 'kicking', playCategory, ...view };
};

/** The receiving (or blocking) unit's view; the other organization from the kicker. */
export const buildReturningSelectionView = (
  world: { readonly football: FootballState },
  ruleset: Pick<LeagueRulesetManifest, 'rulesetId' | 'rules'>,
  fixtureId: string,
  gameState: FootballSelectionSituation,
  playCategory: SpecialTeamsCategory,
): ReturningSelectionView => {
  const { view } = buildSideView(
    world,
    ruleset,
    fixtureId,
    gameState,
    'returning',
    playCategory,
  );
  return { side: 'returning', playCategory, ...view };
};

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

const edgeBp = (
  edges: readonly FootballMatchupEdge[],
  offense: string,
  defense: string,
): number =>
  edges.find(
    (e) => e.offenseConceptKey === offense && e.defenseConceptKey === defense,
  )?.edgeBp ?? 0;

/** Weighted pick: `roll % total` walks the items in their canonical order. */
const weightedPick = <T>(
  items: readonly { readonly item: T; readonly weight: number }[],
  roll: number,
): T => {
  const total = items.reduce((n, i) => n + i.weight, 0);
  let target = roll % total;
  for (const { item, weight } of items) {
    if (target < weight) return item;
    target -= weight;
  }
  return items[items.length - 1]!.item;
};

const validateRolls = (rolls: SelectorRolls): void => {
  if (!isU32(rolls?.conceptRoll) || !isU32(rolls?.formationRoll))
    fail('selector rolls must be unsigned 32-bit integers');
};

type AnySelectionView =
  | OffensiveSelectionView
  | DefensiveSelectionView
  | KickingSelectionView
  | ReturningSelectionView;

const conceptWeights = (
  view: AnySelectionView,
): { item: SelectionConcept; weight: number }[] => {
  // Special-teams units choose among their listed concepts with no situational lean.
  if (view.side === 'kicking' || view.side === 'returning')
    return [...view.concepts]
      .sort((a, b) => byText(a.conceptKey, b.conceptKey))
      .map((concept) => ({ item: concept, weight: BASE_WEIGHT }));
  const s = view.situation;
  const observed =
    view.side === 'offense'
      ? view.observedDefensiveConcepts
      : view.observedOffensiveConcepts;
  const observedTotal = observed.reduce((n, o) => n + o.count, 0);
  // Re-sorted here so a deserialized or hand-built view picks identically to a built one.
  return [...view.concepts]
    .sort((a, b) => byText(a.conceptKey, b.conceptKey))
    .map((concept) => {
      let situational = 0;
      if (view.side === 'offense') {
        if (
          concept.playCategory === 'pass' &&
          s.yardsToGo >= LONG_YARDAGE_TO_GO
        )
          situational += SITUATIONAL_BONUS;
        if (
          concept.playCategory === 'run' &&
          s.yardsToGo <= SHORT_YARDAGE_TO_GO
        )
          situational += SITUATIONAL_BONUS;
      }
      // Lean toward concepts whose ruleset edge is favorable against what the opponent has
      // already shown. Offense edges are the offense's gain; the defense wants the opposite.
      let tendency = 0;
      if (observedTotal > 0) {
        const sum = observed.reduce(
          (n, o) =>
            n +
            o.count *
              (view.side === 'offense'
                ? edgeBp(view.tacticalEdges, concept.conceptKey, o.conceptKey)
                : -edgeBp(
                    view.tacticalEdges,
                    o.conceptKey,
                    concept.conceptKey,
                  )),
          0,
        );
        tendency = Math.floor(sum / observedTotal);
      }
      return {
        item: concept,
        weight: Math.max(MIN_WEIGHT, BASE_WEIGHT + situational + tendency),
      };
    });
};

const selectCall = (
  view: AnySelectionView,
  rolls: SelectorRolls,
): CommittedCallBase => {
  validateRolls(rolls);
  if (view.concepts.length === 0)
    return fail(
      'no concept in the game plan can be fielded by the designated players',
    );
  const concept = weightedPick(conceptWeights(view), rolls.conceptRoll);
  const candidates = [...view.formations]
    .sort((a, b) => byText(a.formationKey, b.formationKey))
    .filter((f) => concept.formationKeys.includes(f.formationKey))
    .map((f) => ({
      item: f,
      weight:
        BASE_WEIGHT +
        (view.gamePlan.personnelPreferenceKeys.includes(f.personnelKey)
          ? PREFERRED_PERSONNEL_BONUS
          : 0),
    }));
  const formation = weightedPick(candidates, rolls.formationRoll);
  const lineup = fillLineup(formation, view.participants);
  if (lineup === null)
    return fail('designated players cannot fill the selected formation');
  return {
    fixtureId: view.fixtureId,
    organizationId: view.organizationId,
    conceptKey: concept.conceptKey,
    formationKey: formation.formationKey,
    personnelKey: formation.personnelKey,
    playCategory: concept.playCategory,
    lineup,
  };
};

export const selectOffensiveCall = (
  view: OffensiveSelectionView,
  selectorRolls: SelectorRolls,
): CommittedOffensiveCall => {
  if (view.side !== 'offense')
    fail('an offensive call needs an offensive selection view');
  return { side: 'offense', ...selectCall(view, selectorRolls) };
};

export const selectDefensiveCall = (
  view: DefensiveSelectionView,
  selectorRolls: SelectorRolls,
): CommittedDefensiveCall => {
  if (view.side !== 'defense')
    fail('a defensive call needs a defensive selection view');
  return { side: 'defense', ...selectCall(view, selectorRolls) };
};

export const selectKickingCall = (
  view: KickingSelectionView,
  selectorRolls: SelectorRolls,
): CommittedKickingCall => {
  if (view.side !== 'kicking')
    fail('a kicking call needs a kicking selection view');
  return { side: 'kicking', ...selectCall(view, selectorRolls) };
};

export const selectReturningCall = (
  view: ReturningSelectionView,
  selectorRolls: SelectorRolls,
): CommittedReturningCall => {
  if (view.side !== 'returning')
    fail('a returning call needs a returning selection view');
  return { side: 'returning', ...selectCall(view, selectorRolls) };
};
