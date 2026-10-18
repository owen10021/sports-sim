import type { GameDayDesignation, GameState, KickoffKind } from './football';
import type { FootballRulesV1, FootballSide } from './footballRules';
import type { LineupSlot } from './footballSelection';
import type { EntityId, RecordId } from './ids';

/**
 * Pure, deterministic football game-state transitions (Package E design basis, Task 8).
 *
 * Every function here maps `(rules, organizations, state, fact)` to a new state plus the
 * public events that happened. Nothing draws randomness, reads latent player truth, or
 * touches the world: the play resolver supplies resolved FACTS, and these functions turn
 * them into the next down, distance, possession, score, clock and period. A rule that the
 * synthetic profile claims to represent is implemented exactly once, here.
 *
 * Coordinates: a yard line is yards advanced from the possessing organization's own goal
 * line (0..fieldLengthYards). `possessionOrganizationId` is the organization with the ball
 * on the NEXT snap (the kicker, for a kickoff).
 *
 * Represented V1 semantics (the accepted E boundary; anything not listed is not modeled):
 *  - Four downs per series, first down at `firstDownYards` or by penalty, goal-to-go caps
 *    the distance; turnover on downs flips possession at the spot.
 *  - Touchdown is followed by one untimed extra-point kick, then a kickoff by the scorer.
 *    Safety gives the defense the points and a free kick (from `safetyKickYardLine`) by the
 *    team scored upon. A made field goal is followed by a kickoff by the scorer.
 *  - A turnover whose spot is behind the offense's goal line is a defensive touchdown; one
 *    whose spot is past the opponent's goal line is a touchback.
 *  - One period ends when its clock reaches zero (never during the untimed extra point).
 *    Halftime resets timeouts and gives the second-half kickoff to the team that kicked
 *    first. A tie after regulation plays `overtimePeriods` full timed periods (kickoff by
 *    the opening receiver); if still tied it ends tied when the ruleset allows, otherwise it
 *    plays another overtime period. There is no sudden death because the ruleset declares none.
 *  - At most one penalty per play. `dead_ball` fouls erase the play and cost no time and are
 *    always enforced; `previous_spot` and `spot` fouls are accepted or declined by the fouled
 *    team (whichever outcome is better for it, a strictly better one only), and a `spot`
 *    foul on a play that scored or turned the ball over is enforced from the previous spot.
 *    Yardage is capped at half the distance to the relevant goal line.
 *  - Timeouts are tracked and reset but never spent: the clock runs between plays.
 */

export class GameStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameStateError';
  }
}

const fail = (message: string): never => {
  throw new GameStateError(message);
};

export interface GameOrganizations {
  readonly homeOrganizationId: EntityId;
  readonly awayOrganizationId: EntityId;
}

export type GameEventKind =
  | 'first_down'
  | 'turnover'
  | 'turnover_on_downs'
  | 'touchdown'
  | 'safety'
  | 'field_goal_good'
  | 'field_goal_missed'
  | 'extra_point_good'
  | 'extra_point_missed'
  | 'punt'
  | 'kickoff'
  | 'touchback'
  | 'penalty_accepted'
  | 'penalty_declined'
  | 'period_end'
  | 'half_end'
  | 'overtime_start'
  | 'game_end';

export interface GameEvent {
  readonly kind: GameEventKind;
  /** The organization the event belongs to (scorer, fouled team, new possessor), if any. */
  readonly organizationId: EntityId | null;
  readonly points: number;
}

export interface GameTransition {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export interface PenaltyFact {
  readonly penaltyKey: string;
  readonly against: 'offense' | 'defense';
  readonly againstOrganizationId: EntityId;
  readonly yards: number;
  readonly automaticFirstDown: boolean;
  readonly lossOfDown: boolean;
  readonly enforcement: 'dead_ball' | 'spot' | 'previous_spot';
}

export interface ScrimmageResultFact {
  readonly yardsGained: number;
  readonly turnover: 'interception' | 'fumble' | null;
  readonly clockSecondsUsed: number;
  readonly offenseConceptKey: string;
  readonly defenseConceptKey: string;
}

/** Where a kicked ball first came to rest, and the return from there. */
export interface KickResultFact {
  /** Kicking team's coordinates; at or past `fieldLengthYards` is the end zone (touchback). */
  readonly landingYardLine: number;
  /** Yards the receiving team advanced from where it caught the ball. */
  readonly returnYards: number;
  readonly clockSecondsUsed: number;
}

export interface FieldGoalResultFact {
  readonly good: boolean;
  readonly clockSecondsUsed: number;
}

export interface ExtraPointResultFact {
  readonly good: boolean;
  readonly clockSecondsUsed: number;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const isCount = (n: unknown): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;

const otherOrganization = (
  orgs: GameOrganizations,
  organizationId: EntityId,
): EntityId => {
  if (organizationId === orgs.homeOrganizationId)
    return orgs.awayOrganizationId;
  if (organizationId === orgs.awayOrganizationId)
    return orgs.homeOrganizationId;
  return fail(`organization "${organizationId}" does not play in this game`);
};

const addPoints = (
  orgs: GameOrganizations,
  state: GameState,
  organizationId: EntityId,
  points: number,
): GameState =>
  organizationId === orgs.homeOrganizationId
    ? { ...state, homeScore: state.homeScore + points }
    : organizationId === orgs.awayOrganizationId
      ? { ...state, awayScore: state.awayScore + points }
      : fail(`organization "${organizationId}" does not play in this game`);

const goalToGo = (rules: FootballRulesV1, yardLine: number): number =>
  Math.max(
    1,
    Math.min(
      rules.field.firstDownYards,
      rules.field.fieldLengthYards - yardLine,
    ),
  );

const requireSnap = (
  state: GameState,
  snap: GameState['nextSnap'],
  what: string,
): void => {
  if (state.status !== 'in_progress')
    fail(`the game is over; cannot apply ${what}`);
  if (state.nextSnap !== snap)
    fail(`${what} needs next snap "${snap}", not "${state.nextSnap}"`);
};

const requireSeconds = (seconds: unknown): number => {
  if (!isCount(seconds))
    return fail('clockSecondsUsed must be a non-negative integer');
  return seconds;
};

const spendClock = (state: GameState, seconds: number): GameState => ({
  ...state,
  clockSecondsRemaining: Math.max(0, state.clockSecondsRemaining - seconds),
});

const ev = (
  kind: GameEventKind,
  organizationId: EntityId | null,
  points = 0,
): GameEvent => ({ kind, organizationId, points });

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

/**
 * The state before the opening kickoff. The receiver is supplied by the caller (a coin toss
 * is not modeled); the other organization kicks.
 */
export const createInitialGameState = (
  rules: FootballRulesV1,
  orgs: GameOrganizations,
  fixtureId: RecordId,
  openingReceiverOrganizationId: EntityId,
): GameState => ({
  possessionOrganizationId: otherOrganization(
    orgs,
    openingReceiverOrganizationId,
  ),
  period: 1,
  clockSecondsRemaining: rules.clock.quarterSeconds,
  down: 1,
  yardsToGo: rules.field.firstDownYards,
  yardLine: rules.field.kickoffYardLine,
  homeScore: 0,
  awayScore: 0,
  homeTimeoutsRemaining: rules.clock.timeoutsPerHalf,
  awayTimeoutsRemaining: rules.clock.timeoutsPerHalf,
  resolvedCalls: [],
  fixtureId,
  playsResolved: 0,
  nextSnap: 'kickoff',
  status: 'in_progress',
  kickoffKind: 'opening',
  openingReceiverOrganizationId,
  driveCount: 0,
  drivePlays: 0,
  workloadByPlayer: [],
});

// ---------------------------------------------------------------------------
// Downs and distance
// ---------------------------------------------------------------------------

export interface DownAndDistance {
  readonly down: number;
  readonly yardsToGo: number;
  readonly firstDown: boolean;
  readonly turnoverOnDowns: boolean;
}

/**
 * The next down after a gain of `yardsGained` that ends at `newYardLine`. A gain of at
 * least the distance is a first down (goal-to-go caps the new distance); otherwise the down
 * advances, and a gain that falls short on the last down is a turnover on downs.
 */
export const nextDownAndDistance = (
  rules: FootballRulesV1,
  current: { readonly down: number; readonly yardsToGo: number },
  yardsGained: number,
  newYardLine: number,
): DownAndDistance => {
  if (yardsGained >= current.yardsToGo)
    return {
      down: 1,
      yardsToGo: goalToGo(rules, newYardLine),
      firstDown: true,
      turnoverOnDowns: false,
    };
  if (current.down >= rules.field.downsPerSeries)
    return {
      down: 1,
      yardsToGo: rules.field.firstDownYards,
      firstDown: false,
      turnoverOnDowns: true,
    };
  return {
    down: current.down + 1,
    yardsToGo: current.yardsToGo - yardsGained,
    firstDown: false,
    turnoverOnDowns: false,
  };
};

// ---------------------------------------------------------------------------
// Possession, scoring, periods
// ---------------------------------------------------------------------------

const kickoffState = (
  rules: FootballRulesV1,
  state: GameState,
  kicker: EntityId,
  kind: KickoffKind,
): GameState => ({
  ...state,
  possessionOrganizationId: kicker,
  nextSnap: 'kickoff',
  kickoffKind: kind,
  down: 1,
  yardsToGo: rules.field.firstDownYards,
  yardLine:
    kind === 'after_safety'
      ? rules.field.safetyKickYardLine
      : rules.field.kickoffYardLine,
});

/** A new drive: `organizationId` has the ball first-and-ten at `yardLine`. */
const startDrive = (
  rules: FootballRulesV1,
  state: GameState,
  organizationId: EntityId,
  yardLine: number,
): GameState => ({
  ...state,
  possessionOrganizationId: organizationId,
  nextSnap: 'scrimmage',
  kickoffKind: null,
  yardLine,
  down: 1,
  yardsToGo: goalToGo(rules, yardLine),
  driveCount: state.driveCount + 1,
  drivePlays: 0,
});

export type ScoringKind = 'touchdown' | 'field_goal' | 'safety' | 'extra_point';

/**
 * Credit `scoringOrganizationId` and set up the snap that follows: a touchdown earns an
 * untimed extra-point try, a made field goal or extra point a kickoff by the scorer, and a
 * safety a free kick by the team that was scored upon. Clock, play count and period are
 * untouched; the caller owns them.
 */
export const applyScoringResult = (
  rules: FootballRulesV1,
  orgs: GameOrganizations,
  state: GameState,
  scoringOrganizationId: EntityId,
  kind: ScoringKind,
): GameTransition => {
  const points =
    kind === 'touchdown'
      ? rules.scoring.touchdown
      : kind === 'field_goal'
        ? rules.scoring.fieldGoal
        : kind === 'safety'
          ? rules.scoring.safety
          : rules.scoring.extraPoint;
  let s = addPoints(orgs, state, scoringOrganizationId, points);
  const events: GameEvent[] = [];
  if (kind === 'touchdown') {
    events.push(ev('touchdown', scoringOrganizationId, points));
    s = {
      ...s,
      possessionOrganizationId: scoringOrganizationId,
      nextSnap: 'extra_point',
      kickoffKind: null,
      down: 1,
      yardLine: rules.field.extraPointYardLine,
      yardsToGo: rules.field.fieldLengthYards - rules.field.extraPointYardLine,
    };
  } else if (kind === 'safety') {
    events.push(ev('safety', scoringOrganizationId, points));
    s = kickoffState(
      rules,
      s,
      otherOrganization(orgs, scoringOrganizationId),
      'after_safety',
    );
  } else {
    events.push(
      ev(
        kind === 'field_goal' ? 'field_goal_good' : 'extra_point_good',
        scoringOrganizationId,
        points,
      ),
    );
    s = kickoffState(rules, s, scoringOrganizationId, 'after_score');
  }
  return { state: s, events };
};

const resetTimeouts = (
  rules: FootballRulesV1,
  state: GameState,
): GameState => ({
  ...state,
  homeTimeoutsRemaining: rules.clock.timeoutsPerHalf,
  awayTimeoutsRemaining: rules.clock.timeoutsPerHalf,
});

/** Roll the period (or end the game) when the clock has run out and no try is pending. */
const rollPeriods = (
  rules: FootballRulesV1,
  orgs: GameOrganizations,
  state: GameState,
  events: GameEvent[],
): GameState => {
  if (
    state.status === 'final' ||
    state.clockSecondsRemaining > 0 ||
    state.nextSnap === 'extra_point'
  )
    return state;
  const regulation = rules.clock.quartersPerGame;
  let s = state;
  events.push(ev('period_end', null));
  if (s.period < regulation) {
    if (s.period * 2 === regulation) {
      events.push(ev('half_end', null));
      s = kickoffState(
        rules,
        s,
        s.openingReceiverOrganizationId,
        'second_half',
      );
      s = resetTimeouts(rules, s);
    }
    return {
      ...s,
      period: s.period + 1,
      clockSecondsRemaining: rules.clock.quarterSeconds,
    };
  }
  if (s.homeScore !== s.awayScore) {
    events.push(
      ev(
        'game_end',
        s.homeScore > s.awayScore
          ? orgs.homeOrganizationId
          : orgs.awayOrganizationId,
      ),
    );
    return { ...s, status: 'final' };
  }
  const overtimePlayed = s.period - regulation;
  if (
    overtimePlayed >= rules.clock.overtimePeriods &&
    rules.clock.tieAllowedAfterOvertime
  ) {
    events.push(ev('game_end', null));
    return { ...s, status: 'final' };
  }
  events.push(ev('overtime_start', null));
  const kicker =
    overtimePlayed % 2 === 0
      ? s.openingReceiverOrganizationId
      : otherOrganization(orgs, s.openingReceiverOrganizationId);
  s = resetTimeouts(rules, kickoffState(rules, s, kicker, 'overtime'));
  return {
    ...s,
    period: s.period + 1,
    clockSecondsRemaining: rules.clock.overtimeSeconds,
  };
};

const finish = (
  rules: FootballRulesV1,
  orgs: GameOrganizations,
  state: GameState,
  events: GameEvent[],
): GameTransition => {
  const s = rollPeriods(rules, orgs, state, events);
  return { state: s, events };
};

// ---------------------------------------------------------------------------
// Fourth-down policy (a ruleset-declared situation rule, public information only)
// ---------------------------------------------------------------------------

export type FourthDownChoice = 'go' | 'punt' | 'field_goal';

/** Distance of a field goal attempt from this line of scrimmage. */
export const fieldGoalKickDistance = (
  rules: FootballRulesV1,
  yardLine: number,
): number =>
  rules.field.fieldLengthYards - yardLine + rules.specialTeams.kickDepthYards;

/**
 * What the ruleset's situation rule does on this snap. It reads only the public down,
 * distance and spot, never a player or team quality, so a stronger team gets no special
 * treatment. Before the last down the choice is always to run a scrimmage play.
 */
export const fourthDownChoice = (
  rules: FootballRulesV1,
  situation: {
    readonly down: number;
    readonly yardsToGo: number;
    readonly yardLine: number;
  },
): FourthDownChoice => {
  if (situation.down < rules.field.downsPerSeries) return 'go';
  const st = rules.specialTeams;
  if (
    fieldGoalKickDistance(rules, situation.yardLine) <= st.fieldGoalMaxKickYards
  )
    return 'field_goal';
  if (
    situation.yardsToGo <= st.goForItMaxYardsToGo &&
    situation.yardLine >= st.goForItMinYardLine
  )
    return 'go';
  return 'punt';
};

// ---------------------------------------------------------------------------
// Scrimmage plays
// ---------------------------------------------------------------------------

export type ScrimmageEnd =
  | 'normal'
  | 'touchdown'
  | 'safety'
  | 'defensive_touchdown'
  | 'touchback'
  | 'turnover';

/**
 * What a scrimmage play's geometry says happened. This is the ONE place a touchdown, safety,
 * defensive touchdown or touchback is decided; the resolver reports facts from it and the
 * transitions act on it.
 */
export const scrimmageEnd = (
  rules: FootballRulesV1,
  yardLine: number,
  yardsGained: number,
  turnover: 'interception' | 'fumble' | null,
): ScrimmageEnd => {
  const end = yardLine + yardsGained;
  const field = rules.field.fieldLengthYards;
  if (turnover === null)
    return end >= field ? 'touchdown' : end <= 0 ? 'safety' : 'normal';
  return end <= 0
    ? 'defensive_touchdown'
    : end >= field
      ? 'touchback'
      : 'turnover';
};

const validateScrimmage = (
  rules: FootballRulesV1,
  state: GameState,
  fact: ScrimmageResultFact,
): void => {
  const field = rules.field.fieldLengthYards;
  if (!Number.isSafeInteger(fact.yardsGained))
    fail('yardsGained must be an integer');
  if (
    fact.yardsGained < -state.yardLine ||
    fact.yardsGained > field - state.yardLine
  )
    fail('yardsGained leaves the field');
  if (
    fact.turnover !== null &&
    fact.turnover !== 'interception' &&
    fact.turnover !== 'fumble'
  )
    fail('turnover must be interception, fumble or null');
  requireSeconds(fact.clockSecondsUsed);
};

const advancedPlay = (
  state: GameState,
  fact: ScrimmageResultFact,
  seconds: number,
  countsForDrive: boolean,
): GameState => ({
  ...spendClock(state, seconds),
  playsResolved: state.playsResolved + 1,
  drivePlays: state.drivePlays + (countsForDrive ? 1 : 0),
  resolvedCalls: [
    ...state.resolvedCalls,
    {
      offenseConceptKey: fact.offenseConceptKey,
      defenseConceptKey: fact.defenseConceptKey,
    },
  ],
});

/** Resolve a scrimmage play that stands (no penalty accepted) into the next game state. */
export const applyScrimmageResult = (
  rules: FootballRulesV1,
  orgs: GameOrganizations,
  state: GameState,
  fact: ScrimmageResultFact,
): GameTransition => scrimmageTransition(rules, orgs, state, fact, true);

const scrimmageTransition = (
  rules: FootballRulesV1,
  orgs: GameOrganizations,
  state: GameState,
  fact: ScrimmageResultFact,
  rollThePeriod: boolean,
): GameTransition => {
  requireSnap(state, 'scrimmage', 'a scrimmage result');
  validateScrimmage(rules, state, fact);
  const offense = state.possessionOrganizationId;
  const defense = otherOrganization(orgs, offense);
  const field = rules.field.fieldLengthYards;
  const end = state.yardLine + fact.yardsGained;
  const kind = scrimmageEnd(
    rules,
    state.yardLine,
    fact.yardsGained,
    fact.turnover,
  );
  let s = advancedPlay(state, fact, fact.clockSecondsUsed, true);
  const events: GameEvent[] = [];
  const take = (t: GameTransition): void => {
    s = t.state;
    events.push(...t.events);
  };
  if (kind === 'touchdown')
    take(applyScoringResult(rules, orgs, s, offense, 'touchdown'));
  else if (kind === 'safety')
    take(applyScoringResult(rules, orgs, s, defense, 'safety'));
  else if (kind === 'defensive_touchdown') {
    events.push(ev('turnover', defense));
    take(applyScoringResult(rules, orgs, s, defense, 'touchdown'));
  } else if (kind === 'touchback') {
    events.push(ev('turnover', defense), ev('touchback', defense));
    s = startDrive(rules, s, defense, rules.field.touchbackYardLine);
  } else if (kind === 'turnover') {
    events.push(ev('turnover', defense));
    s = startDrive(rules, s, defense, field - end);
  } else {
    const dd = nextDownAndDistance(rules, state, fact.yardsGained, end);
    if (dd.turnoverOnDowns) {
      events.push(ev('turnover_on_downs', defense));
      s = startDrive(rules, s, defense, field - end);
    } else {
      s = { ...s, yardLine: end, down: dd.down, yardsToGo: dd.yardsToGo };
      if (dd.firstDown) events.push(ev('first_down', offense));
    }
  }
  return rollThePeriod ? finish(rules, orgs, s, events) : { state: s, events };
};

// ---------------------------------------------------------------------------
// Penalties
// ---------------------------------------------------------------------------

const validatePenalty = (
  orgs: GameOrganizations,
  state: GameState,
  penalty: PenaltyFact,
): void => {
  const offense = state.possessionOrganizationId;
  const expected =
    penalty.against === 'offense' ? offense : otherOrganization(orgs, offense);
  if (penalty.against !== 'offense' && penalty.against !== 'defense')
    fail(
      'only offensive and defensive penalties are represented on scrimmage plays',
    );
  if (penalty.againstOrganizationId !== expected)
    fail('the penalty is charged to the wrong organization');
  if (!isCount(penalty.yards))
    fail('penalty yards must be a non-negative integer');
  if (
    penalty.enforcement !== 'dead_ball' &&
    penalty.enforcement !== 'spot' &&
    penalty.enforcement !== 'previous_spot'
  )
    fail('unknown penalty enforcement');
};

/**
 * Enforce a foul from `anchor`. The ball moves half the distance at most, the down repeats
 * unless the down was used (`spot` enforcement) or the foul takes a down, and a foul that
 * is an automatic first down, or moves the ball past the line to gain, is a first down.
 */
const enforcePenalty = (
  rules: FootballRulesV1,
  orgs: GameOrganizations,
  before: GameState,
  played: GameState,
  anchor: number,
  usedDown: boolean,
  penalty: PenaltyFact,
): GameTransition => {
  const offense = before.possessionOrganizationId;
  const defense = otherOrganization(orgs, offense);
  const field = rules.field.fieldLengthYards;
  const moved =
    penalty.against === 'offense'
      ? -Math.min(penalty.yards, Math.floor(anchor / 2))
      : Math.min(penalty.yards, Math.floor((field - anchor) / 2));
  const yardLine = anchor + moved;
  const net = yardLine - before.yardLine;
  const events: GameEvent[] = [
    ev('penalty_accepted', penalty.againstOrganizationId),
  ];
  let s: GameState = { ...played };
  if (penalty.automaticFirstDown || net >= before.yardsToGo) {
    s = { ...s, yardLine, down: 1, yardsToGo: goalToGo(rules, yardLine) };
    events.push(ev('first_down', offense));
  } else {
    const down =
      before.down + (usedDown ? 1 : 0) + (penalty.lossOfDown ? 1 : 0);
    if (down > rules.field.downsPerSeries) {
      events.push(ev('turnover_on_downs', defense));
      s = startDrive(rules, s, defense, field - yardLine);
    } else {
      s = { ...s, yardLine, down, yardsToGo: before.yardsToGo - net };
    }
  }
  return { state: s, events };
};

/** Higher is better for the offense: terminal results first, then position. */
const offenseValue = (
  offense: EntityId,
  orgs: GameOrganizations,
  t: GameTransition,
): readonly number[] => {
  const scored = (kind: GameEventKind): GameEvent | undefined =>
    t.events.find((e) => e.kind === kind);
  const td = scored('touchdown');
  if (td !== undefined)
    return [td.organizationId === offense ? 4 : -4, 0, 0, 0];
  if (scored('safety') !== undefined) return [-3, 0, 0, 0];
  if (
    t.state.possessionOrganizationId !== offense &&
    t.state.nextSnap === 'scrimmage'
  )
    return [-2, 0, 0, 0];
  void orgs;
  return [
    0,
    scored('first_down') !== undefined ? 1 : 0,
    t.state.yardLine,
    -t.state.down,
  ];
};

const compareValues = (a: readonly number[], b: readonly number[]): number => {
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!;
    if (d !== 0) return d;
  }
  return 0;
};

export interface PenaltyTransition extends GameTransition {
  readonly accepted: boolean;
  /**
   * Whether the snapped play's own result counts. False when an accepted foul erased it
   * (every dead-ball foul, a previous-spot foul, a spot foul on a scoring or turnover play).
   */
  readonly playStands: boolean;
}

/**
 * Apply a scrimmage play together with the penalty drawn on it. `dead_ball` fouls erase the
 * play, cost no time and are always enforced. For `previous_spot` and `spot` fouls the
 * fouled team keeps whichever result is strictly better for it; ties keep the play.
 */
export const applyPenaltyResult = (
  rules: FootballRulesV1,
  orgs: GameOrganizations,
  state: GameState,
  fact: ScrimmageResultFact,
  penalty: PenaltyFact,
): PenaltyTransition => {
  requireSnap(state, 'scrimmage', 'a penalty');
  validateScrimmage(rules, state, fact);
  validatePenalty(orgs, state, penalty);
  const offense = state.possessionOrganizationId;
  const rolled = (t: GameTransition): GameTransition => {
    const events = [...t.events];
    return finish(rules, orgs, t.state, events);
  };

  if (penalty.enforcement === 'dead_ball') {
    const played = advancedPlay(state, fact, 0, false);
    const t = enforcePenalty(
      rules,
      orgs,
      state,
      played,
      state.yardLine,
      false,
      penalty,
    );
    return { ...rolled(t), accepted: true, playStands: false };
  }

  // The result as it would stand, without rolling the period yet.
  const stands = scrimmageTransition(rules, orgs, state, fact, false);
  const end = scrimmageEnd(
    rules,
    state.yardLine,
    fact.yardsGained,
    fact.turnover,
  );
  const atSpot = penalty.enforcement === 'spot' && end === 'normal';
  const played = advancedPlay(state, fact, fact.clockSecondsUsed, atSpot);
  const enforced = atSpot
    ? enforcePenalty(
        rules,
        orgs,
        state,
        played,
        state.yardLine + fact.yardsGained,
        true,
        penalty,
      )
    : enforcePenalty(
        rules,
        orgs,
        state,
        played,
        state.yardLine,
        false,
        penalty,
      );

  const standsValue = offenseValue(offense, orgs, stands);
  const enforcedValue = offenseValue(offense, orgs, enforced);
  const delta = compareValues(enforcedValue, standsValue);
  // The offense is fouled when the foul is on the defense; each team takes what is better.
  const accept = penalty.against === 'defense' ? delta > 0 : delta < 0;
  if (accept)
    return { ...rolled(enforced), accepted: true, playStands: atSpot };
  const declined = ev('penalty_declined', penalty.againstOrganizationId);
  return {
    ...rolled({ state: stands.state, events: [declined, ...stands.events] }),
    accepted: false,
    playStands: true,
  };
};

// ---------------------------------------------------------------------------
// Special teams
// ---------------------------------------------------------------------------

const validateKick = (rules: FootballRulesV1, fact: KickResultFact): void => {
  if (
    !Number.isSafeInteger(fact.landingYardLine) ||
    fact.landingYardLine < 0 ||
    fact.landingYardLine > rules.field.fieldLengthYards + 30
  )
    fail('landingYardLine is outside the kicking range');
  if (!Number.isSafeInteger(fact.returnYards))
    fail('returnYards must be an integer');
  requireSeconds(fact.clockSecondsUsed);
};

/** The receiving team's possession after a kicked ball: touchback, return, or return score. */
const receiveKick = (
  rules: FootballRulesV1,
  orgs: GameOrganizations,
  state: GameState,
  fact: KickResultFact,
  kind: 'kickoff' | 'punt',
): GameTransition => {
  validateKick(rules, fact);
  const field = rules.field.fieldLengthYards;
  const kicker = state.possessionOrganizationId;
  const receiver = otherOrganization(orgs, kicker);
  const events: GameEvent[] = [ev(kind, kicker)];
  let s = state;
  if (fact.landingYardLine >= field) {
    if (fact.returnYards !== 0) fail('a touchback has no return');
    events.push(ev('touchback', receiver));
    s = startDrive(rules, s, receiver, rules.field.touchbackYardLine);
  } else {
    const spot = field - fact.landingYardLine + fact.returnYards;
    if (spot < 1 || spot > field) fail('the return ends outside the field');
    if (spot >= field) {
      const scored = applyScoringResult(rules, orgs, s, receiver, 'touchdown');
      s = scored.state;
      events.push(...scored.events);
    } else s = startDrive(rules, s, receiver, spot);
  }
  return { state: s, events };
};

export const applyKickoffResult = (
  rules: FootballRulesV1,
  orgs: GameOrganizations,
  state: GameState,
  fact: KickResultFact,
): GameTransition => {
  requireSnap(state, 'kickoff', 'a kickoff result');
  const seconds = requireSeconds(fact.clockSecondsUsed);
  const played: GameState = {
    ...spendClock(state, seconds),
    playsResolved: state.playsResolved + 1,
  };
  const t = receiveKick(rules, orgs, played, fact, 'kickoff');
  const events = [...t.events];
  return finish(rules, orgs, t.state, events);
};

export const applyPuntResult = (
  rules: FootballRulesV1,
  orgs: GameOrganizations,
  state: GameState,
  fact: KickResultFact,
): GameTransition => {
  requireSnap(state, 'scrimmage', 'a punt result');
  const seconds = requireSeconds(fact.clockSecondsUsed);
  const played: GameState = {
    ...spendClock(state, seconds),
    playsResolved: state.playsResolved + 1,
    drivePlays: state.drivePlays + 1,
  };
  const t = receiveKick(rules, orgs, played, fact, 'punt');
  const events = [...t.events];
  return finish(rules, orgs, t.state, events);
};

export const applyFieldGoalResult = (
  rules: FootballRulesV1,
  orgs: GameOrganizations,
  state: GameState,
  fact: FieldGoalResultFact,
): GameTransition => {
  requireSnap(state, 'scrimmage', 'a field goal result');
  const seconds = requireSeconds(fact.clockSecondsUsed);
  const kicker = state.possessionOrganizationId;
  const played: GameState = {
    ...spendClock(state, seconds),
    playsResolved: state.playsResolved + 1,
    drivePlays: state.drivePlays + 1,
  };
  if (fact.good) {
    const t = applyScoringResult(rules, orgs, played, kicker, 'field_goal');
    const events = [...t.events];
    return finish(rules, orgs, t.state, events);
  }
  const receiver = otherOrganization(orgs, kicker);
  const events: GameEvent[] = [ev('field_goal_missed', kicker)];
  const s = startDrive(
    rules,
    played,
    receiver,
    Math.max(
      rules.field.fieldLengthYards - state.yardLine,
      rules.field.touchbackYardLine,
    ),
  );
  return finish(rules, orgs, s, events);
};

export const applyExtraPointResult = (
  rules: FootballRulesV1,
  orgs: GameOrganizations,
  state: GameState,
  fact: ExtraPointResultFact,
): GameTransition => {
  requireSnap(state, 'extra_point', 'an extra point result');
  const seconds = requireSeconds(fact.clockSecondsUsed);
  const scorer = state.possessionOrganizationId;
  const played: GameState = {
    ...spendClock(state, seconds),
    playsResolved: state.playsResolved + 1,
  };
  if (fact.good) {
    const t = applyScoringResult(rules, orgs, played, scorer, 'extra_point');
    const events = [...t.events];
    return finish(rules, orgs, t.state, events);
  }
  const events: GameEvent[] = [ev('extra_point_missed', scorer)];
  return finish(
    rules,
    orgs,
    kickoffState(rules, played, scorer, 'after_score'),
    events,
  );
};

// ---------------------------------------------------------------------------
// Usage counters
// ---------------------------------------------------------------------------

/** Add workload units to the per-player counters, keeping them sorted by player id. */
export const accumulateWorkload = (
  state: GameState,
  entries: readonly {
    readonly playerId: EntityId;
    readonly workloadUnits: number;
  }[],
): GameState => {
  const totals = new Map<string, number>();
  state.workloadByPlayer.forEach((w) =>
    totals.set(w.playerId, w.workloadUnits),
  );
  entries.forEach((e) => {
    if (!isCount(e.workloadUnits))
      fail('workloadUnits must be a non-negative integer');
    totals.set(e.playerId, (totals.get(e.playerId) ?? 0) + e.workloadUnits);
  });
  return {
    ...state,
    workloadByPlayer: [...totals.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([playerId, workloadUnits]) => ({
        playerId: playerId as EntityId,
        workloadUnits,
      })),
  };
};

// ---------------------------------------------------------------------------
// Substitution and eligibility
// ---------------------------------------------------------------------------

/** The role vocabulary key the ruleset's `minOffensiveLinemenOnLine` counts. */
export const OFFENSIVE_LINE_ROLE = 'offensive_line';

export interface DesignationCheck {
  readonly rules: FootballRulesV1;
  readonly orgs: GameOrganizations;
  readonly fixtureId: RecordId;
  readonly designations: readonly GameDayDesignation[];
}

/** Problems with the fixture's designations as a whole (wrong club, over the active cap). */
export const designationProblems = (check: DesignationCheck): string[] => {
  const problems: string[] = [];
  const { rules, orgs, fixtureId } = check;
  const mine = check.designations.filter((d) => d.fixtureId === fixtureId);
  mine.forEach((d) => {
    if (
      d.organizationId !== orgs.homeOrganizationId &&
      d.organizationId !== orgs.awayOrganizationId
    )
      problems.push(
        `designation ${d.id} belongs to ${d.organizationId}, which does not play in this fixture`,
      );
  });
  [orgs.homeOrganizationId, orgs.awayOrganizationId].forEach((orgId) => {
    const active = new Set(
      mine
        .filter((d) => d.organizationId === orgId && d.status === 'active')
        .map((d) => d.playerId),
    );
    if (active.size > rules.substitution.maxActiveGameDayPlayers)
      problems.push(
        `${orgId} activates ${active.size} players, over the limit of ${rules.substitution.maxActiveGameDayPlayers}`,
      );
  });
  return problems;
};

export interface LineupCheck {
  readonly rules: FootballRulesV1;
  readonly fixtureId: RecordId;
  readonly organizationId: EntityId;
  readonly unitKey: FootballSide;
  readonly formationKey: string;
  readonly lineup: readonly LineupSlot[];
  readonly designations: readonly GameDayDesignation[];
}

/**
 * Why a lineup is not legal to field: only active designees of this organization in this
 * unit, in a role the slot allows, one player per slot, filling the formation exactly.
 */
export const lineupProblems = (check: LineupCheck): string[] => {
  const { rules, fixtureId, organizationId, unitKey } = check;
  const formation = rules.formations.find(
    (f) => f.formationKey === check.formationKey,
  );
  if (formation === undefined)
    return [`unknown formation "${check.formationKey}"`];
  const problems: string[] = [];
  if (formation.side !== unitKey)
    problems.push(
      `formation "${formation.formationKey}" belongs to the ${formation.side} unit`,
    );
  if (check.lineup.length !== rules.substitution.playersPerSide)
    problems.push(
      `lineup has ${check.lineup.length} players, but the ruleset fields ${rules.substitution.playersPerSide}`,
    );
  if (check.lineup.length !== formation.slots.length)
    problems.push('lineup does not fill the formation slots');
  const seen = new Set<string>();
  let linemen = 0;
  check.lineup.forEach((entry, i) => {
    const slot = formation.slots[i];
    if (slot === undefined || slot.slotKey !== entry.slotKey) {
      problems.push(
        `lineup slot ${i} is not "${slot?.slotKey ?? 'a formation slot'}"`,
      );
      return;
    }
    if (seen.has(entry.playerId))
      problems.push(`${entry.playerId} is lined up twice`);
    seen.add(entry.playerId);
    const mine = check.designations.filter(
      (d) => d.fixtureId === fixtureId && d.playerId === entry.playerId,
    );
    const designation = mine.find(
      (d) =>
        d.organizationId === organizationId &&
        d.status === 'active' &&
        d.unitKey === unitKey,
    );
    if (designation === undefined) {
      problems.push(
        mine.some((d) => d.organizationId !== organizationId)
          ? `${entry.playerId} belongs to another organization`
          : `${entry.playerId} is not an active ${unitKey} designee`,
      );
      return;
    }
    if (!slot.eligibleRoles.includes(designation.roleKey ?? ''))
      problems.push(
        `${entry.playerId} (${designation.roleKey}) is not eligible for slot "${slot.slotKey}"`,
      );
    if (designation.roleKey === OFFENSIVE_LINE_ROLE) linemen += 1;
  });
  if (
    unitKey === 'offense' &&
    linemen < rules.substitution.minOffensiveLinemenOnLine
  )
    problems.push(
      `an offensive lineup needs ${rules.substitution.minOffensiveLinemenOnLine} linemen, not ${linemen}`,
    );
  return problems;
};

/** Whether a lineup may legally take the field. */
export const legalSubstitution = (check: LineupCheck): boolean =>
  lineupProblems(check).length === 0;

/** Whether a role may be the target of a pass under the ruleset's eligibility list. */
export const isEligibleReceiverRole = (
  rules: FootballRulesV1,
  roleKey: string,
): boolean => rules.substitution.eligibleReceiverRoles.includes(roleKey);
