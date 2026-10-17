import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import {
  MemoryCareerStore,
  PersistenceError,
  type CareerSnapshot,
  type CareerStore,
  type CommitRecord,
  type HistorySlice,
  type MemoryStoreState,
  type RecoveryReport,
} from '@sport-sim/sim-core';

const FILE_FORMAT = 'sport-sim-career-file';
const FILE_VERSION = 1;

interface CareerFile {
  readonly format: typeof FILE_FORMAT;
  readonly version: typeof FILE_VERSION;
  readonly state: MemoryStoreState;
}

/**
 * CareerStore for the headless runner: the reference MemoryCareerStore persisted as one JSON
 * file. A save builds the next state on a copy, writes it to a temp file and renames it over
 * the old file, so the file is always the previous or the new state, never a mix. Only the
 * in-memory state is swapped after the rename succeeds.
 */
export class JsonFileCareerStore implements CareerStore {
  readonly path: string;
  #mem = new MemoryCareerStore();
  #failNext = false;
  #initialized = false;

  constructor(path: string) {
    this.path = path;
  }

  /** Test seam: the next save fails before anything reaches the file. */
  failNextCommit(): void {
    this.#failNext = true;
  }

  async initialize(): Promise<void> {
    if (existsSync(this.path)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(this.path, 'utf8'));
      } catch {
        throw new PersistenceError(
          'CORRUPT_STORE',
          `${this.path} is not valid JSON`,
        );
      }
      const file = parsed as Partial<CareerFile> | null;
      if (
        file === null ||
        file.format !== FILE_FORMAT ||
        file.version !== FILE_VERSION ||
        file.state === undefined
      ) {
        throw new PersistenceError(
          'CORRUPT_STORE',
          `${this.path} is not a version ${FILE_VERSION} career file`,
        );
      }
      this.#mem = MemoryCareerStore.fromState(file.state);
    }
    await this.#mem.initialize();
    this.#initialized = true;
  }

  #requireInit(): void {
    if (!this.#initialized)
      throw new PersistenceError('NOT_INITIALIZED', 'call initialize() first');
  }

  #write(state: MemoryStoreState): void {
    const temp = `${this.path}.tmp`;
    const file: CareerFile = {
      format: FILE_FORMAT,
      version: FILE_VERSION,
      state,
    };
    writeFileSync(temp, JSON.stringify(file), 'utf8');
    renameSync(temp, this.path);
  }

  async #mutate(
    apply: (candidate: MemoryCareerStore) => Promise<void>,
  ): Promise<void> {
    this.#requireInit();
    const candidate = MemoryCareerStore.fromState(this.#mem.exportState());
    await candidate.initialize();
    if (this.#failNext) {
      this.#failNext = false;
      candidate.failNextCommit();
    }
    await apply(candidate);
    try {
      this.#write(candidate.exportState());
    } catch (error) {
      throw new PersistenceError(
        'WRITE_FAILED',
        error instanceof Error ? error.message : String(error),
      );
    }
    this.#mem = candidate;
  }

  saveCommit(commit: CommitRecord): Promise<void> {
    return this.#mutate((c) => c.saveCommit(commit));
  }

  markRecovery(
    report: RecoveryReport,
    repairedSnapshot?: CareerSnapshot,
  ): Promise<void> {
    return this.#mutate((c) => c.markRecovery(report, repairedSnapshot));
  }

  loadLatest(): Promise<CareerSnapshot | null> {
    return this.#mem.loadLatest();
  }

  listVerifiedSnapshots(): Promise<readonly CareerSnapshot[]> {
    return this.#mem.listVerifiedSnapshots();
  }

  loadHistorySince(revision: number): Promise<HistorySlice> {
    return this.#mem.loadHistorySince(revision);
  }

  loadRecoveryLog(): Promise<readonly RecoveryReport[]> {
    return this.#mem.loadRecoveryLog();
  }
}
