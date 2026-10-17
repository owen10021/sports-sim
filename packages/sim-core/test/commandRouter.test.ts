import { describe, expect, it } from 'vitest';
import {
  GENESIS_HASH,
  WorldKernel,
  commandId,
  createWorld,
  fingerprintWorld,
  isRoutableCommandType,
  routeCommand,
  verifyEventChain,
  worldRevision,
  type CommandEnvelope,
  type RouteContext,
  type RouteOutcome,
} from '../src/index';
import { fixedIdSource, harnessActor, makeRuleset, makeSeed } from './helpers';

const setup = (
  router?: (ctx: RouteContext) => RouteOutcome,
  fault?: boolean,
) => {
  const ruleset = makeRuleset();
  const world = createWorld(makeSeed(ruleset), ruleset, fixedIdSource());
  const kernel = WorldKernel.fromGenesis(world, ruleset, {
    ...(router === undefined ? {} : { testRouter: router }),
    ...(fault === true
      ? {
          beforeCommit: () => {
            throw new Error('injected fault');
          },
        }
      : {}),
  });
  return { ruleset, world, kernel };
};

const advance = (n: number, days: unknown): CommandEnvelope =>
  ({
    commandId: commandId(`cmd-${n}`),
    expectedRevision: worldRevision(n - 1),
    actor: harnessActor(),
    command: { type: 'AdvanceDays', days },
  }) as unknown as CommandEnvelope;

const advanceDays = (days: unknown): RouteContext['command'] =>
  ({ type: 'AdvanceDays', days }) as unknown as RouteContext['command'];

const snapshot = (k: WorldKernel) => ({
  fingerprint: fingerprintWorld(k.world),
  rng: k.world.rng,
  head: k.chainHead,
  eventCount: k.eventCount,
  events: k.events.length,
  revision: k.world.revision,
  nextIds: k.world.nextIds,
  known: k.knownCommandIds,
});

/** Test-only router: AdvanceDays plus a second event emitted by the same command. */
const twoEventRouter = (ctx: RouteContext): RouteOutcome => {
  const base = routeCommand(ctx);
  if (!base.ok) return base;
  return {
    ...base,
    resolution: {
      ...base.resolution,
      eventSpecs: [
        ...base.resolution.eventSpecs,
        { type: 'SecondaryNote', payload: { note: 'second event' } },
      ],
    },
  };
};

describe('routeCommand (static command router)', () => {
  it('recognises exactly the routable command types', () => {
    expect(isRoutableCommandType('AdvanceDays')).toBe(true);
    expect(isRoutableCommandType('Nope')).toBe(false);
    expect(isRoutableCommandType('toString')).toBe(false);
    expect(isRoutableCommandType('__proto__')).toBe(false);
  });

  it('resolves AdvanceDays purely: returns next domain state and one event spec without bumping revision or ids', () => {
    const { world, ruleset } = setup();
    const before = fingerprintWorld(world);
    const out = routeCommand({
      world,
      ruleset,
      actor: harnessActor(),
      commandId: commandId('cmd-1'),
      command: advanceDays(3),
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(fingerprintWorld(world)).toBe(before);
    expect(out.resolution.nextWorld.simDate).toBe('2026-10-19');
    expect(out.resolution.nextWorld.rng.draws).toBe(3);
    expect(out.resolution.nextWorld.revision).toBe(world.revision);
    expect(out.resolution.nextWorld.nextIds).toEqual(world.nextIds);
    expect(out.resolution.eventSpecs).toHaveLength(1);
    expect(out.resolution.eventSpecs[0]!.type).toBe('DaysAdvanced');
    expect(out.resolution.detail).toBe('advanced 3 day(s) to 2026-10-19');
  });

  it('reports validation and authorization failures without resolving', () => {
    const { world, ruleset } = setup();
    const base = {
      world,
      ruleset,
      actor: harnessActor(),
      commandId: commandId('cmd-1'),
    };
    const bad = routeCommand({
      ...base,
      command: advanceDays(0),
    });
    expect(bad).toMatchObject({
      ok: false,
      stage: 'validation',
      code: 'INVALID_PAYLOAD',
    });
    const cpu = routeCommand({
      ...base,
      actor: { kind: 'cpu_org', id: 'org-1' } as never,
      command: advanceDays(1),
    });
    expect(cpu).toMatchObject({
      ok: false,
      stage: 'authorization',
      code: 'UNAUTHORIZED_ACTOR',
    });
  });
});

describe('WorldKernel multi-event commits', () => {
  it('commits two event specs at ONE revision with sequential ids and a linked chain', () => {
    const { kernel } = setup(twoEventRouter);
    const res = kernel.execute(advance(1, 2));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.events).toHaveLength(2);
    expect(res.events.map((e) => e.eventId)).toEqual([
      'evt-000001',
      'evt-000002',
    ]);
    expect(res.events.map((e) => e.type)).toEqual([
      'DaysAdvanced',
      'SecondaryNote',
    ]);
    expect(res.events.every((e) => e.revision === worldRevision(1))).toBe(true);
    expect(res.events.every((e) => e.commandId === 'cmd-1')).toBe(true);
    expect(res.events[0]!.previousHash).toBe(GENESIS_HASH);
    expect(res.events[1]!.previousHash).toBe(res.events[0]!.hash);
    expect(res.world.revision).toBe(worldRevision(1));
    expect(res.world.nextIds.event).toBe(3);
    expect(kernel.eventCount).toBe(2);
    expect(kernel.chainHead).toBe(res.events[1]!.hash);
    expect(verifyEventChain(kernel.events)).toEqual({
      ok: true,
      headHash: res.events[1]!.hash,
      count: 2,
    });
    expect(kernel.knownCommandIds).toEqual(['cmd-1']);
  });

  it('keeps issuing sequential event ids across commands with different event counts', () => {
    const { kernel } = setup(twoEventRouter);
    expect(kernel.execute(advance(1, 1)).ok).toBe(true);
    const second = kernel.execute(advance(2, 1));
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.events.map((e) => e.eventId)).toEqual([
      'evt-000003',
      'evt-000004',
    ]);
    expect(second.world.revision).toBe(worldRevision(2));
    expect(kernel.world.nextIds.event).toBe(5);
  });

  it('changes nothing when beforeCommit throws after a two-event resolution', () => {
    const { kernel } = setup(twoEventRouter, true);
    const before = snapshot(kernel);
    const res = kernel.execute(advance(1, 2));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.rejection.code).toBe('INTERNAL_ERROR');
    expect(snapshot(kernel)).toEqual(before);
    expect(kernel.knownCommandIds).toEqual([]);
  });

  it('treats an accepted resolution with no events as an internal error and changes nothing', () => {
    const noEvents = (ctx: RouteContext): RouteOutcome => {
      const base = routeCommand(ctx);
      if (!base.ok) return base;
      return { ...base, resolution: { ...base.resolution, eventSpecs: [] } };
    };
    const { kernel } = setup(noEvents);
    const before = snapshot(kernel);
    const res = kernel.execute(advance(1, 1));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.rejection.code).toBe('INTERNAL_ERROR');
    expect(snapshot(kernel)).toEqual(before);
  });

  it('a router-level rejection mutates nothing and consumes no RNG', () => {
    const { kernel } = setup(twoEventRouter);
    const before = snapshot(kernel);
    const res = kernel.execute(advance(1, 9999));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.rejection.code).toBe('INVALID_PAYLOAD');
    expect(snapshot(kernel)).toEqual(before);
    expect(kernel.world.rng.draws).toBe(0);
  });
});
