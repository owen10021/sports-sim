import {
  PACKAGE_E_EXPECTED,
  canonicalString,
  diffPackageE,
  type PackageEResult,
  type PackageEStoreRun,
} from '@sport-sim/sim-core';
import type { DiagnosticLine } from './careerDiagnostics';

/** Pure comparison of a straight-through Package E run with the accepted Node/Hermes identity. */
export const judgePackageEDirectRun = (
  result: PackageEResult,
): DiagnosticLine => {
  const diffs = diffPackageE(result, PACKAGE_E_EXPECTED);
  return diffs.length === 0
    ? { ok: true, text: 'MATCH Node/Hermes Package E' }
    : { ok: false, text: `MISMATCH: ${diffs.join(' | ')}` };
};

/** Pure comparison of a Package E store run with the accepted deterministic identity. */
export const judgePackageEStoreRun = (
  run: PackageEStoreRun,
): DiagnosticLine => {
  const diffs = diffPackageE(run.result, PACKAGE_E_EXPECTED);
  if (run.loadStatus !== 'loaded') diffs.push(`load status ${run.loadStatus}`);
  if (!run.replayOk) diffs.push('stored history replay failed');
  if (run.reloadedFingerprint !== PACKAGE_E_EXPECTED.fingerprint)
    diffs.push('reloaded fingerprint differs');
  if (run.reloadedChainHead !== PACKAGE_E_EXPECTED.eventChainHead)
    diffs.push('reloaded chain head differs');
  if (
    run.reloadedRngState === null ||
    canonicalString(run.reloadedRngState) !==
      canonicalString(PACKAGE_E_EXPECTED.rngState)
  )
    diffs.push('reloaded RNG state differs');
  if (
    run.reloadedGameIdentity === null ||
    canonicalString(run.reloadedGameIdentity) !==
      canonicalString(PACKAGE_E_EXPECTED.game)
  )
    diffs.push('reloaded game identity differs');
  return diffs.length === 0
    ? { ok: true, text: 'MATCH after SQLite save, reload and replay' }
    : { ok: false, text: `MISMATCH: ${diffs.join(' | ')}` };
};
