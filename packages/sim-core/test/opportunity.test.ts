import { describe, expect, it } from 'vitest';
import {
  opportunityProblems,
  remainingOpportunity,
  entityId,
  recordId,
  type OpportunityWindow,
  type OpportunityAllocation,
} from '../src/index';
import { dWorld, NF, D_TODAY, D_END } from './support/packageDHarness';

const window = (): OpportunityWindow => ({
  id: recordId('window-d'),
  organizationId: NF.org,
  phaseKey: 'offseason',
  fromDate: D_TODAY,
  toDate: D_END,
  status: 'open',
  pools: [
    {
      resourceKey: 'first_team_reps',
      scopeKey: 'running_back',
      capacityUnits: 100,
    },
  ],
});
const allocation = (
  id = 'allocation-a',
  playerId = 'player-nf-01',
  units = 60,
): OpportunityAllocation => ({
  id: recordId(id),
  windowId: recordId('window-d'),
  organizationId: NF.org,
  playerId: entityId(playerId),
  resourceKey: 'first_team_reps',
  scopeKey: 'running_back',
  units,
  teacherPersonId: null,
  responsibilityKeys: [],
  basisPlanIds: [],
  sourceProposalId: recordId('proposal-d'),
  committedAt: D_TODAY,
});
describe('finite opportunity validation', () => {
  it('reduces remaining capacity and rejects giving full starter reps to every rostered prospect', () => {
    const w = dWorld(),
      win = window();
    const a = allocation(),
      b = allocation('allocation-b', 'player-nf-05', 40);
    expect(opportunityProblems(w, win, [a, b])).toEqual([]);
    expect(
      remainingOpportunity(win, [a], 'first_team_reps', 'running_back'),
    ).toBe(40);
    expect(
      remainingOpportunity(win, [a, b], 'first_team_reps', 'running_back'),
    ).toBe(0);
    expect(opportunityProblems(w, win, [a, { ...b, units: 60 }])).toContain(
      'OPPORTUNITY_OVERALLOCATED',
    );
  });
  it.each([0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid allocation units %s',
    (units) => {
      expect(
        opportunityProblems(dWorld(), window(), [{ ...allocation(), units }]),
      ).toContain('INVALID_ALLOCATION_UNITS');
    },
  );
  it('rejects unrostered, rival, duplicate, outside-window and resolved-window use', () => {
    const w = dWorld(),
      win = window(),
      a = allocation();
    expect(
      opportunityProblems(w, win, [
        { ...a, playerId: entityId('player-fa-01') },
      ]),
    ).toContain('ALLOCATION_WITHOUT_ROSTER_ACCESS');
    expect(
      opportunityProblems(w, win, [
        { ...a, organizationId: entityId('org-southport') },
      ]),
    ).toContain('WRONG_ORGANIZATION');
    expect(
      opportunityProblems(w, win, [a, { ...a, id: recordId('allocation-b') }]),
    ).toContain('DUPLICATE_ALLOCATION');
    expect(
      opportunityProblems(w, win, [{ ...a, committedAt: '2027-03-02' }]),
    ).toContain('ALLOCATION_OUTSIDE_WINDOW');
    expect(
      opportunityProblems(w, { ...win, status: 'resolved' }, [a]),
    ).toContain('WINDOW_ALREADY_RESOLVED');
    expect(
      opportunityProblems(w, win, [
        { ...a, teacherPersonId: entityId('missing-teacher') },
      ]),
    ).toContain('MISSING_TEACHER');
  });
});
