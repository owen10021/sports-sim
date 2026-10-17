import {
  careerStoreContractCases,
  recoveryContractCases,
  repairContractCases,
  runContractCases,
  type ContractResult,
} from '@sport-sim/sim-core';
import { ExpoSqliteDatabase } from './expoSqliteDatabase';
import { createSqliteRecoveryHarness } from './sqliteRecoveryHarness';
import { SqliteCareerStore } from './sqliteCareerStore';

/**
 * Run the shared CareerStore, recovery and repair contracts against the REAL expo-sqlite
 * engine inside the app runtime (Hermes on device/simulator). Each case gets a fresh
 * in-memory database. The diagnostics screen shows the results as PASS/FAIL.
 */
export const runSqliteContractOnDevice = async (): Promise<ContractResult[]> =>
  runContractCases(
    careerStoreContractCases(async () => {
      const db = await ExpoSqliteDatabase.open(':memory:');
      const store = new SqliteCareerStore(db);
      return { store, failNextCommit: () => store.failNextCommit() };
    }),
  );

const freshRecoveryHarness = async () => createSqliteRecoveryHarness(await ExpoSqliteDatabase.open(':memory:'));

export const runRecoveryContractOnDevice = async (): Promise<ContractResult[]> =>
  runContractCases([...recoveryContractCases(freshRecoveryHarness), ...repairContractCases(freshRecoveryHarness)]);