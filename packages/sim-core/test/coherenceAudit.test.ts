import { describe, expect, it } from 'vitest';
import {
  auditOrganizationCoherence,
  canonicalString,
  type FootballWorld,
} from '../src/index';
import { submitCommand } from './support/decisionHarness';
import {
  NF,
  SP,
  TODAY,
  newOrgKernel,
  okResult,
  runnerFor,
} from './support/orgHarness';

const TERMS_TYPE = 'organization_plan_v1';

const terms = (extra: Record<string, unknown> = {}) => ({
  planId: null,
  kind: 'strategy',
  scopeKey: 'direction',
  ownerPersonId: NF.gm,
  effectiveAt: TODAY,
  horizon: { seasons: 2 },
  objectives: [{ key: 'o', priority: 'high', target: { prefer: 'opt-a' } }],
  constraints: [],
  triggerRefs: [],
  fallbackPlanIds: [],
  changeReasonRefs: [],
  ...extra,
});

const adopt = (r: ReturnType<typeof runnerFor>, t: Record<string, unknown>) => {
  okResult(r.run(submitCommand(NF.gm, { termsType: TERMS_TYPE, terms: t })));
  return okResult(
    r.run({
      type: 'CommitPlanProposal',
      actingPersonId: NF.gm,
      proposalId: r.kernel.world.decisions.proposals.at(-1)!.id,
      expectedRevision: 1,
      beliefIds: [],
      evidenceClaimIds: [],
      rationale: { note: 'adopt' },
    }),
  );
};

describe('coherence audit', () => {
  it('finds nothing wrong in a world built only through the real command path', () => {
    const r = runnerFor(newOrgKernel());
    adopt(r, terms());
    expect(auditOrganizationCoherence(r.kernel.world, NF.org)).toEqual([]);
    expect(auditOrganizationCoherence(r.kernel.world, SP.org)).toEqual([]);
  });

  it('flags an unexplained plan reversal, deterministically and without mutating anything', () => {
    const r = runnerFor(newOrgKernel());
    const w = adopt(r, terms()).world;
    const plan = w.plans.plans[0]!;
    const reversed = {
      ...plan.revisions[0]!,
      revision: 2,
      objectives: [
        { key: 'o', priority: 'high' as const, target: { prefer: 'opt-b' } },
      ],
    };
    // Commands refuse this; the audit exists to catch state that got here some other way.
    const tampered: FootballWorld = {
      ...w,
      plans: {
        plans: [
          {
            ...plan,
            currentRevision: 2,
            revisions: [...plan.revisions, reversed],
          },
        ],
      },
    };
    const before = canonicalString(tampered);
    const first = auditOrganizationCoherence(tampered, NF.org);
    expect(first).toEqual([
      {
        code: 'UNEXPLAINED_PLAN_REVERSAL',
        organizationId: NF.org,
        subjectIds: [plan.id],
        message: `plan ${plan.id} revision 2 reverses revision 1 with no change reason`,
      },
    ]);
    expect(auditOrganizationCoherence(tampered, NF.org)).toEqual(first);
    expect(canonicalString(tampered)).toBe(before);
    // The other organization is unaffected.
    expect(auditOrganizationCoherence(tampered, SP.org)).toEqual([]);

    // An explained reversal is not flagged.
    const explained: FootballWorld = {
      ...tampered,
      plans: {
        plans: [
          {
            ...plan,
            currentRevision: 2,
            revisions: [
              ...plan.revisions,
              { ...reversed, changeReasonRefs: [plan.id] },
            ],
          },
        ],
      },
    };
    expect(auditOrganizationCoherence(explained, NF.org)).toEqual([]);
  });

  it('flags a mandate that outlived the role behind it', () => {
    const r = runnerFor(newOrgKernel());
    okResult(
      r.run({
        type: 'CreateMandate',
        organizationId: NF.org,
        actingPersonId: NF.gm,
        delegatePersonId: NF.scout,
        category: 'organizational_plan',
        scope: { scopeKeys: ['strategy'] },
        hardConstraints: { unit: 'synthetic_units', maxAmount: 100 },
        preferences: {},
        allowedRights: ['propose'],
        fallback: {},
        escalationRules: { onExceedsHardConstraint: 'escalate' },
        effectiveFrom: TODAY,
        effectiveUntil: null,
      }),
    );
    const w = r.kernel.world;
    expect(auditOrganizationCoherence(w, NF.org)).toEqual([]);
    const mandate = w.authority.mandates[0]!;
    // Hand-built stale state: the delegate's role ended but the mandate stayed active.
    const stale: FootballWorld = {
      ...w,
      people: {
        ...w.people,
        roleEpisodes: w.people.roleEpisodes.map((e) =>
          e.personId === NF.scout ? { ...e, endDate: '2026-10-15' } : e,
        ),
      },
    };
    const before = canonicalString(stale);
    const findings = auditOrganizationCoherence(stale, NF.org);
    expect(findings).toEqual([
      {
        code: 'STALE_MANDATE',
        organizationId: NF.org,
        subjectIds: [mandate.id],
        message: `mandate ${mandate.id} is still active but its delegate no longer holds a role`,
      },
    ]);
    expect(canonicalString(stale)).toBe(before);
  });

  it('flags missing receipt references', () => {
    const r = runnerFor(newOrgKernel());
    const w = adopt(r, terms()).world;
    const orphaned: FootballWorld = {
      ...w,
      decisions: { ...w.decisions, receipts: [] },
    };
    const findings = auditOrganizationCoherence(orphaned, NF.org);
    expect(findings.map((f) => f.code)).toEqual(['MISSING_DECISION_REFERENCE']);
    const dangling: FootballWorld = {
      ...w,
      decisions: {
        ...w.decisions,
        receipts: w.decisions.receipts.map((x) => ({
          ...x,
          approvalIds: ['rec-999999' as (typeof x.approvalIds)[number]],
        })),
      },
    };
    const f2 = auditOrganizationCoherence(dangling, NF.org);
    expect(f2).toHaveLength(1);
    expect(f2[0]!.subjectIds).toContain('rec-999999');
  });
});
