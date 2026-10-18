import { describe, expect, it } from 'vitest';
import {
  WorldKernel,
  resolveDevelopmentWindow,
  DeterministicRng,
  SYNTHETIC_PACKAGE_D_RULESET,
  canonicalString,
  fingerprintWorld,
  requireDevelopmentRules,
  commandId,
  worldRevision,
  entityId,
  type CommandEnvelope,
} from '../src/index';
import {
  dRunner,
  adoptDevelopmentPlan,
  NF,
  COACH,
  openWindow,
  submitAllocation,
  allocationTerms,
  commitAllocation,
  D_TODAY,
  D_END,
} from './support/packageDHarness';
import { runnerFor, okResult, codeOf, snapshotOf } from './support/orgHarness';
const resolve = (windowId: string) => ({
  type: 'ResolveDevelopmentCheckpoint',
  windowId,
});

// Isolate the manual command boundary from Task 7's automatic calendar. This fixture
// resumes at a due date; real time advancement is tested in developmentCalendar.test.
const atDate = (
  r: ReturnType<typeof dRunner>,
  date: string,
): ReturnType<typeof dRunner> => {
  const kernel = WorldKernel.resume({
    world: { ...r.kernel.world, simDate: date },
    ruleset: SYNTHETIC_PACKAGE_D_RULESET,
    chainHead: r.kernel.chainHead,
    eventCount: r.kernel.eventCount,
    knownCommandIds: r.kernel.knownCommandIds,
  });
  let n = 0;
  return {
    kernel,
    run: (command, kind = 'test_harness', expectedRevision) =>
      kernel.execute({
        commandId: commandId('unit-checkpoint-' + ++n),
        expectedRevision: worldRevision(
          expectedRevision ?? Number(kernel.world.revision),
        ),
        actor: { kind, id: entityId('actor-1') },
        command,
      } as unknown as CommandEnvelope),
  };
};
const prepared = (supervised = false) => {
  const r = dRunner(),
    windowId = openWindow(r);
  const terms = supervised
    ? {
        ...allocationTerms('player-nf-01', 40),
        resourceKey: 'development_reps',
        teacherPersonId: COACH,
        responsibilityKeys: ['run_reads'],
      }
    : allocationTerms('player-nf-01', 50);
  const p = submitAllocation(r, windowId, [terms]);
  okResult(r.run(commitAllocation(p)));
  return { r: atDate(r, D_END), windowId };
};

describe('atomic development checkpoints', () => {
  it('resolves a window once and rejects early, unauthorized and repeated requests without RNG draws', () => {
    const early = dRunner(),
      win = openWindow(early);
    const p = submitAllocation(early, win, [allocationTerms()]);
    okResult(early.run(commitAllocation(p)));
    const before = snapshotOf(early.kernel);
    expect(codeOf(early.run(resolve(win)))).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(early.kernel)).toEqual(before);
    const { r, windowId } = prepared();
    const due = snapshotOf(r.kernel);
    expect(codeOf(r.run(resolve(windowId), 'human_gm'))).toBe(
      'UNAUTHORIZED_ACTOR',
    );
    expect(snapshotOf(r.kernel)).toEqual(due);
    okResult(r.run(resolve(windowId)));
    expect(r.kernel.world.development.opportunityWindows[0]!.status).toBe(
      'resolved',
    );
    expect(
      r.kernel.world.development.checkpoints.filter((c) => c.windowId !== null),
    ).toHaveLength(1);
    expect(r.kernel.world.development.events.length).toBeGreaterThan(0);
    const done = snapshotOf(r.kernel);
    expect(codeOf(r.run(resolve(windowId)))).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(done);
  });
  it('serializing and resuming the unchanged pre-checkpoint state cannot reroll its outcome', () => {
    const { r, windowId } = prepared();
    const state = JSON.parse(
      JSON.stringify({
        world: r.kernel.world,
        chainHead: r.kernel.chainHead,
        eventCount: r.kernel.eventCount,
        knownCommandIds: r.kernel.knownCommandIds,
      }),
    );
    const resumed = runnerFor(
      WorldKernel.resume({ ...state, ruleset: SYNTHETIC_PACKAGE_D_RULESET }),
    );
    const runSame = (kernel: WorldKernel) =>
      kernel.execute({
        commandId: commandId('cmd-identical-checkpoint'),
        expectedRevision: worldRevision(Number(kernel.world.revision)),
        actor: { kind: 'test_harness', id: entityId('actor-1') },
        command: resolve(windowId),
      });
    okResult(runSame(r.kernel));
    okResult(runSame(resumed.kernel));
    expect(resumed.kernel.chainHead).toBe(r.kernel.chainHead);
    expect(fingerprintWorld(resumed.kernel.world)).toBe(
      fingerprintWorld(r.kernel.world),
    );
    expect(resumed.kernel.world.rng).toEqual(r.kernel.world.rng);
    expect(canonicalString(resumed.kernel.world.development)).toBe(
      canonicalString(r.kernel.world.development),
    );
  });
  it('records teacher-attributed qualitative observations without converting truth into beliefs', () => {
    const { r, windowId } = prepared(true);
    const beliefs = JSON.stringify(r.kernel.world.information.beliefs);
    okResult(r.run(resolve(windowId)));
    expect(JSON.stringify(r.kernel.world.information.beliefs)).toBe(beliefs);
    const claims = r.kernel.world.information.claims.filter(
      (c) => c.propositionType === 'practice_observation',
    );
    expect(claims.length).toBeGreaterThan(0);
    for (const c of claims) {
      expect(c.sourcePersonId).toBe(COACH);
      expect(c.holderOrganizationIds).toEqual([NF.org]);
      expect(JSON.stringify(c.proposition)).not.toMatch(
        /beforeBp|afterBp|malleability|rng|deltaBp/,
      );
    }
    expect(
      r.kernel.world.development.checkpoints.find(
        (c) => c.windowId === windowId,
      )!.rngDrawCount,
    ).toBeGreaterThan(0);
  });
  it('cannot multiply full opportunity budgets by shortening checkpoint windows', () => {
    const r = dRunner();
    const days = requireDevelopmentRules(
      SYNTHETIC_PACKAGE_D_RULESET,
    ).checkpointCadenceDays;
    const before = snapshotOf(r.kernel);
    expect(
      codeOf(
        r.run({
          type: 'OpenOpportunityWindow',
          organizationId: NF.org,
          phaseKey: 'exploit',
          fromDate: D_TODAY,
          toDate: '2027-02-16',
        }),
      ),
    ).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);
    expect(days).toBeGreaterThan(1);
    void D_END;
  });
});

describe('checkpoint learning cannot duplicate a finite lesson across schemes', () => {
  it('divides one shared allocation across explicit target schemes', () => {
    const career = (schemeKeys: string[]) => {
      const r = dRunner();
      const planId = adoptDevelopmentPlan(
        r,
        schemeKeys.map((schemeKey, index) => ({
          key: 'learn_' + index,
          priority: 'high',
          target: {
            playerId: 'player-nf-01',
            schemeKey,
            responsibilityKey: 'run_reads',
            transferFamilyKey: 'ball_carrier',
          },
        })),
      );
      const windowId = openWindow(r);
      const p = submitAllocation(r, windowId, [
        {
          ...allocationTerms('player-nf-01', 40),
          resourceKey: 'development_reps',
          teacherPersonId: COACH,
          responsibilityKeys: ['run_reads'],
          basisPlanIds: [planId],
        },
      ]);
      okResult(r.run(commitAllocation(p)));
      okResult(r.run({ type: 'AdvanceDays', days: 7 }));
      return r.kernel.world.development.roleKnowledge
        .filter(
          (k) =>
            k.playerId === 'player-nf-01' && schemeKeys.includes(k.schemeKey),
        )
        .reduce((n, k) => n + k.familiarityBp, 0);
    };
    const one = career(['target_offense_a']);
    expect(one).toBeGreaterThan(0);
    expect(
      career(['target_offense_a', 'target_offense_b']),
    ).toBeLessThanOrEqual(one);
  });
});

describe('committed learning pins the approved plan revision', () => {
  const objective = (key: string) => ({
    key,
    priority: 'high',
    target: {
      playerId: 'player-nf-01',
      schemeKey: 'scheme_' + key,
      responsibilityKey: 'run_reads',
      transferFamilyKey: 'ball_carrier',
    },
  });
  const revise = (
    r: ReturnType<typeof dRunner>,
    planId: string,
    objectives: Record<string, unknown>[],
    date = D_TODAY,
  ) => {
    const prior = r.kernel.world.decisions.proposals.find(
      (p) => p.termsType === 'organization_plan_v1',
    )!;
    okResult(
      r.run({
        type: 'SubmitProposal',
        organizationId: NF.org,
        actingPersonId: NF.gm,
        category: 'organizational_plan',
        subjects: [{ kind: 'entity', id: NF.org }],
        termsType: 'organization_plan_v1',
        terms: {
          ...(prior.terms as Record<string, unknown>),
          planId,
          effectiveAt: date,
          objectives,
        },
        requiredApproverPersonIds: [],
        expiresAt: null,
        contingencies: {},
      }),
    );
    okResult(
      r.run({
        type: 'CommitPlanProposal',
        actingPersonId: NF.gm,
        proposalId: r.kernel.world.decisions.proposals.at(-1)!.id,
        expectedRevision: 1,
        beliefIds: [],
        evidenceClaimIds: [],
        rationale: { note: 'revised future intent' },
      }),
    );
  };
  const lessonTerms = (planId: string) => ({
    ...allocationTerms('player-nf-01', 40),
    resourceKey: 'development_reps',
    teacherPersonId: COACH,
    responsibilityKeys: ['run_reads'],
    basisPlanIds: [planId],
  });
  it('a later effective plan revision cannot invalidate earlier legal work', () => {
    const r = dRunner(),
      planId = adoptDevelopmentPlan(r, [objective('original')]),
      win = openWindow(r);
    const p = submitAllocation(r, win, [lessonTerms(planId)]);
    okResult(r.run(commitAllocation(p)));
    revise(r, planId, [objective('original')], '2027-02-16');
    okResult(r.run({ type: 'AdvanceDays', days: 7 }));
    expect(
      r.kernel.world.development.checkpoints.filter((c) => c.windowId !== null),
    ).toHaveLength(1);
  });
  it('a same-day revision cannot redirect already-committed teaching to a new scheme', () => {
    const r = dRunner(),
      planId = adoptDevelopmentPlan(r, [objective('original')]),
      win = openWindow(r);
    const p = submitAllocation(r, win, [lessonTerms(planId)]);
    okResult(r.run(commitAllocation(p)));
    revise(r, planId, [objective('original'), objective('added')]);
    okResult(r.run({ type: 'AdvanceDays', days: 7 }));
    const knowledge = r.kernel.world.development.roleKnowledge;
    expect(
      knowledge.some(
        (k) => k.schemeKey === 'scheme_original' && k.familiarityBp > 0,
      ),
    ).toBe(true);
    expect(knowledge.some((k) => k.schemeKey === 'scheme_added')).toBe(false);
  });
  it('rejects a stale plan revision if intent changes between workload approval and execution', () => {
    const r = dRunner(),
      planId = adoptDevelopmentPlan(r, [objective('original')]),
      win = openWindow(r);
    const p = submitAllocation(r, win, [lessonTerms(planId)]);
    revise(r, planId, [objective('original'), objective('added')]);
    const before = snapshotOf(r.kernel);
    expect(codeOf(r.run(commitAllocation(p)))).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });
});

describe('work checkpoints do not own biological time', () => {
  it('does not age a veteran twice when two organizations resolve the same interval', () => {
    const { r, windowId } = prepared();
    okResult(r.run(resolve(windowId)));
    const first = r.kernel.world;
    const otherWindow = {
      ...first.development.opportunityWindows.find((w) => w.id === windowId)!,
      id: 'window-other' as (typeof first.development.opportunityWindows)[number]['id'],
      status: 'open' as const,
    };
    const otherAllocation = {
      ...first.development.opportunityAllocations[0]!,
      id: 'allocation-other' as (typeof first.development.opportunityAllocations)[number]['id'],
      windowId: otherWindow.id,
    };
    const shadow = {
      ...first,
      development: {
        ...first.development,
        opportunityWindows: [
          ...first.development.opportunityWindows,
          otherWindow,
        ],
        opportunityAllocations: [
          ...first.development.opportunityAllocations,
          otherAllocation,
        ],
      },
    };
    const next = resolveDevelopmentWindow(
      shadow,
      SYNTHETIC_PACKAGE_D_RULESET,
      otherWindow.id,
      DeterministicRng.fromState(shadow.rng),
    ).world;
    expect(
      next.roster.players.find((p) => p.personId === 'player-fa-04')!
        .capabilities,
    ).toEqual(
      first.roster.players.find((p) => p.personId === 'player-fa-04')!
        .capabilities,
    );
    const passive = first.development.checkpoints.filter(
      (c) => c.kind === 'passive',
    );
    expect(passive.length).toBeGreaterThan(0);
    expect(
      next.development.checkpoints.filter((c) => c.kind === 'passive'),
    ).toEqual(passive);
  });
  it('prorates late commitments and teacher departures instead of awarding a whole lesson', () => {
    const career = (late: boolean, departure: boolean) => {
      const r = dRunner(),
        windowId = openWindow(r);
      if (late) okResult(r.run({ type: 'AdvanceDays', days: 6 }));
      const p = submitAllocation(r, windowId, [
        {
          ...allocationTerms('player-nf-01', 40),
          resourceKey: 'development_reps',
          teacherPersonId: COACH,
          responsibilityKeys: ['run_reads'],
        },
      ]);
      okResult(r.run(commitAllocation(p)));
      if (departure)
        okResult(
          r.run({
            type: 'EndRoleEpisode',
            organizationId: NF.org,
            actingPersonId: NF.owner,
            episodeId: 'role-nf-coach-d',
            lastDay: D_TODAY,
          }),
        );
      okResult(r.run({ type: 'AdvanceDays', days: late ? 1 : 7 }));
      return r.kernel.world.development.roleKnowledge.find(
        (k) =>
          k.playerId === 'player-nf-01' && k.responsibilityKey === 'run_reads',
      )!.familiarityBp;
    };
    const full = career(false, false);
    expect(career(true, false)).toBeLessThan(full);
    expect(career(false, true)).toBeLessThan(full);
  });
});

it('rejects overdue manual work before changing person-time or drawing RNG', () => {
  const r = dRunner(),
    win = openWindow(r);
  const p = submitAllocation(r, win, [allocationTerms()]);
  okResult(r.run(commitAllocation(p)));
  const overdue = atDate(r, '2027-03-01');
  const before = snapshotOf(overdue.kernel);
  expect(codeOf(overdue.run(resolve(win)))).toBe('INVALID_PAYLOAD');
  expect(snapshotOf(overdue.kernel)).toEqual(before);
});
