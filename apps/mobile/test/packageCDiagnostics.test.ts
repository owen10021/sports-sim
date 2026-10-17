import { describe, expect, it } from 'vitest';
import {
  MemoryCareerStore,
  PACKAGE_C_EXPECTED,
  diffPackageC,
  runPackageCScenario,
  runPackageCThroughStore,
} from '@sport-sim/sim-core';
import {
  judgePackageCDirectRun,
  judgePackageCStoreRun,
} from '../src/diagnostics/packageCJudgement';

describe('Package C on-device diagnostic judgement', () => {
  it('reports MATCH for a clean direct run and a clean store run', async () => {
    expect(judgePackageCDirectRun(runPackageCScenario())).toEqual({
      ok: true,
      text: 'MATCH Node Package C (fingerprint + event-chain head)',
    });
    const run = await runPackageCThroughStore(new MemoryCareerStore());
    expect(judgePackageCStoreRun(run)).toEqual({
      ok: true,
      text: 'MATCH after SQLite save, reload and replay',
    });
  }, 120_000);

  it('reports MISMATCH when any recorded value differs', async () => {
    const run = await runPackageCThroughStore(new MemoryCareerStore());
    const badStore = judgePackageCStoreRun({
      ...run,
      reloadedFingerprint: 'not-the-fingerprint',
    });
    expect(badStore.ok).toBe(false);
    expect(badStore.text).toContain('reloaded fingerprint differs');
    const badReplay = judgePackageCStoreRun({ ...run, replayOk: false });
    expect(badReplay.ok).toBe(false);
    expect(badReplay.text).toContain('stored history replay failed');
    const direct = judgePackageCDirectRun({
      ...run.result,
      fingerprint: 'drifted',
    });
    expect(direct.ok).toBe(false);
    expect(direct.text).toContain('fingerprint');
    expect(diffPackageC(run.result, PACKAGE_C_EXPECTED)).toEqual([]);
  }, 120_000);
});
