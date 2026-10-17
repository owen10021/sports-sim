import { GENESIS_HASH, type EventEnvelope } from './audit';
import {
  PersistenceError,
  SNAPSHOT_RETENTION_NEWEST,
  checkCommitContinuity,
  cloneData,
  verifySnapshot,
  type CareerSnapshot,
  type CareerStore,
  type CommandRecord,
  type CommitRecord,
  type HistorySlice,
  type RecoveryReport,
} from './persistence';

/**
 * Reference CareerStore that keeps everything in memory. It defines the behaviour every
 * real adapter must match, and lets the shared contract run without a mobile runtime.
 * Not for shipping: data does not survive a process restart.
 */
export class MemoryCareerStore implements CareerStore {
  #initialized = false;
  #snapshots: CareerSnapshot[] = []; // ascending by revision
  #activeRevision: number | null = null;
  #commands: CommandRecord[] = [];
  #events: EventEnvelope[] = [];
  #recovery: RecoveryReport[] = [];
  #failNext = false;

  /** Test seam: the next saveCommit fails after validation, before any state changes. */
  failNextCommit(): void {
    this.#failNext = true;
  }

  /**
   * Test seam: replace a stored snapshot with the result of `mutate` applied to a plain
   * (unfrozen) copy, bypassing every check. Simulates on-disk corruption.
   */
  tamperWithSnapshotForTest(
    revision: number,
    mutate: (plain: Record<string, unknown>) => Record<string, unknown>,
  ): void {
    const i = this.#snapshots.findIndex((s) => s.revision === revision);
    if (i < 0) throw new Error(`no snapshot at revision ${revision}`);
    const plain = JSON.parse(JSON.stringify(this.#snapshots[i])) as Record<string, unknown>;
    this.#snapshots[i] = mutate(plain) as unknown as CareerSnapshot;
  }

  async initialize(): Promise<void> {
    this.#initialized = true;
  }

  #requireInit(): void {
    if (!this.#initialized) throw new PersistenceError('NOT_INITIALIZED', 'call initialize() first');
  }

  #active(): CareerSnapshot | null {
    if (this.#activeRevision === null) return null;
    return this.#snapshots.find((s) => s.revision === this.#activeRevision) ?? null;
  }

  async saveCommit(input: CommitRecord): Promise<void> {
    this.#requireInit();
    const commit = cloneData(input);
    // Throws UnsupportedSchemaVersionError for a future schema (fail closed).
    verifySnapshot(commit.snapshot);
    const reason = checkCommitContinuity(this.#active(), commit);
    if (reason !== null) throw new PersistenceError('COMMIT_REJECTED', reason);
    if (this.#failNext) {
      this.#failNext = false;
      throw new PersistenceError('WRITE_FAILED', 'injected fault before commit');
    }
    // Build the complete next state, then swap it in as one step.
    const snapshots = [...this.#snapshots, commit.snapshot].sort((a, b) => a.revision - b.revision);
    const keep = new Set<number>([0]);
    for (const s of snapshots.slice(-SNAPSHOT_RETENTION_NEWEST)) keep.add(s.revision);
    const nextSnapshots = snapshots.filter((s) => keep.has(s.revision));
    const nextCommands = [...this.#commands, ...commit.commands];
    const nextEvents = [...this.#events, ...commit.events];
    this.#snapshots = nextSnapshots;
    this.#commands = nextCommands;
    this.#events = nextEvents;
    this.#activeRevision = commit.snapshot.revision;
  }

  async loadLatest(): Promise<CareerSnapshot | null> {
    this.#requireInit();
    const active = this.#active();
    if (active === null) return null;
    verifySnapshot(active); // throws for unsupported schema; other defects are Task 9's concern
    return cloneData(active);
  }

  async listVerifiedSnapshots(): Promise<readonly CareerSnapshot[]> {
    this.#requireInit();
    const out: CareerSnapshot[] = [];
    for (const s of [...this.#snapshots].reverse()) {
      if (verifySnapshot(s).ok) out.push(cloneData(s));
    }
    return out;
  }

  async loadHistorySince(revision: number): Promise<HistorySlice> {
    this.#requireInit();
    return cloneData({
      commands: this.#commands.filter((c) => c.resultRevision > revision),
      events: this.#events.filter((e) => e.revision > revision),
    });
  }

  async markRecovery(report: RecoveryReport, repairedSnapshot?: CareerSnapshot): Promise<void> {
    this.#requireInit();
    const entry = cloneData(report);
    if (repairedSnapshot === undefined) {
      this.#recovery = [...this.#recovery, entry];
      return;
    }
    const repaired = cloneData(repairedSnapshot);
    const verdict = verifySnapshot(repaired);
    if (!verdict.ok) {
      throw new PersistenceError('COMMIT_REJECTED', `repaired snapshot invalid: ${verdict.reasons.join('; ')}`);
    }
    const tail = this.#events.length === 0 ? GENESIS_HASH : (this.#events[this.#events.length - 1] as EventEnvelope).hash;
    if (repaired.eventCount !== this.#events.length || repaired.chainHead !== tail) {
      throw new PersistenceError('COMMIT_REJECTED', 'repaired snapshot does not match the stored history tail');
    }
    const snapshots = [...this.#snapshots.filter((s) => s.revision !== repaired.revision), repaired].sort(
      (a, b) => a.revision - b.revision,
    );
    this.#snapshots = snapshots;
    this.#activeRevision = repaired.revision;
    this.#recovery = [...this.#recovery, entry];
  }

  async loadRecoveryLog(): Promise<readonly RecoveryReport[]> {
    this.#requireInit();
    return cloneData(this.#recovery);
  }
}
