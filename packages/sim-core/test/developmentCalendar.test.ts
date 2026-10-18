import { describe, expect, it } from 'vitest';
import {
  WorldKernel,
  createWorld,
  worldId,
  DeterministicRng,
  SYNTHETIC_RULESET,
  SYNTHETIC_SEED,
  ORG_SUBSTRATE_SEED,
  SYNTHETIC_PACKAGE_C_RULESET,
  PACKAGE_C_SEED,
  type FootballWorld,
} from '../src/index';
import {
  dRunner,
  openWindow,
  submitAllocation,
  allocationTerms,
  commitAllocation,
} from './support/packageDHarness';
import { runnerFor, okResult, snapshotOf, codeOf } from './support/orgHarness';

const prepared = () => {
  const r = dRunner(),
    windowId = openWindow(r);
  const p = submitAllocation(r, windowId, [
    allocationTerms('player-nf-01', 50),
  ]);
  okResult(r.run(commitAllocation(p)));
  return { r, windowId };
};
const projection = (world: FootballWorld) => ({
  development: world.development,
  medical: world.medical,
  capabilities: world.roster.players.map((p) => ({
    personId: p.personId,
    capabilities: p.capabilities,
  })),
  simDate: world.simDate,
  rng: world.rng,
});

describe('logical-time development calendar', () => {
  it('preserves the exact legacy A/B/C day-roll and domain behavior', () => {
    for (const [seed, ruleset] of [
      [SYNTHETIC_SEED, SYNTHETIC_RULESET],
      [ORG_SUBSTRATE_SEED, SYNTHETIC_RULESET],
      [PACKAGE_C_SEED, SYNTHETIC_PACKAGE_C_RULESET],
    ] as const) {
      const world = createWorld(seed, ruleset, {
        newWorldId: () => worldId('world-calendar-legacy'),
      });
      const r = runnerFor(WorldKernel.fromGenesis(world, ruleset));
      const rng = DeterministicRng.fromState(world.rng);
      const expected = Array.from({ length: 14 }, () => rng.nextU32());
      okResult(r.run({ type: 'AdvanceDays', days: 14 }));
      expect(r.kernel.world.rng).toEqual(rng.snapshot());
      expect(r.kernel.world.development).toEqual(world.development);
      expect(r.kernel.world.medical).toEqual(world.medical);
      expect(r.kernel.world.roster).toEqual(world.roster);
      expect(r.kernel.events).toHaveLength(1);
      const payload = r.kernel.events[0]!.payload as {
        dayRolls: { roll: number }[];
      };
      expect(payload.dayRolls.map((d) => d.roll)).toEqual(expected);
    }
  });
  it('resolves explicitly committed routine work unattended and invents no new windows', () => {
    const { r, windowId } = prepared();
    okResult(r.run({ type: 'AdvanceDays', days: 14 }));
    expect(
      r.kernel.world.development.opportunityWindows.find(
        (w) => w.id === windowId,
      )!.status,
    ).toBe('resolved');
    expect(r.kernel.world.development.opportunityWindows).toHaveLength(1);
    expect(
      r.kernel.world.development.checkpoints.filter(
        (c) => c.windowId === windowId,
      ),
    ).toHaveLength(1);
    const before = snapshotOf(r.kernel);
    expect(
      codeOf(r.run({ type: 'ResolveDevelopmentCheckpoint', windowId })),
    ).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });
  it('has identical D-domain state and RNG for one 14-day or fourteen 1-day commands', () => {
    const coarse = prepared(),
      fine = prepared();
    okResult(coarse.r.run({ type: 'AdvanceDays', days: 14 }));
    for (let day = 0; day < 14; day++)
      okResult(fine.r.run({ type: 'AdvanceDays', days: 1 }));
    expect(
      coarse.r.kernel.world.development.checkpoints.filter(
        (c) => c.windowId !== null,
      ),
    ).toHaveLength(1);
    expect(projection(coarse.r.kernel.world)).toEqual(
      projection(fine.r.kernel.world),
    );
  });
  it('ages and recovers without work, while an uncommitted window remains undecided', () => {
    const r = dRunner(),
      windowId = openWindow(r);
    const before = r.kernel.world;
    okResult(r.run({ type: 'AdvanceDays', days: 14 }));
    expect(
      r.kernel.world.development.opportunityWindows.find(
        (w) => w.id === windowId,
      )!.status,
    ).toBe('open');
    expect(r.kernel.world.development.opportunityAllocations).toEqual([]);
    expect(
      r.kernel.world.development.checkpoints.every((c) => c.kind === 'passive'),
    ).toBe(true);
    expect(r.kernel.world.development.checkpoints).toHaveLength(14);
    expect(
      r.kernel.world.roster.players.find((p) => p.personId === 'player-fa-04')!
        .capabilities,
    ).not.toEqual(
      before.roster.players.find((p) => p.personId === 'player-fa-04')!
        .capabilities,
    );
    expect(r.kernel.world.information).toEqual(before.information);
  });
});

it('orders same-day committed windows by organization then window ID, regardless of creation order', async () => {
  const { dSeed, NF, SP } = await import('./support/packageDHarness');
  const { sealSeed, SYNTHETIC_PACKAGE_D_RULESET } =
    await import('../src/index');
  const { contentHash: ignored, ...body } = dSeed();
  void ignored;
  const grants = body.organizationSubstrate!.authorityGrants;
  const nfOwner = grants.find(
    (g) => g.personId === NF.owner && g.category === 'workload_usage',
  )!;
  const seed = sealSeed({
    ...body,
    organizationSubstrate: {
      ...body.organizationSubstrate!,
      authorityGrants: [
        ...grants,
        {
          ...nfOwner,
          id: 'grant-sp-d-workload',
          personId: SP.owner,
          organizationId: SP.org,
        },
      ],
    },
  });
  const r = runnerFor(
    WorldKernel.fromGenesis(
      createWorld(seed, SYNTHETIC_PACKAGE_D_RULESET, {
        newWorldId: () => worldId('world-calendar-ties'),
      }),
      SYNTHETIC_PACKAGE_D_RULESET,
    ),
  );
  const spWindow = openWindow(r, { organizationId: SP.org }),
    nfWindow = openWindow(r);
  const spPlayer = r.kernel.world.roster.players.find(
    (p) => p.personId === 'player-sp-02',
  )!;
  expect(spPlayer).toBeDefined();
  okResult(
    r.run({
      type: 'SubmitProposal',
      organizationId: SP.org,
      actingPersonId: SP.owner,
      category: 'workload_usage',
      subjects: [{ kind: 'entity', id: SP.org }],
      termsType: 'opportunity_allocation_v1',
      terms: {
        windowId: spWindow,
        allocations: [
          {
            ...allocationTerms(spPlayer.personId, 40),
            scopeKey: spPlayer.primaryRole,
          },
        ],
      },
      requiredApproverPersonIds: [],
      expiresAt: null,
      contingencies: {},
    }),
  );
  okResult(
    r.run(
      commitAllocation(r.kernel.world.decisions.proposals.at(-1)!.id, SP.owner),
    ),
  );
  const p = submitAllocation(r, nfWindow, [
    allocationTerms('player-nf-01', 40),
  ]);
  okResult(r.run(commitAllocation(p)));
  okResult(r.run({ type: 'AdvanceDays', days: 7 }));
  const checkpoints = r.kernel.world.development.checkpoints.filter(
    (c) => c.windowId !== null,
  );
  expect(checkpoints.map((c) => c.organizationId)).toEqual(
    [NF.org, SP.org].sort(),
  );
  expect(checkpoints).toHaveLength(2);
});
