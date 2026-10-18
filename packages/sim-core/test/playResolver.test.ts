import { describe, expect, it } from 'vitest';
import {
  DeterministicRng,
  FootballPlayError,
  buildDefensiveSelectionView,
  buildOffensiveSelectionView,
  entityId,
  recordId,
  requireFootballRules,
  resolvePlay,
  selectDefensiveCall,
  selectOffensiveCall,
  type FootballWorld,
} from '../src/index';
import { E_FIXTURE_1 } from './support/packageEHarness';
import {
  RULESET,
  fixtureOrgs,
  gameStateFor,
  planFor,
  playInput,
  selectionWorld,
  situationFor,
} from './support/footballSelectionHarness';

const world = selectionWorld();
const { home, away } = fixtureOrgs(world);
const rules = requireFootballRules(RULESET);
const state = gameStateFor(home);
const input = playInput(world, state);
const seeded = (seed: number) => DeterministicRng.fromSeed(seed);

describe('resolvePlay replay', () => {
  it('is byte-equivalent for identical input and RNG snapshot', () => {
    const a = resolvePlay(input, seeded(11));
    const b = resolvePlay(input, seeded(11));
    expect(JSON.stringify(a.resolved)).toBe(JSON.stringify(b.resolved));
    expect(JSON.stringify(a.nextGameState)).toBe(
      JSON.stringify(b.nextGameState),
    );
    expect(JSON.stringify(a.privateTrace)).toBe(JSON.stringify(b.privateTrace));
    expect(a.rng.snapshot()).toEqual(b.rng.snapshot());
    expect(a.resolved.traceHash).toBe(b.resolved.traceHash);
    expect(a.resolved.rngDrawCount).toBe(b.resolved.rngDrawCount);
  });

  it('continues from a restored snapshot exactly as from the original stream', () => {
    const first = resolvePlay(input, seeded(5));
    const resumed = resolvePlay(
      { ...input, gameState: first.nextGameState },
      DeterministicRng.fromState(first.rng.snapshot()),
    );
    const straight = seeded(5);
    const one = resolvePlay(input, straight);
    const two = resolvePlay(
      { ...input, gameState: one.nextGameState },
      straight,
    );
    expect(JSON.stringify(resumed.resolved)).toBe(JSON.stringify(two.resolved));
  });

  it('does not mutate its input and varies with the stream', () => {
    const before = JSON.stringify(input);
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 200; seed++)
      kinds.add(resolvePlay(input, seeded(seed)).resolved.resultKind);
    expect(JSON.stringify(input)).toBe(before);
    expect(kinds.size).toBeGreaterThanOrEqual(3);
  });
});

describe('resolved play facts', () => {
  const plays = Array.from({ length: 300 }, (_, i) =>
    resolvePlay(input, seeded(i + 1)),
  );

  it('record the pre-play situation, calls and participants', () => {
    plays.forEach(({ resolved }) => {
      expect(resolved.fixtureId).toBe(E_FIXTURE_1);
      expect(resolved.sequence).toBe(1);
      expect(resolved.offenseOrganizationId).toBe(home);
      expect(resolved.defenseOrganizationId).toBe(away);
      expect(resolved.pre).toEqual({
        period: 1,
        clockSecondsRemaining: 900,
        down: 1,
        yardsToGo: 10,
        yardLine: 25,
        homeScore: 0,
        awayScore: 0,
      });
      expect(resolved.offense.lineup).toHaveLength(11);
      expect(resolved.defense.lineup).toHaveLength(11);
      const ids = [...resolved.offense.lineup, ...resolved.defense.lineup].map(
        (s) => s.playerId,
      );
      expect(new Set(ids).size).toBe(22);
    });
  });

  it('keep result, yardage and turnover facts mutually consistent', () => {
    plays.forEach(({ resolved: r }) => {
      expect(['run', 'pass']).toContain(r.playCategory);
      if (r.resultKind === 'sack') expect(r.yardsGained).toBeLessThan(0);
      if (r.resultKind === 'incompletion') expect(r.yardsGained).toBe(0);
      if (r.resultKind === 'interception') {
        expect(r.turnover).toBe('interception');
        expect(r.playCategory).toBe('pass');
      }
      if (r.resultKind === 'fumble_lost') expect(r.turnover).toBe('fumble');
      if (r.turnover === null)
        expect(['rush', 'completion', 'incompletion', 'sack']).toContain(
          r.resultKind,
        );
      expect(r.yardsGained).toBeGreaterThanOrEqual(-r.pre.yardLine);
      expect(r.yardsGained).toBeLessThanOrEqual(
        rules.field.fieldLengthYards - r.pre.yardLine,
      );
      expect(r.touchdown).toBe(
        r.turnover === null &&
          r.pre.yardLine + r.yardsGained >= rules.field.fieldLengthYards,
      );
      expect(r.safety).toBe(r.pre.yardLine + r.yardsGained <= 0);
      const duration = rules.clock.playDurations.find(
        (d) => d.playCategory === r.playCategory,
      )!;
      expect(r.clockSecondsUsed).toBeGreaterThanOrEqual(duration.minSeconds);
      expect(r.clockSecondsUsed).toBeLessThanOrEqual(duration.maxSeconds);
    });
  });

  it('carry principals that match the result', () => {
    plays.forEach(({ resolved: r }) => {
      const lineupIds = new Set(
        [...r.offense.lineup, ...r.defense.lineup].map((s) => s.playerId),
      );
      Object.values(r.principals).forEach((id) => {
        if (id !== null) expect(lineupIds.has(id)).toBe(true);
      });
      if (r.playCategory === 'run')
        expect(r.principals.ballCarrierPlayerId).not.toBeNull();
      if (r.resultKind === 'completion')
        expect(r.principals.targetPlayerId).not.toBeNull();
      if (r.resultKind === 'sack')
        expect(r.principals.pressurePlayerId).not.toBeNull();
    });
  });

  it('describe each participant action exposure once and convert it to workload', () => {
    const { resolved } = plays[0]!;
    expect(resolved.participation.length).toBe(22);
    resolved.participation.forEach((p) => {
      expect(rules.injury.contactClasses).toContain(p.contactClass);
      p.actionExposures.forEach((a) => expect(a.attempts).toBe(1));
      expect(p.workloadUnits).toBe(
        p.actionExposures.reduce(
          (n, a) =>
            n +
            rules.exposureConversion.find((x) => x.actionKey === a.actionKey)!
              .loadUnitsPerExposure *
              a.attempts,
          0,
        ),
      );
      p.responsibilityExposures.forEach((x) =>
        expect(x.meaningfulReps).toBe(1),
      );
    });
    const keys = JSON.stringify(resolved);
    expect(keys).not.toContain('valueBp');
    expect(keys).not.toContain('capabilityBp');
    expect(keys).not.toContain('executionBp');
  });

  it('advance only the bookkeeping the play determines', () => {
    plays.forEach(({ resolved: r, nextGameState: n }) => {
      expect(n.playsResolved).toBe(1);
      expect(n.resolvedCalls).toEqual([
        {
          offenseConceptKey: r.offense.conceptKey,
          defenseConceptKey: r.defense.conceptKey,
        },
      ]);
      expect(n.clockSecondsRemaining).toBe(
        Math.max(0, 900 - r.clockSecondsUsed),
      );
      expect(n.fixtureId).toBe(E_FIXTURE_1);
    });
  });

  it('draw the committed calls from the selectors using the first four stream words', () => {
    const rng = seeded(77);
    const probe = DeterministicRng.fromState(rng.snapshot());
    const offenseRolls = {
      conceptRoll: probe.nextU32(),
      formationRoll: probe.nextU32(),
    };
    const defenseRolls = {
      conceptRoll: probe.nextU32(),
      formationRoll: probe.nextU32(),
    };
    const situation = situationFor(home);
    const o = selectOffensiveCall(
      buildOffensiveSelectionView(world, RULESET, E_FIXTURE_1, situation),
      offenseRolls,
    );
    const d = selectDefensiveCall(
      buildDefensiveSelectionView(world, RULESET, E_FIXTURE_1, situation),
      defenseRolls,
    );
    const { resolved } = resolvePlay(input, rng);
    expect(resolved.offense).toMatchObject({
      conceptKey: o.conceptKey,
      formationKey: o.formationKey,
      lineup: o.lineup,
    });
    expect(resolved.defense).toMatchObject({
      conceptKey: d.conceptKey,
      formationKey: d.formationKey,
      lineup: d.lineup,
    });
  });
});

describe('resolvePlay validates before it draws', () => {
  const unchanged = (bad: () => unknown, rng = seeded(3)) => {
    const before = rng.snapshot();
    expect(bad).toThrow(FootballPlayError);
    expect(rng.snapshot()).toEqual(before);
  };
  const run =
    (over: Record<string, unknown>, rng = seeded(3)) =>
    () =>
      resolvePlay({ ...input, ...over } as never, rng);
  const withState = (over: Record<string, unknown>) => ({
    gameState: { ...state, ...over },
  });

  it('rejects an unknown, final or foreign fixture and a foreign possession', () => {
    unchanged(run(withState({ fixtureId: recordId('fixture-nope') })));
    unchanged(
      run({
        football: {
          ...world.football,
          fixtures: world.football.fixtures.map((f) =>
            f.id === E_FIXTURE_1
              ? { ...f, status: 'final', finalGameId: recordId('game-1') }
              : f,
          ),
        },
      }),
    );
    unchanged(
      run(withState({ possessionOrganizationId: entityId('org-elsewhere') })),
    );
  });

  it('rejects impossible starting game states', () => {
    unchanged(run(withState({ down: 0 })));
    unchanged(run(withState({ down: 5 })));
    unchanged(run(withState({ yardLine: 140 })));
    unchanged(run(withState({ yardsToGo: -2 })));
    unchanged(run(withState({ playsResolved: -1 })));
    unchanged(run(withState({ clockSecondsRemaining: 0.5 })));
    unchanged(run(withState({ nextSnap: 'kickoff' })));
    unchanged(run(withState({ nextSnap: 'extra_point' })));
    unchanged(run(withState({ nextSnap: 'nonsense' })));
  });

  it('rejects missing or duplicated plans and plans with nothing fieldable', () => {
    const noPlan: FootballWorld = {
      ...world,
      football: {
        ...world.football,
        gamePlans: world.football.gamePlans.filter(
          (p) => p.organizationId !== away,
        ),
      },
    };
    unchanged(run({ football: noPlan.football }));
    const nothing: FootballWorld = {
      ...world,
      football: {
        ...world.football,
        gamePlans: world.football.gamePlans.map((p) =>
          p.organizationId === home ? planFor(home, { conceptKeys: [] }) : p,
        ),
      },
    };
    unchanged(run({ football: nothing.football }));
  });

  it('rejects unknown vocabulary in the ruleset and a ruleset with no football rules', () => {
    unchanged(run({ ruleset: { rulesetId: 'no-football', rules: {} } }));
    const missingClass = {
      ...RULESET,
      rules: {
        ...RULESET.rules,
        football: {
          ...rules,
          injury: { ...rules.injury, contactClasses: ['none'] },
        },
      },
    };
    unchanged(run({ ruleset: missingClass }));
  });

  it('rejects a designated player with no readiness record, leaving the stream untouched', () => {
    const rng = seeded(3);
    // Every call assigns some home player an action, whichever concept is selected.
    const homePlayers = new Set(
      world.football.designations
        .filter((d) => d.organizationId === home)
        .map((d) => d.playerId),
    );
    const lacking: FootballWorld = {
      ...world,
      development: {
        ...world.development,
        readiness: world.development.readiness.filter(
          (r) => !homePlayers.has(r.playerId),
        ),
      },
    };
    const before = rng.snapshot();
    expect(() => resolvePlay(playInput(lacking, state), rng)).toThrow(
      FootballPlayError,
    );
    expect(rng.snapshot()).toEqual(before);
  });

  it('rejects any input key outside the accepted input, including rating-like fields', () => {
    unchanged(run({ teamOvr: 91 }));
    unchanged(run({ humanControlled: true }));
    unchanged(run(withState({ humanControlled: true })));
    unchanged(run(withState({ winStreak: 7 })));
    unchanged(
      run({ latent: { ...input.latent, teamStrength: { [home]: 99 } } }),
    );
  });
});

describe('resolvePlay ignores labels and control status', () => {
  it('gives the same play whatever the ruleset id or fixture profile label says', () => {
    const base = resolvePlay(input, seeded(21));
    const relabeled = resolvePlay(
      playInput(world, state, { ...RULESET, rulesetId: 'another-label' }),
      seeded(21),
    );
    expect(JSON.stringify(relabeled.resolved)).toBe(
      JSON.stringify(base.resolved),
    );
    const renamed: FootballWorld = {
      ...world,
      football: {
        ...world.football,
        fixtures: world.football.fixtures.map((f) =>
          f.id === E_FIXTURE_1 ? { ...f, rulesProfileKey: 'renamed' } : f,
        ),
      },
    };
    expect(
      JSON.stringify(
        resolvePlay(playInput(renamed, state), seeded(21)).resolved,
      ),
    ).toBe(JSON.stringify(base.resolved));
  });
});
