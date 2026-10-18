import type { CanonicalValue } from './audit';
import {
  FootballUsageError,
  footballWorkloadUnits,
} from './developmentFootballUsage';
import type { FootballState, GameState } from './football';
import {
  FootballActionError,
  deriveFootballActionInputFromRules,
  type FootballActionInput,
} from './footballActions';
import {
  MissingFootballRulesError,
  requireFootballRules,
  type FootballConceptRule,
  type FootballRulesV1,
  type PlayCategory,
} from './footballRules';
import {
  FootballSelectionError,
  buildDefensiveSelectionView,
  buildKickingSelectionView,
  buildOffensiveSelectionView,
  buildReturningSelectionView,
  selectDefensiveCall,
  selectKickingCall,
  selectOffensiveCall,
  selectReturningCall,
  type LineupSlot,
  type SpecialTeamsCategory,
} from './footballSelection';
import {
  GameStateError,
  accumulateWorkload,
  applyExtraPointResult,
  applyFieldGoalResult,
  applyKickoffResult,
  applyPenaltyResult,
  applyPuntResult,
  applyScrimmageResult,
  designationProblems,
  fieldGoalKickDistance,
  fourthDownChoice,
  isEligibleReceiverRole,
  lineupProblems,
  scrimmageEnd,
  type GameEvent,
  type GameOrganizations,
  type GameTransition,
  type PenaltyFact,
} from './gameState';
import { hashCanonical } from './hash';
import type { EntityId, RecordId } from './ids';
import type { DeterministicRng } from './rng';
import type { LeagueRulesetManifest } from './ruleset';
import { currentRosterMembership } from './roster';
import type { FootballWorld } from './world';

/**
 * THE one authoritative football play resolver (design basis sections 8, 9 and 14).
 *
 * `resolvePlay` is pure: it reads a validated input, consumes the supplied deterministic
 * RNG in one canonical, named order, and returns facts plus the next game state. It never
 * mutates the world, never draws from `Math.random` or the clock, and consumes zero
 * randomness for anything but football resolution. Everything is integer / basis-point math.
 *
 * ONE resolver runs every represented snap: scrimmage runs and passes, punts and field
 * goals (taken on the ruleset's fourth-down situation rule), extra points and kickoffs. The
 * kicking and returning units choose their calls from their own selection views exactly as
 * the offense and defense do. There is no second special-teams simulator.
 *
 * Both sides select their calls from separate selection views first. Only AFTER both calls
 * are committed (and their lineups proved legal) does the resolver read latent player truth
 * (capabilities, learned familiarity, functional readiness) for the lineup participants and
 * only through `deriveFootballActionInputFromRules`. Derived margins are ephemeral: they
 * live in the private trace and are never written to a persistent field.
 *
 * Down, distance, possession, score, penalty enforcement, clock and period come from the
 * pure transition layer in `gameState.ts`; this file reports resolved FACTS to it and
 * returns the state it produces.
 */

/** Every draw family, in the only order a play may consume them. */
export const PLAY_DRAW_SCHEDULE = [
  'offense_selection',
  'defense_selection',
  'recognition',
  'execution',
  'interaction',
  'sack',
  'sack_loss',
  'target',
  'defender',
  'interception',
  'completion',
  'fumble',
  'result',
  'tackler',
  'kick_distance',
  'kick_result',
  'return_yards',
  'penalty',
  'penalty_kind',
  'clock',
] as const;
export type PlayDrawFamily = (typeof PLAY_DRAW_SCHEDULE)[number];

/**
 * Football injury / exposure evaluation draws one roll per participant, in canonical
 * participant order, AFTER `resolvePlay` returns. The complete-game composition (Task 10)
 * owns those draws; they are named here so the contract is complete.
 */
export const FOOTBALL_INJURY_DRAW_FAMILY = 'injury_exposure' as const;

export type PlayResultKind =
  | 'rush'
  | 'completion'
  | 'incompletion'
  | 'sack'
  | 'interception'
  | 'fumble_lost'
  | 'kickoff'
  | 'punt'
  | 'field_goal_good'
  | 'field_goal_missed'
  | 'extra_point_good'
  | 'extra_point_missed';

export interface PlayStateInput {
  readonly ruleset: Pick<LeagueRulesetManifest, 'rulesetId' | 'rules'>;
  /** The Package E collections: fixtures, committed designations and frozen game plans. */
  readonly football: FootballState;
  /** Read only AFTER both calls are committed; never reaches either selection view. */
  readonly latent: Pick<FootballWorld, 'roster' | 'development' | 'medical'>;
  readonly gameState: GameState;
}

export interface PlayParticipationFact {
  readonly organizationId: EntityId;
  readonly side: 'offense' | 'defense' | 'kicking' | 'returning';
  readonly slotKey: string;
  readonly playerId: EntityId;
  readonly contactClass: string;
  readonly workloadUnits: number;
  readonly actionExposures: readonly {
    readonly actionKey: string;
    readonly attempts: number;
  }[];
  readonly responsibilityExposures: readonly {
    readonly schemeKey: string;
    readonly responsibilityKey: string;
    readonly meaningfulReps: number;
  }[];
}

/** The foul drawn on a scrimmage play (accepted or declined is `penaltyAccepted`). */
export type PlayPenaltyFact = PenaltyFact;

export interface PlayCallFact {
  readonly conceptKey: string;
  readonly formationKey: string;
  readonly personnelKey: string;
  readonly lineup: readonly LineupSlot[];
}

export interface PlayPrincipals {
  readonly passerPlayerId: EntityId | null;
  readonly ballCarrierPlayerId: EntityId | null;
  readonly targetPlayerId: EntityId | null;
  readonly defenderPlayerId: EntityId | null;
  readonly tacklerPlayerId: EntityId | null;
  readonly pressurePlayerId: EntityId | null;
  readonly kickerPlayerId: EntityId | null;
  readonly returnerPlayerId: EntityId | null;
}

/** What a kicked ball did. Absent (`null`) on scrimmage plays. */
export interface PlayKickFact {
  /** Yards of flight for kickoffs and punts; the attempt distance for kicks at goal. */
  readonly kickYards: number;
  /** Kicking-team coordinates where a kickoff / punt first came down (`null` for goals). */
  readonly landingYardLine: number | null;
  readonly touchback: boolean;
  readonly returnYards: number;
  /** Whether a kick at goal was good (`null` for kickoffs and punts). */
  readonly good: boolean | null;
}

export interface ResolvedPlayDraft {
  readonly fixtureId: RecordId;
  /** 1-based position of this play in its game. */
  readonly sequence: number;
  /** The organization with the ball (or doing the kicking) on this snap. */
  readonly offenseOrganizationId: EntityId;
  readonly defenseOrganizationId: EntityId;
  readonly pre: {
    readonly period: number;
    readonly clockSecondsRemaining: number;
    readonly down: number;
    readonly yardsToGo: number;
    readonly yardLine: number;
    readonly homeScore: number;
    readonly awayScore: number;
  };
  /** The offense, or the kicking unit on a special-teams snap. */
  readonly offense: PlayCallFact;
  /** The defense, or the returning / blocking unit on a special-teams snap. */
  readonly defense: PlayCallFact;
  readonly playCategory: PlayCategory;
  readonly resultKind: PlayResultKind;
  /** Signed raw gain of a scrimmage play (0 for kicks), bounded by field geometry. */
  readonly yardsGained: number;
  readonly turnover: 'interception' | 'fumble' | null;
  /** A touchdown was scored on this play by either side (it counts only if `playStands`). */
  readonly touchdown: boolean;
  readonly safety: boolean;
  readonly kick: PlayKickFact | null;
  readonly penalty: PlayPenaltyFact | null;
  /** `null` when no foul was drawn. */
  readonly penaltyAccepted: boolean | null;
  /** False when an accepted foul erased this snap's result. */
  readonly playStands: boolean;
  readonly clockSecondsUsed: number;
  readonly principals: PlayPrincipals;
  readonly participation: readonly PlayParticipationFact[];
  readonly rngDrawStart: number;
  readonly rngDrawCount: number;
  /** SHA-256 over the private trace: proof the trace existed without exposing it. */
  readonly traceHash: string;
}

export interface PlayDrawRecord {
  readonly family: PlayDrawFamily;
  /** Exclusive upper bound; `2^32` marks a raw `nextU32` selection roll. */
  readonly bound: number;
  readonly value: number;
  /** 32-bit words consumed (more than 1 only when rejection sampling retried). */
  readonly words: number;
}

/** Debug / test only. Never persisted, never organization-facing. */
export interface PlayPrivateTrace {
  readonly draws: readonly PlayDrawRecord[];
  readonly margins: { readonly [key: string]: number };
  readonly executions: readonly {
    readonly side: 'offense' | 'defense' | 'kicking' | 'returning';
    readonly slotKey: string;
    readonly playerId: EntityId;
    readonly actionKey: string;
    readonly responsibilityKey: string;
    readonly executionBp: number;
    readonly functionalReadinessBp: number;
    readonly familiarityBp: number;
    readonly attempted: boolean;
  }[];
}

export interface ResolvedPlay {
  readonly resolved: ResolvedPlayDraft;
  readonly nextGameState: GameState;
  /** The public events the transition produced, in order. */
  readonly events: readonly GameEvent[];
  readonly rng: DeterministicRng;
  readonly privateTrace: PlayPrivateTrace;
}

export class FootballPlayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FootballPlayError';
  }
}

const fail = (message: string): never => {
  throw new FootballPlayError(message);
};

// ---------------------------------------------------------------------------
// Input validation (everything here finishes before the first draw)
// ---------------------------------------------------------------------------

const INPUT_KEYS = ['football', 'gameState', 'latent', 'ruleset'] as const;
const LATENT_KEYS = ['development', 'medical', 'roster'] as const;
const GAME_STATE_KEYS = [
  'awayScore',
  'awayTimeoutsRemaining',
  'clockSecondsRemaining',
  'down',
  'driveCount',
  'drivePlays',
  'fixtureId',
  'homeScore',
  'homeTimeoutsRemaining',
  'kickoffKind',
  'nextSnap',
  'openingReceiverOrganizationId',
  'period',
  'playsResolved',
  'possessionOrganizationId',
  'resolvedCalls',
  'status',
  'workloadByPlayer',
  'yardLine',
  'yardsToGo',
] as const;

const exactKeys = (
  value: unknown,
  keys: readonly string[],
  path: string,
): void => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return fail(`${path} must be an object`);
  const actual = Object.keys(value).sort();
  const extra = actual.filter((k) => !keys.includes(k));
  if (extra.length > 0)
    fail(
      `${path} has fields the resolver does not accept: ${extra.join(', ')}`,
    );
  const missing = keys.filter((k) => !actual.includes(k));
  if (missing.length > 0) fail(`${path} is missing: ${missing.join(', ')}`);
};

/** Contact classes the resolver tags exposure with; the ruleset must declare all of them. */
const CONTACT_ORDER = ['none', 'incidental', 'engaged', 'tackle'] as const;

const ACTION_CONTACT: { readonly [actionKey: string]: string } = {
  run_block: 'engaged',
  pass_protect: 'engaged',
  rush_passer: 'engaged',
  defend_run: 'engaged',
  tackle_ball_carrier: 'engaged',
  carry_ball: 'incidental',
  cover_receiver: 'incidental',
  run_route: 'incidental',
  catch_ball: 'incidental',
};

const contactRank = (c: string): number =>
  CONTACT_ORDER.indexOf(c as (typeof CONTACT_ORDER)[number]);

const NEXT_SNAPS = ['scrimmage', 'extra_point', 'kickoff'] as const;

const validateInput = (input: PlayStateInput): FootballRulesV1 => {
  exactKeys(input, INPUT_KEYS, 'play input');
  exactKeys(input.latent, LATENT_KEYS, 'play input latent');
  exactKeys(input.gameState, GAME_STATE_KEYS, 'play input gameState');
  const rules = requireFootballRules(input.ruleset);
  const g = input.gameState;
  if (!(NEXT_SNAPS as readonly string[]).includes(g.nextSnap))
    fail(`gameState.nextSnap "${String(g.nextSnap)}" is not a snap`);
  if (g.status !== 'in_progress') fail('the game is not in progress');
  if ((g.nextSnap === 'kickoff') !== (g.kickoffKind !== null))
    fail('gameState.kickoffKind must be set exactly for a kickoff snap');
  (['playsResolved', 'driveCount', 'drivePlays'] as const).forEach((k) => {
    if (!Number.isSafeInteger(g[k]) || g[k] < 0)
      fail(`gameState.${k} must be a non-negative integer`);
  });
  if (!Number.isSafeInteger(g.period) || g.period < 1)
    fail('gameState.period must be a positive integer');
  if (!Array.isArray(g.workloadByPlayer))
    fail('gameState.workloadByPlayer must be an array');
  if (
    rules.ordering.selectionOrder[0] !== 'offense' ||
    rules.ordering.selectionOrder[1] !== 'defense'
  )
    fail('the play resolver requires offense-then-defense selection order');
  CONTACT_ORDER.forEach((c) => {
    if (!rules.injury.contactClasses.includes(c))
      fail(`the ruleset must declare contact class "${c}"`);
  });
  if (
    rules.penalties.some(
      (p) => p.against !== 'offense' && p.against !== 'defense',
    )
  )
    fail('special-teams penalties are not represented by this resolver');
  if (rules.outcome.penaltyChanceBp > 0 && rules.penalties.length === 0)
    fail('the ruleset has no scrimmage penalty to draw');
  return rules;
};

const hasAction = (concept: FootballConceptRule, actionKey: string): boolean =>
  concept.assignments.some((a) => a.actionKey === actionKey);

const KICK_ACTIONS = ['kick_off', 'punt_ball', 'kick_field_goal'] as const;

const validateConcept = (concept: FootballConceptRule): void => {
  if (concept.side === 'offense') {
    if (concept.playCategory === 'run') {
      if (!hasAction(concept, 'carry_ball'))
        fail(`run concept "${concept.conceptKey}" has no ball carrier`);
    } else if (concept.playCategory === 'pass') {
      if (!hasAction(concept, 'throw_pass'))
        fail(`pass concept "${concept.conceptKey}" has no passer`);
      if (!hasAction(concept, 'catch_ball') && !hasAction(concept, 'run_route'))
        fail(`pass concept "${concept.conceptKey}" has no receiver`);
    } else
      fail(
        `offensive concept "${concept.conceptKey}" is not a scrimmage play category`,
      );
  } else if (concept.side === 'kicking') {
    if (!KICK_ACTIONS.some((a) => hasAction(concept, a)))
      fail(`kicking concept "${concept.conceptKey}" has no kicker`);
  }
};

// ---------------------------------------------------------------------------
// Integer helpers
// ---------------------------------------------------------------------------

const clamp = (n: number, lo: number, hi: number): number =>
  n < lo ? lo : n > hi ? hi : n;

/**
 * A baseline probability moved by a margin. A margin equal to `marginScaleBp` moves the
 * probability by the room the baseline has on its thinner side, so the shift is always
 * proportional to the baseline and the result always stays inside `0..10000`.
 */
const scaledProbabilityBp = (
  baselineBp: number,
  marginBp: number,
  marginScaleBp: number,
): number => {
  const room = Math.min(baselineBp, 10000 - baselineBp);
  return clamp(
    baselineBp + Math.floor((marginBp * room) / marginScaleBp),
    0,
    10000,
  );
};

const meanOf = (values: readonly number[]): number | null =>
  values.length === 0
    ? null
    : Math.floor(values.reduce((a, b) => a + b, 0) / values.length);

const blend = (parts: readonly (number | null)[]): number | null =>
  meanOf(parts.filter((p): p is number => p !== null));

/** Index into `weights` that a draw in `[0, sum)` lands on. */
const weightedIndex = (weights: readonly number[], roll: number): number => {
  let target = roll;
  for (let i = 0; i < weights.length; i++) {
    if (target < weights[i]!) return i;
    target -= weights[i]!;
  }
  return weights.length - 1;
};

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
// Slot execution
// ---------------------------------------------------------------------------

type UnitSide = 'offense' | 'defense' | 'kicking' | 'returning';

interface SlotExecution {
  readonly side: UnitSide;
  readonly slotKey: string;
  readonly playerId: EntityId;
  readonly actionKey: string;
  readonly responsibilityKey: string;
  readonly schemeKey: string;
  readonly input: FootballActionInput;
  readonly executionBp: number;
  readonly attempted: boolean;
}

const slotPlayer = (lineup: readonly LineupSlot[], slotKey: string): EntityId =>
  lineup.find((s) => s.slotKey === slotKey)!.playerId;

const deriveSide = (
  side: UnitSide,
  concept: FootballConceptRule,
  lineup: readonly LineupSlot[],
  rules: FootballRulesV1,
  latent: PlayStateInput['latent'],
): SlotExecution[] => {
  const out: SlotExecution[] = [];
  concept.assignments.forEach((assignment) => {
    assignment.slotKeys.forEach((slotKey) => {
      const playerId = slotPlayer(lineup, slotKey);
      const derived = deriveFootballActionInputFromRules(
        latent,
        rules,
        playerId,
        assignment.actionKey,
        concept.schemeKey,
        assignment.responsibilityKey,
      );
      out.push({
        side,
        slotKey,
        playerId,
        actionKey: assignment.actionKey,
        responsibilityKey: assignment.responsibilityKey,
        schemeKey: concept.schemeKey,
        input: derived,
        executionBp: derived.canAttempt ? derived.executionBp : 0,
        attempted: derived.canAttempt,
      });
    });
  });
  return out;
};

const ofAction = (
  execs: readonly SlotExecution[],
  ...actionKeys: string[]
): SlotExecution[] => execs.filter((e) => actionKeys.includes(e.actionKey));

const notAction = (
  execs: readonly SlotExecution[],
  ...actionKeys: string[]
): SlotExecution[] => execs.filter((e) => !actionKeys.includes(e.actionKey));

const groupMean = (execs: readonly SlotExecution[], ...keys: string[]) =>
  meanOf(ofAction(execs, ...keys).map((e) => e.executionBp));

const allMean = (execs: readonly SlotExecution[]): number =>
  meanOf(execs.map((e) => e.executionBp)) ?? 0;

/** One slot per player, keeping the best execution among that slot's actions. */
const bestPerSlot = (execs: readonly SlotExecution[]): SlotExecution[] => {
  const best = new Map<string, SlotExecution>();
  execs.forEach((e) => {
    const held = best.get(e.slotKey);
    if (held === undefined || e.executionBp > held.executionBp)
      best.set(e.slotKey, e);
  });
  return [...best.values()];
};

// ---------------------------------------------------------------------------
// Shared resolution context
// ---------------------------------------------------------------------------

interface Context {
  readonly input: PlayStateInput;
  readonly rng: DeterministicRng;
  readonly rules: FootballRulesV1;
  readonly state: GameState;
  readonly orgs: GameOrganizations;
  readonly draws: PlayDrawRecord[];
  readonly drawStart: number;
  readonly drawInt: (family: PlayDrawFamily, bound: number) => number;
  readonly drawSelectionRoll: (family: PlayDrawFamily) => number;
  readonly drawNoise: (family: PlayDrawFamily) => number;
}

interface CallPair {
  readonly offenseCall: PlayCallFact & { readonly organizationId: EntityId };
  readonly defenseCall: PlayCallFact & { readonly organizationId: EntityId };
  readonly offenseConcept: FootballConceptRule;
  readonly defenseConcept: FootballConceptRule;
  readonly offenseSide: UnitSide;
  readonly defenseSide: UnitSide;
}

/** What a snap produced before the transition layer turns it into the next state. */
interface SnapOutcome {
  readonly category: PlayCategory;
  readonly resultKind: PlayResultKind;
  readonly yardsGained: number;
  readonly turnover: 'interception' | 'fumble' | null;
  readonly kick: PlayKickFact | null;
  readonly penalty: PenaltyFact | null;
  readonly clockSecondsUsed: number;
  readonly principals: PlayPrincipals;
  readonly tackled: ReadonlySet<string>;
  readonly margins: { readonly [key: string]: number };
  readonly transition: (extra: {
    readonly offenseConceptKey: string;
    readonly defenseConceptKey: string;
  }) => {
    readonly transition: GameTransition;
    readonly penaltyAccepted: boolean | null;
    readonly playStands: boolean;
  };
}

const emptyPrincipals: PlayPrincipals = {
  passerPlayerId: null,
  ballCarrierPlayerId: null,
  targetPlayerId: null,
  defenderPlayerId: null,
  tacklerPlayerId: null,
  pressurePlayerId: null,
  kickerPlayerId: null,
  returnerPlayerId: null,
};

export const resolvePlay = (
  input: PlayStateInput,
  rng: DeterministicRng,
): ResolvedPlay => {
  const start = rng.snapshot();
  try {
    return resolveInternal(input, rng, start.draws);
  } catch (error) {
    // Whatever failed, the supplied generator is exactly as it was handed in.
    rng.restore(start);
    if (
      error instanceof FootballPlayError ||
      !(
        error instanceof FootballSelectionError ||
        error instanceof FootballActionError ||
        error instanceof FootballUsageError ||
        error instanceof MissingFootballRulesError ||
        error instanceof GameStateError
      )
    )
      throw error;
    throw new FootballPlayError(error.message);
  }
};

// ---------------------------------------------------------------------------
// Snap decision and call selection
// ---------------------------------------------------------------------------

type Snap =
  | { readonly kind: 'scrimmage' }
  | { readonly kind: 'special'; readonly category: SpecialTeamsCategory };

/** The returning / blocking unit of a kick at goal is the field-goal block concept. */
const returningCategory = (
  category: SpecialTeamsCategory,
): SpecialTeamsCategory =>
  category === 'extra_point' ? 'field_goal' : category;

const decideSnap = (ctx: Context): Snap => {
  const s = ctx.state;
  if (s.nextSnap === 'kickoff') return { kind: 'special', category: 'kickoff' };
  if (s.nextSnap === 'extra_point')
    return { kind: 'special', category: 'extra_point' };
  const choice = fourthDownChoice(ctx.rules, s);
  if (choice === 'go') return { kind: 'scrimmage' };
  const category: SpecialTeamsCategory =
    choice === 'punt' ? 'punt' : 'field_goal';
  const world = { football: ctx.input.football };
  const kicking = buildKickingSelectionView(
    world,
    ctx.input.ruleset,
    s.fixtureId,
    s,
    category,
  );
  const returning = buildReturningSelectionView(
    world,
    ctx.input.ruleset,
    s.fixtureId,
    s,
    returningCategory(category),
  );
  // A side with no fieldable kick (or block) unit goes for it instead of forfeiting the down.
  return kicking.concepts.length > 0 && returning.concepts.length > 0
    ? { kind: 'special', category }
    : { kind: 'scrimmage' };
};

const conceptOf = (rules: FootballRulesV1, key: string): FootballConceptRule =>
  rules.concepts.find((c) => c.conceptKey === key)!;

const assertLegal = (
  ctx: Context,
  call: PlayCallFact & { readonly organizationId: EntityId },
  unitKey: UnitSide,
): void => {
  const problems = lineupProblems({
    rules: ctx.rules,
    fixtureId: ctx.state.fixtureId,
    organizationId: call.organizationId,
    unitKey,
    formationKey: call.formationKey,
    lineup: call.lineup,
    designations: ctx.input.football.designations,
  });
  if (problems.length > 0) fail(`illegal ${unitKey} lineup: ${problems[0]}`);
};

const selectScrimmage = (ctx: Context): CallPair => {
  const world = { football: ctx.input.football };
  const { state, rules } = ctx;
  const offenseView = buildOffensiveSelectionView(
    world,
    ctx.input.ruleset,
    state.fixtureId,
    state,
  );
  const defenseView = buildDefensiveSelectionView(
    world,
    ctx.input.ruleset,
    state.fixtureId,
    state,
  );
  if (offenseView.concepts.length === 0)
    fail('no offensive concept in the game plan can be fielded');
  if (defenseView.concepts.length === 0)
    fail('no defensive concept in the game plan can be fielded');
  offenseView.concepts.forEach((c) =>
    validateConcept(conceptOf(rules, c.conceptKey)),
  );
  defenseView.concepts.forEach((c) =>
    validateConcept(conceptOf(rules, c.conceptKey)),
  );
  const offense = selectOffensiveCall(offenseView, {
    conceptRoll: ctx.drawSelectionRoll('offense_selection'),
    formationRoll: ctx.drawSelectionRoll('offense_selection'),
  });
  const defense = selectDefensiveCall(defenseView, {
    conceptRoll: ctx.drawSelectionRoll('defense_selection'),
    formationRoll: ctx.drawSelectionRoll('defense_selection'),
  });
  return {
    offenseCall: offense,
    defenseCall: defense,
    offenseConcept: conceptOf(rules, offense.conceptKey),
    defenseConcept: conceptOf(rules, defense.conceptKey),
    offenseSide: 'offense',
    defenseSide: 'defense',
  };
};

const selectSpecial = (
  ctx: Context,
  category: SpecialTeamsCategory,
): CallPair => {
  const world = { football: ctx.input.football };
  const { state, rules } = ctx;
  const kickingView = buildKickingSelectionView(
    world,
    ctx.input.ruleset,
    state.fixtureId,
    state,
    category,
  );
  const returningView = buildReturningSelectionView(
    world,
    ctx.input.ruleset,
    state.fixtureId,
    state,
    returningCategory(category),
  );
  if (kickingView.concepts.length === 0)
    fail(`no ${category} kicking concept can be fielded`);
  if (returningView.concepts.length === 0)
    fail(`no ${category} returning concept can be fielded`);
  kickingView.concepts.forEach((c) =>
    validateConcept(conceptOf(rules, c.conceptKey)),
  );
  const kicking = selectKickingCall(kickingView, {
    conceptRoll: ctx.drawSelectionRoll('offense_selection'),
    formationRoll: ctx.drawSelectionRoll('offense_selection'),
  });
  const returning = selectReturningCall(returningView, {
    conceptRoll: ctx.drawSelectionRoll('defense_selection'),
    formationRoll: ctx.drawSelectionRoll('defense_selection'),
  });
  return {
    offenseCall: kicking,
    defenseCall: returning,
    offenseConcept: conceptOf(rules, kicking.conceptKey),
    defenseConcept: conceptOf(rules, returning.conceptKey),
    offenseSide: 'kicking',
    defenseSide: 'returning',
  };
};

const roleOf = (
  ctx: Context,
  organizationId: EntityId,
  unit: UnitSide,
  playerId: EntityId,
): string =>
  ctx.input.football.designations.find(
    (d) =>
      d.fixtureId === ctx.state.fixtureId &&
      d.organizationId === organizationId &&
      d.unitKey === unit &&
      d.status === 'active' &&
      d.playerId === playerId,
  )?.roleKey ?? '';

// ---------------------------------------------------------------------------
// Scrimmage snaps (runs and passes)
// ---------------------------------------------------------------------------

interface SnapResult {
  readonly outcome: SnapOutcome;
  readonly execs: readonly SlotExecution[];
}

const scrimmage = (ctx: Context, pair: CallPair): SnapResult => {
  const { rules, state, orgs } = ctx;
  const outcome = rules.outcome;
  const offExecs = deriveSide(
    'offense',
    pair.offenseConcept,
    pair.offenseCall.lineup,
    rules,
    ctx.input.latent,
  );
  const defExecs = deriveSide(
    'defense',
    pair.defenseConcept,
    pair.defenseCall.lineup,
    rules,
    ctx.input.latent,
  );
  const pass = pair.offenseConcept.playCategory === 'pass';
  const offenseKey = pair.offenseCall.conceptKey;
  const defenseKey = pair.defenseCall.conceptKey;

  // ----- Phase 1: pre-snap recognition -----
  const edgeBp =
    rules.matchupEdges.find(
      (e) =>
        e.offenseConceptKey === offenseKey &&
        e.defenseConceptKey === defenseKey,
    )?.edgeBp ?? 0;
  const recognitionNoise = ctx.drawNoise('recognition');
  const tacticalBp = clamp(
    edgeBp + Math.floor(recognitionNoise / 3),
    -3000,
    3000,
  );

  // ----- Phase 2: assignment execution -----
  const offenseNoise = ctx.drawNoise('execution');
  const defenseNoise = ctx.drawNoise('execution');
  const noiseDiff = offenseNoise - defenseNoise;

  // ----- Phase 3: protection / run fit and pressure -----
  const interactionNoise = ctx.drawNoise('interaction');
  const offenseAll = allMean(offExecs);
  const defenseAll = allMean(defExecs);

  const runOffense =
    blend([
      groupMean(offExecs, 'carry_ball'),
      groupMean(offExecs, 'run_block'),
      groupMean(offExecs, 'run_route'),
    ]) ?? offenseAll;
  const runDefense =
    blend([
      groupMean(defExecs, 'defend_run'),
      groupMean(defExecs, 'tackle_ball_carrier'),
    ]) ?? defenseAll;
  const passOffense =
    blend([
      groupMean(offExecs, 'throw_pass'),
      groupMean(offExecs, 'read_progression'),
      groupMean(offExecs, 'run_route'),
      groupMean(offExecs, 'catch_ball'),
    ]) ?? offenseAll;
  const protectMean = groupMean(offExecs, 'pass_protect') ?? offenseAll;
  const rushMean = groupMean(defExecs, 'rush_passer') ?? defenseAll;
  const coverMean = groupMean(defExecs, 'cover_receiver') ?? defenseAll;
  const tackleMean =
    blend([
      groupMean(defExecs, 'tackle_ball_carrier'),
      groupMean(defExecs, 'defend_run'),
    ]) ?? defenseAll;

  const pressureMargin = rushMean - protectMean + interactionNoise;
  const runMargin =
    runOffense -
    runDefense +
    tacticalBp +
    noiseDiff +
    Math.floor(interactionNoise / 2);

  let resultKind: PlayResultKind;
  let turnover: 'interception' | 'fumble' | null = null;
  let yardsGained = 0;
  let targetSlot: SlotExecution | null = null;
  let coverSlot: SlotExecution | null = null;
  let tacklerSlot: SlotExecution | null = null;
  let pressureSlot: SlotExecution | null = null;
  let passMargin = 0;
  const lo = -state.yardLine;
  const hi = Math.min(
    outcome.maxPlayYards,
    rules.field.fieldLengthYards - state.yardLine,
  );
  const yardsFromTenths = (tenths: number, min: number): number =>
    clamp(Math.floor(tenths / 10), Math.max(lo, min), hi);

  const rushers = bestPerSlot(ofAction(defExecs, 'rush_passer'));
  const coverers = bestPerSlot(ofAction(defExecs, 'cover_receiver'));
  const catchers =
    ofAction(offExecs, 'catch_ball').length > 0
      ? ofAction(offExecs, 'catch_ball')
      : ofAction(offExecs, 'run_route');
  // Only roles the ruleset lists as eligible receivers can be targeted.
  const receivers = bestPerSlot(catchers).filter((e) =>
    isEligibleReceiverRole(
      rules,
      roleOf(ctx, pair.offenseCall.organizationId, 'offense', e.playerId),
    ),
  );

  if (pass) {
    if (receivers.length === 0)
      fail('no eligible receiver is lined up for the pass');
    const pSack = scaledProbabilityBp(
      outcome.baselineSackBp,
      pressureMargin,
      outcome.marginScaleBp,
    );
    const sackRoll = ctx.drawInt('sack', 10000);
    if (sackRoll < pSack) {
      // ----- Sack -----
      resultKind = 'sack';
      yardsGained = clamp(-(2 + ctx.drawInt('sack_loss', 7)), lo, 0);
      const pool = rushers.length > 0 ? rushers : bestPerSlot(defExecs);
      const weights = pool.map((e) => 1000 + e.executionBp);
      pressureSlot =
        pool[weightedIndex(weights, ctx.drawInt('defender', sum(weights)))]!;
    } else {
      // ----- Phase 4: progression and target -----
      const targetWeights = receivers.map((e) => 1000 + e.executionBp);
      targetSlot =
        receivers[
          weightedIndex(
            targetWeights,
            ctx.drawInt('target', sum(targetWeights)),
          )
        ]!;
      const coverIndex = ctx.drawInt('defender', Math.max(1, coverers.length));
      coverSlot = coverers.length > 0 ? coverers[coverIndex]! : null;

      // ----- Phase 5: coverage and contest / ball security -----
      const contest =
        targetSlot.executionBp - (coverSlot?.executionBp ?? coverMean);
      passMargin =
        passOffense -
        coverMean +
        tacticalBp +
        noiseDiff -
        Math.floor(Math.max(0, pressureMargin) / 2) +
        Math.floor(contest / 2);
      const pInterception = scaledProbabilityBp(
        outcome.baselineInterceptionBp,
        -passMargin,
        outcome.marginScaleBp,
      );
      if (ctx.drawInt('interception', 10000) < pInterception) {
        resultKind = 'interception';
        turnover = 'interception';
      } else {
        const pCompletion = scaledProbabilityBp(
          outcome.baselineCompletionBp,
          passMargin,
          outcome.marginScaleBp,
        );
        if (ctx.drawInt('completion', 10000) < pCompletion) {
          resultKind = 'completion';
          const pFumble = scaledProbabilityBp(
            outcome.baselineFumbleBp,
            tackleMean - targetSlot.executionBp,
            outcome.marginScaleBp,
          );
          const fumbled = ctx.drawInt('fumble', 10000) < pFumble;
          // ----- Phase 6: ball progression and result -----
          const resultNoise = ctx.drawNoise('result');
          yardsGained = yardsFromTenths(
            outcome.baselineCompletionYardsTenths +
              Math.floor(
                ((passMargin + resultNoise) * outcome.yardsPerMarginTenths) /
                  outcome.marginScaleBp,
              ),
            0,
          );
          if (fumbled) {
            resultKind = 'fumble_lost';
            turnover = 'fumble';
          }
        } else resultKind = 'incompletion';
      }
    }
  } else {
    // ----- Run -----
    const carrier = bestPerSlot(ofAction(offExecs, 'carry_ball'))[0]!;
    const pFumble = scaledProbabilityBp(
      outcome.baselineFumbleBp,
      tackleMean - carrier.executionBp,
      outcome.marginScaleBp,
    );
    const fumbled = ctx.drawInt('fumble', 10000) < pFumble;
    const resultNoise = ctx.drawNoise('result');
    yardsGained = yardsFromTenths(
      outcome.baselineRushYardsTenths +
        Math.floor(
          ((runMargin + resultNoise) * outcome.yardsPerMarginTenths) /
            outcome.marginScaleBp,
        ),
      lo,
    );
    resultKind = fumbled ? 'fumble_lost' : 'rush';
    if (fumbled) turnover = 'fumble';
  }

  // ----- Phase 7: contact and exposure (who made the tackle) -----
  if (resultKind === 'rush' || resultKind === 'completion') {
    const pool = (() => {
      const direct = bestPerSlot(
        ofAction(defExecs, 'tackle_ball_carrier', 'defend_run'),
      );
      if (direct.length > 0) return direct;
      const cover = bestPerSlot(ofAction(defExecs, 'cover_receiver'));
      if (cover.length > 0) return cover;
      return bestPerSlot(defExecs);
    })();
    const weights = pool.map((e) => 1000 + e.executionBp);
    tacklerSlot =
      pool[weightedIndex(weights, ctx.drawInt('tackler', sum(weights)))]!;
  }

  // ----- Phase 8: flags and administration -----
  let penalty: PenaltyFact | null = null;
  const penaltyRoll = ctx.drawInt('penalty', 10000);
  if (penaltyRoll < outcome.penaltyChanceBp) {
    const weights = rules.penalties.map((p) => p.weightBp);
    const picked =
      rules.penalties[
        weightedIndex(weights, ctx.drawInt('penalty_kind', sum(weights)))
      ]!;
    const against = picked.against as 'offense' | 'defense';
    penalty = {
      penaltyKey: picked.penaltyKey,
      against,
      againstOrganizationId:
        against === 'offense'
          ? pair.offenseCall.organizationId
          : pair.defenseCall.organizationId,
      yards: picked.yards,
      automaticFirstDown: picked.automaticFirstDown,
      lossOfDown: picked.lossOfDown,
      enforcement: picked.enforcement,
    };
  }

  // ----- Phase 9: clock (possession and score come from the transition layer) -----
  const duration = rules.clock.playDurations.find(
    (d) => d.playCategory === pair.offenseConcept.playCategory,
  )!;
  const clockSecondsUsed =
    duration.minSeconds +
    ctx.drawInt('clock', duration.maxSeconds - duration.minSeconds + 1);

  // ----- Facts -----
  const passerExec = ofAction(offExecs, 'throw_pass')[0];
  const carrierExec = pass
    ? null
    : bestPerSlot(ofAction(offExecs, 'carry_ball'))[0]!;
  const ballCarrier =
    carrierExec ??
    (resultKind === 'completion' || resultKind === 'fumble_lost'
      ? targetSlot
      : null);
  const principals: PlayPrincipals = {
    ...emptyPrincipals,
    passerPlayerId: passerExec?.playerId ?? null,
    ballCarrierPlayerId: ballCarrier?.playerId ?? null,
    targetPlayerId: pass ? (targetSlot?.playerId ?? null) : null,
    defenderPlayerId: coverSlot?.playerId ?? null,
    tacklerPlayerId: tacklerSlot?.playerId ?? null,
    pressurePlayerId: pressureSlot?.playerId ?? null,
  };
  const tackled = new Set<string>();
  if (principals.ballCarrierPlayerId !== null)
    tackled.add(principals.ballCarrierPlayerId);
  if (principals.tacklerPlayerId !== null)
    tackled.add(principals.tacklerPlayerId);
  if (resultKind === 'sack') {
    if (principals.passerPlayerId !== null)
      tackled.add(principals.passerPlayerId);
    if (principals.pressurePlayerId !== null)
      tackled.add(principals.pressurePlayerId);
  }

  const category = pair.offenseConcept.playCategory;
  return {
    execs: [...offExecs, ...defExecs],
    outcome: {
      category,
      resultKind,
      yardsGained,
      turnover,
      kick: null,
      penalty,
      clockSecondsUsed,
      principals,
      tackled,
      margins: {
        edgeBp,
        tacticalBp,
        runMargin,
        pressureMargin,
        passMargin,
        offenseNoise,
        defenseNoise,
      },
      transition: (keys) => {
        const fact = {
          yardsGained,
          turnover,
          clockSecondsUsed,
          offenseConceptKey: keys.offenseConceptKey,
          defenseConceptKey: keys.defenseConceptKey,
        };
        if (penalty !== null) {
          const r = applyPenaltyResult(rules, orgs, state, fact, penalty);
          return {
            transition: { state: r.state, events: r.events },
            penaltyAccepted: r.accepted,
            playStands: r.playStands,
          };
        }
        return {
          transition: applyScrimmageResult(rules, orgs, state, fact),
          penaltyAccepted: null,
          playStands: true,
        };
      },
    },
  };
};

// ---------------------------------------------------------------------------
// Special-teams snaps (kickoff, punt, field goal, extra point): same machinery
// ---------------------------------------------------------------------------

const kick = (
  ctx: Context,
  pair: CallPair,
  category: SpecialTeamsCategory,
): SnapResult => {
  const { rules, state, orgs } = ctx;
  const o = rules.outcome;
  const st = rules.specialTeams;
  const field = rules.field.fieldLengthYards;
  const neutral = st.neutralExecutionBp;
  const kickExecs = deriveSide(
    'kicking',
    pair.offenseConcept,
    pair.offenseCall.lineup,
    rules,
    ctx.input.latent,
  );
  const retExecs = deriveSide(
    'returning',
    pair.defenseConcept,
    pair.defenseCall.lineup,
    rules,
    ctx.input.latent,
  );
  const kickerSlot = bestPerSlot(ofAction(kickExecs, ...KICK_ACTIONS))[0]!;
  const kickerExec = kickerSlot.executionBp;
  const kickSupport =
    meanOf(notAction(kickExecs, ...KICK_ACTIONS).map((e) => e.executionBp)) ??
    neutral;
  const returner = bestPerSlot(ofAction(retExecs, 'carry_ball'))[0];
  const returnerExec = returner?.executionBp ?? neutral;
  const returnSupport =
    meanOf(notAction(retExecs, 'carry_ball').map((e) => e.executionBp)) ??
    neutral;

  const executionNoise = ctx.drawNoise('execution');
  let resultKind: PlayResultKind;
  let kickFact: PlayKickFact;
  let landing = 0;
  let good = false;
  let returnYards = 0;
  const margins: { [key: string]: number } = {
    kickerExecution: kickerExec,
    kickSupport,
    returnSupport,
    executionNoise,
  };

  if (category === 'kickoff' || category === 'punt') {
    const distanceNoise = ctx.drawNoise('kick_distance');
    const base =
      category === 'kickoff' ? o.baselineKickoffYards : o.baselinePuntYards;
    const kickMargin = kickerExec - neutral + executionNoise;
    const tenths =
      base * 10 +
      Math.floor(
        ((kickMargin + distanceNoise) * o.yardsPerMarginTenths) /
          o.marginScaleBp,
      );
    const kickYards = clamp(Math.floor(tenths / 10), 10, 100);
    landing = state.yardLine + kickYards;
    const touchback = landing >= field;
    if (!touchback) {
      const returnNoise = ctx.drawNoise('return_yards');
      const catchSpot = field - landing;
      const returnPower = blend([returnerExec, returnSupport]) ?? neutral;
      const returnMargin = returnPower - kickSupport + returnNoise;
      margins.returnMargin = returnMargin;
      returnYards = clamp(
        Math.floor(
          (o.baselineReturnYardsTenths +
            Math.floor(
              (returnMargin * o.yardsPerMarginTenths) / o.marginScaleBp,
            )) /
            10,
        ),
        0,
        field - catchSpot,
      );
    }
    margins.kickMargin = kickMargin;
    resultKind = category;
    kickFact = {
      kickYards,
      landingYardLine: landing,
      touchback,
      returnYards,
      good: null,
    };
  } else {
    const distance =
      category === 'extra_point'
        ? field - rules.field.extraPointYardLine + st.kickDepthYards
        : fieldGoalKickDistance(rules, state.yardLine);
    const reference =
      field - rules.field.extraPointYardLine + st.kickDepthYards;
    const baseBp = clamp(
      o.baselineKickMakeBp -
        o.kickDistancePenaltyBpPerYard * (distance - reference),
      0,
      10000,
    );
    const kickMargin =
      kickerExec -
      neutral +
      Math.floor((kickSupport - returnSupport) / 2) +
      Math.floor(executionNoise / 2);
    const pMake = scaledProbabilityBp(baseBp, kickMargin, o.marginScaleBp);
    good = ctx.drawInt('kick_result', 10000) < pMake;
    margins.kickMargin = kickMargin;
    margins.makeBp = pMake;
    resultKind = `${category}_${good ? 'good' : 'missed'}` as PlayResultKind;
    kickFact = {
      kickYards: distance,
      landingYardLine: null,
      touchback: false,
      returnYards: 0,
      good,
    };
  }

  const duration = rules.clock.playDurations.find(
    (d) => d.playCategory === category,
  )!;
  const clockSecondsUsed =
    duration.minSeconds +
    ctx.drawInt('clock', duration.maxSeconds - duration.minSeconds + 1);

  const returned =
    (category === 'kickoff' || category === 'punt') && !kickFact.touchback;
  const principals: PlayPrincipals = {
    ...emptyPrincipals,
    kickerPlayerId: kickerSlot.playerId,
    returnerPlayerId: returner?.playerId ?? null,
    ballCarrierPlayerId: returned ? (returner?.playerId ?? null) : null,
  };
  const tackled = new Set<string>();
  if (returned && returner !== undefined) tackled.add(returner.playerId);

  return {
    execs: [...kickExecs, ...retExecs],
    outcome: {
      category,
      resultKind,
      yardsGained: 0,
      turnover: null,
      kick: kickFact,
      penalty: null,
      clockSecondsUsed,
      principals,
      tackled,
      margins,
      transition: () => {
        const t =
          category === 'kickoff'
            ? applyKickoffResult(rules, orgs, state, {
                landingYardLine: landing,
                returnYards,
                clockSecondsUsed,
              })
            : category === 'punt'
              ? applyPuntResult(rules, orgs, state, {
                  landingYardLine: landing,
                  returnYards,
                  clockSecondsUsed,
                })
              : category === 'field_goal'
                ? applyFieldGoalResult(rules, orgs, state, {
                    good,
                    clockSecondsUsed,
                  })
                : applyExtraPointResult(rules, orgs, state, {
                    good,
                    clockSecondsUsed,
                  });
        return { transition: t, penaltyAccepted: null, playStands: true };
      },
    },
  };
};

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

const participationFor = (
  ctx: Context,
  pair: CallPair,
  result: SnapResult,
): PlayParticipationFact[] => {
  const rules = ctx.rules;
  const out: PlayParticipationFact[] = [];
  const sides = [
    { side: pair.offenseSide, call: pair.offenseCall },
    { side: pair.defenseSide, call: pair.defenseCall },
  ];
  sides.forEach(({ side, call }) => {
    call.lineup.forEach((slot) => {
      const mine = result.execs.filter(
        (e) => e.side === side && e.slotKey === slot.slotKey && e.attempted,
      );
      const actionKeys = [...new Set(mine.map((e) => e.actionKey))];
      const actionExposures = actionKeys.map((actionKey) => ({
        actionKey,
        attempts: 1,
      }));
      const responsibilityExposures: {
        schemeKey: string;
        responsibilityKey: string;
        meaningfulReps: number;
      }[] = [];
      mine.forEach((e) => {
        if (
          !responsibilityExposures.some(
            (r) =>
              r.schemeKey === e.schemeKey &&
              r.responsibilityKey === e.responsibilityKey,
          )
        )
          responsibilityExposures.push({
            schemeKey: e.schemeKey,
            responsibilityKey: e.responsibilityKey,
            meaningfulReps: 1,
          });
      });
      let contactClass = 'none';
      actionKeys.forEach((a) => {
        const c = ACTION_CONTACT[a] ?? 'none';
        if (contactRank(c) > contactRank(contactClass)) contactClass = c;
      });
      if (result.outcome.tackled.has(slot.playerId)) contactClass = 'tackle';
      out.push({
        organizationId: call.organizationId,
        side,
        slotKey: slot.slotKey,
        playerId: slot.playerId,
        contactClass,
        workloadUnits: footballWorkloadUnits(rules, actionExposures),
        actionExposures,
        responsibilityExposures,
      });
    });
  });
  return out;
};

const resolveInternal = (
  input: PlayStateInput,
  rng: DeterministicRng,
  drawStart: number,
): ResolvedPlay => {
  const rules = validateInput(input);
  const state = input.gameState;
  const fixture = input.football.fixtures.find((f) => f.id === state.fixtureId);
  if (fixture === undefined)
    return fail(`unknown fixture "${state.fixtureId}"`);
  if (fixture.status !== 'scheduled')
    fail(`fixture "${state.fixtureId}" is already final`);
  const orgs: GameOrganizations = {
    homeOrganizationId: fixture.homeOrganizationId,
    awayOrganizationId: fixture.awayOrganizationId,
  };
  const problems = designationProblems({
    rules,
    orgs,
    fixtureId: state.fixtureId,
    designations: input.football.designations,
  });
  if (problems.length > 0) fail(problems[0]!);
  // Revalidate committed game-day designations against current Package C roster truth.
  // This happens before the first football draw so a stale designation cannot field a
  // reserve player or a player whose active membership belongs to the other club.
  input.football.designations
    .filter((d) => d.fixtureId === state.fixtureId && d.status === 'active')
    .forEach((d) => {
      const membership = currentRosterMembership(
        input.latent.roster,
        d.playerId,
        fixture.fixtureDate,
      );
      if (
        membership === undefined ||
        membership.status !== 'active' ||
        membership.organizationId !== d.organizationId
      )
        fail(
          `player "${d.playerId}" is not on the active roster for "${d.organizationId}"`,
        );
    });

  // ----- Draw bookkeeping -----
  const draws: PlayDrawRecord[] = [];
  const drawInt = (family: PlayDrawFamily, bound: number): number => {
    const before = rng.snapshot().draws;
    const value = rng.nextInt(bound);
    draws.push({ family, bound, value, words: rng.snapshot().draws - before });
    return value;
  };
  const drawSelectionRoll = (family: PlayDrawFamily): number => {
    const before = rng.snapshot().draws;
    const value = rng.nextU32();
    draws.push({
      family,
      bound: 4294967296,
      value,
      words: rng.snapshot().draws - before,
    });
    return value;
  };
  const noiseBound = 2 * rules.outcome.executionNoiseBp + 1;
  const ctx: Context = {
    input,
    rng,
    rules,
    state,
    orgs,
    draws,
    drawStart,
    drawInt,
    drawSelectionRoll,
    drawNoise: (family) =>
      drawInt(family, noiseBound) - rules.outcome.executionNoiseBp,
  };

  // ----- Which snap is this, and who calls it? -----
  const snap = decideSnap(ctx);
  const pair =
    snap.kind === 'scrimmage'
      ? selectScrimmage(ctx)
      : selectSpecial(ctx, snap.category);
  // Latent truth is read only after both calls are committed AND their lineups are legal.
  assertLegal(ctx, pair.offenseCall, pair.offenseSide);
  assertLegal(ctx, pair.defenseCall, pair.defenseSide);
  const result =
    snap.kind === 'scrimmage'
      ? scrimmage(ctx, pair)
      : kick(ctx, pair, snap.category);
  const outcome = result.outcome;

  const participation = participationFor(ctx, pair, result);
  const applied = outcome.transition({
    offenseConceptKey: pair.offenseCall.conceptKey,
    defenseConceptKey: pair.defenseCall.conceptKey,
  });
  const events = applied.transition.events;
  const nextGameState = accumulateWorkload(
    applied.transition.state,
    participation.map((p) => ({
      playerId: p.playerId,
      workloadUnits: p.workloadUnits,
    })),
  );

  const privateTrace: PlayPrivateTrace = {
    draws,
    margins: outcome.margins,
    executions: result.execs.map((e) => ({
      side: e.side,
      slotKey: e.slotKey,
      playerId: e.playerId,
      actionKey: e.actionKey,
      responsibilityKey: e.responsibilityKey,
      executionBp: e.executionBp,
      functionalReadinessBp: e.input.functionalReadinessBp,
      familiarityBp: e.input.familiarityBp,
      attempted: e.attempted,
    })),
  };

  const callFact = (c: PlayCallFact): PlayCallFact => ({
    conceptKey: c.conceptKey,
    formationKey: c.formationKey,
    personnelKey: c.personnelKey,
    lineup: c.lineup,
  });
  const resolved: ResolvedPlayDraft = {
    fixtureId: state.fixtureId,
    sequence: state.playsResolved + 1,
    offenseOrganizationId: pair.offenseCall.organizationId,
    defenseOrganizationId: pair.defenseCall.organizationId,
    pre: {
      period: state.period,
      clockSecondsRemaining: state.clockSecondsRemaining,
      down: state.down,
      yardLine: state.yardLine,
      yardsToGo: state.yardsToGo,
      homeScore: state.homeScore,
      awayScore: state.awayScore,
    },
    offense: callFact(pair.offenseCall),
    defense: callFact(pair.defenseCall),
    playCategory: outcome.category,
    resultKind: outcome.resultKind,
    yardsGained: outcome.yardsGained,
    turnover: outcome.turnover,
    touchdown: events.some((e) => e.kind === 'touchdown'),
    safety: events.some((e) => e.kind === 'safety'),
    kick: outcome.kick,
    penalty: outcome.penalty,
    penaltyAccepted: applied.penaltyAccepted,
    playStands: applied.playStands,
    clockSecondsUsed: outcome.clockSecondsUsed,
    principals: outcome.principals,
    participation,
    rngDrawStart: drawStart,
    rngDrawCount: rng.snapshot().draws - drawStart,
    traceHash: hashCanonical(privateTrace as unknown as CanonicalValue),
  };
  return { resolved, nextGameState, events, rng, privateTrace };
};

void scrimmageEnd;
