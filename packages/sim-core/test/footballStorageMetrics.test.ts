import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_E_RULESET,
  canonicalString,
  collectFootballMetrics,
  fingerprintWorld,
  resolveScheduledGameChange,
} from '../src/index';
import { E_FIXTURE_1 } from './support/packageEHarness';
import { selectionWorld } from './support/footballSelectionHarness';

describe('football storage/ecology metrics', () => {
  it('is deterministic, useful to Package G, and read-only', () => {
    expect(typeof collectFootballMetrics).toBe('function');
    const world = resolveScheduledGameChange(
      selectionWorld(),
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    ).nextWorld;
    const beforeFingerprint = fingerprintWorld(world);
    const beforeRng = canonicalString(world.rng);
    const beforeWorld = canonicalString(world);

    const a = collectFootballMetrics(world);
    const b = collectFootballMetrics(world);

    expect(canonicalString(a)).toBe(canonicalString(b));
    expect(a.games).toBe(1);
    expect(a.plays).toBe(world.football.plays.length);
    expect(a.totalPoints).toBe(
      world.football.games[0]!.homeScore + world.football.games[0]!.awayScore,
    );
    expect(a.participationPlays).toBeGreaterThan(0);
    expect(a.workloadUnits).toBeGreaterThan(0);
    expect(a.footballInjuries).toBe(
      world.medical.episodes.filter(
        (episode) => episode.sourceKind === 'football',
      ).length,
    );
    expect(a.acceptedPenalties).toBe(
      world.football.plays.filter((play) => play.penaltyAccepted === true)
        .length,
    );
    expect(a.causalLinks).toBe(world.football.causalLinks.length);
    expect(a.serializedBytes.football).toBeGreaterThan(0);
    expect(a.serializedBytes.plays).toBeGreaterThan(0);

    expect(fingerprintWorld(world)).toBe(beforeFingerprint);
    expect(canonicalString(world.rng)).toBe(beforeRng);
    expect(canonicalString(world)).toBe(beforeWorld);
  });
});
