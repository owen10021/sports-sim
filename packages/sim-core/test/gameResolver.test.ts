import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_E_RULESET,
  WorldKernel,
  resolveScheduledGameChange,
  type FootballWorld,
} from '../src/index';
import { E_FIXTURE_1, E_GAME_DAY_1 } from './support/packageEHarness';
import {
  fixtureOrgs,
  selectionWorld,
} from './support/footballSelectionHarness';
import { codeOf, okResult, runnerFor, snapshotOf } from './support/orgHarness';

const readyWorld = (): FootballWorld => selectionWorld();

describe('resolveScheduledGameChange', () => {
  it('resolves the due fixture to one legal final game deterministically', () => {
    const a = resolveScheduledGameChange(
      readyWorld(),
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    );
    const b = resolveScheduledGameChange(
      readyWorld(),
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    );

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.gameDraft.finalState.status).toBe('final');
    expect(a.gameDraft.plays.length).toBeGreaterThan(0);
    expect(a.gameDraft.rngDrawCount).toBeGreaterThan(0);
    expect(a.nextWorld.rng.draws).toBe(
      a.gameDraft.rngDrawStart + a.gameDraft.rngDrawCount,
    );

    const fixture = a.nextWorld.football.fixtures.find(
      (f) => f.id === E_FIXTURE_1,
    )!;
    expect(fixture.status).toBe('final');
    expect(fixture.finalGameId).toBe(a.gameDraft.gameRecord.id);
    expect(a.nextWorld.football.games).toHaveLength(1);
    expect(a.nextWorld.football.games[0]!.id).toBe(fixture.finalGameId);
  });

  it('uses the fixture clubs only and produces a score for the same game', () => {
    const world = readyWorld();
    const { home, away } = fixtureOrgs(world);
    const out = resolveScheduledGameChange(
      world,
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    );
    expect(out.gameDraft.gameRecord.homeOrganizationId).toBe(home);
    expect(out.gameDraft.gameRecord.awayOrganizationId).toBe(away);
    expect(out.gameDraft.gameRecord.homeScore).toBe(
      out.gameDraft.finalState.homeScore,
    );
    expect(out.gameDraft.gameRecord.awayScore).toBe(
      out.gameDraft.finalState.awayScore,
    );
  });
});

describe('ResolveScheduledGame command', () => {
  it('resolves exactly once as one world revision', () => {
    const kernel = WorldKernel.fromGenesis(
      readyWorld(),
      SYNTHETIC_PACKAGE_E_RULESET,
    );
    const r = runnerFor(kernel);
    const beforeRevision = Number(kernel.world.revision);
    const first = okResult(
      r.run({ type: 'ResolveScheduledGame', fixtureId: E_FIXTURE_1 }),
    );
    expect(Number(first.world.revision)).toBe(beforeRevision + 1);
    expect(first.events.some((e) => e.type === 'ScheduledGameResolved')).toBe(
      true,
    );
    const after = snapshotOf(kernel);
    const second = r.run({
      type: 'ResolveScheduledGame',
      fixtureId: E_FIXTURE_1,
    });
    expect(codeOf(second)).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(kernel)).toEqual(after);
  });

  it('rejects before the fixture date without consuming RNG or mutating', () => {
    const early: FootballWorld = { ...readyWorld(), simDate: '2027-09-11' };
    const kernel = WorldKernel.fromGenesis(early, SYNTHETIC_PACKAGE_E_RULESET);
    const r = runnerFor(kernel);
    const before = snapshotOf(kernel);
    const res = r.run({ type: 'ResolveScheduledGame', fixtureId: E_FIXTURE_1 });
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(kernel)).toEqual(before);
    expect(kernel.world.simDate).not.toBe(E_GAME_DAY_1);
  });
});
