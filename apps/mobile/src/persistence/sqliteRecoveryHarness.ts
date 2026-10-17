import type { RecoveryHarness, SnapshotTamper } from '@sport-sim/sim-core';
import type { SqlDatabase } from './sqlDatabase';
import { SqliteCareerStore } from './sqliteCareerStore';

/**
 * Corruption seams for the shared recovery contract, written against the SqlDatabase
 * interface so the SAME damage is inflicted under Node (node:sqlite) and on device
 * (expo-sqlite). It deliberately bypasses every integrity check, like real disk corruption.
 */
export const createSqliteRecoveryHarness = (
  db: SqlDatabase,
): RecoveryHarness => {
  const store = new SqliteCareerStore(db);
  return {
    store,
    async tamperSnapshot(revision: number, kind: SnapshotTamper) {
      const rows = await db.all<{ snapshot_json: string }>(
        'SELECT snapshot_json FROM snapshots WHERE revision = ?',
        [revision],
      );
      const row = rows[0];
      if (row === undefined)
        throw new Error(`no snapshot at revision ${revision}`);
      const parsed = JSON.parse(row.snapshot_json) as Record<string, unknown>;
      const next =
        kind === 'hash'
          ? JSON.stringify({ ...parsed, contentHash: 'f'.repeat(64) })
          : kind === 'future'
            ? JSON.stringify({ ...parsed, schemaVersion: 99 })
            : '{not json';
      await db.run(
        'UPDATE snapshots SET snapshot_json = ? WHERE revision = ?',
        [next, revision],
      );
    },
    async truncateHistory(count: number) {
      const rows = await db.all<{ ordinal: number; command_id: string }>(
        'SELECT ordinal, command_id FROM events ORDER BY ordinal DESC LIMIT ?',
        [count],
      );
      for (const r of rows) {
        await db.run('DELETE FROM events WHERE ordinal = ?', [r.ordinal]);
        await db.run('DELETE FROM commands WHERE command_id = ?', [
          r.command_id,
        ]);
      }
    },
    async tamperEvent(index: number) {
      const rows = await db.all<{ ordinal: number; event_json: string }>(
        'SELECT ordinal, event_json FROM events ORDER BY ordinal LIMIT 1 OFFSET ?',
        [index],
      );
      const row = rows[0];
      if (row === undefined) throw new Error(`no event at index ${index}`);
      const parsed = JSON.parse(row.event_json) as Record<string, unknown>;
      await db.run('UPDATE events SET event_json = ? WHERE ordinal = ?', [
        JSON.stringify({ ...parsed, type: 'TamperedEvent' }),
        row.ordinal,
      ]);
    },
  };
};
