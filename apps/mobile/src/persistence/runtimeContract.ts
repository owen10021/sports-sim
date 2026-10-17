import {
  careerStoreContractCases,
  recoveryContractCases,
  repairContractCases,
  runContractCases,
  type ContractResult,
} from '@sport-sim/sim-core';
import {
  disposeScratchDatabases,
  openScratchDatabase,
} from './scratchDatabase';
import { createSqliteRecoveryHarness } from './sqliteRecoveryHarness';
import { SqliteCareerStore } from './sqliteCareerStore';

/**
 * Run the shared CareerStore, recovery and repair contracts against the REAL expo-sqlite
 * engine inside the app runtime (Hermes on device/simulator). Each case gets its own fresh
 * scratch database (see scratchDatabase.ts), removed afterwards. The diagnostics screen
 * shows the results as PASS/FAIL.
 */
export const runSqliteContractOnDevice = async (): Promise<
  ContractResult[]
> => {
  try {
    return await runContractCases(
      careerStoreContractCases(async () => {
        const db = await openScratchDatabase();
        const store = new SqliteCareerStore(db);
        return { store, failNextCommit: () => store.failNextCommit() };
      }),
    );
  } finally {
    await disposeScratchDatabases();
  }
};

const freshRecoveryHarness = async () =>
  createSqliteRecoveryHarness(await openScratchDatabase());

export const runRecoveryContractOnDevice = async (): Promise<
  ContractResult[]
> => {
  try {
    return await runContractCases([
      ...recoveryContractCases(freshRecoveryHarness),
      ...repairContractCases(freshRecoveryHarness),
    ]);
  } finally {
    await disposeScratchDatabases();
  }
};
