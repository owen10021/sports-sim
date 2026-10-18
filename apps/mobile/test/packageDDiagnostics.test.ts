import { describe, expect, it } from 'vitest';
import {
  MemoryCareerStore,
  PACKAGE_D_EXPECTED,
  diffPackageD,
  runPackageDScenario,
  runPackageDThroughStore,
} from '@sport-sim/sim-core';
import {
  judgePackageDDirectRun,
  judgePackageDStoreRun,
} from '../src/diagnostics/packageDJudgement';

describe('Package D on-device diagnostic judgement', () => {
  it('reports MATCH for a clean direct run and a clean store run', async () => {
    expect(judgePackageDDirectRun(runPackageDScenario())).toEqual({
      ok: true,
      text: 'MATCH Node/Hermes Package D',
    });
    const run = await runPackageDThroughStore(new MemoryCareerStore());
    expect(judgePackageDStoreRun(run)).toEqual({
      ok: true,
      text: 'MATCH after SQLite save, reload and replay',
    });
  }, 120_000);

  it('reports MISMATCH for deterministic identity, RNG, replay, or record-ID drift', async () => {
    const run = await runPackageDThroughStore(new MemoryCareerStore());
    expect(diffPackageD(run.result, PACKAGE_D_EXPECTED)).toEqual([]);

    const direct = judgePackageDDirectRun({
      ...run.result,
      rngState: {
        ...run.result.rngState,
        draws: run.result.rngState.draws + 1,
      },
    });
    expect(direct.ok).toBe(false);
    expect(direct.text).toContain('rngState');

    const badReplay = judgePackageDStoreRun({ ...run, replayOk: false });
    expect(badReplay.ok).toBe(false);
    expect(badReplay.text).toContain('stored history replay failed');

    const badRng = judgePackageDStoreRun({
      ...run,
      reloadedRngState: run.reloadedRngState
        ? { ...run.reloadedRngState, draws: run.reloadedRngState.draws + 1 }
        : null,
    });
    expect(badRng.ok).toBe(false);
    expect(badRng.text).toContain('reloaded RNG state differs');

    const badIds = judgePackageDDirectRun({
      ...run.result,
      keyRecordIds: { ...run.result.keyRecordIds, planId: 'rec-drifted' },
    });
    expect(badIds.ok).toBe(false);
    expect(badIds.text).toContain('keyRecordIds');
  }, 120_000);
});
