import { verifyEventChain } from './audit';
import { canonicalString } from './canonical';
import { historySupports, requireMatchingRefs, type LoadOptions } from './careerIntegrity';
import { WorldKernel } from './kernel';
import {
  PersistenceError,
  verifySnapshot,
  type CareerSnapshot,
  type CareerStore,
  type RecoveryReport,
} from './persistence';
import { repairLatestFromHistory } from './replay';

export type LoadOutcome =
  /** Nothing has ever been saved. */
  | { readonly status: 'empty' }
  /** Everything verified; `kernel` continues the career. */
  | { readonly status: 'loaded'; readonly kernel: WorldKernel; readonly snapshot: CareerSnapshot }
  /**
   * The newest snapshot was not trustworthy, so it was rebuilt by deterministic replay of
   * verified history (opt-in via `repair`). `report` records exactly what happened.
   */
  | {
      readonly status: 'recovered';
      readonly kernel: WorldKernel;
      readonly snapshot: CareerSnapshot;
      readonly report: RecoveryReport;
    }
  /**
   * Stored data was NOT trustworthy as-is. `snapshot` is the newest older snapshot that
   * history still supports. It is read-only: stored history is ahead of it, so it is not a
   * state the career may continue from until it is repaired.
   */
  | { readonly status: 'degraded'; readonly snapshot: CareerSnapshot; readonly report: RecoveryReport }
  /** No snapshot could be trusted. */
  | { readonly status: 'failed'; readonly report: RecoveryReport };

const sameReport = (a: RecoveryReport, b: RecoveryReport): boolean => canonicalString(a) === canonicalString(b);

/** Record a recovery once: an identical report as the newest log entry is not repeated. */
export const logRecovery = async (store: CareerStore, report: RecoveryReport): Promise<void> => {
  const log = await store.loadRecoveryLog();
  const last = log[log.length - 1];
  if (last !== undefined && sameReport(last, report)) return;
  await store.markRecovery(report);
};

/**
 * Load a career defensively. It verifies the schema (a future schema throws and is never
 * "recovered"), snapshot hash, ruleset/seed references and the audit-chain head, and it
 * never treats damaged data as valid: any problem produces an explicit RecoveryReport.
 */
export const loadCareer = async (store: CareerStore, options: LoadOptions): Promise<LoadOutcome> => {
  let active: CareerSnapshot | null = null;
  let unreadable: string | null = null;
  try {
    active = await store.loadLatest();
  } catch (error) {
    if (error instanceof PersistenceError && error.code === 'CORRUPT_STORE') unreadable = error.message;
    else throw error; // includes UnsupportedSchemaVersionError: fail closed
  }
  if (active === null && unreadable === null) return { status: 'empty' };

  const history = await store.loadHistorySince(0);
  const events = history.events;
  const chain = verifyEventChain(events);
  const verifiedPrefix = chain.ok ? events.length : chain.index;

  const reasons: string[] = [];
  if (unreadable !== null) reasons.push(`active snapshot unreadable: ${unreadable}`);
  if (active !== null) {
    const verdict = verifySnapshot(active);
    if (!verdict.ok) {
      reasons.push(...verdict.reasons.map((r) => `active snapshot: ${r}`));
    } else {
      requireMatchingRefs(active, options);
    }
    if (!chain.ok) {
      reasons.push(`event history failed verification at event ${chain.index} (${chain.reason})`);
    } else if (events.length < active.eventCount) {
      reasons.push(`event history ends at event ${events.length} but the active snapshot expects ${active.eventCount}`);
    } else if (events.length > active.eventCount) {
      reasons.push(`event history (${events.length} events) is ahead of the active snapshot (${active.eventCount})`);
    } else if (chain.headHash !== active.chainHead) {
      reasons.push('active snapshot chainHead does not match the stored event history');
    }
  }

  if (reasons.length === 0 && active !== null) {
    const kernel = WorldKernel.resume({
      world: active.world,
      ruleset: options.ruleset,
      chainHead: active.chainHead,
      eventCount: active.eventCount,
      knownCommandIds: active.knownCommandIds,
    });
    return { status: 'loaded', kernel, snapshot: active };
  }

  const previousActiveRevision = active?.revision ?? null;

  if (options.repair === true) {
    const repair = await repairLatestFromHistory(store, { ...options, reasons });
    if (repair.status === 'repaired') {
      return { status: 'recovered', kernel: repair.kernel, snapshot: repair.snapshot, report: repair.report };
    }
    reasons.push(...repair.reasons.map((r) => `repair refused: ${r}`));
  }

  // Not trustworthy as-is: pick the newest verified snapshot that history still supports.
  for (const candidate of await store.listVerifiedSnapshots()) {
    if (!historySupports(candidate, events, verifiedPrefix)) continue;
    requireMatchingRefs(candidate, options);
    const report: RecoveryReport = {
      action: 'FELL_BACK_TO_PREVIOUS_SNAPSHOT',
      previousActiveRevision,
      restoredRevision: candidate.revision,
      reasons,
    };
    await logRecovery(store, report);
    return { status: 'degraded', snapshot: candidate, report };
  }
  const report: RecoveryReport = {
    action: 'NO_VERIFIED_SNAPSHOT',
    previousActiveRevision,
    restoredRevision: null,
    reasons,
  };
  await logRecovery(store, report);
  return { status: 'failed', report };
};
