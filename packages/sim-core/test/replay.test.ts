import { describe, expect, it } from 'vitest';
import {
  MemoryCareerStore,
  ReplayError,
  commandId,
  createContractCareer,
  fingerprintWorld,
  repairLatestFromHistory,
  replayFrom,
  repairContractCases,
  verifyCareerReplay,
  type CommandRecord,
  type RecoveryHarness,
  type SnapshotTamper,
} from '../src/index';

const filled = async (commits = 4) => {
  const store = new MemoryCareerStore();
  await store.initialize();
  const career = createContractCareer();
  await store.saveCommit(career.genesis());
  for (let i = 1; i <= commits; i++) await store.saveCommit(career.step(i));
  return { store, career };
};

describe('replayFrom', () => {
  it('re-executing stored commands from genesis reproduces the exact live state and events', async () => {
    const { store, career } = await filled();
    const genesis = (await store.listVerifiedSnapshots()).find((s) => s.revision === 0)!;
    const history = await store.loadHistorySince(0);
    const result = replayFrom(genesis, career.ruleset, history.commands, history.events);
    expect(fingerprintWorld(result.kernel.world)).toBe(fingerprintWorld(career.kernel.world));
    expect(result.kernel.chainHead).toBe(career.kernel.chainHead);
    expect(result.events).toEqual(history.events);
    expect(result.snapshot.worldFingerprint).toBe(fingerprintWorld(career.kernel.world));
  });

  it('replaying from a mid-career snapshot reaches the same final state', async () => {
    const { store, career } = await filled();
    const mid = (await store.listVerifiedSnapshots()).find((s) => s.revision === 2)!;
    const tail = await store.loadHistorySince(2);
    const result = replayFrom(mid, career.ruleset, tail.commands, tail.events);
    expect(fingerprintWorld(result.kernel.world)).toBe(fingerprintWorld(career.kernel.world));
    expect(result.kernel.chainHead).toBe(career.kernel.chainHead);
  });

  it('detects an intentional mismatch: altered command, same expected events', async () => {
    const { store, career } = await filled();
    const genesis = (await store.listVerifiedSnapshots()).find((s) => s.revision === 0)!;
    const history = await store.loadHistorySince(0);
    const altered: CommandRecord[] = history.commands.map((c, i) =>
      i === 1
        ? { ...c, envelope: { ...c.envelope, command: { type: 'AdvanceDays', days: 7 } as typeof c.envelope.command } }
        : c,
    );
    expect(() => replayFrom(genesis, career.ruleset, altered, history.events)).toThrow(ReplayError);
    try {
      replayFrom(genesis, career.ruleset, altered, history.events);
    } catch (e) {
      expect((e as ReplayError).code).toBe('EVENT_MISMATCH');
    }
  });

  it('a command the kernel rejects during replay is an error, never silently skipped', async () => {
    const { store, career } = await filled();
    const genesis = (await store.listVerifiedSnapshots()).find((s) => s.revision === 0)!;
    const history = await store.loadHistorySince(0);
    const duplicate: CommandRecord[] = [
      history.commands[0]!,
      { ...history.commands[1]!, envelope: { ...history.commands[1]!.envelope, commandId: commandId('cmd-1') } },
    ];
    try {
      replayFrom(genesis, career.ruleset, duplicate);
      throw new Error('expected a ReplayError');
    } catch (e) {
      expect(e).toBeInstanceOf(ReplayError);
      expect((e as ReplayError).code).toBe('COMMAND_REJECTED');
    }
  });

  it('replay consumes no randomness when it is given no commands', async () => {
    const { store, career } = await filled(1);
    const genesis = (await store.listVerifiedSnapshots()).find((s) => s.revision === 0)!;
    const result = replayFrom(genesis, career.ruleset, []);
    expect(result.snapshot.contentHash).toBe(genesis.contentHash);
  });
});

describe('verifyCareerReplay', () => {
  it('passes for an intact career and reports the matching fingerprint and head', async () => {
    const { store, career } = await filled();
    const v = await verifyCareerReplay(store, career.ruleset);
    expect(v.ok).toBe(true);
    expect(v.fingerprint).toBe(fingerprintWorld(career.kernel.world));
    expect(v.chainHead).toBe(career.kernel.chainHead);
  });

  it('fails when stored history was altered', async () => {
    const { store, career } = await filled();
    store.tamperWithEventForTest(1, (e) => ({ ...e, type: 'Forged' }));
    const v = await verifyCareerReplay(store, career.ruleset);
    expect(v.ok).toBe(false);
    expect(v.reasons.length).toBeGreaterThan(0);
  });

  it('fails when stored history is shorter than the active snapshot', async () => {
    const { store, career } = await filled();
    store.truncateHistoryForTest(1);
    expect((await verifyCareerReplay(store, career.ruleset)).ok).toBe(false);
  });
});

describe('repairLatestFromHistory', () => {
  it('rebuilds a corrupt newest snapshot exactly and makes it active', async () => {
    const { store, career } = await filled();
    const original = (await store.loadLatest())!;
    store.tamperWithSnapshotForTest(4, (s) => ({ ...s, contentHash: 'a'.repeat(64) }));
    const out = await repairLatestFromHistory(store, { ruleset: career.ruleset });
    expect(out.status).toBe('repaired');
    expect(await store.loadLatest()).toEqual(original);
    expect((await store.loadRecoveryLog()).map((r) => r.action)).toEqual(['REPAIRED_LATEST_FROM_REPLAY']);
  });

  it('refuses to write anything when the history does not fully verify', async () => {
    const { store, career } = await filled();
    store.tamperWithEventForTest(2, (e) => ({ ...e, type: 'Forged' }));
    store.tamperWithSnapshotForTest(4, (s) => ({ ...s, contentHash: 'a'.repeat(64) }));
    const out = await repairLatestFromHistory(store, { ruleset: career.ruleset });
    expect(out.status).toBe('refused');
    expect(await store.loadRecoveryLog()).toEqual([]);
  });
});

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
      store.tamperWithEventForTest(index, (e) => ({ ...e, type: 'TamperedEvent' }));
    },
  };
};

describe('MemoryCareerStore satisfies the repair contract', () => {
  for (const c of repairContractCases(memoryHarness)) {
    it(c.name, async () => {
      await c.run();
    });
  }
});
