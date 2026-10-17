import { describe, it } from 'vitest';
import {
  MemoryCareerStore,
  recoveryContractCases,
  type RecoveryHarness,
  type SnapshotTamper,
} from '../src/index';

const memoryHarness = async (): Promise<RecoveryHarness> => {
  const store = new MemoryCareerStore();
  return {
    store,
    async tamperSnapshot(revision: number, kind: SnapshotTamper) {
      store.tamperWithSnapshotForTest(revision, (s) => {
        if (kind === 'hash') return { ...s, contentHash: 'f'.repeat(64) };
        if (kind === 'future') return { ...s, schemaVersion: 99 };
        return { revision: s.revision, junk: true };
      });
    },
    async truncateHistory(count: number) {
      store.truncateHistoryForTest(count);
    },
    async tamperEvent(index: number) {
      store.tamperWithEventForTest(index, (e) => ({
        ...e,
        type: 'TamperedEvent',
      }));
    },
  };
};

describe('MemoryCareerStore satisfies the recovery contract', () => {
  for (const c of recoveryContractCases(memoryHarness)) {
    it(c.name, async () => {
      await c.run();
    });
  }
});
