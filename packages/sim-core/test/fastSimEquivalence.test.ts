import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_E_RULESET,
  fastSimSummary,
  footballReplayFacts,
  resolveScheduledGameChange,
} from '../src/index';
import { E_FIXTURE_1 } from './support/packageEHarness';
import { selectionWorld } from './support/footballSelectionHarness';

describe('Fast Sim and replay use the authoritative football ledger', () => {
  it('projects the exact final score/statistics and exact stored play order', () => {
    expect(typeof fastSimSummary).toBe('function');
    expect(typeof footballReplayFacts).toBe('function');
    const world = resolveScheduledGameChange(
      selectionWorld(),
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    ).nextWorld;
    const game = world.football.games[0]!;

    const summary = fastSimSummary(world, game.id);
    expect(summary.gameId).toBe(game.id);
    expect(summary.fixtureId).toBe(game.fixtureId);
    expect(summary.homeOrganizationId).toBe(game.homeOrganizationId);
    expect(summary.awayOrganizationId).toBe(game.awayOrganizationId);
    expect(summary.homeScore).toBe(game.homeScore);
    expect(summary.awayScore).toBe(game.awayScore);
    expect(summary.statistics).toEqual(game.statistics);
    expect(summary.playCount).toBe(game.playIds.length);

    const replay = footballReplayFacts(world, game.id);
    expect(replay.map((play) => play.id)).toEqual(game.playIds);
    expect(replay.map((play) => play.sequence)).toEqual(
      Array.from({ length: game.playIds.length }, (_, i) => i + 1),
    );
  });
});
