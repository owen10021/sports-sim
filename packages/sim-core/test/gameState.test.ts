import { describe, expect, it } from 'vitest';
import {
  GameStateError,
  SYNTHETIC_FOOTBALL_RULES,
  accumulateWorkload,
  applyExtraPointResult,
  applyFieldGoalResult,
  applyKickoffResult,
  applyPuntResult,
  applyScoringResult,
  applyScrimmageResult,
  createInitialGameState,
  entityId,
  nextDownAndDistance,
  recordId,
  scrimmageEnd,
  type FootballRulesV1,
  type GameOrganizations,
  type GameState,
  type ScrimmageResultFact,
} from '../src/index';

const RULES = SYNTHETIC_FOOTBALL_RULES;
const HOME = entityId('home-club');
const AWAY = entityId('away-club');
const ORGS: GameOrganizations = {
  homeOrganizationId: HOME,
  awayOrganizationId: AWAY,
};

/** A mid-game scrimmage state; home has the ball first-and-ten on its own 25. */
const state = (over: Partial<GameState> = {}): GameState => ({
  possessionOrganizationId: HOME,
  period: 1,
  clockSecondsRemaining: 900,
  down: 1,
  yardsToGo: 10,
  yardLine: 25,
  homeScore: 0,
  awayScore: 0,
  homeTimeoutsRemaining: 3,
  awayTimeoutsRemaining: 3,
  resolvedCalls: [],
  fixtureId: recordId('fixture-1'),
  playsResolved: 0,
  nextSnap: 'scrimmage',
  status: 'in_progress',
  kickoffKind: null,
  openingReceiverOrganizationId: AWAY,
  driveCount: 1,
  drivePlays: 0,
  workloadByPlayer: [],
  ...over,
});

const play = (
  over: Partial<ScrimmageResultFact> = {},
): ScrimmageResultFact => ({
  yardsGained: 4,
  turnover: null,
  clockSecondsUsed: 30,
  offenseConceptKey: 'inside_run',
  defenseConceptKey: 'zone_shell',
  ...over,
});

const kinds = (t: { events: readonly { kind: string }[] }): string[] =>
  t.events.map((e) => e.kind);

describe('nextDownAndDistance', () => {
  it('resets to first down on a gain of the distance, capped by goal-to-go', () => {
    expect(
      nextDownAndDistance(RULES, { down: 3, yardsToGo: 8 }, 8, 60),
    ).toEqual({
      down: 1,
      yardsToGo: 10,
      firstDown: true,
      turnoverOnDowns: false,
    });
    expect(
      nextDownAndDistance(RULES, { down: 2, yardsToGo: 7 }, 9, 95),
    ).toEqual({
      down: 1,
      yardsToGo: 5,
      firstDown: true,
      turnoverOnDowns: false,
    });
  });

  it('advances the down and shrinks or grows the distance otherwise', () => {
    expect(
      nextDownAndDistance(RULES, { down: 1, yardsToGo: 10 }, 4, 29),
    ).toEqual({
      down: 2,
      yardsToGo: 6,
      firstDown: false,
      turnoverOnDowns: false,
    });
    expect(
      nextDownAndDistance(RULES, { down: 2, yardsToGo: 6 }, -3, 26),
    ).toEqual({
      down: 3,
      yardsToGo: 9,
      firstDown: false,
      turnoverOnDowns: false,
    });
  });

  it('turns the ball over on downs when the last down falls short', () => {
    const dd = nextDownAndDistance(RULES, { down: 4, yardsToGo: 3 }, 2, 60);
    expect(dd.turnoverOnDowns).toBe(true);
    expect(dd.firstDown).toBe(false);
    expect(
      nextDownAndDistance(RULES, { down: 4, yardsToGo: 3 }, 3, 60).firstDown,
    ).toBe(true);
  });
});

describe('scrimmageEnd (the only classifier of a play result)', () => {
  it('names every ending from geometry and turnover', () => {
    expect(scrimmageEnd(RULES, 25, 4, null)).toBe('normal');
    expect(scrimmageEnd(RULES, 90, 10, null)).toBe('touchdown');
    expect(scrimmageEnd(RULES, 4, -4, null)).toBe('safety');
    expect(scrimmageEnd(RULES, 50, 3, 'interception')).toBe('turnover');
    expect(scrimmageEnd(RULES, 3, -3, 'fumble')).toBe('defensive_touchdown');
    expect(scrimmageEnd(RULES, 98, 2, 'fumble')).toBe('touchback');
  });
});

describe('applyScrimmageResult', () => {
  it('moves the ball, spends the clock and records bookkeeping', () => {
    const t = applyScrimmageResult(RULES, ORGS, state(), play());
    expect(t.state).toMatchObject({
      possessionOrganizationId: HOME,
      down: 2,
      yardsToGo: 6,
      yardLine: 29,
      clockSecondsRemaining: 870,
      playsResolved: 1,
      drivePlays: 1,
      driveCount: 1,
      nextSnap: 'scrimmage',
    });
    expect(t.state.resolvedCalls).toEqual([
      { offenseConceptKey: 'inside_run', defenseConceptKey: 'zone_shell' },
    ]);
    expect(t.events).toEqual([]);
  });

  it('does not mutate its input', () => {
    const before = state();
    const frozen = JSON.stringify(before);
    applyScrimmageResult(RULES, ORGS, before, play());
    expect(JSON.stringify(before)).toBe(frozen);
  });

  it('awards a first down and resets the distance', () => {
    const t = applyScrimmageResult(
      RULES,
      ORGS,
      state(),
      play({ yardsGained: 12 }),
    );
    expect(t.state).toMatchObject({ down: 1, yardsToGo: 10, yardLine: 37 });
    expect(kinds(t)).toEqual(['first_down']);
  });

  it('caps the distance at the goal line (goal to go)', () => {
    const t = applyScrimmageResult(
      RULES,
      ORGS,
      state({ yardLine: 80, yardsToGo: 10 }),
      play({ yardsGained: 15 }),
    );
    expect(t.state).toMatchObject({ down: 1, yardsToGo: 5, yardLine: 95 });
  });

  it('flips possession on a failed fourth down at the spot', () => {
    const t = applyScrimmageResult(
      RULES,
      ORGS,
      state({ down: 4, yardsToGo: 5, yardLine: 40 }),
      play({ yardsGained: 2 }),
    );
    expect(t.state).toMatchObject({
      possessionOrganizationId: AWAY,
      down: 1,
      yardsToGo: 10,
      yardLine: 58,
      driveCount: 2,
      drivePlays: 0,
      nextSnap: 'scrimmage',
    });
    expect(kinds(t)).toEqual(['turnover_on_downs']);
  });

  it('scores a touchdown and sets up the untimed extra point', () => {
    const t = applyScrimmageResult(
      RULES,
      ORGS,
      state({ yardLine: 90 }),
      play({ yardsGained: 10 }),
    );
    expect(t.state).toMatchObject({
      homeScore: 6,
      awayScore: 0,
      possessionOrganizationId: HOME,
      nextSnap: 'extra_point',
      yardLine: 85,
    });
    expect(kinds(t)).toEqual(['touchdown']);
    expect(t.events[0]).toMatchObject({ organizationId: HOME, points: 6 });
  });

  it('gives the defense a safety and a free kick by the team scored upon', () => {
    const t = applyScrimmageResult(
      RULES,
      ORGS,
      state({ yardLine: 4 }),
      play({ yardsGained: -4 }),
    );
    expect(t.state).toMatchObject({
      awayScore: 2,
      possessionOrganizationId: HOME,
      nextSnap: 'kickoff',
      kickoffKind: 'after_safety',
      yardLine: 20,
    });
    expect(kinds(t)).toEqual(['safety']);
  });

  it('flips on an interception at the spot, first-and-ten for the taker', () => {
    const t = applyScrimmageResult(
      RULES,
      ORGS,
      state({ yardLine: 40 }),
      play({ yardsGained: 0, turnover: 'interception' }),
    );
    expect(t.state).toMatchObject({
      possessionOrganizationId: AWAY,
      yardLine: 60,
      down: 1,
      yardsToGo: 10,
      driveCount: 2,
    });
    expect(kinds(t)).toEqual(['turnover']);
  });

  it('scores for the defense when the ball is lost in the offense end zone', () => {
    const t = applyScrimmageResult(
      RULES,
      ORGS,
      state({ yardLine: 3 }),
      play({ yardsGained: -3, turnover: 'fumble' }),
    );
    expect(t.state).toMatchObject({
      awayScore: 6,
      possessionOrganizationId: AWAY,
      nextSnap: 'extra_point',
    });
    expect(kinds(t)).toEqual(['turnover', 'touchdown']);
  });

  it('is a touchback when the ball is lost in the opponent end zone', () => {
    const t = applyScrimmageResult(
      RULES,
      ORGS,
      state({ yardLine: 98 }),
      play({ yardsGained: 2, turnover: 'fumble' }),
    );
    expect(t.state).toMatchObject({
      possessionOrganizationId: AWAY,
      yardLine: 25,
      nextSnap: 'scrimmage',
    });
    expect(kinds(t)).toEqual(['turnover', 'touchback']);
  });

  it('rejects impossible facts and illegal snaps', () => {
    expect(() =>
      applyScrimmageResult(RULES, ORGS, state(), play({ yardsGained: 80 })),
    ).toThrow(GameStateError);
    expect(() =>
      applyScrimmageResult(RULES, ORGS, state(), play({ yardsGained: -30 })),
    ).toThrow(GameStateError);
    expect(() =>
      applyScrimmageResult(
        RULES,
        ORGS,
        state(),
        play({ clockSecondsUsed: -1 }),
      ),
    ).toThrow(GameStateError);
    expect(() =>
      applyScrimmageResult(RULES, ORGS, state({ nextSnap: 'kickoff' }), play()),
    ).toThrow(GameStateError);
    expect(() =>
      applyScrimmageResult(RULES, ORGS, state({ status: 'final' }), play()),
    ).toThrow(GameStateError);
    expect(() =>
      applyScrimmageResult(
        RULES,
        { homeOrganizationId: HOME, awayOrganizationId: HOME },
        state({ possessionOrganizationId: entityId('stranger') }),
        play(),
      ),
    ).toThrow(GameStateError);
  });
});

describe('scoring and the extra point', () => {
  it('credits each scoring kind its ruleset points and sets the next snap', () => {
    const fg = applyScoringResult(RULES, ORGS, state(), HOME, 'field_goal');
    expect(fg.state).toMatchObject({
      homeScore: 3,
      nextSnap: 'kickoff',
      kickoffKind: 'after_score',
      possessionOrganizationId: HOME,
      yardLine: 35,
    });
    const safety = applyScoringResult(RULES, ORGS, state(), AWAY, 'safety');
    expect(safety.state).toMatchObject({
      awayScore: 2,
      possessionOrganizationId: HOME,
      kickoffKind: 'after_safety',
    });
  });

  it('a made or missed try is followed by a kickoff from the scorer', () => {
    const afterTd = applyScrimmageResult(
      RULES,
      ORGS,
      state({ yardLine: 90 }),
      play({ yardsGained: 10 }),
    ).state;
    const good = applyExtraPointResult(RULES, ORGS, afterTd, {
      good: true,
      clockSecondsUsed: 3,
    });
    expect(good.state).toMatchObject({
      homeScore: 7,
      nextSnap: 'kickoff',
      kickoffKind: 'after_score',
      possessionOrganizationId: HOME,
      playsResolved: 2,
    });
    expect(kinds(good)).toEqual(['extra_point_good']);
    const missed = applyExtraPointResult(RULES, ORGS, afterTd, {
      good: false,
      clockSecondsUsed: 3,
    });
    expect(missed.state.homeScore).toBe(6);
    expect(missed.state.nextSnap).toBe('kickoff');
    expect(kinds(missed)).toEqual(['extra_point_missed']);
  });

  it('only runs on an extra-point snap', () => {
    expect(() =>
      applyExtraPointResult(RULES, ORGS, state(), {
        good: true,
        clockSecondsUsed: 0,
      }),
    ).toThrow(GameStateError);
  });
});

describe('kickoffs, punts and field goals', () => {
  const kickoff = state({
    possessionOrganizationId: AWAY,
    nextSnap: 'kickoff',
    kickoffKind: 'opening',
    yardLine: 35,
    openingReceiverOrganizationId: HOME,
    driveCount: 0,
  });

  it('a kickoff return starts the receiving drive at the return spot', () => {
    const t = applyKickoffResult(RULES, ORGS, kickoff, {
      landingYardLine: 97,
      returnYards: 22,
      clockSecondsUsed: 8,
    });
    // Caught at the receiver's 3, returned 22 yards.
    expect(t.state).toMatchObject({
      possessionOrganizationId: HOME,
      yardLine: 25,
      down: 1,
      yardsToGo: 10,
      nextSnap: 'scrimmage',
      kickoffKind: null,
      driveCount: 1,
      playsResolved: 1,
      clockSecondsRemaining: 892,
    });
    expect(kinds(t)).toEqual(['kickoff']);
  });

  it('a kick into the end zone is a touchback at the touchback line', () => {
    const t = applyKickoffResult(RULES, ORGS, kickoff, {
      landingYardLine: 104,
      returnYards: 0,
      clockSecondsUsed: 6,
    });
    expect(t.state).toMatchObject({
      possessionOrganizationId: HOME,
      yardLine: 25,
    });
    expect(kinds(t)).toEqual(['kickoff', 'touchback']);
  });

  it('a kickoff returned the length of the field is a touchdown', () => {
    const t = applyKickoffResult(RULES, ORGS, kickoff, {
      landingYardLine: 95,
      returnYards: 95,
      clockSecondsUsed: 11,
    });
    expect(t.state).toMatchObject({
      homeScore: 6,
      nextSnap: 'extra_point',
      possessionOrganizationId: HOME,
    });
    expect(kinds(t)).toEqual(['kickoff', 'touchdown']);
  });

  it('a punt changes possession at the return spot and counts as a drive play', () => {
    const t = applyPuntResult(
      RULES,
      ORGS,
      state({ down: 4, yardsToGo: 8, yardLine: 30 }),
      { landingYardLine: 74, returnYards: 9, clockSecondsUsed: 10 },
    );
    expect(t.state).toMatchObject({
      possessionOrganizationId: AWAY,
      yardLine: 35,
      down: 1,
      driveCount: 2,
      drivePlays: 0,
      playsResolved: 1,
    });
    expect(kinds(t)).toEqual(['punt']);
  });

  it('a made field goal scores and gives the opponent the kickoff', () => {
    const t = applyFieldGoalResult(
      RULES,
      ORGS,
      state({ down: 4, yardLine: 70 }),
      {
        good: true,
        clockSecondsUsed: 6,
      },
    );
    expect(t.state).toMatchObject({
      homeScore: 3,
      nextSnap: 'kickoff',
      possessionOrganizationId: HOME,
      kickoffKind: 'after_score',
    });
    expect(kinds(t)).toEqual(['field_goal_good']);
  });

  it('a missed field goal gives the opponent the ball at the spot, not inside the touchback line', () => {
    const far = applyFieldGoalResult(
      RULES,
      ORGS,
      state({ down: 4, yardLine: 60 }),
      {
        good: false,
        clockSecondsUsed: 6,
      },
    );
    expect(far.state).toMatchObject({
      possessionOrganizationId: AWAY,
      yardLine: 40,
      homeScore: 0,
    });
    const close = applyFieldGoalResult(
      RULES,
      ORGS,
      state({ down: 4, yardLine: 92 }),
      {
        good: false,
        clockSecondsUsed: 6,
      },
    );
    expect(close.state.yardLine).toBe(25);
    expect(kinds(close)).toEqual(['field_goal_missed']);
  });
});

describe('periods, halves, overtime and game end', () => {
  const nearEnd = (over: Partial<GameState>): GameState =>
    state({ clockSecondsRemaining: 20, ...over });

  it('rolls a quarter without changing the ball, down or distance', () => {
    const t = applyScrimmageResult(RULES, ORGS, nearEnd({}), play());
    expect(t.state).toMatchObject({
      period: 2,
      clockSecondsRemaining: 900,
      down: 2,
      yardsToGo: 6,
      yardLine: 29,
      possessionOrganizationId: HOME,
    });
    expect(kinds(t)).toEqual(['period_end']);
  });

  it('halftime resets timeouts and gives the second-half kickoff to the first kicker', () => {
    const t = applyScrimmageResult(
      RULES,
      ORGS,
      nearEnd({
        period: 2,
        homeTimeoutsRemaining: 0,
        awayTimeoutsRemaining: 1,
      }),
      play(),
    );
    expect(t.state).toMatchObject({
      period: 3,
      clockSecondsRemaining: 900,
      nextSnap: 'kickoff',
      kickoffKind: 'second_half',
      // AWAY received the opening kickoff, so AWAY kicks to start the second half.
      possessionOrganizationId: AWAY,
      homeTimeoutsRemaining: 3,
      awayTimeoutsRemaining: 3,
    });
    expect(kinds(t)).toEqual(['period_end', 'half_end']);
  });

  it('does not end a period during an untimed extra point', () => {
    const td = applyScrimmageResult(
      RULES,
      ORGS,
      nearEnd({ yardLine: 90 }),
      play({ yardsGained: 10, clockSecondsUsed: 30 }),
    );
    expect(td.state.clockSecondsRemaining).toBe(0);
    expect(td.state.period).toBe(1);
    expect(td.state.nextSnap).toBe('extra_point');
    const xp = applyExtraPointResult(RULES, ORGS, td.state, {
      good: true,
      clockSecondsUsed: 0,
    });
    expect(xp.state.period).toBe(2);
    expect(xp.state.clockSecondsRemaining).toBe(900);
    expect(xp.state.nextSnap).toBe('kickoff');
    expect(kinds(xp)).toEqual(['extra_point_good', 'period_end']);
  });

  it('ends the game at the end of regulation for the team that leads', () => {
    const t = applyScrimmageResult(
      RULES,
      ORGS,
      nearEnd({ period: 4, homeScore: 10, awayScore: 3 }),
      play(),
    );
    expect(t.state.status).toBe('final');
    expect(kinds(t)).toEqual(['period_end', 'game_end']);
    expect(t.events[1]).toMatchObject({ organizationId: HOME });
    expect(() => applyScrimmageResult(RULES, ORGS, t.state, play())).toThrow(
      GameStateError,
    );
  });

  it('plays a full overtime period after a tie, kicked off by the opening receiver', () => {
    const t = applyScrimmageResult(
      RULES,
      ORGS,
      nearEnd({ period: 4, homeScore: 7, awayScore: 7 }),
      play(),
    );
    expect(t.state).toMatchObject({
      status: 'in_progress',
      period: 5,
      clockSecondsRemaining: 600,
      nextSnap: 'kickoff',
      kickoffKind: 'overtime',
      possessionOrganizationId: AWAY,
    });
    expect(kinds(t)).toEqual(['period_end', 'overtime_start']);
  });

  it('ends tied after overtime when the ruleset allows a tie', () => {
    const t = applyScrimmageResult(
      RULES,
      ORGS,
      nearEnd({ period: 5, homeScore: 7, awayScore: 7 }),
      play(),
    );
    expect(t.state.status).toBe('final');
    expect(t.events.at(-1)).toMatchObject({
      kind: 'game_end',
      organizationId: null,
    });
  });

  it('plays another overtime period, alternating the kicker, when ties are not allowed', () => {
    const noTies: FootballRulesV1 = {
      ...RULES,
      clock: { ...RULES.clock, tieAllowedAfterOvertime: false },
    };
    const t = applyScrimmageResult(
      noTies,
      ORGS,
      nearEnd({ period: 5, homeScore: 7, awayScore: 7 }),
      play(),
    );
    expect(t.state).toMatchObject({
      status: 'in_progress',
      period: 6,
      kickoffKind: 'overtime',
      possessionOrganizationId: HOME,
    });
    const decided = applyScrimmageResult(
      noTies,
      ORGS,
      nearEnd({ period: 6, homeScore: 7, awayScore: 10 }),
      play(),
    );
    expect(decided.state.status).toBe('final');
  });

  it('starts from the opening kickoff with a full first quarter', () => {
    const s = createInitialGameState(RULES, ORGS, recordId('fixture-1'), AWAY);
    expect(s).toMatchObject({
      possessionOrganizationId: HOME,
      openingReceiverOrganizationId: AWAY,
      nextSnap: 'kickoff',
      kickoffKind: 'opening',
      period: 1,
      clockSecondsRemaining: 900,
      yardLine: 35,
      homeScore: 0,
      awayScore: 0,
      homeTimeoutsRemaining: 3,
      status: 'in_progress',
    });
  });
});

describe('usage counters', () => {
  it('accumulate workload per player in canonical player order', () => {
    const a = entityId('player-b');
    const b = entityId('player-a');
    const once = accumulateWorkload(state(), [
      { playerId: a, workloadUnits: 3 },
      { playerId: b, workloadUnits: 2 },
    ]);
    const twice = accumulateWorkload(once, [{ playerId: a, workloadUnits: 4 }]);
    expect(twice.workloadByPlayer).toEqual([
      { playerId: b, workloadUnits: 2 },
      { playerId: a, workloadUnits: 7 },
    ]);
    expect(once.workloadByPlayer).toEqual([
      { playerId: b, workloadUnits: 2 },
      { playerId: a, workloadUnits: 3 },
    ]);
    expect(() =>
      accumulateWorkload(state(), [{ playerId: a, workloadUnits: -1 }]),
    ).toThrow(GameStateError);
  });
});

describe('reconciliation sweep over every represented scrimmage result', () => {
  it('never leaves an impossible down, distance, spot, clock or score', () => {
    let seed = 12345;
    const next = (n: number): number => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return seed % n;
    };
    for (let i = 0; i < 3000; i++) {
      const yardLine = 1 + next(99);
      const down = 1 + next(4);
      const yardsToGo = 1 + next(Math.min(20, 100 - yardLine));
      const before = state({
        yardLine,
        down,
        yardsToGo,
        clockSecondsRemaining: next(3) === 0 ? 20 : 400,
        period: 1 + next(4),
        homeScore: next(20),
        awayScore: next(20),
      });
      const yardsGained = next(100 + 1) - yardLine;
      const turnover = ([null, null, 'interception', 'fumble'] as const)[
        next(4)
      ]!;
      const t = applyScrimmageResult(
        RULES,
        ORGS,
        before,
        play({ yardsGained, turnover, clockSecondsUsed: next(41) }),
      );
      const s = t.state;
      expect(s.clockSecondsRemaining).toBeGreaterThanOrEqual(0);
      expect(s.homeScore).toBeGreaterThanOrEqual(before.homeScore);
      expect(s.awayScore).toBeGreaterThanOrEqual(before.awayScore);
      expect(s.playsResolved).toBe(1);
      if (s.status === 'final') continue;
      if (s.nextSnap === 'scrimmage') {
        expect(s.down).toBeGreaterThanOrEqual(1);
        expect(s.down).toBeLessThanOrEqual(4);
        expect(s.yardsToGo).toBeGreaterThanOrEqual(1);
        expect(s.yardLine).toBeGreaterThanOrEqual(1);
        expect(s.yardLine).toBeLessThan(100);
        if (s.down === 1)
          expect(s.yardsToGo).toBe(Math.min(10, 100 - s.yardLine));
      }
      if (s.nextSnap === 'extra_point') {
        expect(s.yardLine).toBe(85);
        expect([
          s.homeScore - before.homeScore,
          s.awayScore - before.awayScore,
        ]).toContain(6);
      }
      if (s.nextSnap === 'kickoff') expect(s.kickoffKind).not.toBeNull();
      else expect(s.kickoffKind).toBeNull();
    }
  });
});
