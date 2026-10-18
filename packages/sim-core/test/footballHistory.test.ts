import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_E_RULESET,
  resolveScheduledGameChange,
} from '../src/index';
import { E_FIXTURE_1 } from './support/packageEHarness';
import { selectionWorld } from './support/footballSelectionHarness';

describe('truthful football history retention', () => {
  it('persists one compact observable fact for every resolved play with valid refs', () => {
    const out = resolveScheduledGameChange(
      selectionWorld(),
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    );
    const game = out.nextWorld.football.games[0]!;
    const plays = out.nextWorld.football.plays.filter(
      (p) => p.gameId === game.id,
    );

    expect(plays).toHaveLength(out.gameDraft.plays.length);
    expect(plays.map((p) => p.id)).toEqual(game.playIds);
    expect(
      out.nextWorld.football.fixtures.some(
        (f) => f.id === game.fixtureId && f.finalGameId === game.id,
      ),
    ).toBe(true);
    for (const planId of game.gamePlanSnapshotIds)
      expect(
        out.nextWorld.football.gamePlans.some((p) => p.id === planId),
      ).toBe(true);

    for (const play of plays) {
      expect(play.pre).toBeDefined();
      expect(play.post).toBeDefined();
      expect(play.offense).toBeDefined();
      expect(play.defense).toBeDefined();
      expect(play.resultKind).toBeTruthy();
      expect(play.participation.length).toBeGreaterThan(0);
      expect(play.traceHash).toMatch(/^[0-9a-f]{64}$/);
      for (const episodeId of play.medicalEpisodeIds)
        expect(
          out.nextWorld.medical.episodes.some((e) => e.id === episodeId),
        ).toBe(true);
    }
    for (const episodeId of game.medicalEpisodeIds)
      expect(
        out.nextWorld.medical.episodes.some((e) => e.id === episodeId),
      ).toBe(true);
  });

  it('never persists private trace, latent capability/readiness values, or RNG rolls', () => {
    const out = resolveScheduledGameChange(
      selectionWorld(),
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    );
    const serialized = JSON.stringify({
      game: out.nextWorld.football.games[0],
      plays: out.nextWorld.football.plays,
    });
    for (const forbidden of [
      'privateTrace',
      'capabilityBp',
      'capabilities',
      'readinessBp',
      'acuteFatigueBp',
      'conditioningBp',
      'marginBp',
      'executionBp',
      'randomRoll',
    ])
      expect(serialized).not.toContain(forbidden);
  });
});
