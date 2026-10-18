import { describe, expect, it } from 'vitest';
import {
  DeterministicRng,
  SYNTHETIC_PACKAGE_E_RULESET,
  WorldKernel,
  nextBlockingFootballFixture,
  scheduledGameProblems,
  type FootballWorld,
} from '../src/index';
import {
  E_FIXTURE_1,
  E_FIXTURE_2,
  E_GAME_DAY_1,
  commitBothGamePlans,
  eRunner,
  eWorld,
} from './support/packageEHarness';
import { dRunner } from './support/packageDHarness';
import {
  codeOf,
  messageOf,
  okResult,
  runnerFor,
  snapshotOf,
  type Runner,
} from './support/orgHarness';

const withFinal =
  (...ids: string[]) =>
  (w: FootballWorld): FootballWorld => ({
    ...w,
    football: {
      ...w.football,
      fixtures: w.football.fixtures.map((f) =>
        ids.includes(f.id) ? { ...f, status: 'final' as const } : f,
      ),
    },
  });

const mutated = (
  mutate: (w: FootballWorld) => FootballWorld,
  simDate?: string,
): Runner =>
  runnerFor(
    WorldKernel.fromGenesis(
      mutate(eWorld(simDate)),
      SYNTHETIC_PACKAGE_E_RULESET,
    ),
  );

describe('nextBlockingFootballFixture', () => {
  const w = eWorld();
  it('blocks only past a scheduled fixture, never at its date', () => {
    expect(nextBlockingFootballFixture(w, '2027-09-12')).toBeNull();
    expect(nextBlockingFootballFixture(w, '2027-09-13')?.id).toBe(E_FIXTURE_1);
    expect(nextBlockingFootballFixture(w, '2027-12-31')?.id).toBe(E_FIXTURE_1);
  });
  it('skips final fixtures and picks the earliest remaining one', () => {
    const afterOne = withFinal(E_FIXTURE_1)(w);
    expect(nextBlockingFootballFixture(afterOne, '2027-09-19')).toBeNull();
    expect(nextBlockingFootballFixture(afterOne, '2027-09-20')?.id).toBe(
      E_FIXTURE_2,
    );
    expect(
      nextBlockingFootballFixture(
        withFinal(E_FIXTURE_1, E_FIXTURE_2)(w),
        '2030-01-01',
      ),
    ).toBeNull();
  });
});

describe('AdvanceDays at a scheduled game', () => {
  it('advances exactly to the game date, then refuses to go past it', () => {
    const r = eRunner();
    okResult(r.run({ type: 'AdvanceDays', days: 2 }));
    expect(r.kernel.world.simDate).toBe(E_GAME_DAY_1);
    const before = snapshotOf(r.kernel);
    const res = r.run({ type: 'AdvanceDays', days: 1 });
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain(E_FIXTURE_1);
    expect(messageOf(res)).toContain('2027-09-12');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('rejects a multi-day advance that would pass the fixture, before any RNG or change', () => {
    const r = eRunner();
    const before = snapshotOf(r.kernel);
    const res = r.run({ type: 'AdvanceDays', days: 3 });
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain(E_FIXTURE_1);
    expect(snapshotOf(r.kernel)).toEqual(before);
    expect(r.kernel.world.rng.draws).toBe(before.draws);
  });

  it('keeps the day-roll draw order unchanged for every day it may advance', () => {
    const r = eRunner();
    const expected = DeterministicRng.fromState(r.kernel.world.rng);
    const first = expected.nextU32();
    const second = expected.nextU32();
    const res = okResult(r.run({ type: 'AdvanceDays', days: 2 }));
    const advanced = res.events.find((e) => e.type === 'DaysAdvanced')!;
    expect(
      (advanced.payload as { dayRolls: { roll: number }[] }).dayRolls.map(
        (d) => d.roll,
      ),
    ).toEqual([first, second]);
  });

  it('lifts the boundary once the fixture is final and stops at the next one', () => {
    const r = mutated(withFinal(E_FIXTURE_1), E_GAME_DAY_1);
    okResult(r.run({ type: 'AdvanceDays', days: 7 }));
    expect(r.kernel.world.simDate).toBe('2027-09-19');
    const before = snapshotOf(r.kernel);
    expect(codeOf(r.run({ type: 'AdvanceDays', days: 1 }))).toBe(
      'INVALID_PAYLOAD',
    );
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('leaves worlds without fixtures (Packages A-D) completely unaffected', () => {
    const r = dRunner();
    expect(
      nextBlockingFootballFixture(r.kernel.world, '2099-01-01'),
    ).toBeNull();
    okResult(r.run({ type: 'AdvanceDays', days: 30 }));
  });
});

describe('ResolveScheduledGame skeleton', () => {
  const kinds = ['human_gm', 'commissioner', 'system', 'test_harness'] as const;
  const outcome = (r: Runner, kind: (typeof kinds)[number]) => {
    const res = r.run(
      { type: 'ResolveScheduledGame', fixtureId: E_FIXTURE_1 },
      kind,
    );
    return { code: codeOf(res), message: messageOf(res) };
  };

  it('takes the same validation path for every permitted actor kind', () => {
    // Not due yet.
    const early = kinds.map((k) => outcome(eRunner(), k));
    for (const o of early) expect(o).toEqual(early[0]);
    expect(early[0]!.message).toContain('not due until 2027-09-12');

    // Due, but neither club has a game plan.
    const unplanned = kinds.map((k) => outcome(eRunner(E_GAME_DAY_1), k));
    for (const o of unplanned) expect(o).toEqual(unplanned[0]);
    expect(unplanned[0]!.message).toContain('exactly one committed game plan');

    // Due and fully planned: still refused until the resolver exists.
    const ready = kinds.map((k) => {
      const r = eRunner(E_GAME_DAY_1);
      commitBothGamePlans(r);
      return outcome(r, k);
    });
    for (const o of ready) expect(o).toEqual(ready[0]);
    expect(ready[0]).toEqual({
      code: 'INVALID_PAYLOAD',
      message: 'game resolution is not available yet',
    });
  });

  it('refuses CPU orgs and delegates, and changes nothing on any rejection', () => {
    const r = eRunner(E_GAME_DAY_1);
    const before = snapshotOf(r.kernel);
    for (const kind of ['cpu_org', 'delegate'] as const) {
      const res = r.run(
        { type: 'ResolveScheduledGame', fixtureId: E_FIXTURE_1 },
        kind,
      );
      expect(codeOf(res)).toBe('UNAUTHORIZED_ACTOR');
    }
    for (const bad of [
      { type: 'ResolveScheduledGame' },
      { type: 'ResolveScheduledGame', fixtureId: 'fixture-nope' },
      { type: 'ResolveScheduledGame', fixtureId: E_FIXTURE_1, extra: 1 },
    ]) {
      expect(codeOf(r.run(bad))).toBe('INVALID_PAYLOAD');
    }
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('rejects an already-final fixture and never reads the actor in validation', () => {
    const r = mutated(withFinal(E_FIXTURE_1), E_GAME_DAY_1);
    const res = r.run({ type: 'ResolveScheduledGame', fixtureId: E_FIXTURE_1 });
    expect(messageOf(res)).toContain('already final');
    // The validator is a function of (world, fixtureId) only: no actor parameter exists.
    expect(scheduledGameProblems.length).toBe(2);
  });
});
