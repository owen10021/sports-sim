import { describe, expect, it } from 'vitest';
import { canonicalString, type ExecuteResult } from '../src/index';
import { submitCommand } from './support/decisionHarness';
import {
  NF,
  SP,
  TODAY,
  codeOf,
  messageOf,
  newOrgKernel,
  okResult,
  runnerFor,
  snapshotOf,
  type Runner,
} from './support/orgHarness';

const TERMS_TYPE = 'organization_plan_v1';

const planTerms = (extra: Record<string, unknown> = {}) => ({
  planId: null,
  kind: 'strategy',
  scopeKey: 'franchise-direction',
  ownerPersonId: NF.gm,
  effectiveAt: TODAY,
  horizon: { seasons: 3 },
  objectives: [
    { key: 'build_through_draft', priority: 'high', target: { picksMin: 6 } },
  ],
  constraints: [
    { key: 'cap_room', kind: 'hard', value: { minUnits: 10 } },
    { key: 'veteran_mix', kind: 'preference', value: 'balanced' },
  ],
  triggerRefs: [
    { kind: 'manual_review', refId: 'review-1', note: 'quarterly' },
  ],
  fallbackPlanIds: [],
  changeReasonRefs: [],
  ...extra,
});

const commitPlan = (
  by: string,
  proposalId: string,
  extra: Record<string, unknown> = {},
  expectedRevision = 1,
) => ({
  type: 'CommitPlanProposal',
  actingPersonId: by,
  proposalId,
  expectedRevision,
  beliefIds: [],
  evidenceClaimIds: [],
  rationale: { note: 'adopt the plan' },
  ...extra,
});

const lastProposalId = (r: Runner) =>
  r.kernel.world.decisions.proposals.at(-1)!.id;

/** Submit (GM is directly authorized) and commit a plan; returns the commit result. */
const adopt = (
  r: Runner,
  terms: Record<string, unknown>,
  commitExtra: Record<string, unknown> = {},
): ExecuteResult => {
  okResult(r.run(submitCommand(NF.gm, { termsType: TERMS_TYPE, terms })));
  return r.run(commitPlan(NF.gm, lastProposalId(r), commitExtra));
};

const types = (res: ExecuteResult) =>
  res.ok ? res.events.map((e) => e.type) : [];

const claim = (by: string, org: string) => ({
  type: 'RecordClaim',
  organizationId: org,
  actingPersonId: by,
  subject: { kind: 'entity', id: 'org-southport' },
  propositionType: 'scouting_note',
  proposition: { note: 'disciplined front office' },
  sourceFamilyId: 'family-alpha',
  observedAt: TODAY,
  visibility: 'organization',
  confidence: 'medium',
  possibleBias: null,
  corroboratesClaimIds: [],
  contradictsClaimIds: [],
});
const belief = (
  by: string,
  org: string,
  evidence: string[],
  extra: Record<string, unknown> = {},
) => ({
  type: 'FormBelief',
  organizationId: org,
  actingPersonId: by,
  subject: { kind: 'entity', id: 'org-southport' },
  assessmentType: 'organization_strength',
  assessment: { rating: 'solid' },
  confidence: 'medium',
  evidenceClaimIds: evidence,
  supersedesBeliefId: null,
  ...extra,
});

describe('committing a new plan', () => {
  it('creates the plan, commits the proposal and records the receipt atomically', () => {
    const r = runnerFor(newOrgKernel());
    const res = okResult(adopt(r, planTerms()));
    expect(types(res)).toEqual([
      'PlanCreated',
      'ProposalCommitted',
      'DecisionReceiptRecorded',
    ]);
    const w = res.world;
    expect(w.plans.plans).toEqual([
      {
        id: 'rec-000002',
        organizationId: NF.org,
        kind: 'strategy',
        scopeKey: 'franchise-direction',
        status: 'active',
        currentRevision: 1,
        revisions: [
          {
            revision: 1,
            ownerPersonId: NF.gm,
            effectiveAt: TODAY,
            horizon: { seasons: 3 },
            objectives: [
              {
                key: 'build_through_draft',
                priority: 'high',
                target: { picksMin: 6 },
              },
            ],
            constraints: [
              { key: 'cap_room', kind: 'hard', value: { minUnits: 10 } },
              { key: 'veteran_mix', kind: 'preference', value: 'balanced' },
            ],
            triggerRefs: [
              { kind: 'manual_review', refId: 'review-1', note: 'quarterly' },
            ],
            fallbackPlanIds: [],
            basisBeliefIds: [],
            changeReasonRefs: [],
          },
        ],
      },
    ]);
    expect(w.decisions.proposals[0]!.state).toBe('committed');
    expect(w.decisions.receipts).toHaveLength(1);
    expect(w.decisions.receipts[0]!.id).toBe('rec-000003');
    expect(w.decisions.receipts[0]!.outcomeEventIds).toEqual(
      res.events.map((e) => e.eventId),
    );
    expect(w.rng.draws).toBe(0);
    expect(w.revision).toBe(2);
  });

  it('accepts only an authorized organization_plan_v1 proposal', () => {
    const r = runnerFor(newOrgKernel());
    okResult(r.run(submitCommand(NF.gm)));
    const before = snapshotOf(r.kernel);
    const res = r.run(commitPlan(NF.gm, 'rec-000001'));
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain(TERMS_TYPE);
    expect(snapshotOf(r.kernel)).toEqual(before);

    // A plan proposal that is still awaiting approval does not commit either.
    okResult(
      r.run(
        submitCommand(NF.scout, { termsType: TERMS_TYPE, terms: planTerms() }),
      ),
    );
    const before2 = snapshotOf(r.kernel);
    const res2 = r.run(commitPlan(NF.gm, 'rec-000002'));
    expect(codeOf(res2)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res2)).toContain('awaiting_approval');
    expect(snapshotOf(r.kernel)).toEqual(before2);
  });

  it('requires execute at commit time, independent of propose/approve', () => {
    const r = runnerFor(newOrgKernel());
    okResult(
      r.run(
        submitCommand(NF.gm, { termsType: TERMS_TYPE, terms: planTerms() }),
      ),
    );
    const before = snapshotOf(r.kernel);
    const res = r.run(commitPlan(NF.scout, 'rec-000001'));
    expect(codeOf(res)).toBe('INSUFFICIENT_AUTHORITY');
    expect(messageOf(res)).toContain('execute');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('rejects malformed plan terms without changing anything', () => {
    const bads: Record<string, unknown>[] = [
      planTerms({ kind: 'dynasty' }),
      planTerms({ scopeKey: '' }),
      planTerms({ ownerPersonId: SP.gm }),
      planTerms({ effectiveAt: '2026-10-01' }),
      planTerms({
        objectives: [{ key: 'a', priority: 'urgent', target: 1 }],
      }),
      planTerms({
        objectives: [
          { key: 'a', priority: 'low', target: 1 },
          { key: 'a', priority: 'low', target: 2 },
        ],
      }),
      planTerms({
        constraints: [{ key: 'a', kind: 'soft', value: 1 }],
      }),
      planTerms({ planId: 'rec-999999' }),
    ];
    for (const terms of bads) {
      const r = runnerFor(newOrgKernel());
      okResult(r.run(submitCommand(NF.gm, { termsType: TERMS_TYPE, terms })));
      const before = snapshotOf(r.kernel);
      expect(codeOf(r.run(commitPlan(NF.gm, 'rec-000001')))).toBe(
        'INVALID_PAYLOAD',
      );
      expect(snapshotOf(r.kernel)).toEqual(before);
    }
  });
});

describe('revising a plan', () => {
  const adopted = () => {
    const r = runnerFor(newOrgKernel());
    okResult(adopt(r, planTerms()));
    return r;
  };

  it('appends a revision and preserves the earlier one byte-for-byte', () => {
    const r = adopted();
    const firstRevision = canonicalString(
      r.kernel.world.plans.plans[0]!.revisions[0],
    );
    const res = okResult(
      adopt(
        r,
        planTerms({
          planId: 'rec-000002',
          objectives: [
            {
              key: 'build_through_draft',
              priority: 'high',
              target: { picksMin: 6 },
            },
            { key: 'cap_flexibility', priority: 'medium', target: 'high' },
          ],
        }),
      ),
    );
    expect(types(res)).toEqual([
      'PlanRevised',
      'ProposalCommitted',
      'DecisionReceiptRecorded',
    ]);
    const plan = res.world.plans.plans[0]!;
    expect(plan.currentRevision).toBe(2);
    expect(plan.revisions).toHaveLength(2);
    expect(canonicalString(plan.revisions[0])).toBe(firstRevision);
    expect(plan.revisions[1]!.objectives.map((o) => o.key)).toEqual([
      'build_through_draft',
      'cap_flexibility',
    ]);
  });

  it('plan inertia: changing an objective needs a change reason; absent cause is rejected', () => {
    const r = adopted();
    const reversed = planTerms({
      planId: 'rec-000002',
      objectives: [
        {
          key: 'build_through_draft',
          priority: 'high',
          target: { picksMin: 0 },
        },
      ],
    });
    okResult(
      r.run(submitCommand(NF.gm, { termsType: TERMS_TYPE, terms: reversed })),
    );
    const before = snapshotOf(r.kernel);
    const res = r.run(commitPlan(NF.gm, lastProposalId(r)));
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('changeReasonRef');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('a visible claim as cause lets the reversal through; an invisible one does not', () => {
    const r = adopted();
    const claimRes = okResult(r.run(claim(NF.scout, NF.org)));
    const claimId = claimRes.world.information.claims[0]!.id;
    const reversed = (ref: string) =>
      planTerms({
        planId: 'rec-000002',
        objectives: [
          {
            key: 'build_through_draft',
            priority: 'high',
            target: { picksMin: 0 },
          },
        ],
        changeReasonRefs: [ref],
      });
    okResult(
      r.run(
        submitCommand(NF.gm, {
          termsType: TERMS_TYPE,
          terms: reversed('rec-999999'),
        }),
      ),
    );
    const before = snapshotOf(r.kernel);
    expect(codeOf(r.run(commitPlan(NF.gm, lastProposalId(r))))).toBe(
      'INVALID_PAYLOAD',
    );
    expect(snapshotOf(r.kernel)).toEqual(before);

    okResult(
      r.run(
        submitCommand(NF.gm, {
          termsType: TERMS_TYPE,
          terms: reversed(claimId),
        }),
      ),
    );
    const res = okResult(r.run(commitPlan(NF.gm, lastProposalId(r))));
    expect(res.world.plans.plans[0]!.revisions[1]!.changeReasonRefs).toEqual([
      claimId,
    ]);
  });

  it('hard constraints are protected from silent change; preferences are not', () => {
    const r = adopted();
    const prefOnly = planTerms({
      planId: 'rec-000002',
      constraints: [
        { key: 'cap_room', kind: 'hard', value: { minUnits: 10 } },
        { key: 'veteran_mix', kind: 'preference', value: 'young' },
      ],
    });
    okResult(adopt(r, prefOnly));
    expect(r.kernel.world.plans.plans[0]!.currentRevision).toBe(2);

    const hardChanged = planTerms({
      planId: 'rec-000002',
      constraints: [
        { key: 'cap_room', kind: 'hard', value: { minUnits: 0 } },
        { key: 'veteran_mix', kind: 'preference', value: 'young' },
      ],
    });
    okResult(
      r.run(
        submitCommand(NF.gm, { termsType: TERMS_TYPE, terms: hardChanged }),
      ),
    );
    const res = r.run(commitPlan(NF.gm, lastProposalId(r)));
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('changeReasonRef');
  });

  it('a new plan in an occupied scope supersedes the old one only with a cause', () => {
    const r = adopted();
    const claimId = okResult(r.run(claim(NF.scout, NF.org))).world.information
      .claims[0]!.id;
    okResult(
      r.run(
        submitCommand(NF.gm, { termsType: TERMS_TYPE, terms: planTerms() }),
      ),
    );
    const before = snapshotOf(r.kernel);
    expect(codeOf(r.run(commitPlan(NF.gm, lastProposalId(r))))).toBe(
      'INVALID_PAYLOAD',
    );
    expect(snapshotOf(r.kernel)).toEqual(before);

    okResult(
      r.run(
        submitCommand(NF.gm, {
          termsType: TERMS_TYPE,
          terms: planTerms({ changeReasonRefs: [claimId] }),
        }),
      ),
    );
    const res = okResult(r.run(commitPlan(NF.gm, lastProposalId(r))));
    expect(types(res)).toEqual([
      'PlanCreated',
      'PlanSuperseded',
      'ProposalCommitted',
      'DecisionReceiptRecorded',
    ]);
    expect(res.world.plans.plans.map((p) => [p.id, p.status])).toEqual([
      ['rec-000002', 'superseded'],
      [res.world.plans.plans[1]!.id, 'active'],
    ]);
    // The superseded plan keeps its full history.
    expect(res.world.plans.plans[0]!.revisions).toHaveLength(1);
  });

  it('keeps fallback links honest', () => {
    const r = adopted();
    const attempt = (fallbackPlanIds: string[], extra = {}) => {
      okResult(
        r.run(
          submitCommand(NF.gm, {
            termsType: TERMS_TYPE,
            terms: planTerms({
              planId: 'rec-000002',
              fallbackPlanIds,
              ...extra,
            }),
          }),
        ),
      );
      return r.run(commitPlan(NF.gm, lastProposalId(r)));
    };
    const before = snapshotOf(r.kernel);
    expect(codeOf(attempt(['rec-999999']))).toBe('INVALID_PAYLOAD'); // unknown
    expect(codeOf(attempt(['rec-000002']))).toBe('INVALID_PAYLOAD'); // itself
    expect(codeOf(attempt(['rec-000002', 'rec-000002']))).toBe(
      'INVALID_PAYLOAD',
    ); // duplicate
    // Only the proposals were added; no plan changed.
    expect(r.kernel.world.plans.plans).toHaveLength(1);
    expect(r.kernel.world.plans.plans[0]!.currentRevision).toBe(1);
    expect(r.kernel.world.revision).toBeGreaterThan(Number(before.revision));

    // A real second plan in a different scope is a valid fallback.
    okResult(adopt(r, planTerms({ scopeKey: 'cap-contingency' })));
    const second = r.kernel.world.plans.plans.find(
      (p) => p.scopeKey === 'cap-contingency',
    )!;
    const res = okResult(
      adopt(
        r,
        planTerms({ planId: 'rec-000002', fallbackPlanIds: [second.id] }),
      ),
    );
    expect(res.world.plans.plans[0]!.revisions[1]!.fallbackPlanIds).toEqual([
      second.id,
    ]);
  });
});

describe('belief basis and receipts', () => {
  it('records only beliefs the committing actor can see, and the receipt preserves them exactly', () => {
    const r = runnerFor(newOrgKernel());
    const c1 = okResult(r.run(claim(NF.scout, NF.org))).world.information
      .claims[0]!.id;
    const b1 = okResult(r.run(belief(NF.gm, NF.org, [c1]))).world.information
      .beliefs[0]!.id;

    // A belief held by another organization is not available as a basis.
    const spClaim = okResult(
      r.run(claim(SP.scout, SP.org)),
    ).world.information.claims.at(-1)!.id;
    const spBelief = okResult(
      r.run(belief(SP.gm, SP.org, [spClaim])),
    ).world.information.beliefs.at(-1)!.id;
    okResult(
      r.run(
        submitCommand(NF.gm, { termsType: TERMS_TYPE, terms: planTerms() }),
      ),
    );
    const proposalId = lastProposalId(r);
    const before = snapshotOf(r.kernel);
    expect(
      codeOf(r.run(commitPlan(NF.gm, proposalId, { beliefIds: [spBelief] }))),
    ).toBe('INVALID_PAYLOAD');
    expect(
      codeOf(
        r.run(commitPlan(NF.gm, proposalId, { beliefIds: ['rec-999999'] })),
      ),
    ).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel).fingerprint).toBe(before.fingerprint);

    const res = okResult(
      r.run(
        commitPlan(NF.gm, proposalId, {
          beliefIds: [b1],
          evidenceClaimIds: [c1],
        }),
      ),
    );
    const receipt = res.world.decisions.receipts[0]!;
    expect(receipt.beliefIds).toEqual([b1]);
    expect(receipt.evidenceClaimIds).toEqual([c1]);
    expect(receipt.proposalRevision).toBe(1);
    expect(res.world.plans.plans[0]!.revisions[0]!.basisBeliefIds).toEqual([
      b1,
    ]);

    // Later belief and plan updates never rewrite the receipt.
    const frozen = canonicalString(receipt);
    okResult(r.run(belief(NF.gm, NF.org, [c1], { supersedesBeliefId: b1 })));
    okResult(
      adopt(
        r,
        planTerms({
          planId: res.world.plans.plans[0]!.id,
          horizon: { seasons: 5 },
        }),
      ),
    );
    expect(canonicalString(r.kernel.world.decisions.receipts[0])).toBe(frozen);
  });
});

describe('atomicity', () => {
  it('a fault after resolution leaves plan, proposal, receipt, events, RNG and revision untouched', () => {
    let armed = false;
    const kernel = newOrgKernel({
      beforeCommit: () => {
        if (armed) throw new Error('injected fault');
      },
    });
    const r = runnerFor(kernel);
    okResult(
      r.run(
        submitCommand(NF.gm, { termsType: TERMS_TYPE, terms: planTerms() }),
      ),
    );
    const before = snapshotOf(kernel);
    const worldBefore = canonicalString(kernel.world);
    armed = true;
    expect(codeOf(r.run(commitPlan(NF.gm, 'rec-000001')))).toBe(
      'INTERNAL_ERROR',
    );
    expect(snapshotOf(kernel)).toEqual(before);
    expect(canonicalString(kernel.world)).toBe(worldBefore);
    expect(kernel.world.plans.plans).toEqual([]);
    expect(kernel.world.decisions.receipts).toEqual([]);
    expect(kernel.world.decisions.proposals[0]!.state).toBe('authorized');

    // Once the fault clears, the same proposal commits exactly once.
    armed = false;
    okResult(r.run(commitPlan(NF.gm, 'rec-000001')));
    expect(codeOf(r.run(commitPlan(NF.gm, 'rec-000001')))).toBe(
      'INVALID_PAYLOAD',
    );
    expect(kernel.world.plans.plans).toHaveLength(1);
  });

  it('stale and duplicate commits change nothing and draw no RNG', () => {
    const r = runnerFor(newOrgKernel());
    okResult(
      r.run(
        submitCommand(NF.gm, { termsType: TERMS_TYPE, terms: planTerms() }),
      ),
    );
    const before = snapshotOf(r.kernel);
    expect(
      codeOf(r.run(commitPlan(NF.gm, 'rec-000001'), 'test_harness', 0)),
    ).toBe('STALE_REVISION');
    expect(codeOf(r.run(commitPlan(NF.gm, 'rec-000001', {}, 7)))).toBe(
      'INVALID_PAYLOAD',
    );
    expect(snapshotOf(r.kernel).fingerprint).toBe(before.fingerprint);
    expect(r.kernel.world.rng.draws).toBe(0);
  });
});
