import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_E_RULESET,
  canonicalString,
  fastSimSummary,
  fingerprintWorld,
  footballReplayFacts,
  gameCastFrames,
  resolveScheduledGameChange,
  type FootballWorld,
} from '../src/index';
import { E_FIXTURE_1, NF } from './support/packageEHarness';
import { selectionWorld } from './support/footballSelectionHarness';

describe('football presentation projections are read-only and RNG-free', () => {
  it('is byte-stable across repeated projections and serialized reload-shaped input', () => {
    expect(typeof gameCastFrames).toBe('function');
    const world = resolveScheduledGameChange(
      selectionWorld(),
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    ).nextWorld;
    const game = world.football.games[0]!;
    const beforeFingerprint = fingerprintWorld(world);
    const beforeRng = canonicalString(world.rng);
    const beforeBytes = canonicalString(world);

    const first = {
      fast: fastSimSummary(world, game.id),
      cast: gameCastFrames(world, game.id, NF.org),
      replay: footballReplayFacts(world, game.id),
    };
    const second = {
      fast: fastSimSummary(world, game.id),
      cast: gameCastFrames(world, game.id, NF.org),
      replay: footballReplayFacts(world, game.id),
    };

    expect(second).toEqual(first);
    expect(fingerprintWorld(world)).toBe(beforeFingerprint);
    expect(canonicalString(world.rng)).toBe(beforeRng);
    expect(canonicalString(world)).toBe(beforeBytes);

    const reloaded = JSON.parse(beforeBytes) as FootballWorld;
    expect(fastSimSummary(reloaded, game.id)).toEqual(first.fast);
    expect(gameCastFrames(reloaded, game.id, NF.org)).toEqual(first.cast);
    expect(footballReplayFacts(reloaded, game.id)).toEqual(first.replay);
    expect(canonicalString(reloaded.rng)).toBe(beforeRng);
  });
});
