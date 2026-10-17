import { canonicalString } from './canonical';
import {
  verifyEventChain,
  type CommandEnvelope,
  type EventEnvelope,
} from './audit';
import { hashCanonical, isHash } from './hash';
import { SCHEMA_VERSION, UnsupportedSchemaVersionError } from './provenance';
import { deepFreeze, fingerprintWorld, type FootballWorld } from './world';

/**
 * Persistence contract. Everything here is plain data: nothing depends on SQLite,
 * Expo, the filesystem or the clock, so the same DTOs back every adapter.
 */

/** Complete, self-verifying capture of a career at one revision. */
export interface CareerSnapshot {
  readonly schemaVersion: number;
  readonly worldId: string;
  readonly revision: number;
  /** Total events committed in the career up to and including this revision. */
  readonly eventCount: number;
  /** Audit chain head at this revision (GENESIS_HASH when eventCount is 0). */
  readonly chainHead: string;
  readonly worldFingerprint: string;
  /** Command ids already committed; restored so duplicates stay rejected after restart. */
  readonly knownCommandIds: readonly string[];
  readonly world: FootballWorld;
  /** SHA-256 over every other field. */
  readonly contentHash: string;
}

/** A committed command, kept so replay can re-execute it through the production kernel. */
export interface CommandRecord {
  readonly envelope: CommandEnvelope;
  /** World revision produced by this command. */
  readonly resultRevision: number;
}

/** Everything one atomic save writes. */
export interface CommitRecord {
  readonly snapshot: CareerSnapshot;
  readonly commands: readonly CommandRecord[];
  readonly events: readonly EventEnvelope[];
}

export interface HistorySlice {
  readonly commands: readonly CommandRecord[];
  readonly events: readonly EventEnvelope[];
}

export type RecoveryAction =
  | 'FELL_BACK_TO_PREVIOUS_SNAPSHOT'
  | 'REPAIRED_LATEST_FROM_REPLAY'
  | 'NO_VERIFIED_SNAPSHOT';

/** Explicit record that stored data was not trusted as-is. Never produced silently. */
export interface RecoveryReport {
  readonly action: RecoveryAction;
  /** Revision of the snapshot that was active before recovery (null if none/unreadable). */
  readonly previousActiveRevision: number | null;
  /** Revision of the snapshot that is active after recovery (null if none). */
  readonly restoredRevision: number | null;
  readonly reasons: readonly string[];
}

export type PersistenceErrorCode =
  'NOT_INITIALIZED' | 'COMMIT_REJECTED' | 'WRITE_FAILED' | 'CORRUPT_STORE';

export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode;
  constructor(code: PersistenceErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'PersistenceError';
    this.code = code;
  }
}

/**
 * Durable home of a single career. Implementations never decide simulation outcomes;
 * they atomically persist what the kernel already committed, and fail closed.
 *
 * Guarantees every implementation must provide (see careerStoreContractCases):
 *  - saveCommit is all-or-nothing: a failure leaves the previous active snapshot loadable.
 *  - an unsupported (future) schemaVersion is rejected on save and on load.
 *  - previous verified snapshots stay available (genesis plus the newest few).
 *  - nothing returned by a store aliases its internal state.
 */
export interface CareerStore {
  initialize(): Promise<void>;
  saveCommit(commit: CommitRecord): Promise<void>;
  /** The active snapshot exactly as stored, or null for an empty store. */
  loadLatest(): Promise<CareerSnapshot | null>;
  /** Snapshots whose content hash verifies, newest first. */
  listVerifiedSnapshots(): Promise<readonly CareerSnapshot[]>;
  /** Commands and events whose resulting revision is greater than `revision`. */
  loadHistorySince(revision: number): Promise<HistorySlice>;
  /**
   * Record a recovery. When `repairedSnapshot` is given it becomes the active snapshot
   * (it must be consistent with the stored history). Reports are append-only.
   */
  markRecovery(
    report: RecoveryReport,
    repairedSnapshot?: CareerSnapshot,
  ): Promise<void>;
  /** Append-only recovery log, oldest first. */
  loadRecoveryLog(): Promise<readonly RecoveryReport[]>;
}

/** Newest snapshots retained in addition to the genesis snapshot (revision 0). */
export const SNAPSHOT_RETENTION_NEWEST = 4;

export interface SnapshotInput {
  readonly world: FootballWorld;
  readonly chainHead: string;
  readonly eventCount: number;
  readonly knownCommandIds: readonly string[];
}

const snapshotBody = (s: Omit<CareerSnapshot, 'contentHash'>) => ({
  schemaVersion: s.schemaVersion,
  worldId: s.worldId,
  revision: s.revision,
  eventCount: s.eventCount,
  chainHead: s.chainHead,
  worldFingerprint: s.worldFingerprint,
  knownCommandIds: s.knownCommandIds,
  world: s.world,
});

export const hashSnapshotBody = (
  s: Omit<CareerSnapshot, 'contentHash'>,
): string =>
  hashCanonical({
    domain: 'sport-sim/career-snapshot',
    version: 1,
    body: snapshotBody(s),
  });

/** Seal kernel state into a snapshot DTO. */
export const sealSnapshot = (input: SnapshotInput): CareerSnapshot => {
  const body = {
    schemaVersion: SCHEMA_VERSION as number,
    worldId: input.world.worldId as string,
    revision: input.world.revision as number,
    eventCount: input.eventCount,
    chainHead: input.chainHead,
    worldFingerprint: fingerprintWorld(input.world),
    knownCommandIds: [...input.knownCommandIds].sort(),
    world: input.world,
  };
  return deepFreeze({ ...body, contentHash: hashSnapshotBody(body) });
};

export type SnapshotVerification =
  | { readonly ok: true }
  | { readonly ok: false; readonly reasons: readonly string[] };

/**
 * Check a snapshot is internally consistent. Throws UnsupportedSchemaVersionError for a
 * future schema (a build must never interpret data it does not understand); every other
 * defect is reported as reasons so callers can recover explicitly.
 */
export const verifySnapshot = (value: unknown): SnapshotVerification => {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, reasons: ['snapshot is not an object'] };
  }
  const s = value as Record<string, unknown>;
  if (s.schemaVersion !== SCHEMA_VERSION) {
    if (
      typeof s.schemaVersion === 'number' &&
      Number.isInteger(s.schemaVersion)
    ) {
      throw new UnsupportedSchemaVersionError(
        'career snapshot',
        s.schemaVersion,
      );
    }
    return { ok: false, reasons: ['schemaVersion missing or not an integer'] };
  }
  const reasons: string[] = [];
  const world = s.world as FootballWorld | undefined;
  if (typeof world !== 'object' || world === null) {
    return { ok: false, reasons: ['world missing'] };
  }
  if (!isHash(s.contentHash)) reasons.push('contentHash malformed');
  if (!isHash(s.chainHead)) reasons.push('chainHead malformed');
  if (!Array.isArray(s.knownCommandIds))
    reasons.push('knownCommandIds malformed');
  try {
    const body = snapshotBody(
      s as unknown as Omit<CareerSnapshot, 'contentHash'>,
    );
    canonicalString(body);
    if (
      hashSnapshotBody(s as unknown as Omit<CareerSnapshot, 'contentHash'>) !==
      s.contentHash
    ) {
      reasons.push('contentHash does not match snapshot content');
    }
    if (fingerprintWorld(world) !== s.worldFingerprint)
      reasons.push('worldFingerprint mismatch');
  } catch (e) {
    reasons.push(
      `snapshot not canonical: ${e instanceof Error ? e.message : 'unknown'}`,
    );
  }
  if (world.worldId !== s.worldId) reasons.push('worldId disagrees with world');
  if (world.revision !== s.revision)
    reasons.push('revision disagrees with world');
  if (world.nextIds && world.nextIds.event !== (s.eventCount as number) + 1) {
    reasons.push('eventCount disagrees with world.nextIds');
  }
  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
};

/**
 * Validate that `commit` is a legal successor of `latest` (null for the first save).
 * Shared by every adapter so they cannot drift apart. Returns the reason, or null if legal.
 */
export const checkCommitContinuity = (
  latest: CareerSnapshot | null,
  commit: CommitRecord,
  storedEventCount: number,
): string | null => {
  const { snapshot, commands, events } = commit;
  if (storedEventCount !== (latest?.eventCount ?? 0)) {
    return 'stored history is out of step with the active snapshot; recover before saving';
  }
  const verdict = verifySnapshot(snapshot);
  if (!verdict.ok) return `snapshot invalid: ${verdict.reasons.join('; ')}`;
  if (commands.length > events.length) {
    return 'more commands than events';
  }
  if (latest === null) {
    if (
      snapshot.revision !== 0 ||
      snapshot.eventCount !== 0 ||
      events.length !== 0
    ) {
      return 'first save must be the genesis snapshot (revision 0, no events)';
    }
    return null;
  }
  if (snapshot.worldId !== latest.worldId)
    return 'snapshot belongs to a different world';
  if (snapshot.revision <= latest.revision) {
    return `revision ${snapshot.revision} does not advance past ${latest.revision}`;
  }
  if (snapshot.eventCount !== latest.eventCount + events.length) {
    return 'eventCount does not equal prior count plus supplied events';
  }
  const chain = verifyEventChain(events, latest.chainHead);
  if (!chain.ok)
    return `event chain invalid: ${chain.reason} at ${chain.index}`;
  if (chain.headHash !== snapshot.chainHead)
    return 'snapshot chainHead does not match supplied events';
  for (const c of commands) {
    if (
      c.resultRevision <= latest.revision ||
      c.resultRevision > snapshot.revision
    ) {
      return 'command resultRevision outside the committed range';
    }
    if (latest.knownCommandIds.includes(c.envelope.commandId)) {
      return `command ${c.envelope.commandId} was already committed`;
    }
    if (!snapshot.knownCommandIds.includes(c.envelope.commandId)) {
      return `snapshot does not record command ${c.envelope.commandId}`;
    }
  }
  return null;
};

/** Plain-data deep copy via canonical JSON; frozen so callers cannot alias store state. */
export const cloneData = <T>(value: T): T =>
  deepFreeze(JSON.parse(canonicalString(value)) as T);

/** Revisions to keep after a save: genesis (0) plus the newest few, so replay can always start at genesis. */
export const retainedRevisions = (
  revisions: readonly number[],
): Set<number> => {
  const sorted = [...revisions].sort((a, b) => a - b);
  const keep = new Set<number>([0]);
  for (const r of sorted.slice(-SNAPSHOT_RETENTION_NEWEST)) keep.add(r);
  return keep;
};

/**
 * A repaired snapshot may only be installed if it describes the stored history exactly:
 * it must cover every stored event and carry the audit head of the stored tail.
 * Returns the reason it is unacceptable, or null.
 */
export const checkRepairConsistency = (
  repaired: CareerSnapshot,
  storedEventCount: number,
  storedTailHash: string,
): string | null => {
  const verdict = verifySnapshot(repaired);
  if (!verdict.ok)
    return `repaired snapshot invalid: ${verdict.reasons.join('; ')}`;
  if (
    repaired.eventCount !== storedEventCount ||
    repaired.chainHead !== storedTailHash
  ) {
    return 'repaired snapshot does not match the stored history tail';
  }
  return null;
};
