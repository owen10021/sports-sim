import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_E_RULESET,
  gameCastFrames,
  resolveScheduledGameChange,
} from '../src/index';
import { E_FIXTURE_1, NF, SP } from './support/packageEHarness';
import { selectionWorld } from './support/footballSelectionHarness';

describe('GameCast projects stored football facts without fabrication', () => {
  it('ends at the authoritative game result and exposes only represented factual detail', () => {
    expect(typeof gameCastFrames).toBe('function');
    const world = resolveScheduledGameChange(
      selectionWorld(),
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    ).nextWorld;
    const game = world.football.games[0]!;
    const frames = gameCastFrames(world, game.id);
    const terminal = frames.at(-1)!;

    expect(frames).toHaveLength(game.playIds.length);
    expect(frames.map((frame) => frame.playId)).toEqual(game.playIds);
    expect(terminal.homeScore).toBe(game.homeScore);
    expect(terminal.awayScore).toBe(game.awayScore);
    expect(terminal.terminal).toBe(true);

    const encoded = JSON.stringify(frames);
    for (const forbidden of [
      'traceHash',
      'rngDraw',
      'medicalEpisodeIds',
      'capabilityBp',
      'readinessBp',
      'privateMargin',
      'routePath',
      'coordinates',
      'movementPath',
    ])
      expect(encoded).not.toContain(forbidden);
  });

  it('adds only organization-safe Sunday Proof links when an organization projection is requested', () => {
    const world = resolveScheduledGameChange(
      selectionWorld(),
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    ).nextWorld;
    const game = world.football.games[0]!;
    const ownPlan = world.football.gamePlans.find(
      (p) => p.organizationId === NF.org,
    )!;
    const rivalPlan = world.football.gamePlans.find(
      (p) => p.organizationId === SP.org,
    )!;
    const publicFrames = gameCastFrames(world, game.id);
    const nfFrames = gameCastFrames(world, game.id, NF.org);

    expect(
      publicFrames.every((frame) => frame.sundayProofLinks.length === 0),
    ).toBe(true);
    expect(nfFrames.some((frame) => frame.sundayProofLinks.length > 0)).toBe(
      true,
    );
    const encoded = JSON.stringify(nfFrames);
    expect(encoded).toContain(ownPlan.id);
    expect(encoded).not.toContain(rivalPlan.id);
  });
});
