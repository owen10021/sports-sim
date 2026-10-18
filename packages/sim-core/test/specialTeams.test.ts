import { describe, expect, it } from 'vitest';
import {
  DeterministicRng,
  FootballPlayError,
  resolvePlay,
  type FootballWorld,
} from '../src/index';
import { E_FIXTURE_1 } from './support/packageEHarness';
import {
  fixtureOrgs,
  gameStateFor,
  playInput,
  selectionWorld,
} from './support/footballSelectionHarness';

const world = selectionWorld();
const { home, away } = fixtureOrgs(world);
const seeded = (seed: number) => DeterministicRng.fromSeed(seed);

const kickoffState = () =>
  gameStateFor(home, {
    possessionOrganizationId: home,
    nextSnap: 'kickoff',
    kickoffKind: 'opening',
    openingReceiverOrganizationId: away,
    driveCount: 0,
    drivePlays: 0,
    yardLine: 35,
  });

describe('special teams use the one authoritative play resolver', () => {
  it('resolves an opening kickoff with kicking and returning units', () => {
    const result = resolvePlay(playInput(world, kickoffState()), seeded(101));
    expect(result.resolved.fixtureId).toBe(E_FIXTURE_1);
    expect(result.resolved.playCategory).toBe('kickoff');
    expect(result.resolved.resultKind).toBe('kickoff');
    expect(result.resolved.kick).not.toBeNull();
    expect(result.resolved.offenseOrganizationId).toBe(home);
    expect(result.resolved.defenseOrganizationId).toBe(away);
    expect(result.resolved.principals.kickerPlayerId).not.toBeNull();
    expect(result.resolved.participation).toHaveLength(22);
    expect(new Set(result.resolved.participation.map((p) => p.side))).toEqual(
      new Set(['kicking', 'returning']),
    );
    expect(result.nextGameState.playsResolved).toBe(1);
    expect(result.events.some((e) => e.kind === 'kickoff')).toBe(true);
  });

  it('uses the same resolver for a punt selected by fourth-down situation', () => {
    const state = gameStateFor(home, {
      down: 4,
      yardsToGo: 8,
      yardLine: 30,
    });
    const result = resolvePlay(playInput(world, state), seeded(202));
    expect(result.resolved.playCategory).toBe('punt');
    expect(result.resolved.resultKind).toBe('punt');
    expect(result.resolved.kick?.good).toBeNull();
    expect(result.events.some((e) => e.kind === 'punt')).toBe(true);
    expect(result.nextGameState.playsResolved).toBe(1);
  });

  it('uses the same resolver for a field-goal attempt and reconciles the next state', () => {
    const state = gameStateFor(home, {
      down: 4,
      yardsToGo: 7,
      yardLine: 70,
    });
    const result = resolvePlay(playInput(world, state), seeded(303));
    expect(result.resolved.playCategory).toBe('field_goal');
    expect(['field_goal_good', 'field_goal_missed']).toContain(
      result.resolved.resultKind,
    );
    expect(typeof result.resolved.kick?.good).toBe('boolean');
    if (result.resolved.resultKind === 'field_goal_good') {
      expect(result.nextGameState.homeScore).toBe(3);
      expect(result.nextGameState.nextSnap).toBe('kickoff');
    } else {
      expect(result.nextGameState.homeScore).toBe(0);
      expect(result.nextGameState.possessionOrganizationId).toBe(away);
      expect(result.nextGameState.nextSnap).toBe('scrimmage');
    }
  });

  it('uses the same resolver for the untimed extra point after a touchdown', () => {
    const state = gameStateFor(home, {
      possessionOrganizationId: home,
      nextSnap: 'extra_point',
      kickoffKind: null,
      yardLine: 85,
      homeScore: 6,
      clockSecondsRemaining: 0,
    });
    const result = resolvePlay(playInput(world, state), seeded(404));
    expect(result.resolved.playCategory).toBe('extra_point');
    expect(['extra_point_good', 'extra_point_missed']).toContain(
      result.resolved.resultKind,
    );
    expect(result.nextGameState.nextSnap).toBe('kickoff');
    expect(result.nextGameState.period).toBe(2);
    expect(result.nextGameState.clockSecondsRemaining).toBe(900);
  });

  it('is deterministic for special teams from the same input and RNG snapshot', () => {
    const a = resolvePlay(playInput(world, kickoffState()), seeded(505));
    const b = resolvePlay(playInput(world, kickoffState()), seeded(505));
    expect(JSON.stringify(a.resolved)).toBe(JSON.stringify(b.resolved));
    expect(JSON.stringify(a.nextGameState)).toBe(
      JSON.stringify(b.nextGameState),
    );
    expect(a.rng.snapshot()).toEqual(b.rng.snapshot());
  });
});

describe('special-teams legality fails before RNG', () => {
  it('rejects a kickoff when the kicking unit cannot field a legal formation', () => {
    const noKicking: FootballWorld = {
      ...world,
      football: {
        ...world.football,
        designations: world.football.designations.filter(
          (d) => !(d.organizationId === home && d.unitKey === 'kicking'),
        ),
      },
    };
    const rng = seeded(606);
    const before = rng.snapshot();
    expect(() =>
      resolvePlay(playInput(noKicking, kickoffState()), rng),
    ).toThrow(/no kickoff kicking concept can be fielded/i);
    expect(rng.snapshot()).toEqual(before);
  });

  it('rejects a finalized fixture without consuming a football draw', () => {
    const finalWorld: FootballWorld = {
      ...world,
      football: {
        ...world.football,
        fixtures: world.football.fixtures.map((f) =>
          f.id === E_FIXTURE_1
            ? { ...f, status: 'final' as const, finalGameId: f.id }
            : f,
        ),
      },
    };
    const rng = seeded(707);
    const before = rng.snapshot();
    expect(() =>
      resolvePlay(playInput(finalWorld, kickoffState()), rng),
    ).toThrow(FootballPlayError);
    expect(rng.snapshot()).toEqual(before);
  });
});
