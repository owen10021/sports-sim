import { describe, expect, it } from 'vitest';
import {
  FootballSelectionError,
  MissingFootballRulesError,
  buildDefensiveSelectionView,
  buildOffensiveSelectionView,
  entityId,
  recordId,
  selectDefensiveCall,
  selectOffensiveCall,
  type DefensiveSelectionView,
  type FootballWorld,
  type OffensiveSelectionView,
} from '../src/index';
import { E_FIXTURE_1, NF, nf, sp } from './support/packageEHarness';
import {
  RULESET,
  fixtureOrgs,
  planFor,
  selectionWorld,
  situationFor,
  spreadRolls,
} from './support/footballSelectionHarness';

const world = selectionWorld();
const { home, away } = fixtureOrgs(world);
const playerOf = (org: string) => (org === NF.org ? nf : sp);

const offense = (w: FootballWorld = world, over = {}) =>
  buildOffensiveSelectionView(
    w,
    RULESET,
    E_FIXTURE_1,
    situationFor(home, over),
  );
const defense = (w: FootballWorld = world, over = {}) =>
  buildDefensiveSelectionView(
    w,
    RULESET,
    E_FIXTURE_1,
    situationFor(home, over),
  );

describe('selection views', () => {
  it('give each side only its own club, plan and designated players', () => {
    const o = offense();
    const d = defense();
    expect(o.side).toBe('offense');
    expect(d.side).toBe('defense');
    expect(o.organizationId).toBe(home);
    expect(d.organizationId).toBe(away);
    expect(o.gamePlan.gamePlanId).toBe(`gameplan-${home}`);
    expect(d.gamePlan.gamePlanId).toBe(`gameplan-${away}`);
    const own = playerOf(home);
    const ids = new Set(Array.from({ length: 34 }, (_, i) => own(i + 1)));
    expect(o.participants).toHaveLength(17);
    o.participants.forEach((p) => expect(ids.has(p.playerId)).toBe(true));
    expect(d.participants).toHaveLength(15);
    expect(
      d.participants.every((p) =>
        p.playerId.startsWith(`player-${away === NF.org ? 'nf' : 'sp'}`),
      ),
    ).toBe(true);
  });

  it('list only fieldable formations and plan concepts of their own side', () => {
    const o = offense();
    expect(o.formations.map((f) => f.formationKey)).toEqual([
      'single_back_11',
      'two_back_21',
      'two_tight_12',
    ]);
    expect(o.concepts.map((c) => c.conceptKey)).toEqual([
      'deep_pass',
      'inside_run',
      'outside_run',
      'quick_pass',
    ]);
    const d = defense();
    expect(d.formations.map((f) => f.formationKey)).toEqual([
      'four_three_base',
      'nickel_425',
    ]);
    expect(d.concepts.map((c) => c.conceptKey)).toEqual([
      'man_press',
      'run_commit_front',
      'zone_shell',
    ]);
    expect(
      d.concepts.find((c) => c.conceptKey === 'run_commit_front')!
        .formationKeys,
    ).toEqual(['four_three_base']);
  });

  it('drop formations the designated players cannot fill', () => {
    const noThirdCorner: FootballWorld = {
      ...world,
      football: {
        ...world.football,
        designations: world.football.designations.filter(
          (x) =>
            !(
              x.organizationId === away &&
              x.roleKey === 'cornerback' &&
              x.depthOrder === 3
            ),
        ),
      },
    };
    const d = defense(noThirdCorner);
    expect(d.formations.map((f) => f.formationKey)).toEqual([
      'four_three_base',
    ]);
    expect(d.concepts.map((c) => c.conceptKey)).toEqual([
      'man_press',
      'run_commit_front',
      'zone_shell',
    ]);
  });

  it('ignore inactive designations and other units', () => {
    const w: FootballWorld = {
      ...world,
      football: {
        ...world.football,
        designations: world.football.designations.map((x) =>
          x.organizationId === home && x.roleKey === 'quarterback'
            ? {
                ...x,
                status: 'inactive' as const,
                unitKey: null,
                roleKey: null,
                depthOrder: null,
              }
            : x,
        ),
      },
    };
    const o = offense(w);
    expect(o.participants.some((p) => p.roleKey === 'quarterback')).toBe(false);
    expect(o.formations).toEqual([]);
    expect(() =>
      selectOffensiveCall(o, { conceptRoll: 1, formationRoll: 1 }),
    ).toThrow(FootballSelectionError);
  });

  it('copy the scoreboard from the selecting side and never keep the input object', () => {
    const state = situationFor(home, {
      homeScore: 17,
      awayScore: 10,
      homeTimeoutsRemaining: 2,
      awayTimeoutsRemaining: 1,
      down: 3,
      yardsToGo: 4,
      yardLine: 61,
      period: 4,
      clockSecondsRemaining: 95,
    });
    const o = buildOffensiveSelectionView(world, RULESET, E_FIXTURE_1, state);
    const d = buildDefensiveSelectionView(world, RULESET, E_FIXTURE_1, state);
    expect(o.situation).toEqual({
      period: 4,
      clockSecondsRemaining: 95,
      down: 3,
      yardsToGo: 4,
      offenseYardLine: 61,
      scoreDifferential: 7,
      timeoutsRemaining: 2,
    });
    expect(d.situation.scoreDifferential).toBe(-7);
    expect(d.situation.timeoutsRemaining).toBe(1);
    expect(
      Object.values(o as unknown as Record<string, unknown>),
    ).not.toContain(state);
  });

  it('copy the plan constraints so later edits to the world cannot reach the view', () => {
    const o = offense();
    const plan = world.football.gamePlans.find(
      (p) => p.organizationId === home,
    )!;
    expect(o.gamePlan.constraints).toEqual(plan.constraints);
    expect(o.gamePlan.constraints).not.toBe(plan.constraints);
  });

  it('are deterministic for identical inputs', () => {
    expect(JSON.stringify(offense())).toBe(JSON.stringify(offense()));
    expect(JSON.stringify(defense())).toBe(JSON.stringify(defense()));
  });

  it('count observed opponent concepts from plays already resolved', () => {
    const resolvedCalls = [
      { offenseConceptKey: 'inside_run', defenseConceptKey: 'zone_shell' },
      { offenseConceptKey: 'inside_run', defenseConceptKey: 'man_press' },
      { offenseConceptKey: 'quick_pass', defenseConceptKey: 'zone_shell' },
    ];
    expect(offense(world, { resolvedCalls }).observedDefensiveConcepts).toEqual(
      [
        { conceptKey: 'man_press', count: 1 },
        { conceptKey: 'zone_shell', count: 2 },
      ],
    );
    expect(defense(world, { resolvedCalls }).observedOffensiveConcepts).toEqual(
      [
        { conceptKey: 'inside_run', count: 2 },
        { conceptKey: 'quick_pass', count: 1 },
      ],
    );
  });
});

describe('selection fails closed before any roll is used', () => {
  const build =
    (w: FootballWorld, state = situationFor(home)) =>
    () =>
      buildOffensiveSelectionView(w, RULESET, E_FIXTURE_1, state);

  it('rejects unknown, final or foreign fixtures and possession', () => {
    expect(() =>
      buildOffensiveSelectionView(
        world,
        RULESET,
        'fixture-nope',
        situationFor(home),
      ),
    ).toThrow(/unknown fixture/);
    const final: FootballWorld = {
      ...world,
      football: {
        ...world.football,
        fixtures: world.football.fixtures.map((f) =>
          f.id === E_FIXTURE_1
            ? {
                ...f,
                status: 'final' as const,
                finalGameId: recordId('game-1'),
              }
            : f,
        ),
      },
    };
    expect(build(final)).toThrow(/already final/);
    expect(build(world, situationFor(entityId('org-elsewhere')))).toThrow(
      /does not play/,
    );
  });

  it('rejects a missing or duplicated game plan', () => {
    const none: FootballWorld = {
      ...world,
      football: {
        ...world.football,
        gamePlans: world.football.gamePlans.filter(
          (p) => p.organizationId !== home,
        ),
      },
    };
    expect(build(none)).toThrow(/exactly one committed game plan/);
    const twice: FootballWorld = {
      ...world,
      football: {
        ...world.football,
        gamePlans: [
          ...world.football.gamePlans,
          { ...planFor(home), id: recordId('gameplan-dup') },
        ],
      },
    };
    expect(build(twice)).toThrow(/exactly one committed game plan/);
  });

  it('rejects malformed situations and unknown observed concepts', () => {
    for (const over of [
      { down: 0 },
      { down: 5 },
      { down: 1.5 },
      { yardsToGo: -1 },
      { yardLine: 101 },
      { clockSecondsRemaining: Number.NaN },
      { homeScore: 1.2 },
    ])
      expect(build(world, situationFor(home, over))).toThrow(
        FootballSelectionError,
      );
    expect(
      build(
        world,
        situationFor(home, {
          resolvedCalls: [
            {
              offenseConceptKey: 'zone_shell',
              defenseConceptKey: 'zone_shell',
            },
          ],
        }),
      ),
    ).toThrow(/unknown offensive concept/);
    expect(
      build(
        world,
        situationFor(home, {
          resolvedCalls: [
            { offenseConceptKey: 'inside_run', defenseConceptKey: 'nope' },
          ],
        }),
      ),
    ).toThrow(/unknown defensive concept/);
  });

  it('rejects a ruleset without football rules', () => {
    expect(() =>
      buildOffensiveSelectionView(
        world,
        { rulesetId: 'no-football', rules: {} } as never,
        E_FIXTURE_1,
        situationFor(home),
      ),
    ).toThrow(MissingFootballRulesError);
  });

  it('rejects invalid rolls and the wrong side of view', () => {
    const o = offense();
    const d = defense();
    for (const bad of [-1, 1.5, 2 ** 32, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() =>
        selectOffensiveCall(o, { conceptRoll: bad, formationRoll: 0 }),
      ).toThrow(/32-bit/);
    expect(() =>
      selectOffensiveCall(o, { conceptRoll: 0, formationRoll: -1 }),
    ).toThrow(/32-bit/);
    expect(() =>
      selectOffensiveCall(d as unknown as OffensiveSelectionView, {
        conceptRoll: 0,
        formationRoll: 0,
      }),
    ).toThrow(/offensive selection view/);
    expect(() =>
      selectDefensiveCall(o as unknown as DefensiveSelectionView, {
        conceptRoll: 0,
        formationRoll: 0,
      }),
    ).toThrow(/defensive selection view/);
  });
});

describe('selectors', () => {
  const rolls = spreadRolls(1500);

  it('are pure functions of the view and the explicit rolls', () => {
    const o = offense();
    const before = JSON.stringify(o);
    const a = selectOffensiveCall(o, { conceptRoll: 777, formationRoll: 4242 });
    const b = selectOffensiveCall(o, { conceptRoll: 777, formationRoll: 4242 });
    expect(a).toEqual(b);
    expect(JSON.stringify(o)).toBe(before);
    expect(selectOffensiveCall.length).toBe(2);
    expect(selectDefensiveCall.length).toBe(2);
  });

  it('pick identically from a view whose lists arrive in any order', () => {
    const o = offense();
    const shuffled: OffensiveSelectionView = {
      ...o,
      concepts: [...o.concepts].reverse(),
      formations: [...o.formations].reverse(),
      participants: [...o.participants].reverse(),
    };
    rolls.slice(0, 100).forEach((r) =>
      expect(
        selectOffensiveCall(shuffled, {
          conceptRoll: r,
          formationRoll: r >>> 2,
        }),
      ).toEqual(
        selectOffensiveCall(o, { conceptRoll: r, formationRoll: r >>> 2 }),
      ),
    );
  });

  it('fill every slot with distinct designated players in depth order', () => {
    const o = offense();
    rolls.slice(0, 200).forEach((r) => {
      const call = selectOffensiveCall(o, {
        conceptRoll: r,
        formationRoll: r >>> 3,
      });
      const formation = o.formations.find(
        (f) => f.formationKey === call.formationKey,
      )!;
      expect(call.lineup.map((s) => s.slotKey)).toEqual(
        formation.slots.map((s) => s.slotKey),
      );
      expect(new Set(call.lineup.map((s) => s.playerId)).size).toBe(
        formation.slots.length,
      );
      const qb = call.lineup.find((s) => s.slotKey === 'qb')!;
      expect(qb.playerId).toBe(playerOf(home)(1));
      expect(call.personnelKey).toBe(formation.personnelKey);
      expect(call.organizationId).toBe(home);
    });
  });

  it('use the next player in depth order when the first choice is not designated', () => {
    const w: FootballWorld = {
      ...world,
      football: {
        ...world.football,
        designations: world.football.designations.filter(
          (x) =>
            !(
              x.organizationId === home &&
              x.roleKey === 'quarterback' &&
              x.depthOrder === 1
            ),
        ),
      },
    };
    const call = selectOffensiveCall(offense(w), {
      conceptRoll: 5,
      formationRoll: 5,
    });
    expect(call.lineup.find((s) => s.slotKey === 'qb')!.playerId).toBe(
      playerOf(home)(2),
    );
  });

  const share = (picks: readonly string[], keys: readonly string[]) =>
    picks.filter((k) => keys.includes(k)).length / picks.length;

  it('lean toward the pass on long yardage and the run on short yardage', () => {
    const pick = (yardsToGo: number) =>
      rolls.map(
        (r) =>
          selectOffensiveCall(offense(world, { yardsToGo }), {
            conceptRoll: r,
            formationRoll: 0,
          }).conceptKey,
      );
    const passes = ['quick_pass', 'deep_pass'];
    expect(share(pick(10), passes)).toBeGreaterThan(share(pick(5), passes));
    expect(share(pick(5), passes)).toBeGreaterThan(share(pick(1), passes));
    expect(share(pick(1), passes)).toBeGreaterThan(0);
    expect(share(pick(10), passes)).toBeLessThan(1);
  });

  it('prefer the plan personnel grouping without making it mandatory', () => {
    const o = offense();
    const picks = rolls.map(
      (r) =>
        selectOffensiveCall(o, { conceptRoll: 0, formationRoll: r })
          .personnelKey,
    );
    const preferred =
      picks.filter((p) => p === 'personnel_11').length / picks.length;
    expect(preferred).toBeGreaterThan(0.5);
    expect(preferred).toBeLessThan(1);
  });

  it('answer observed tendencies with the ruleset tactical edge', () => {
    const base = defense();
    const seenRuns = defense(world, {
      resolvedCalls: Array.from({ length: 6 }, () => ({
        offenseConceptKey: 'inside_run',
        defenseConceptKey: 'zone_shell',
      })),
    });
    const frontShare = (v: DefensiveSelectionView) =>
      share(
        rolls.map(
          (r) =>
            selectDefensiveCall(v, { conceptRoll: r, formationRoll: 0 })
              .conceptKey,
        ),
        ['run_commit_front'],
      );
    expect(frontShare(seenRuns)).toBeGreaterThan(frontShare(base));
  });

  it('never choose a concept outside the committed plan', () => {
    const w: FootballWorld = {
      ...world,
      football: {
        ...world.football,
        gamePlans: world.football.gamePlans.map((p) =>
          p.organizationId === home ? { ...p, conceptKeys: ['inside_run'] } : p,
        ),
      },
    };
    const o = offense(w);
    rolls
      .slice(0, 100)
      .forEach((r) =>
        expect(
          selectOffensiveCall(o, { conceptRoll: r, formationRoll: r })
            .conceptKey,
        ).toBe('inside_run'),
      );
  });

  it('treats the two clubs identically whichever one has the ball', () => {
    const asHome = buildOffensiveSelectionView(
      world,
      RULESET,
      E_FIXTURE_1,
      situationFor(home),
    );
    const asAway = buildOffensiveSelectionView(
      world,
      RULESET,
      E_FIXTURE_1,
      situationFor(away),
    );
    expect(asAway.organizationId).toBe(away);
    const strip = (v: OffensiveSelectionView) => ({
      concepts: v.concepts,
      formations: v.formations,
      participantRoles: v.participants.map((p) => [p.roleKey, p.depthOrder]),
    });
    expect(strip(asAway)).toEqual(strip(asHome));
  });
});
