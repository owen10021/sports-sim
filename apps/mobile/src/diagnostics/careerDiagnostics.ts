import {
  SYNTHETIC_RULESET,
  SYNTHETIC_SEED,
  loadCareer,
  verifyCareerReplay,
  type ContractResult,
} from '@sport-sim/sim-core';
import type { CareerLifecycle } from '../lifecycle/careerLifecycle';

export interface DiagnosticLine {
  readonly ok: boolean;
  readonly text: string;
}

/** Re-verifies the saved career from storage WITHOUT repairing anything. */
export const verifySavedCareer = async (
  life: CareerLifecycle,
): Promise<DiagnosticLine> => {
  try {
    const outcome = await loadCareer(life.store, {
      ruleset: SYNTHETIC_RULESET,
      seed: SYNTHETIC_SEED,
    });
    switch (outcome.status) {
      case 'empty':
        return { ok: true, text: 'Nothing saved yet' };
      case 'loaded':
        return {
          ok: true,
          text: `Verified: snapshot hash, ruleset/seed refs and event chain (rev ${outcome.snapshot.revision})`,
        };
      case 'recovered':
        return { ok: true, text: `Recovered: ${outcome.report.action}` };
      case 'degraded':
        return {
          ok: false,
          text: `DEGRADED: ${outcome.report.reasons.join('; ')}`,
        };
      case 'failed':
        return {
          ok: false,
          text: `FAILED: ${outcome.report.reasons.join('; ')}`,
        };
    }
  } catch (error) {
    return {
      ok: false,
      text: error instanceof Error ? error.message : String(error),
    };
  }
};

/** Replays the whole stored history through the production kernel and compares results. */
export const verifySavedReplay = async (
  life: CareerLifecycle,
): Promise<DiagnosticLine> => {
  try {
    const result = await verifyCareerReplay(life.store, SYNTHETIC_RULESET);
    return result.ok
      ? {
          ok: true,
          text: `Replay matches stored state (fingerprint ${result.fingerprint?.slice(0, 12)}...)`,
        }
      : { ok: false, text: `Replay MISMATCH: ${result.reasons.join('; ')}` };
  } catch (error) {
    return {
      ok: false,
      text: error instanceof Error ? error.message : String(error),
    };
  }
};

export const summarizeContract = (
  results: readonly ContractResult[],
): DiagnosticLine => {
  const failed = results.filter((r) => !r.passed);
  return failed.length === 0
    ? { ok: true, text: `PASS ${results.length}/${results.length}` }
    : {
        ok: false,
        text: `FAIL ${failed.length}/${results.length}: ${failed.map((f) => `${f.name} -> ${f.error ?? ''}`).join(' | ')}`,
      };
};
