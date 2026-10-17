import {
  GOLDEN_EXPECTED,
  diffGolden,
  runGoldenScenario,
  runGoldenThroughStore,
} from '@sport-sim/sim-core';
import { ExpoSqliteDatabase } from '../persistence/expoSqliteDatabase';
import { SqliteCareerStore } from '../persistence/sqliteCareerStore';
import type { DiagnosticLine } from './careerDiagnostics';

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

  const db = await ExpoSqliteDatabase.open(':memory:');
  const run = await runGoldenThroughStore(new SqliteCareerStore(db));
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
