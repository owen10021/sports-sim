import {
  PACKAGE_B_EXPECTED,
  diffPackageB,
  type PackageBStoreRun,
} from '@sport-sim/sim-core';
import type { DiagnosticLine } from './careerDiagnostics';

/** Pure comparison of a Package B store run with the recorded Node values. */
export const judgePackageBStoreRun = (
  run: PackageBStoreRun,
): DiagnosticLine => {
  const diffs = diffPackageB(run.result, PACKAGE_B_EXPECTED);
  if (run.loadStatus !== 'loaded') diffs.push(`load status ${run.loadStatus}`);
  if (!run.replayOk) diffs.push('stored history replay failed');
  if (run.reloadedFingerprint !== PACKAGE_B_EXPECTED.fingerprint)
    diffs.push('reloaded fingerprint differs');
  if (run.reloadedChainHead !== PACKAGE_B_EXPECTED.eventChainHead)
    diffs.push('reloaded chain head differs');
  return diffs.length === 0
    ? { ok: true, text: 'MATCH after SQLite save, reload and replay' }
    : { ok: false, text: `MISMATCH: ${diffs.join(' | ')}` };
};
