import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_E_RULESET,
  deriveGameStatistics,
  resolveScheduledGameChange,
} from '../src/index';
import { E_FIXTURE_1 } from './support/packageEHarness';
import { selectionWorld } from './support/footballSelectionHarness';

describe('football statistics are derived from the play ledger', () => {
  it('derives the exact stored team/player summaries from persisted play facts', () => {
    const out = resolveScheduledGameChange(
      selectionWorld(),
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    );
    const game = out.nextWorld.football.games[0]!;
    const plays = out.nextWorld.football.plays.filter(
      (p) => p.gameId === game.id,
    );
    const stats = deriveGameStatistics(plays);

    expect(stats).toEqual(game.statistics);
    expect(stats.teams).toHaveLength(2);
    expect(stats.players.length).toBeGreaterThan(0);
    expect(stats.teams.reduce((sum, t) => sum + t.points, 0)).toBe(
      game.homeScore + game.awayScore,
    );
    expect(stats.players.reduce((sum, p) => sum + p.workloadUnits, 0)).toBe(
      game.participationSummary.reduce((sum, p) => sum + p.workloadUnits, 0),
    );
  });

  it('counts only represented play facts rather than inventing hidden performance stats', () => {
    const out = resolveScheduledGameChange(
      selectionWorld(),
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    );
    const game = out.nextWorld.football.games[0]!;
    const plays = out.nextWorld.football.plays.filter(
      (p) => p.gameId === game.id,
    );
    const stats = deriveGameStatistics(plays);
    const scrimmage = plays.filter(
      (p) =>
        p.playStands && (p.playCategory === 'run' || p.playCategory === 'pass'),
    );
    expect(stats.teams.reduce((sum, t) => sum + t.scrimmagePlays, 0)).toBe(
      scrimmage.length,
    );
    expect(stats.teams.reduce((sum, t) => sum + t.turnovers, 0)).toBe(
      plays.filter((p) => p.playStands && p.turnover !== null).length,
    );
  });
});
