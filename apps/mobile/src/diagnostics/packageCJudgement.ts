import {
  PACKAGE_C_EXPECTED,
  diffPackageC,
  type PackageCResult,
  type PackageCStoreRun,
} from '@sport-sim/sim-core';
import type { DiagnosticLine } from './careerDiagnostics';

/** Pure comparison of a straight-through Package C run with the recorded Node values. */
export const judgePackageCDirectRun = (
  result: PackageCResult,
): DiagnosticLine => {
  const diffs = diffPackageC(result, PACKAGE_C_EXPECTED);
  return diffs.length === 0
    ? {
        ok: true,
        text: 'MATCH Node Package C (fingerprint + event-chain head)',
      }
    : { ok: false, text: `MISMATCH: ${diffs.join(' | ')}` };
};

/** Pure comparison of a Package C store run with the recorded Node values. */
export const judgePackageCStoreRun = (
  run: PackageCStoreRun,
): DiagnosticLine => {
  const diffs = diffPackageC(run.result, PACKAGE_C_EXPECTED);
  if (run.loadStatus !== 'loaded') diffs.push(`load status ${run.loadStatus}`);
  if (!run.replayOk) diffs.push('stored history replay failed');
  if (run.reloadedFingerprint !== PACKAGE_C_EXPECTED.fingerprint)
    diffs.push('reloaded fingerprint differs');
  if (run.reloadedChainHead !== PACKAGE_C_EXPECTED.eventChainHead)
    diffs.push('reloaded chain head differs');
  return diffs.length === 0
    ? { ok: true, text: 'MATCH after SQLite save, reload and replay' }
    : { ok: false, text: `MISMATCH: ${diffs.join(' | ')}` };
};
