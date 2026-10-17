import { describe, expect, it } from 'vitest';
import { activeDevelopmentPlans } from '../src/index';
import {
  dRunner,
  NF,
  SP,
  adoptDevelopmentPlan,
  openWindow,
  submitAllocation,
  allocationTerms,
  commitAllocation,
} from './support/packageDHarness';
import { codeOf, snapshotOf } from './support/orgHarness';

describe('development intent is an existing organizational plan', () => {
  it('adopts a GM plan without granting workload execution authority or reps', () => {
    const r = dRunner();
    const id = adoptDevelopmentPlan(r);
    expect(
      activeDevelopmentPlans(r.kernel.world, NF.org).map((p) => p.id),
    ).toEqual([id]);
    expect(activeDevelopmentPlans(r.kernel.world, SP.org)).toEqual([]);
    expect(r.kernel.world.development.opportunityAllocations).toEqual([]);
    const win = openWindow(r);
    const proposalId = submitAllocation(r, win, [allocationTerms()]);
    const before = snapshotOf(r.kernel);
    expect(codeOf(r.run(commitAllocation(proposalId, NF.gm)))).toBe(
      'INSUFFICIENT_AUTHORITY',
    );
    expect(snapshotOf(r.kernel)).toEqual(before);
  });
});
