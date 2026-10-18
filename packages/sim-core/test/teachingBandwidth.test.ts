import { describe, expect, it } from 'vitest';
import {
  teachingProblems,
  entityId,
  recordId,
  opportunityProblems,
  type OpportunityAllocation,
} from '../src/index';
import {
  dWorld,
  dRunner,
  COACH,
  NF,
  D_TODAY,
  D_END,
} from './support/packageDHarness';
import { okResult } from './support/orgHarness';

const allocation = (units = 40): OpportunityAllocation => ({
  id: recordId('lesson-a'),
  windowId: recordId('window-a'),
  organizationId: NF.org,
  playerId: entityId('player-nf-01'),
  resourceKey: 'installation_work',
  scopeKey: 'running_back',
  units,
  teacherPersonId: COACH,
  responsibilityKeys: ['run_reads'],
  basisPlanIds: [],
  sourceProposalId: recordId('proposal-a'),
  committedAt: D_TODAY,
});

describe('teaching legality and scarce attention', () => {
  it('charges teaching bandwidth across players and resources, not separately per lesson', () => {
    const w = dWorld();
    const a = allocation(50),
      b = {
        ...allocation(40),
        id: recordId('lesson-b'),
        resourceKey: 'development_reps' as const,
        playerId: entityId('player-nf-05'),
      };
    expect(teachingProblems(w, [allocation(40)])).toEqual([]);
    expect(teachingProblems(w, [a, b])).toContain(
      'TEACHING_BANDWIDTH_EXCEEDED',
    );
    expect(teachingProblems(w, [b, a])).toEqual(teachingProblems(w, [a, b]));
  });
  it('rejects missing expertise, inactive teachers and work for unrelated roles', () => {
    const w = dWorld(),
      a = allocation();
    expect(
      teachingProblems(w, [{ ...a, responsibilityKeys: ['coverage_rules'] }]),
    ).toContain('TEACHER_LACKS_RESPONSIBILITY_EXPERTISE');
    expect(teachingProblems(w, [{ ...a, scopeKey: 'quarterback' }])).toContain(
      'ALLOCATION_ROLE_MISMATCH',
    );
    expect(teachingProblems(w, [{ ...a, teacherPersonId: NF.gm }])).toContain(
      'MISSING_TEACHING_PROFILE',
    );
  });
  it('composes finite pool conservation with teacher bandwidth', () => {
    const w = dWorld(),
      a = allocation(40);
    const win = {
      id: a.windowId,
      organizationId: NF.org,
      phaseKey: 'offseason',
      fromDate: D_TODAY,
      toDate: D_END,
      status: 'open' as const,
      pools: [
        {
          resourceKey: 'installation_work' as const,
          scopeKey: 'running_back',
          capacityUnits: 30,
        },
      ],
    };
    expect(opportunityProblems(w, win, [a])).toContain(
      'OPPORTUNITY_OVERALLOCATED',
    );
    const smallPool = {
      ...win,
      pools: [{ ...win.pools[0]!, capacityUnits: 100 }],
    };
    expect(opportunityProblems(w, smallPool, [allocation(90)])).toContain(
      'TEACHING_BANDWIDTH_EXCEEDED',
    );
  });
  it('staff departure preserves capability and learned knowledge but removes future teaching legality', () => {
    const r = dRunner();
    const control = dRunner();
    okResult(control.run({ type: 'AdvanceDays', days: 1 }));
    const before = JSON.stringify({
      players: control.kernel.world.roster.players,
      knowledge: control.kernel.world.development.roleKnowledge,
    });
    okResult(
      r.run({
        type: 'EndRoleEpisode',
        organizationId: NF.org,
        actingPersonId: NF.owner,
        episodeId: 'role-nf-coach-d',
        lastDay: D_TODAY,
      }),
    );
    okResult(r.run({ type: 'AdvanceDays', days: 1 }));
    expect(
      JSON.stringify({
        players: r.kernel.world.roster.players,
        knowledge: r.kernel.world.development.roleKnowledge,
      }),
    ).toBe(before);
    expect(
      teachingProblems(r.kernel.world, [
        { ...allocation(), committedAt: '2027-02-16' },
      ]),
    ).toContain('TEACHER_NOT_IN_ORGANIZATION');
  });
});

it('reserves person-owned bandwidth across overlapping organization windows but releases it for adjacent windows', () => {
  const base = dWorld(),
    a = allocation(50);
  const first = {
    id: a.windowId,
    organizationId: NF.org,
    phaseKey: 'practice',
    fromDate: D_TODAY,
    toDate: D_END,
    pools: [],
    status: 'open' as const,
  };
  const second = {
    ...first,
    id: recordId('window-b'),
    organizationId: entityId('org-sp'),
  };
  const candidate = {
    ...allocation(40),
    id: recordId('lesson-b'),
    windowId: second.id,
  };
  const world = {
    ...base,
    development: {
      ...base.development,
      opportunityWindows: [first, second],
      opportunityAllocations: [a],
    },
  };
  expect(teachingProblems(world, [candidate])).toContain(
    'TEACHING_BANDWIDTH_EXCEEDED',
  );
  expect(teachingProblems(world, [a])).not.toContain(
    'TEACHING_BANDWIDTH_EXCEEDED',
  );
  const adjacent = {
    ...world,
    development: {
      ...world.development,
      opportunityWindows: [
        first,
        { ...second, fromDate: D_END, toDate: '2027-03-01' },
      ],
    },
  };
  expect(
    teachingProblems(adjacent, [{ ...candidate, committedAt: D_END }]),
  ).not.toContain('TEACHING_BANDWIDTH_EXCEEDED');
});
