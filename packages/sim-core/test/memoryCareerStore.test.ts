import { describe, expect, it } from 'vitest';
import {
  MemoryCareerStore,
  UnsupportedSchemaVersionError,
  WorldKernel,
  commandId,
  createWorld,
  sealSnapshot,
  worldRevision,
  type CommandEnvelope,
} from '../src/index';
import { fixedIdSource, harnessActor, makeRuleset, makeSeed } from './helpers';

const career = async () => {
  const ruleset = makeRuleset();
  const world = createWorld(makeSeed(ruleset), ruleset, fixedIdSource());
  const kernel = WorldKernel.fromGenesis(world, ruleset);
  const store = new MemoryCareerStore();
  await store.initialize();
  const snap = () =>
    sealSnapshot({
      world: kernel.world,
      chainHead: kernel.chainHead,
      eventCount: kernel.eventCount,
      knownCommandIds: kernel.knownCommandIds,
    });
  await store.saveCommit({ snapshot: snap(), commands: [], events: [] });
  const step = async (n: number) => {
    const envelope = {
      commandId: commandId(`cmd-${n}`),
      expectedRevision: worldRevision(n - 1),
      actor: harnessActor(),
      command: { type: 'AdvanceDays', days: 1 },
    } as unknown as CommandEnvelope;
    const res = kernel.execute(envelope);
    if (!res.ok) throw new Error('fixture rejected');
    await store.saveCommit({
      snapshot: snap(),
      commands: [{ envelope, resultRevision: Number(res.world.revision) }],
      events: res.events,
    });
  };
  return { store, step };
};

describe('MemoryCareerStore corruption behaviour (test seams)', () => {
  it('excludes a snapshot whose content no longer verifies from the verified list', async () => {
    const { store, step } = await career();
    await step(1);
    await step(2);
    store.tamperWithSnapshotForTest(2, (s) => ({ ...s, contentHash: 'f'.repeat(64) }));
    expect((await store.listVerifiedSnapshots()).map((s) => s.revision)).toEqual([1, 0]);
  });

  it('fails closed when the active snapshot declares a future schema', async () => {
    const { store, step } = await career();
    await step(1);
    store.tamperWithSnapshotForTest(1, (s) => ({ ...s, schemaVersion: 99 }));
    await expect(store.loadLatest()).rejects.toBeInstanceOf(UnsupportedSchemaVersionError);
    await expect(store.listVerifiedSnapshots()).rejects.toBeInstanceOf(UnsupportedSchemaVersionError);
  });

  it('can install a verified repair over a corrupt active snapshot', async () => {
    const { store, step } = await career();
    await step(1);
    const good = (await store.loadLatest())!;
    store.tamperWithSnapshotForTest(1, (s) => ({ ...s, contentHash: '0'.repeat(64) }));
    await store.markRecovery(
      {
        action: 'REPAIRED_LATEST_FROM_REPLAY',
        previousActiveRevision: 1,
        restoredRevision: 1,
        reasons: ['hash mismatch'],
      },
      good,
    );
    expect(await store.loadLatest()).toEqual(good);
    expect((await store.listVerifiedSnapshots()).map((s) => s.revision)).toEqual([1, 0]);
  });
});
