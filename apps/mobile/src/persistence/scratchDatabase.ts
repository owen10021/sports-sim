import * as SQLite from 'expo-sqlite';
import { ExpoSqliteDatabase } from './expoSqliteDatabase';

/**
 * Throwaway databases for diagnostics and contract runs.
 *
 * expo-sqlite hands back the SAME connection every time the name `:memory:` is opened, so
 * "fresh in-memory database per case" silently shared state between cases on a real device.
 * Each scratch database therefore gets its own uniquely named file, closed and deleted by
 * `disposeScratchDatabases()`. The real career database (`sport-sim.db`) is never used here.
 */
const live: { name: string; db: ExpoSqliteDatabase }[] = [];
let counter = 0;

export const openScratchDatabase = async (): Promise<ExpoSqliteDatabase> => {
  counter += 1;
  const name = `scratch-${Date.now().toString(36)}-${counter}.db`;
  const db = await ExpoSqliteDatabase.open(name);
  live.push({ name, db });
  return db;
};

export const disposeScratchDatabases = async (): Promise<void> => {
  const pending = live.splice(0, live.length);
  for (const { name, db } of pending) {
    try {
      await db.close();
    } catch {
      // Best effort: a scratch database that will not close is deleted below anyway.
    }
    try {
      await SQLite.deleteDatabaseAsync(name);
    } catch {
      // Best effort cleanup of a scratch file.
    }
  }
};
