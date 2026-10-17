import {
  GOLDEN_EXPECTED,
  PACKAGE_B_EXPECTED,
  diffGolden,
  diffPackageB,
  runGoldenScenario,
  runGoldenThroughStore,
  runPackageBScenario,
  runPackageBThroughStore,
  type PackageBResult,
} from '@sport-sim/sim-core';
import {
  disposeScratchDatabases,
  openScratchDatabase,
} from '../persistence/scratchDatabase';
import { SqliteCareerStore } from '../persistence/sqliteCareerStore';
import type { DiagnosticLine } from './careerDiagnostics';
import { judgePackageBStoreRun } from './packageBJudgement';

export interface GoldenDiagnostics {
  readonly kernel: DiagnosticLine;
  readonly store: DiagnosticLine;
  readonly fingerprint: string;
  readonly chainHead: string;
}

/**
 * Run the Package A golden scenario in THIS runtime (Hermes in the app): once straight
 * through the kernel and once through the real expo-sqlite store, then compare both with the
 * recorded Node values. Any difference is a cross-runtime determinism failure.
 */
export const runGoldenOnDevice = async (): Promise<GoldenDiagnostics> => {
  const direct = runGoldenScenario();
  const directDiffs = diffGolden(direct, GOLDEN_EXPECTED);
  const kernel: DiagnosticLine =
    directDiffs.length === 0
      ? { ok: true, text: 'MATCH Node golden (fingerprint + event-chain head)' }
      : { ok: false, text: `MISMATCH: ${directDiffs.join(' | ')}` };

  let run;
  try {
    const db = await openScratchDatabase();
    run = await runGoldenThroughStore(new SqliteCareerStore(db));
  } finally {
    await disposeScratchDatabases();
  }
  const storeDiffs = diffGolden(run.result, GOLDEN_EXPECTED);
  if (run.loadStatus !== 'loaded')
    storeDiffs.push(`load status ${run.loadStatus}`);
  if (!run.replayOk) storeDiffs.push('stored history replay failed');
  if (run.reloadedFingerprint !== GOLDEN_EXPECTED.fingerprint)
    storeDiffs.push('reloaded fingerprint differs');
  if (run.reloadedChainHead !== GOLDEN_EXPECTED.eventChainHead)
    storeDiffs.push('reloaded chain head differs');
  const store: DiagnosticLine =
    storeDiffs.length === 0
      ? { ok: true, text: 'MATCH after SQLite save, reload and replay' }
      : { ok: false, text: `MISMATCH: ${storeDiffs.join(' | ')}` };

  return {
    kernel,
    store,
    fingerprint: direct.fingerprint,
    chainHead: direct.eventChainHead,
  };
};

export interface PackageBDiagnostics {
  readonly kernel: DiagnosticLine;
  readonly store: DiagnosticLine;
  readonly fingerprint: string;
  readonly chainHead: string;
  readonly keyRecordIds: PackageBResult['keyRecordIds'];
}

/**
 * Run the Package B organization-divergence scenario in THIS runtime (Hermes in the app),
 * straight through the kernel and through the real expo-sqlite store, and compare both
 * with the recorded Node values.
 */
export const runPackageBOnDevice = async (): Promise<PackageBDiagnostics> => {
  const direct = runPackageBScenario();
  const directDiffs = diffPackageB(direct, PACKAGE_B_EXPECTED);
  const kernel: DiagnosticLine =
    directDiffs.length === 0
      ? {
          ok: true,
          text: 'MATCH Node Package B (fingerprint + event-chain head)',
        }
      : { ok: false, text: `MISMATCH: ${directDiffs.join(' | ')}` };

  let run;
  try {
    const db = await openScratchDatabase();
    run = await runPackageBThroughStore(new SqliteCareerStore(db));
  } finally {
    await disposeScratchDatabases();
  }
  return {
    kernel,
    store: judgePackageBStoreRun(run),
    fingerprint: direct.fingerprint,
    chainHead: direct.eventChainHead,
    keyRecordIds: direct.keyRecordIds,
  };
};
