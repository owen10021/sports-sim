import {
  GENESIS_HASH,
  PersistenceError,
  SCHEMA_VERSION,
  UnsupportedSchemaVersionError,
  canonicalString,
  checkCommitContinuity,
  checkRepairConsistency,
  cloneData,
  retainedRevisions,
  verifySnapshot,
  type CareerSnapshot,
  type CareerStore,
  type CommandRecord,
  type CommitRecord,
  type EventEnvelope,
  type HistorySlice,
  type RecoveryReport,
} from '@sport-sim/sim-core';
import type { SqlDatabase, SqlExecutor } from './sqlDatabase';

/** SQLite `PRAGMA user_version` for this layout. Older builds refuse newer files. */
export const SQLITE_STORE_VERSION = 1;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS snapshots (
  revision      INTEGER PRIMARY KEY,
  event_count   INTEGER NOT NULL,
  content_hash  TEXT NOT NULL,
  snapshot_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS metadata (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  schema_version  INTEGER NOT NULL,
  world_id        TEXT NOT NULL,
  active_revision INTEGER NOT NULL
    REFERENCES snapshots(revision) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE IF NOT EXISTS commands (
  command_id      TEXT PRIMARY KEY,
  ordinal         INTEGER NOT NULL UNIQUE,
  result_revision INTEGER NOT NULL,
  envelope_json   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  ordinal    INTEGER PRIMARY KEY,
  event_id   TEXT NOT NULL UNIQUE,
  revision   INTEGER NOT NULL,
  command_id TEXT NOT NULL REFERENCES commands(command_id),
  hash       TEXT NOT NULL,
  event_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS recovery_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  report_json TEXT NOT NULL
);
`;

export interface SqliteCareerStoreOptions {
  /** Test/diagnostic seam: runs after the final statement, immediately before COMMIT. */
  readonly faultBeforeCommit?: () => void;
}

interface SnapshotRow {
  revision: number;
  snapshot_json: string;
}

const parseJson = <T>(text: string, what: string): T => {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new PersistenceError('CORRUPT_STORE', `${what} is not valid JSON`);
  }
};

/**
 * CareerStore backed by SQLite. It only persists what the kernel already committed.
 * A save writes commands, events and the verified snapshot inside ONE transaction and
 * moves the active-snapshot pointer as the FINAL statement, so a failure at any earlier
 * point rolls back and the previous active snapshot stays loadable.
 */
export class SqliteCareerStore implements CareerStore {
  readonly #db: SqlDatabase;
  readonly #options: SqliteCareerStoreOptions;
  #initialized = false;
  #failNext = false;

  constructor(db: SqlDatabase, options: SqliteCareerStoreOptions = {}) {
    this.#db = db;
    this.#options = options;
  }

  /** Arm a one-shot fault that fires immediately before the next COMMIT. */
  failNextCommit(): void {
    this.#failNext = true;
  }

  async initialize(): Promise<void> {
    await this.#db.exec('PRAGMA foreign_keys = ON;');
    const rows = await this.#db.all<{ user_version: number }>(
      'PRAGMA user_version',
    );
    const version = rows[0]?.user_version ?? 0;
    if (version > SQLITE_STORE_VERSION) {
      throw new UnsupportedSchemaVersionError('sqlite career store', version);
    }
    await this.#db.transaction(async (tx) => {
      for (const statement of SCHEMA_SQL.split(';')) {
        if (statement.trim().length > 0) await tx.run(statement);
      }
      await tx.run(`PRAGMA user_version = ${SQLITE_STORE_VERSION}`);
    });
    this.#initialized = true;
  }

  #requireInit(): void {
    if (!this.#initialized)
      throw new PersistenceError('NOT_INITIALIZED', 'call initialize() first');
  }

  async #readActive(tx: SqlExecutor): Promise<CareerSnapshot | null> {
    const rows = await tx.all<SnapshotRow>(
      `SELECT s.revision AS revision, s.snapshot_json AS snapshot_json
         FROM metadata m JOIN snapshots s ON s.revision = m.active_revision
        WHERE m.id = 1`,
    );
    const row = rows[0];
    return row === undefined
      ? null
      : parseJson<CareerSnapshot>(row.snapshot_json, 'active snapshot');
  }

  async #storedTail(
    tx: SqlExecutor,
  ): Promise<{ count: number; tailHash: string }> {
    const counts = await tx.all<{ n: number }>(
      'SELECT COUNT(*) AS n FROM events',
    );
    const tail = await tx.all<{ hash: string }>(
      'SELECT hash FROM events ORDER BY ordinal DESC LIMIT 1',
    );
    return {
      count: counts[0]?.n ?? 0,
      tailHash: tail[0]?.hash ?? GENESIS_HASH,
    };
  }

  async saveCommit(input: CommitRecord): Promise<void> {
    this.#requireInit();
    const commit = cloneData(input);
    verifySnapshot(commit.snapshot); // future schema throws before the database is touched
    try {
      await this.#db.transaction(async (tx) => {
        const latest = await this.#readActive(tx);
        const stored = await this.#storedTail(tx);
        const reason = checkCommitContinuity(latest, commit, stored.count);
        if (reason !== null)
          throw new PersistenceError('COMMIT_REJECTED', reason);

        const commandCount =
          (await tx.all<{ n: number }>('SELECT COUNT(*) AS n FROM commands'))[0]
            ?.n ?? 0;
        for (let i = 0; i < commit.commands.length; i++) {
          const c = commit.commands[i] as CommandRecord;
          await tx.run(
            'INSERT INTO commands (command_id, ordinal, result_revision, envelope_json) VALUES (?, ?, ?, ?)',
            [
              c.envelope.commandId,
              commandCount + i + 1,
              c.resultRevision,
              canonicalString(c.envelope),
            ],
          );
        }
        for (let i = 0; i < commit.events.length; i++) {
          const e = commit.events[i] as EventEnvelope;
          await tx.run(
            'INSERT INTO events (ordinal, event_id, revision, command_id, hash, event_json) VALUES (?, ?, ?, ?, ?, ?)',
            [
              stored.count + i + 1,
              e.eventId,
              e.revision,
              e.commandId,
              e.hash,
              canonicalString(e),
            ],
          );
        }
        const s = commit.snapshot;
        await tx.run(
          'INSERT INTO snapshots (revision, event_count, content_hash, snapshot_json) VALUES (?, ?, ?, ?)',
          [s.revision, s.eventCount, s.contentHash, canonicalString(s)],
        );
        const revisions = (
          await tx.all<{ revision: number }>('SELECT revision FROM snapshots')
        ).map((r) => r.revision);
        const keep = retainedRevisions(revisions);
        for (const r of revisions) {
          if (!keep.has(r))
            await tx.run('DELETE FROM snapshots WHERE revision = ?', [r]);
        }
        // FINAL statement: only now does the new snapshot become the active one.
        await tx.run(
          `INSERT INTO metadata (id, schema_version, world_id, active_revision) VALUES (1, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET active_revision = excluded.active_revision`,
          [SCHEMA_VERSION, s.worldId, s.revision],
        );

        this.#options.faultBeforeCommit?.();
        if (this.#failNext) {
          this.#failNext = false;
          throw new PersistenceError(
            'WRITE_FAILED',
            'injected fault before commit',
          );
        }
      });
    } catch (error) {
      if (
        error instanceof PersistenceError ||
        error instanceof UnsupportedSchemaVersionError
      )
        throw error;
      throw new PersistenceError(
        'WRITE_FAILED',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async loadLatest(): Promise<CareerSnapshot | null> {
    this.#requireInit();
    const active = await this.#db.transaction((tx) => this.#readActive(tx));
    if (active === null) return null;
    verifySnapshot(active); // future schema fails closed; other defects are the recovery layer's job
    return cloneData(active);
  }

  async listVerifiedSnapshots(): Promise<readonly CareerSnapshot[]> {
    this.#requireInit();
    const rows = await this.#db.all<SnapshotRow>(
      'SELECT revision, snapshot_json FROM snapshots ORDER BY revision DESC',
    );
    const out: CareerSnapshot[] = [];
    for (const row of rows) {
      let parsed: CareerSnapshot;
      try {
        parsed = JSON.parse(row.snapshot_json) as CareerSnapshot;
      } catch {
        continue; // unreadable rows are never "verified"
      }
      if (verifySnapshot(parsed).ok) out.push(cloneData(parsed));
    }
    return out;
  }

  async loadHistorySince(revision: number): Promise<HistorySlice> {
    this.#requireInit();
    const commandRows = await this.#db.all<{
      result_revision: number;
      envelope_json: string;
    }>(
      'SELECT result_revision, envelope_json FROM commands WHERE result_revision > ? ORDER BY ordinal',
      [revision],
    );
    const eventRows = await this.#db.all<{ event_json: string }>(
      'SELECT event_json FROM events WHERE revision > ? ORDER BY ordinal',
      [revision],
    );
    return cloneData({
      commands: commandRows.map((r) => ({
        envelope: parseJson<CommandRecord['envelope']>(
          r.envelope_json,
          'stored command',
        ),
        resultRevision: r.result_revision,
      })),
      events: eventRows.map((r) =>
        parseJson<EventEnvelope>(r.event_json, 'stored event'),
      ),
    });
  }

  async markRecovery(
    report: RecoveryReport,
    repairedSnapshot?: CareerSnapshot,
  ): Promise<void> {
    this.#requireInit();
    const entry = cloneData(report);
    const repaired =
      repairedSnapshot === undefined ? undefined : cloneData(repairedSnapshot);
    try {
      await this.#db.transaction(async (tx) => {
        if (repaired !== undefined) {
          const stored = await this.#storedTail(tx);
          const problem = checkRepairConsistency(
            repaired,
            stored.count,
            stored.tailHash,
          );
          if (problem !== null)
            throw new PersistenceError('COMMIT_REJECTED', problem);
          await tx.run(
            'INSERT OR REPLACE INTO snapshots (revision, event_count, content_hash, snapshot_json) VALUES (?, ?, ?, ?)',
            [
              repaired.revision,
              repaired.eventCount,
              repaired.contentHash,
              canonicalString(repaired),
            ],
          );
        }
        await tx.run('INSERT INTO recovery_log (report_json) VALUES (?)', [
          canonicalString(entry),
        ]);
        if (repaired !== undefined) {
          // FINAL statement: the repaired snapshot becomes active.
          await tx.run(
            `INSERT INTO metadata (id, schema_version, world_id, active_revision) VALUES (1, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET active_revision = excluded.active_revision`,
            [SCHEMA_VERSION, repaired.worldId, repaired.revision],
          );
        }
      });
    } catch (error) {
      if (
        error instanceof PersistenceError ||
        error instanceof UnsupportedSchemaVersionError
      )
        throw error;
      throw new PersistenceError(
        'WRITE_FAILED',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async loadRecoveryLog(): Promise<readonly RecoveryReport[]> {
    this.#requireInit();
    const rows = await this.#db.all<{ report_json: string }>(
      'SELECT report_json FROM recovery_log ORDER BY id',
    );
    return cloneData(
      rows.map((r) =>
        parseJson<RecoveryReport>(r.report_json, 'recovery report'),
      ),
    );
  }
}
