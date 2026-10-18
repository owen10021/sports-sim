import { describe, expect, it } from 'vitest';
import {
  MemoryCareerStore,
  PACKAGE_E_EXPECTED,
  canonicalString,
  diffPackageE,
  executePackageEScenario,
  fastSimSummary,
  fingerprintWorld,
  gameCastFrames,
  runPackageEScenario,
  runPackageEThroughStore,
} from '@sport-sim/sim-core';
import {
  judgePackageEDirectRun,
  judgePackageEStoreRun,
} from '../src/diagnostics/packageEJudgement';

describe('Package E on-device diagnostic judgement', () => {
  it('reports MATCH for a clean direct run and a clean store run', async () => {
    expect(judgePackageEDirectRun(runPackageEScenario())).toEqual({
      ok: true,
      text: 'MATCH Node/Hermes Package E',
    });
    const run = await runPackageEThroughStore(new MemoryCareerStore());
    expect(judgePackageEStoreRun(run)).toEqual({
      ok: true,
      text: 'MATCH after SQLite save, reload and replay',
    });
  }, 120_000);

  it('reports MISMATCH for deterministic identity, RNG, replay, game, or record-ID drift', async () => {
    const run = await runPackageEThroughStore(new MemoryCareerStore());
    expect(diffPackageE(run.result, PACKAGE_E_EXPECTED)).toEqual([]);

    const badRng = judgePackageEDirectRun({
      ...run.result,
      rngState: {
        ...run.result.rngState,
        draws: run.result.rngState.draws + 1,
      },
    });
    expect(badRng.ok).toBe(false);
    expect(badRng.text).toContain('rngState');

    const badReplay = judgePackageEStoreRun({ ...run, replayOk: false });
    expect(badReplay.ok).toBe(false);
    expect(badReplay.text).toContain('stored history replay failed');

    const badReloadedRng = judgePackageEStoreRun({
      ...run,
      reloadedRngState: run.reloadedRngState
        ? { ...run.reloadedRngState, draws: run.reloadedRngState.draws + 1 }
        : null,
    });
    expect(badReloadedRng.ok).toBe(false);
    expect(badReloadedRng.text).toContain('reloaded RNG state differs');

    const badGame = judgePackageEStoreRun({
      ...run,
      reloadedGameIdentity: run.reloadedGameIdentity
        ? {
            ...run.reloadedGameIdentity,
            homeScore: run.reloadedGameIdentity.homeScore + 1,
          }
        : null,
    });
    expect(badGame.ok).toBe(false);
    expect(badGame.text).toContain('reloaded game identity differs');

    const badIds = judgePackageEDirectRun({
      ...run.result,
      keyRecordIds: {
        ...run.result.keyRecordIds,
        gameId: 'rec-drifted',
      },
    });
    expect(badIds.ok).toBe(false);
    expect(badIds.text).toContain('keyRecordIds');
  }, 120_000);

  it('proves reading Fast Sim and GameCast cannot mutate the accepted identity', () => {
    const { kernel } = executePackageEScenario();
    const game = kernel.world.football.games[0]!;
    const before = {
      fingerprint: fingerprintWorld(kernel.world),
      rng: canonicalString(kernel.world.rng),
      football: canonicalString(kernel.world.football),
    };
    void fastSimSummary(kernel.world, game.id);
    void gameCastFrames(kernel.world, game.id, game.homeOrganizationId);
    expect(fingerprintWorld(kernel.world)).toBe(before.fingerprint);
    expect(canonicalString(kernel.world.rng)).toBe(before.rng);
    expect(canonicalString(kernel.world.football)).toBe(before.football);
  }, 30_000);
});
