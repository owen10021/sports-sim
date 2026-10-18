import { describe, expect, it } from 'vitest';
import {
  GAME_PLAN_EXECUTION_TERMS_TYPE,
  SYNTHETIC_PACKAGE_E_RULESET,
  WorldKernel,
  buildGamePlanExecutionSnapshot,
  type FootballWorld,
} from '../src/index';
import {
  E_FIXTURE_1,
  NF,
  NF_COACH,
  SP,
  SP_COACH,
  adoptStrategyPlan,
  commitBothGamePlans,
  commitGamePlan,
  eRunner,
  eWorld,
  gamePlanTerms,
  reviseStrategyPlan,
  submitGamePlan,
} from './support/packageEHarness';
import {
  codeOf,
  messageOf,
  okResult,
  runnerFor,
  snapshotOf,
  type Runner,
} from './support/orgHarness';

const rules = SYNTHETIC_PACKAGE_E_RULESET.rules.football!;

const mutated = (mutate: (w: FootballWorld) => FootballWorld): Runner =>
  runnerFor(
    WorldKernel.fromGenesis(mutate(eWorld()), SYNTHETIC_PACKAGE_E_RULESET),
  );

const rejects = (
  r: Runner,
  terms: Record<string, unknown>,
  contains: string,
) => {
  const id = submitGamePlan(r, terms);
  const before = snapshotOf(r.kernel);
  const res = r.run(commitGamePlan(id));
  expect(codeOf(res)).toBe('INVALID_PAYLOAD');
  expect(messageOf(res)).toContain(contains);
  expect(snapshotOf(r.kernel)).toEqual(before);
  expect(r.kernel.world.football.gamePlans).toHaveLength(0);
};

describe('game-plan execution snapshot', () => {
  it('commits an immutable snapshot pinned to plan revisions and the proposal terms hash', () => {
    const r = eRunner();
    const planId = adoptStrategyPlan(r);
    const terms = gamePlanTerms({
      strategyPlanRefs: [{ planId, revision: 1 }],
    });
    const proposalId = submitGamePlan(r, terms);
    const proposal = r.kernel.world.decisions.proposals.at(-1)!;
    const res = okResult(r.run(commitGamePlan(proposalId)));
    expect(res.events.map((e) => e.type)).toContain('GamePlanCommitted');

    const snapshot = r.kernel.world.football.gamePlans[0]!;
    expect(snapshot).toMatchObject({
      fixtureId: E_FIXTURE_1,
      organizationId: NF.org,
      capturedAt: r.kernel.world.simDate,
      strategyPlanRefs: [{ planId, revision: 1 }],
      schemeProposalRef: {
        proposalId,
        revision: 1,
        termsHash: proposal.termsHash,
      },
      authorizedStaffPersonIds: [NF_COACH],
      schemeKey: 'base_offense',
      conceptKeys: ['inside_run', 'quick_pass', 'zone_shell'],
      personnelPreferenceKeys: ['personnel_11'],
      sourceProposalId: proposalId,
    });
    const receipt = r.kernel.world.decisions.receipts.at(-1)!;
    expect(receipt.proposalId).toBe(proposalId);
    expect(receipt.executedTermsHash).toBe(proposal.termsHash);
  });

  it('does not follow later strategy-plan revisions or newer scheme proposals', () => {
    const r = eRunner();
    const planId = adoptStrategyPlan(r);
    okResult(
      r.run(
        commitGamePlan(
          submitGamePlan(
            r,
            gamePlanTerms({ strategyPlanRefs: [{ planId, revision: 1 }] }),
          ),
        ),
      ),
    );
    const snapshot = r.kernel.world.football.gamePlans[0]!;
    const receipt = r.kernel.world.decisions.receipts.at(-1)!;

    reviseStrategyPlan(r, planId);
    expect(
      r.kernel.world.plans.plans.find((p) => p.id === planId)!.currentRevision,
    ).toBe(2);
    submitGamePlan(
      r,
      gamePlanTerms({
        strategyPlanRefs: [{ planId, revision: 2 }],
        conceptKeys: ['deep_pass'],
      }),
    );

    expect(r.kernel.world.football.gamePlans).toEqual([snapshot]);
    expect(r.kernel.world.football.gamePlans[0]!.strategyPlanRefs).toEqual([
      { planId, revision: 1 },
    ]);
    expect(
      r.kernel.world.decisions.receipts.find((x) => x.id === receipt.id),
    ).toEqual(receipt);
  });

  it('rejects a stale, foreign, closed or non-strategy plan reference', () => {
    const r = eRunner();
    const planId = adoptStrategyPlan(r);
    reviseStrategyPlan(r, planId);
    rejects(
      r,
      gamePlanTerms({ strategyPlanRefs: [{ planId, revision: 1 }] }),
      'revision 2, not 1',
    );
    rejects(
      r,
      gamePlanTerms({
        strategyPlanRefs: [{ planId: 'plan-does-not-exist', revision: 1 }],
      }),
      'not a strategy plan',
    );
  });

  it('rejects unknown scheme, concept or personnel vocabulary and unknown staff', () => {
    rejects(
      eRunner(),
      gamePlanTerms({ schemeKey: 'made_up' }),
      'not in the rules',
    );
    rejects(
      eRunner(),
      gamePlanTerms({ conceptKeys: ['made_up_concept'] }),
      'concept made_up_concept',
    );
    rejects(
      eRunner(),
      gamePlanTerms({ conceptKeys: [] }),
      'at least one concept',
    );
    rejects(
      eRunner(),
      gamePlanTerms({ personnelPreferenceKeys: ['personnel_99'] }),
      'personnel group',
    );
    rejects(
      eRunner(),
      gamePlanTerms({ authorizedStaffPersonIds: [] }),
      'at least one person',
    );
    rejects(
      eRunner(),
      gamePlanTerms({ authorizedStaffPersonIds: ['person-nobody'] }),
      'does not hold a role',
    );
    rejects(
      eRunner(),
      gamePlanTerms({ authorizedStaffPersonIds: [SP_COACH] }),
      'does not hold a role',
    );
  });

  it('rejects malformed terms and a fixture the club does not play in or that is final', () => {
    rejects(eRunner(), { ...gamePlanTerms(), extra: 1 }, 'exactly the keys');
    rejects(
      eRunner(),
      gamePlanTerms({ fixtureId: 'fixture-nope' }),
      'does not name a fixture',
    );
    const final = mutated((w) => ({
      ...w,
      football: {
        ...w.football,
        fixtures: w.football.fixtures.map((f) =>
          f.id === E_FIXTURE_1 ? { ...f, status: 'final' as const } : f,
        ),
      },
    }));
    rejects(final, gamePlanTerms(), 'already final');
  });

  it('allows exactly one committed game plan per club and fixture', () => {
    const r = eRunner();
    okResult(r.run(commitGamePlan(submitGamePlan(r, gamePlanTerms()))));
    const again = submitGamePlan(
      r,
      gamePlanTerms({ conceptKeys: ['deep_pass'] }),
    );
    const before = snapshotOf(r.kernel);
    const res = r.run(commitGamePlan(again));
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('already has a committed game plan');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('lets both clubs commit independently and leaves the strategy plans untouched', () => {
    const r = eRunner();
    const planId = adoptStrategyPlan(r);
    const plansBefore = r.kernel.world.plans;
    commitBothGamePlans(r);
    expect(
      r.kernel.world.football.gamePlans.map((g) => g.organizationId),
    ).toEqual([NF.org, SP.org]);
    expect(r.kernel.world.plans).toEqual(plansBefore);
    expect(planId).toBeTruthy();
  });

  it('hashes the plan independent of list order', () => {
    const a = eRunner();
    const b = eRunner();
    submitGamePlan(a, gamePlanTerms());
    submitGamePlan(
      b,
      gamePlanTerms({
        conceptKeys: ['zone_shell', 'quick_pass', 'inside_run'],
      }),
    );
    expect(a.kernel.world.decisions.proposals.at(-1)!.termsHash).toBe(
      b.kernel.world.decisions.proposals.at(-1)!.termsHash,
    );
  });
});

describe('game-plan authority', () => {
  it('lets only a person with execute commit, whatever the actor kind', () => {
    for (const kind of [
      'human_gm',
      'commissioner',
      'system',
      'test_harness',
    ] as const) {
      const r = eRunner();
      const id = submitGamePlan(r, gamePlanTerms());
      const before = snapshotOf(r.kernel);
      const res = r.run(commitGamePlan(id, NF.gm), kind);
      expect(codeOf(res)).toBe('INSUFFICIENT_AUTHORITY');
      expect(snapshotOf(r.kernel)).toEqual(before);
      okResult(r.run(commitGamePlan(id, NF_COACH), kind));
      expect(r.kernel.world.football.gamePlans).toHaveLength(1);
    }
  });

  it('refuses a stale proposal revision and a wrong category or terms type', () => {
    const r = eRunner();
    const id = submitGamePlan(r, gamePlanTerms());
    okResult(
      r.run({
        type: 'ReviseProposal',
        actingPersonId: NF.gm,
        proposalId: id,
        expectedRevision: 1,
        terms: gamePlanTerms({ conceptKeys: ['deep_pass'] }),
      }),
    );
    const before = snapshotOf(r.kernel);
    const res = r.run(commitGamePlan(id));
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('stale');
    expect(snapshotOf(r.kernel)).toEqual(before);
    expect(GAME_PLAN_EXECUTION_TERMS_TYPE).toBe('game_plan_execution_v1');
  });
});

describe('buildGamePlanExecutionSnapshot is pure', () => {
  it('reads the world without changing it and mints no id into it', () => {
    const r = eRunner();
    const id = submitGamePlan(r, gamePlanTerms());
    const world = r.kernel.world;
    const proposal = world.decisions.proposals.at(-1)!;
    const before = JSON.stringify(world);
    const built = buildGamePlanExecutionSnapshot(
      world,
      rules,
      E_FIXTURE_1,
      NF.org,
      proposal,
    );
    expect('snapshot' in built).toBe(true);
    expect(JSON.stringify(world)).toBe(before);
    expect(id).toBe(proposal.id);
  });
});
