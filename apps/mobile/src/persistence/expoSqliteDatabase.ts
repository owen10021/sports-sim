import * as SQLite from 'expo-sqlite';
import { SerialQueue } from './serialQueue';
import type { SqlDatabase, SqlExecutor, SqlValue } from './sqlDatabase';

/**
 * expo-sqlite implementation of SqlDatabase. All operations on the connection are
 * serialised so a write transaction can never interleave with another statement.
 * Foreign keys are enabled on this one connection by SqliteCareerStore.initialize().
 */
export class ExpoSqliteDatabase implements SqlDatabase {
  readonly #db: SQLite.SQLiteDatabase;
  readonly #queue = new SerialQueue();

  private constructor(db: SQLite.SQLiteDatabase) {
    this.#db = db;
  }

  static async open(name = 'sport-sim.db'): Promise<ExpoSqliteDatabase> {
    return new ExpoSqliteDatabase(await SQLite.openDatabaseAsync(name));
  }

  exec(sql: string): Promise<void> {
    return this.#queue.run(() => this.#db.execAsync(sql));
  }

  run(sql: string, params: readonly SqlValue[] = []): Promise<void> {
    return this.#queue.run(async () => {
      await this.#db.runAsync(sql, [...params]);
    });
  }

  all<T extends object>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    return this.#queue.run(() => this.#db.getAllAsync<T>(sql, [...params]));
  }

  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    return this.#queue.run(async () => {
      let result: T | undefined;
      let finished = false;
      const tx: SqlExecutor = {
        run: async (sql, params = []) => {
          await this.#db.runAsync(sql, [...params]);
        },
        all: <R extends object>(sql: string, params: readonly SqlValue[] = []) =>
          this.#db.getAllAsync<R>(sql, [...params]),
      };
      // Rolls back automatically if `work` throws.
      await this.#db.withTransactionAsync(async () => {
        result = await work(tx);
        finished = true;
      });
      if (!finished) throw new Error('transaction did not complete');
      return result as T;
    });
  }

  async close(): Promise<void> {
    await this.#queue.run(() => this.#db.closeAsync());
  }
}
