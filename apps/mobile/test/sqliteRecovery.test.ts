import { describe, it } from 'vitest';
import {
  recoveryContractCases,
  repairContractCases,
} from '@sport-sim/sim-core';
import { createSqliteRecoveryHarness } from '../src/persistence/sqliteRecoveryHarness';
import { NodeSqliteDatabase } from './support/nodeSqliteDatabase';

const sqliteHarness = async () =>
  createSqliteRecoveryHarness(new NodeSqliteDatabase());

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
