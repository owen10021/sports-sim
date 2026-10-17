import { describe, expect, it } from 'vitest';
import {
  MemoryCareerStore,
  PACKAGE_B_EXPECTED,
  runPackageBThroughStore,
} from '@sport-sim/sim-core';
import { judgePackageBStoreRun } from '../src/diagnostics/packageBJudgement';

describe('Package B on-device diagnostic judgement', () => {
  it('reports MATCH for a clean store run', async () => {
    const run = await runPackageBThroughStore(new MemoryCareerStore());
    expect(judgePackageBStoreRun(run)).toEqual({
      ok: true,
      text: 'MATCH after SQLite save, reload and replay',
    });
  });

  it('reports MISMATCH when any recorded value differs', async () => {
    const run = await runPackageBThroughStore(new MemoryCareerStore());
    const bad = {
      ...run,
      reloadedFingerprint: 'not-the-fingerprint',
    };
    const line = judgePackageBStoreRun(bad);
    expect(line.ok).toBe(false);
    expect(line.text).toContain('reloaded fingerprint differs');
    expect(PACKAGE_B_EXPECTED.fingerprint).toHaveLength(64);
  });
});
