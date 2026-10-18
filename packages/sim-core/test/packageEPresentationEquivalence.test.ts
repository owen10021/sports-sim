import { describe, expect, it, vi } from 'vitest';
import {
  canonicalString,
  fastSimSummary,
  fingerprintWorld,
  footballReplayFacts,
  gameCastFrames,
} from '../src/index';
import { executePackageEScenario } from '../src/packageEScenarioRun';

vi.setConfig({ testTimeout: 60_000 });

describe('Package E presentation equivalence RED gate', () => {
  it('Fast Sim, GameCast and replay project the same accepted ledger and consume no RNG', () => {
    const run = executePackageEScenario();
    const gameId = run.kernel.world.football.games[0]!.id;
    const before = {
      fingerprint: fingerprintWorld(run.kernel.world),
      rng: { ...run.kernel.world.rng },
    };

    const fast = fastSimSummary(run.kernel.world, gameId);
    const cast = gameCastFrames(run.kernel.world, gameId);
    const replay = footballReplayFacts(run.kernel.world, gameId);

    expect(fast.homeScore).toBe(run.result.game.homeScore);
    expect(fast.awayScore).toBe(run.result.game.awayScore);
    expect(fast.playCount).toBe(run.result.game.playCount);
    expect(cast.map((frame) => frame.playId)).toEqual(
      replay.map((play) => play.id),
    );
    expect(cast.at(-1)?.homeScore).toBe(fast.homeScore);
    expect(cast.at(-1)?.awayScore).toBe(fast.awayScore);
    expect(cast.at(-1)?.terminal).toBe(true);

    const after = {
      fingerprint: fingerprintWorld(run.kernel.world),
      rng: { ...run.kernel.world.rng },
    };
    expect(after).toEqual(before);
    expect(canonicalString(replay)).toBe(
      canonicalString(run.kernel.world.football.plays),
    );
  });
});
