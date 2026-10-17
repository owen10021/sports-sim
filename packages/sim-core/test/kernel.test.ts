import { describe, expect, it } from 'vitest';
import {
  GENESIS_HASH,
  WorldKernel,
  commandId,
  createWorld,
  entityId,
  fingerprintWorld,
  verifyEventChain,
  worldRevision,
  type CommandEnvelope,
  type ActorRef,
} from '../src/index';
import { fixedIdSource, harnessActor, makeRuleset, makeSeed } from './helpers';

// First three xoshiro128** outputs for seed 12345 (independent Python reference).
const ROLLS = [1093274547, 203003357, 3741353573];

const setup = () => {
  const ruleset = makeRuleset();
  const world = createWorld(makeSeed(ruleset), ruleset, fixedIdSource());
  return { ruleset, world, kernel: WorldKernel.fromGenesis(world, ruleset) };
};

const cmd = (
  n: number,
  days: unknown,
  expectedRevision = n - 1,
  actor: ActorRef = harnessActor(),
): CommandEnvelope =>
  ({
    commandId: commandId(`cmd-${n}`),
    expectedRevision: worldRevision(expectedRevision),
    actor,
    command: { type: 'AdvanceDays', days },
  }) as unknown as CommandEnvelope;

const state = (k: WorldKernel) => ({
  fingerprint: fingerprintWorld(k.world),
  rng: k.world.rng,
  head: k.chainHead,
  events: k.events.length,
  revision: k.world.revision,
});

describe('WorldKernel mutation pipeline', () => {
  it('commits AdvanceDays: one revision, one event, RNG draws recorded, chain intact', () => {
    const { kernel } = setup();
    const res = kernel.execute(cmd(1, 3));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.world.simDate).toBe('2026-10-19');
    expect(res.world.revision).toBe(worldRevision(1));
    expect(res.world.rng.draws).toBe(3);
    expect(res.events).toHaveLength(1);
    const ev = res.events[0]!;
    expect(ev.type).toBe('DaysAdvanced');
    expect(ev.revision).toBe(worldRevision(1));
    expect(ev.simDate).toBe('2026-10-19');
    expect(ev.previousHash).toBe(GENESIS_HASH);
    expect(ev.payload).toEqual({
      fromDate: '2026-10-16',
      toDate: '2026-10-19',
      days: 3,
      dayRolls: [
        { date: '2026-10-17', roll: ROLLS[0] },
        { date: '2026-10-18', roll: ROLLS[1] },
        { date: '2026-10-19', roll: ROLLS[2] },
      ],
    });
    expect(kernel.world).toBe(res.world);
    expect(kernel.chainHead).toBe(ev.hash);
    expect(verifyEventChain(kernel.events)).toEqual({
      ok: true,
      headHash: ev.hash,
      count: 1,
    });
    expect(res.trace.steps.map((s) => s.stage)).toEqual([
      'validation',
      'authorization',
      'resolution',
      'commit',
    ]);
    expect(res.trace.steps.every((s) => s.outcome === 'pass')).toBe(true);
  });

  it('increments revision exactly once per command and issues sequential event ids', () => {
    const { kernel } = setup();
    for (let n = 1; n <= 4; n++) {
      const res = kernel.execute(cmd(n, 1));
      expect(res.ok).toBe(true);
      expect(Number(kernel.world.revision)).toBe(n);
      if (res.ok)
        expect(String(res.events[0]!.eventId)).toBe(
          `evt-${String(n).padStart(6, '0')}`,
        );
    }
    expect(kernel.events).toHaveLength(4);
    expect(kernel.world.nextIds.event).toBe(5);
    expect(verifyEventChain(kernel.events).ok).toBe(true);
  });

  it('rejects a stale expected revision and changes nothing', () => {
    const { kernel } = setup();
    kernel.execute(cmd(1, 2));
    const before = state(kernel);
    const res = kernel.execute(cmd(2, 1, 0));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rejection.code).toBe('STALE_REVISION');
      expect(res.trace.steps.at(-1)?.outcome).toBe('fail');
    }
    expect(state(kernel)).toEqual(before);
    const future = kernel.execute(cmd(2, 1, 9));
    expect(future.ok).toBe(false);
    expect(state(kernel)).toEqual(before);
  });

  it('rejects a duplicate command id even when the revision is current', () => {
    const { kernel } = setup();
    expect(kernel.execute(cmd(1, 1)).ok).toBe(true);
    const before = state(kernel);
    const dup = kernel.execute({ ...cmd(1, 1, 1) });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.rejection.code).toBe('DUPLICATE_COMMAND');
    expect(state(kernel)).toEqual(before);
  });

  it('rejects invalid day counts and unknown commands without side effects', () => {
    const { kernel } = setup();
    const before = state(kernel);
    for (const days of [
      0,
      -1,
      1.5,
      31,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      '3',
      null,
      undefined,
    ]) {
      const res = kernel.execute(cmd(1, days));
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.rejection.code).toBe('INVALID_PAYLOAD');
      expect(state(kernel)).toEqual(before);
    }
    const unknown = kernel.execute({
      ...cmd(1, 1),
      command: { type: 'TeleportBall', yards: 99 },
    } as unknown as CommandEnvelope);
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.rejection.code).toBe('SCHEMA_INVALID');
    expect(state(kernel)).toEqual(before);
  });

  it('rejects malformed envelopes (schema) without side effects', () => {
    const { kernel } = setup();
    const before = state(kernel);
    const bads: unknown[] = [
      null,
      42,
      {},
      { ...cmd(1, 1), actor: undefined },
      { ...cmd(1, 1), commandId: 'has space' },
      { ...cmd(1, 1), expectedRevision: -1 },
      { ...cmd(1, 1), command: undefined },
    ];
    for (const bad of bads) {
      const res = kernel.execute(bad as CommandEnvelope);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.rejection.code).toBe('SCHEMA_INVALID');
      expect(state(kernel)).toEqual(before);
    }
  });

  it('rejects actors without authority over the calendar', () => {
    const { kernel } = setup();
    const before = state(kernel);
    for (const kind of ['cpu_org', 'delegate'] as const) {
      const res = kernel.execute(
        cmd(1, 1, 0, { kind, id: entityId('someone') }),
      );
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.rejection.code).toBe('UNAUTHORIZED_ACTOR');
      expect(state(kernel)).toEqual(before);
    }
    for (const kind of [
      'human_gm',
      'commissioner',
      'system',
      'test_harness',
    ] as const) {
      const { kernel: k2 } = setup();
      expect(
        k2.execute(cmd(1, 1, 0, { kind, id: entityId('someone') })).ok,
      ).toBe(true);
    }
  });

  it('INVARIANT: every rejected command leaves fingerprint, RNG and audit chain unchanged', () => {
    const { kernel } = setup();
    const rejected: CommandEnvelope[] = [
      cmd(10, 0),
      cmd(11, 1, 99),
      cmd(12, 1, 0, { kind: 'cpu_org', id: entityId('cpu') }),
      cmd(13, 31),
    ];
    for (let n = 1; n <= 5; n++) {
      const ok = kernel.execute(cmd(n, (n % 3) + 1));
      expect(ok.ok).toBe(true);
      for (const bad of rejected) {
        const before = state(kernel);
        const res = kernel.execute(bad);
        expect(res.ok).toBe(false);
        expect(state(kernel)).toEqual(before);
      }
    }
    expect(kernel.world.rng.draws).toBe(2 + 3 + 1 + 2 + 3);
  });

  it('a rejected command id is not burned: the corrected command can be retried', () => {
    const { kernel } = setup();
    expect(kernel.execute(cmd(1, 0)).ok).toBe(false);
    expect(kernel.execute(cmd(1, 2)).ok).toBe(true);
  });

  it('commits atomically: a fault before commit leaves the kernel untouched', () => {
    const { ruleset, world } = setup();
    let armed = true;
    const kernel = WorldKernel.fromGenesis(world, ruleset, {
      beforeCommit: () => {
        if (armed) throw new Error('injected');
      },
    });
    const before = state(kernel);
    const res = kernel.execute(cmd(1, 2));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.rejection.code).toBe('INTERNAL_ERROR');
    expect(state(kernel)).toEqual(before);
    armed = false;
    expect(kernel.execute(cmd(1, 2)).ok).toBe(true);
  });

  it('never mutates prior world objects (immutable results)', () => {
    const { kernel, world } = setup();
    const fp = fingerprintWorld(world);
    const res = kernel.execute(cmd(1, 5));
    expect(res.ok).toBe(true);
    expect(fingerprintWorld(world)).toBe(fp);
    expect(world.revision).toBe(worldRevision(0));
    if (res.ok) {
      expect(Object.isFrozen(res.world)).toBe(true);
      expect(Object.isFrozen(res.events[0])).toBe(true);
    }
  });

  it('is deterministic across independent kernels and resumable from saved state', () => {
    const a = setup().kernel;
    const b = setup().kernel;
    for (let n = 1; n <= 4; n++) {
      a.execute(cmd(n, n));
      b.execute(cmd(n, n));
    }
    expect(fingerprintWorld(a.world)).toBe(fingerprintWorld(b.world));
    expect(a.chainHead).toBe(b.chainHead);

    const resumed = WorldKernel.resume({
      world: a.world,
      ruleset: setup().ruleset,
      chainHead: a.chainHead,
      eventCount: a.eventCount,
      knownCommandIds: a.knownCommandIds,
    });
    expect(resumed.execute(cmd(4, 1)).ok).toBe(false); // duplicate survives resume
    a.execute(cmd(5, 2));
    resumed.execute(cmd(5, 2));
    expect(fingerprintWorld(resumed.world)).toBe(fingerprintWorld(a.world));
    expect(resumed.chainHead).toBe(a.chainHead);
  });
});
