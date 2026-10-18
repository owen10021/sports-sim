import {
  PACKAGE_D_EXPECTED,
  canonicalString,
  diffPackageD,
  type PackageDResult,
  type PackageDStoreRun,
} from '@sport-sim/sim-core';
import type { DiagnosticLine } from './careerDiagnostics';

/** Pure comparison of a straight-through Package D run with the accepted Node/Hermes identity. */
export const judgePackageDDirectRun = (
  result: PackageDResult,
): DiagnosticLine => {
  const diffs = diffPackageD(result, PACKAGE_D_EXPECTED);
  return diffs.length === 0
    ? { ok: true, text: 'MATCH Node/Hermes Package D' }
    : { ok: false, text: `MISMATCH: ${diffs.join(' | ')}` };
};

/** Pure comparison of a Package D store run with the accepted deterministic identity. */
export const judgePackageDStoreRun = (
  run: PackageDStoreRun,
): DiagnosticLine => {
  const diffs = diffPackageD(run.result, PACKAGE_D_EXPECTED);
  if (run.loadStatus !== 'loaded') diffs.push(`load status ${run.loadStatus}`);
  if (!run.replayOk) diffs.push('stored history replay failed');
  if (run.reloadedFingerprint !== PACKAGE_D_EXPECTED.fingerprint)
    diffs.push('reloaded fingerprint differs');
  if (run.reloadedChainHead !== PACKAGE_D_EXPECTED.eventChainHead)
    diffs.push('reloaded chain head differs');
  if (
    run.reloadedRngState === null ||
    canonicalString(run.reloadedRngState) !==
      canonicalString(PACKAGE_D_EXPECTED.rngState)
  )
    diffs.push('reloaded RNG state differs');
  return diffs.length === 0
    ? { ok: true, text: 'MATCH after SQLite save, reload and replay' }
    : { ok: false, text: `MISMATCH: ${diffs.join(' | ')}` };
};
