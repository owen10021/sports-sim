import { GENESIS_HASH, verifyEventChain, type EventEnvelope } from './audit';
import { canonicalString } from './canonical';
import {
  historySupports,
  requireMatchingRefs,
  type LoadOptions,
} from './careerIntegrity';
import { WorldKernel } from './kernel';
import {
  PersistenceError,
  sealSnapshot,
  verifySnapshot,
  type CareerSnapshot,
  type CareerStore,
  type CommandRecord,
  type RecoveryReport,
} from './persistence';
import type { LeagueRulesetManifest } from './ruleset';
import { fingerprintWorld } from './world';

export type ReplayErrorCode =
  'COMMAND_REJECTED' | 'REVISION_MISMATCH' | 'EVENT_MISMATCH';

export class ReplayError extends Error {
  readonly code: ReplayErrorCode;
  constructor(code: ReplayErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'ReplayError';
    this.code = code;
  }
}

export interface ReplayResult {
  readonly kernel: WorldKernel;
  /** Verified snapshot of the replayed final state. */
  readonly snapshot: CareerSnapshot;
  /** Events produced by the replay. */
  readonly events: readonly EventEnvelope[];
}

/**
 * Re-execute stored commands from `snapshot` through the exact production WorldKernel.
 * There is no alternate mutation path: a command the kernel rejects, or events that differ
 * from `expectedEvents`, are errors rather than being skipped or patched.
 */
export const replayFrom = (
  snapshot: CareerSnapshot,
  ruleset: LeagueRulesetManifest,
  commands: readonly CommandRecord[],
  expectedEvents?: readonly EventEnvelope[],
): ReplayResult => {
  const kernel = WorldKernel.resume({
    world: snapshot.world,
    ruleset,
    chainHead: snapshot.chainHead,
    eventCount: snapshot.eventCount,
    knownCommandIds: snapshot.knownCommandIds,
  });
  const produced: EventEnvelope[] = [];
  for (const record of commands) {
    const result = kernel.execute(record.envelope);
    if (!result.ok) {
      throw new ReplayError(
        'COMMAND_REJECTED',
        `${record.envelope.commandId} was rejected during replay (${result.rejection.code}: ${result.rejection.message})`,
      );
    }
    if (Number(result.world.revision) !== record.resultRevision) {
      throw new ReplayError(
        'REVISION_MISMATCH',
        `${record.envelope.commandId} produced revision ${result.world.revision}, history says ${record.resultRevision}`,
      );
    }
    produced.push(...result.events);
  }
  if (expectedEvents !== undefined) {
    if (produced.length !== expectedEvents.length) {
      throw new ReplayError(
        'EVENT_MISMATCH',
        `replay produced ${produced.length} events, history has ${expectedEvents.length}`,
      );
    }
    for (let i = 0; i < produced.length; i++) {
      if (canonicalString(produced[i]) !== canonicalString(expectedEvents[i])) {
        throw new ReplayError(
          'EVENT_MISMATCH',
          `replayed event ${i} differs from stored event ${i}`,
        );
      }
    }
  }
  return {
    kernel,
    snapshot: sealSnapshot({
      world: kernel.world,
      chainHead: kernel.chainHead,
      eventCount: kernel.eventCount,
      knownCommandIds: kernel.knownCommandIds,
    }),
    events: produced,
  };
};

export interface ReplayVerification {
  readonly ok: boolean;
  readonly reasons: readonly string[];
  /** Fingerprint of the replayed final world (when replay completed). */
  readonly fingerprint?: string;
  /** Audit-chain head of the replayed history (when replay completed). */
  readonly chainHead?: string;
}

const activeOrNull = async (
  store: CareerStore,
): Promise<CareerSnapshot | null> => {
  try {
    return await store.loadLatest();
  } catch (error) {
    if (error instanceof PersistenceError && error.code === 'CORRUPT_STORE')
      return null;
    throw error;
  }
};

/**
 * Replay the ENTIRE stored history from the verified genesis snapshot and compare the final
 * world fingerprint and audit-chain head with what is stored. Read-only.
 */
export const verifyCareerReplay = async (
  store: CareerStore,
  ruleset: LeagueRulesetManifest,
): Promise<ReplayVerification> => {
  const reasons: string[] = [];
  const genesis = (await store.listVerifiedSnapshots()).find(
    (s) => s.revision === 0,
  );
  if (genesis === undefined)
    return {
      ok: false,
      reasons: ['no verified genesis snapshot to replay from'],
    };
  const history = await store.loadHistorySince(0);
  const chain = verifyEventChain(history.events);
  if (!chain.ok)
    reasons.push(
      `event history failed verification at event ${chain.index} (${chain.reason})`,
    );
  let result: ReplayResult;
  try {
    result = replayFrom(genesis, ruleset, history.commands, history.events);
  } catch (error) {
    if (error instanceof Error && error.name === 'ReplayError') {
      return { ok: false, reasons: [...reasons, error.message] };
    }
    throw error;
  }
  const fingerprint = fingerprintWorld(result.kernel.world);
  const chainHead = result.kernel.chainHead;
  const active = await activeOrNull(store);
  if (active === null) {
    reasons.push('no readable active snapshot to compare against');
  } else {
    const verdict = verifySnapshot(active);
    if (!verdict.ok)
      reasons.push(...verdict.reasons.map((r) => `active snapshot: ${r}`));
    if (active.worldFingerprint !== fingerprint)
      reasons.push('active snapshot fingerprint differs from replayed history');
    if (active.chainHead !== chainHead)
      reasons.push('active snapshot chainHead differs from replayed history');
    if (active.eventCount !== history.events.length) {
      reasons.push(
        `active snapshot expects ${active.eventCount} events, history has ${history.events.length}`,
      );
    }
  }
  return { ok: reasons.length === 0, reasons, fingerprint, chainHead };
};

export interface RepairOptions extends LoadOptions {
  /** Why a repair is being attempted (copied into the recovery report). */
  readonly reasons?: readonly string[];
}

export type RepairOutcome =
  | {
      readonly status: 'repaired';
      readonly kernel: WorldKernel;
      readonly snapshot: CareerSnapshot;
      readonly report: RecoveryReport;
    }
  | { readonly status: 'refused'; readonly reasons: readonly string[] };

/**
 * Rebuild the latest snapshot by replaying immutable history from the newest verified
 * snapshot that history supports. It writes ONLY when the whole event chain verifies, the
 * replay matches stored events exactly, and it would not silently discard committed work.
 */
export const repairLatestFromHistory = async (
  store: CareerStore,
  options: RepairOptions,
): Promise<RepairOutcome> => {
  const refuse = (...reasons: string[]): RepairOutcome => ({
    status: 'refused',
    reasons,
  });
  const history = await store.loadHistorySince(0);
  const events = history.events;
  const chain = verifyEventChain(events);
  if (!chain.ok) {
    return refuse(
      `event history failed verification at event ${chain.index} (${chain.reason})`,
    );
  }
  const active = await activeOrNull(store);
  if (active !== null && verifySnapshot(active).ok) {
    if (active.eventCount > events.length) {
      return refuse(
        `history ends at event ${events.length} but the active snapshot expects ${active.eventCount}; repair would discard committed work`,
      );
    }
    if (
      active.eventCount === events.length &&
      active.chainHead === chain.headHash
    ) {
      return refuse(
        'active snapshot already matches history; nothing to repair',
      );
    }
  }
  const base = (await store.listVerifiedSnapshots()).find((s) =>
    historySupports(s, events, events.length),
  );
  if (base === undefined)
    return refuse('no verified snapshot is supported by the stored history');
  requireMatchingRefs(base, options);
  const tail = await store.loadHistorySince(base.revision);
  let result: ReplayResult;
  try {
    result = replayFrom(
      base,
      options.ruleset,
      tail.commands,
      events.slice(base.eventCount),
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'ReplayError')
      return refuse(error.message);
    throw error;
  }
  const tailHash =
    events.length === 0
      ? GENESIS_HASH
      : (events[events.length - 1] as EventEnvelope).hash;
  if (
    result.snapshot.eventCount !== events.length ||
    result.snapshot.chainHead !== tailHash
  ) {
    return refuse('replayed state does not end at the stored history tail');
  }
  const report: RecoveryReport = {
    action: 'REPAIRED_LATEST_FROM_REPLAY',
    previousActiveRevision: active?.revision ?? null,
    restoredRevision: result.snapshot.revision,
    reasons: options.reasons ?? ['repair requested'],
  };
  await store.markRecovery(report, result.snapshot);
  return {
    status: 'repaired',
    kernel: result.kernel,
    snapshot: result.snapshot,
    report,
  };
};
