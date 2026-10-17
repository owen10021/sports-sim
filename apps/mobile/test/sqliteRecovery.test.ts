import { describe, it } from 'vitest';
import {
  recoveryContractCases,
  repairContractCases,
  type RecoveryHarness,
  type SnapshotTamper,
} from '@sport-sim/sim-core';
import { SqliteCareerStore } from '../src/persistence/sqliteCareerStore';
import { NodeSqliteDatabase } from './support/nodeSqliteDatabase';

const sqliteHarness = async (): Promise<RecoveryHarness> => {
  const db = new NodeSqliteDatabase();
  const store = new SqliteCareerStore(db);
  return {
    store,
    async tamperSnapshot(revision: number, kind: SnapshotTamper) {
      const row = (
        await db.all<{ snapshot_json: string }>('SELECT snapshot_json FROM snapshots WHERE revision = ?', [revision])
      )[0];
      if (row === undefined) throw new Error(`no snapshot at revision ${revision}`);
      const parsed = JSON.parse(row.snapshot_json) as Record<string, unknown>;
      const next =
        kind === 'hash'
          ? JSON.stringify({ ...parsed, contentHash: 'f'.repeat(64) })
          : kind === 'future'
            ? JSON.stringify({ ...parsed, schemaVersion: 99 })
            : '{not json';
      await db.run('UPDATE snapshots SET snapshot_json = ? WHERE revision = ?', [next, revision]);
    },
    async truncateHistory(count: number) {
      const rows = await db.all<{ ordinal: number; command_id: string }>(
        'SELECT ordinal, command_id FROM events ORDER BY ordinal DESC LIMIT ?',
        [count],
      );
      for (const r of rows) {
        await db.run('DELETE FROM events WHERE ordinal = ?', [r.ordinal]);
        await db.run('DELETE FROM commands WHERE command_id = ?', [r.command_id]);
      }
    },
    async tamperEvent(index: number) {
      const row = (
        await db.all<{ ordinal: number; event_json: string }>('SELECT ordinal, event_json FROM events ORDER BY ordinal LIMIT 1 OFFSET ?', [
          index,
        ])
      )[0];
      if (row === undefined) throw new Error(`no event at index ${index}`);
      const parsed = JSON.parse(row.event_json) as Record<string, unknown>;
      await db.run('UPDATE events SET event_json = ? WHERE ordinal = ?', [
        JSON.stringify({ ...parsed, type: 'TamperedEvent' }),
        row.ordinal,
      ]);
    },
  };
};

describe('SqliteCareerStore satisfies the recovery contract', () => {
  for (const c of recoveryContractCases(sqliteHarness)) {
    it(c.name, async () => {
      await c.run();
    });
  }
});
describe('SqliteCareerStore satisfies the repair contract', () => {
  for (const c of repairContractCases(sqliteHarness)) {
    it(c.name, async () => {
      await c.run();
    });
  }
});