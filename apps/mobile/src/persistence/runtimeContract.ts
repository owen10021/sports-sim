import { careerStoreContractCases, runContractCases, type ContractResult } from '@sport-sim/sim-core';
import { ExpoSqliteDatabase } from './expoSqliteDatabase';
import { SqliteCareerStore } from './sqliteCareerStore';

/**
 * Runs the shared CareerStore contract against the REAL expo-sqlite engine inside the
 * app runtime (Hermes on device/simulator). Each case gets a fresh in-memory database.
 * The diagnostics screen shows these results as PASS/FAIL.
 */
export const runSqliteContractOnDevice = async (): Promise<ContractResult[]> =>
  runContractCases(
    careerStoreContractCases(async () => {
      const db = await ExpoSqliteDatabase.open(':memory:');
      const store = new SqliteCareerStore(db);
      return { store, failNextCommit: () => store.failNextCommit() };
    }),
  );