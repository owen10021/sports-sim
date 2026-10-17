/**
 * The smallest database surface the career store needs. Keeping it this narrow lets the
 * SAME SqliteCareerStore run on expo-sqlite (device/Hermes) and on node:sqlite (Windows
 * tests), so the Node suite exercises the real SQL, schema and transaction logic.
 */
export type SqlValue = string | number | null;

export interface SqlExecutor {
  run(sql: string, params?: readonly SqlValue[]): Promise<void>;
  all<T extends object>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
}

export interface SqlDatabase extends SqlExecutor {
  /** Run one or more statements with no parameters (schema, pragmas). */
  exec(sql: string): Promise<void>;
  /**
   * Run `work` inside one exclusive transaction. Resolves with its result after COMMIT;
   * if `work` throws, the transaction is rolled back and the error is rethrown.
   */
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}
