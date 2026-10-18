import { describe, expect, it } from 'vitest';
import {
  GameStateError,
  SYNTHETIC_FOOTBALL_RULES,
  applyPenaltyResult,
  entityId,
  recordId,
  type GameOrganizations,
  type GameState,
  type PenaltyFact,
  type ScrimmageResultFact,
} from '../src/index';

const RULES = SYNTHETIC_FOOTBALL_RULES;
const HOME = entityId('home-club');
const AWAY = entityId('away-club');
const ORGS: GameOrganizations = {
  homeOrganizationId: HOME,
  awayOrganizationId: AWAY,
};

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

/** The ruleset's own penalty, charged to the right organization for `before`'s possession. */
const rulePenalty = (penaltyKey: string): PenaltyFact => {
  const r = RULES.penalties.find((p) => p.penaltyKey === penaltyKey)!;
  return {
    penaltyKey: r.penaltyKey,
    against: r.against as 'offense' | 'defense',
    againstOrganizationId: r.against === 'offense' ? HOME : AWAY,
    yards: r.yards,
    automaticFirstDown: r.automaticFirstDown,
    lossOfDown: r.lossOfDown,
    enforcement: r.enforcement,
  };
};

const custom = (over: Partial<PenaltyFact>): PenaltyFact => ({
  ...rulePenalty('offensive_holding'),
  ...over,
});

const kinds = (t: { events: readonly { kind: string }[] }): string[] =>
  t.events.map((e) => e.kind);

describe('dead-ball fouls (always enforced; the play never happened)', () => {
  it('moves an offensive false start back from the previous spot without spending time', () => {
    const t = applyPenaltyResult(
      RULES,
      ORGS,
      state(),
      play({ yardsGained: 20 }),
      rulePenalty('false_start'),
    );
    expect(t.accepted).toBe(true);
    expect(t.state).toMatchObject({
      yardLine: 20,
      down: 1,
      yardsToGo: 15,
      clockSecondsRemaining: 900,
      playsResolved: 1,
      drivePlays: 0,
      possessionOrganizationId: HOME,
    });
    expect(t.state.resolvedCalls).toHaveLength(1);
    expect(kinds(t)).toEqual(['penalty_accepted']);
  });

  it('erases even a touchdown when the defense was offside', () => {
    const t = applyPenaltyResult(
      RULES,
      ORGS,
      state({ yardLine: 90 }),
      play({ yardsGained: 10 }),
      rulePenalty('offside_defense'),
    );
    expect(t.accepted).toBe(true);
    expect(t.state).toMatchObject({
      homeScore: 0,
      nextSnap: 'scrimmage',
      yardLine: 95,
      down: 1,
      yardsToGo: 5,
    });
  });

  it('a short-distance dead-ball foul by the defense can be a first down', () => {
    const t = applyPenaltyResult(
      RULES,
      ORGS,
      state({ down: 3, yardsToGo: 4, yardLine: 40 }),
      play({ yardsGained: 0 }),
      rulePenalty('offside_defense'),
    );
    expect(t.state).toMatchObject({ down: 1, yardsToGo: 10, yardLine: 45 });
    expect(kinds(t)).toEqual(['penalty_accepted', 'first_down']);
  });
});

describe('previous-spot fouls (accepted or declined by the fouled team)', () => {
  it('caps yardage at half the distance to the goal line', () => {
    const t = applyPenaltyResult(
      RULES,
      ORGS,
      state({ yardLine: 6 }),
      play({ yardsGained: 20 }),
      rulePenalty('offensive_holding'),
    );
    expect(t.accepted).toBe(true);
    expect(t.state).toMatchObject({ yardLine: 3, down: 1, yardsToGo: 13 });
    expect(t.state.clockSecondsRemaining).toBe(870);
  });

  it('is accepted by the defense when it erases a good offensive play', () => {
    const t = applyPenaltyResult(
      RULES,
      ORGS,
      state(),
      play({ yardsGained: 20 }),
      rulePenalty('offensive_holding'),
    );
    expect(t.accepted).toBe(true);
    expect(t.state).toMatchObject({ yardLine: 15, down: 1, yardsToGo: 20 });
    expect(t.state.drivePlays).toBe(0);
  });

  it('is declined by the defense when it already took the ball away', () => {
    const t = applyPenaltyResult(
      RULES,
      ORGS,
      state(),
      play({ yardsGained: 0, turnover: 'interception' }),
      rulePenalty('offensive_holding'),
    );
    expect(t.accepted).toBe(false);
    expect(t.state.possessionOrganizationId).toBe(AWAY);
    expect(kinds(t)).toEqual(['penalty_declined', 'turnover']);
  });

  it('is accepted by the offense when the defense foul erases a turnover', () => {
    const t = applyPenaltyResult(
      RULES,
      ORGS,
      state(),
      play({ yardsGained: 0, turnover: 'interception' }),
      rulePenalty('pass_interference_defense'),
    );
    expect(t.accepted).toBe(true);
    expect(t.state).toMatchObject({
      possessionOrganizationId: HOME,
      yardLine: 40,
      down: 1,
      yardsToGo: 10,
    });
    expect(kinds(t)).toEqual(['penalty_accepted', 'first_down']);
  });
});

describe('spot fouls', () => {
  it('is enforced from the end of a normal play and uses the down', () => {
    const t = applyPenaltyResult(
      RULES,
      ORGS,
      state(),
      play({ yardsGained: 3 }),
      rulePenalty('defensive_holding'),
    );
    expect(t.accepted).toBe(true);
    expect(t.state).toMatchObject({ yardLine: 33, down: 1, yardsToGo: 10 });
    expect(t.state.drivePlays).toBe(1);
    expect(t.state.clockSecondsRemaining).toBe(870);
  });

  it('without an automatic first down it only helps when it gains more than the play', () => {
    const spot5 = custom({
      against: 'defense',
      againstOrganizationId: AWAY,
      enforcement: 'spot',
      yards: 5,
    });
    const short = applyPenaltyResult(
      RULES,
      ORGS,
      state(),
      play({ yardsGained: 2 }),
      spot5,
    );
    expect(short.accepted).toBe(true);
    expect(short.state).toMatchObject({ yardLine: 32, down: 2, yardsToGo: 3 });
    const reaches = applyPenaltyResult(
      RULES,
      ORGS,
      state({ down: 2, yardsToGo: 5, yardLine: 30 }),
      play({ yardsGained: 3 }),
      spot5,
    );
    expect(reaches.state).toMatchObject({
      yardLine: 38,
      down: 1,
      yardsToGo: 10,
    });
    expect(kinds(reaches)).toEqual(['penalty_accepted', 'first_down']);
  });

  it('is declined by the offense when the play scored a touchdown', () => {
    const t = applyPenaltyResult(
      RULES,
      ORGS,
      state({ yardLine: 90 }),
      play({ yardsGained: 10 }),
      rulePenalty('defensive_holding'),
    );
    expect(t.accepted).toBe(false);
    expect(t.state).toMatchObject({ homeScore: 6, nextSnap: 'extra_point' });
    expect(kinds(t)).toEqual(['penalty_declined', 'touchdown']);
  });

  it('adds its yardage to a play that already gained a first down', () => {
    const t = applyPenaltyResult(
      RULES,
      ORGS,
      state(),
      play({ yardsGained: 30 }),
      rulePenalty('defensive_holding'),
    );
    expect(t.accepted).toBe(true);
    expect(t.state).toMatchObject({ yardLine: 60, down: 1, yardsToGo: 10 });
  });

  it('caps spot yardage at half the distance to the goal line', () => {
    const t = applyPenaltyResult(
      RULES,
      ORGS,
      state({ yardLine: 80 }),
      play({ yardsGained: 15 }),
      rulePenalty('pass_interference_defense'),
    );
    // Anchor 95, 5 yards to the goal, so half is 2.
    expect(t.state).toMatchObject({ yardLine: 97, down: 1, yardsToGo: 3 });
  });
});

describe('loss of down and turnover on downs', () => {
  it('a loss-of-down foul on fourth down turns the ball over', () => {
    const t = applyPenaltyResult(
      RULES,
      ORGS,
      state({ down: 4, yardsToGo: 10 }),
      play({ yardsGained: 11 }),
      custom({ yards: 5, lossOfDown: true }),
    );
    expect(t.accepted).toBe(true);
    expect(t.state).toMatchObject({
      possessionOrganizationId: AWAY,
      yardLine: 80,
      down: 1,
    });
    expect(kinds(t)).toEqual(['penalty_accepted', 'turnover_on_downs']);
  });

  it('keeps the play when both results are equally bad for the fouled team', () => {
    const t = applyPenaltyResult(
      RULES,
      ORGS,
      state({ down: 4, yardsToGo: 10 }),
      play({ yardsGained: 2 }),
      custom({ yards: 5, lossOfDown: true }),
    );
    expect(t.accepted).toBe(false);
    expect(t.state.yardLine).toBe(73);
    expect(kinds(t)).toEqual(['penalty_declined', 'turnover_on_downs']);
  });
});

describe('time', () => {
  it('rolls the period when an accepted live-ball foul play runs the clock out', () => {
    const t = applyPenaltyResult(
      RULES,
      ORGS,
      state({ clockSecondsRemaining: 20 }),
      play({ yardsGained: 20 }),
      rulePenalty('offensive_holding'),
    );
    expect(t.state.period).toBe(2);
    expect(kinds(t)).toEqual(['penalty_accepted', 'period_end']);
  });

  it('a dead-ball foul spends no time, so the period does not roll', () => {
    const t = applyPenaltyResult(
      RULES,
      ORGS,
      state({ clockSecondsRemaining: 20 }),
      play({ yardsGained: 20 }),
      rulePenalty('false_start'),
    );
    expect(t.state.period).toBe(1);
    expect(t.state.clockSecondsRemaining).toBe(20);
  });
});

describe('validation', () => {
  it('rejects a foul charged to the wrong organization or an unrepresented side', () => {
    expect(() =>
      applyPenaltyResult(
        RULES,
        ORGS,
        state(),
        play(),
        custom({ againstOrganizationId: AWAY }),
      ),
    ).toThrow(GameStateError);
    expect(() =>
      applyPenaltyResult(
        RULES,
        ORGS,
        state(),
        play(),
        custom({ against: 'kicking' as unknown as 'offense' }),
      ),
    ).toThrow(GameStateError);
    expect(() =>
      applyPenaltyResult(RULES, ORGS, state(), play(), custom({ yards: -5 })),
    ).toThrow(GameStateError);
    expect(() =>
      applyPenaltyResult(
        RULES,
        ORGS,
        state(),
        play(),
        custom({ enforcement: 'whenever' as unknown as 'spot' }),
      ),
    ).toThrow(GameStateError);
    expect(() =>
      applyPenaltyResult(
        RULES,
        ORGS,
        state({ nextSnap: 'kickoff' }),
        play(),
        rulePenalty('false_start'),
      ),
    ).toThrow(GameStateError);
  });
});

describe('reconciliation sweep over every represented foul', () => {
  it('never leaves an impossible state and never scores on an accepted foul', () => {
    let seed = 987;
    const next = (n: number): number => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return seed % n;
    };
    for (let i = 0; i < 3000; i++) {
      const yardLine = 1 + next(99);
      const before = state({
        yardLine,
        down: 1 + next(4),
        yardsToGo: 1 + next(Math.min(20, 100 - yardLine)),
        clockSecondsRemaining: next(3) === 0 ? 20 : 400,
        period: 1 + next(3),
      });
      const yardsGained = next(101) - yardLine;
      const turnover = ([null, null, 'interception', 'fumble'] as const)[
        next(4)
      ]!;
      const penalty = rulePenalty(
        RULES.penalties[next(RULES.penalties.length)]!.penaltyKey,
      );
      const t = applyPenaltyResult(
        RULES,
        ORGS,
        before,
        play({ yardsGained, turnover, clockSecondsUsed: next(41) }),
        penalty,
      );
      const s = t.state;
      const accepted = kinds(t).includes('penalty_accepted');
      const declined = kinds(t).includes('penalty_declined');
      expect(accepted).toBe(t.accepted);
      expect(declined).toBe(!t.accepted);
      expect(s.playsResolved).toBe(1);
      expect(s.clockSecondsRemaining).toBeGreaterThanOrEqual(0);
      if (t.accepted) {
        expect(s.homeScore).toBe(before.homeScore);
        expect(s.awayScore).toBe(before.awayScore);
      }
      if (penalty.enforcement === 'dead_ball')
        expect(s.clockSecondsRemaining).toBe(before.clockSecondsRemaining);
      if (s.status !== 'final' && s.nextSnap === 'scrimmage') {
        expect(s.down).toBeGreaterThanOrEqual(1);
        expect(s.down).toBeLessThanOrEqual(4);
        expect(s.yardsToGo).toBeGreaterThanOrEqual(1);
        expect(s.yardLine).toBeGreaterThanOrEqual(1);
        expect(s.yardLine).toBeLessThan(100);
      }
    }
  });
});
