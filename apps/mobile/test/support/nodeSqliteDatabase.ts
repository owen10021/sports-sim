import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { SerialQueue } from '../../src/persistence/serialQueue';
import type {
  SqlDatabase,
  SqlExecutor,
  SqlValue,
} from '../../src/persistence/sqlDatabase';

// createRequire keeps bundlers from rewriting the `node:` prefix of this built-in.
const { DatabaseSync: Database } = createRequire(import.meta.url)(
  'node:sqlite',
) as {
  DatabaseSync: new (path: string) => DatabaseSync;
};

/** node:sqlite implementation of SqlDatabase, used so Windows/Node tests run the real SQL. */
export class NodeSqliteDatabase implements SqlDatabase {
  readonly raw: DatabaseSync;
  readonly #queue = new SerialQueue();

  constructor(path = ':memory:') {
    this.raw = new Database(path);
  }

  #run(sql: string, params: readonly SqlValue[]): void {
    this.raw.prepare(sql).run(...params);
  }

  #all<T extends object>(sql: string, params: readonly SqlValue[]): T[] {
    return this.raw.prepare(sql).all(...params) as unknown as T[];
  }

  exec(sql: string): Promise<void> {
    return this.#queue.run(async () => this.raw.exec(sql));
  }

  run(sql: string, params: readonly SqlValue[] = []): Promise<void> {
    return this.#queue.run(async () => this.#run(sql, params));
  }

  all<T extends object>(
    sql: string,
    params: readonly SqlValue[] = [],
  ): Promise<T[]> {
    return this.#queue.run(async () => this.#all<T>(sql, params));
  }

  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    return this.#queue.run(async () => {
      const tx: SqlExecutor = {
        run: async (sql, params = []) => this.#run(sql, params),
        all: async <R extends object>(
          sql: string,
          params: readonly SqlValue[] = [],
        ) => this.#all<R>(sql, params),
      };
      this.raw.exec('BEGIN IMMEDIATE');
      try {
        const result = await work(tx);
        this.raw.exec('COMMIT');
        return result;
      } catch (error) {
        try {
          this.raw.exec('ROLLBACK');
        } catch {
          /* already rolled back by SQLite */
        }
        throw error;
      }
    });
  }

  close(): void {
    this.raw.close();
  }
}
