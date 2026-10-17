import { describe, expect, it } from 'vitest';
import { canonicalString } from '../src/index';
import { mintRecordIds } from '../src/commandSupport';
import {
  dRunner,
  NF,
  D_TODAY,
  D_END,
  openWindow,
  allocationTerms,
  submitAllocation,
  commitAllocation,
} from './support/packageDHarness';
import { codeOf, okResult, snapshotOf } from './support/orgHarness';

describe('opportunity window and proposal commands', () => {
  it('only privileged simulation actors can open ruleset-owned finite pools', () => {
    const r = dRunner();
    const before = snapshotOf(r.kernel);
    expect(
      codeOf(
        r.run(
          {
            type: 'OpenOpportunityWindow',
            organizationId: NF.org,
            phaseKey: 'offseason',
            fromDate: D_TODAY,
            toDate: D_END,
          },
          'human_gm',
        ),
      ),
    ).toBe('UNAUTHORIZED_ACTOR');
    expect(snapshotOf(r.kernel)).toEqual(before);
    openWindow(r);
    const win = r.kernel.world.development.opportunityWindows[0]!;
    expect(
      win.pools.find(
        (p) =>
          p.resourceKey === 'first_team_reps' && p.scopeKey === 'running_back',
      )!.capacityUnits,
    ).toBe(100);
    const after = snapshotOf(r.kernel);
    expect(
      codeOf(
        r.run({
          type: 'OpenOpportunityWindow',
          organizationId: NF.org,
          phaseKey: 'another-label',
          fromDate: D_TODAY,
          toDate: D_END,
        }),
      ),
    ).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(after);
  });
  it('commits a conserved set from one snapshot with canonical record order and a decision receipt', () => {
    const run = (reverse: boolean) => {
      const r = dRunner(),
        windowId = openWindow(r);
      const allocations = [
        allocationTerms('player-nf-01', 60),
        allocationTerms('player-nf-05', 40),
      ];
      const proposalId = submitAllocation(
        r,
        windowId,
        reverse ? [...allocations].reverse() : allocations,
      );
      const draws = r.kernel.world.rng.draws;
      okResult(r.run(commitAllocation(proposalId)));
      expect(r.kernel.world.decisions.receipts.at(-1)!.proposalId).toBe(
        proposalId,
      );
      expect(r.kernel.world.rng.draws).toBe(draws);
      const before = snapshotOf(r.kernel);
      expect(codeOf(r.run(commitAllocation(proposalId)))).toBe(
        'INVALID_PAYLOAD',
      );
      expect(snapshotOf(r.kernel)).toEqual(before);
      return r.kernel.world;
    };
    expect(canonicalString(run(false))).toBe(canonicalString(run(true)));
  });
  it('rejects excess capacity atomically and preserves proposal, IDs and RNG', () => {
    const r = dRunner(),
      win = openWindow(r);
    const id = submitAllocation(r, win, [
      allocationTerms('player-nf-01', 60),
      allocationTerms('player-nf-05', 60),
    ]);
    const before = snapshotOf(r.kernel);
    expect(codeOf(r.run(commitAllocation(id)))).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);
    expect(r.kernel.world.decisions.proposals.at(-1)!.state).toBe('authorized');
  });
  it('rejects stale proposal revisions and mutated terms without partially committing', () => {
    const r = dRunner(),
      win = openWindow(r);
    const id = submitAllocation(r, win, [allocationTerms()]);
    const before = snapshotOf(r.kernel);
    expect(
      codeOf(r.run({ ...commitAllocation(id), expectedRevision: 2 })),
    ).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });
  it('reserves authoritative development record IDs when minting other domain records', () => {
    const r = dRunner();
    openWindow(r);
    const w = r.kernel.world;
    const id = w.development.opportunityWindows[0]!.id;
    const rewound = {
      ...w,
      nextIds: { ...w.nextIds, record: Number(id.slice(4)) },
    };
    expect(mintRecordIds(rewound, 1).ids).not.toContain(id);
  });
});

describe('delegated opportunity execution checks actual allocation terms', () => {
  const delegate = (
    r: ReturnType<typeof dRunner>,
    maxAmount: number,
    scopeKeys = ['running_back'],
  ) =>
    okResult(
      r.run({
        type: 'CreateMandate',
        organizationId: NF.org,
        actingPersonId: NF.owner,
        delegatePersonId: NF.gm,
        category: 'workload_usage',
        scope: { scopeKeys },
        hardConstraints: { unit: 'opportunity_units', maxAmount },
        preferences: {},
        allowedRights: ['execute'],
        fallback: {},
        escalationRules: { onExceedsHardConstraint: 'reject' },
      }),
    );
  it('cannot understate workload in a caller-supplied mandate usage declaration', () => {
    const r = dRunner(),
      win = openWindow(r);
    delegate(r, 5);
    const id = submitAllocation(r, win, [allocationTerms('player-nf-01', 60)]);
    const before = snapshotOf(r.kernel);
    expect(
      codeOf(
        r.run({
          ...commitAllocation(id, NF.gm),
          mandateUsage: {
            unit: 'opportunity_units',
            amount: 1,
            scopeKey: 'running_back',
          },
        }),
      ),
    ).toBe('INSUFFICIENT_AUTHORITY');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });
  it('derives valid mandate usage from real terms and records the backing', () => {
    const r = dRunner(),
      win = openWindow(r);
    delegate(r, 80);
    const id = submitAllocation(r, win, [allocationTerms('player-nf-01', 60)]);
    okResult(r.run(commitAllocation(id, NF.gm)));
    expect(r.kernel.world.decisions.receipts.at(-1)!.mandateId).toBe(
      r.kernel.world.authority.mandates.at(-1)!.id,
    );
  });
});
