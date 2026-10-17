import { describe, expect, it } from 'vitest';
import {
  buildOrganizationDecisionView,
  canonicalString,
  legalOptionIds,
  traceViolations,
  type FootballWorld,
  type OrganizationDecisionView,
} from '../src/index';
import { submitCommand } from './support/decisionHarness';
import {
  NF,
  SP,
  TODAY,
  newOrgKernel,
  okResult,
  runnerFor,
  type Runner,
} from './support/orgHarness';
import { referenceOrganizationReasoner } from './support/referenceOrganizationReasoner';

const TERMS_TYPE = 'organization_plan_v1';
const OPTIONS = ['opt-a', 'opt-b', 'opt-c'];

const claimCmd = (
  by: string,
  org: string,
  proposition: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) => ({
  type: 'RecordClaim',
  organizationId: org,
  actingPersonId: by,
  subject: { kind: 'entity', id: 'org-southport' },
  propositionType: 'option_note',
  proposition,
  sourceFamilyId: `family-${by}`,
  observedAt: TODAY,
  visibility: 'organization',
  confidence: 'medium',
  possibleBias: null,
  corroboratesClaimIds: [],
  contradictsClaimIds: [],
  ...extra,
});

const adoptPlan = (
  r: Runner,
  org: string,
  gm: string,
  prefer: string,
  forbid: string[] = [],
) => {
  const terms = {
    planId: null,
    kind: 'strategy',
    scopeKey: 'direction',
    ownerPersonId: gm,
    effectiveAt: TODAY,
    horizon: { seasons: 2 },
    objectives: [{ key: 'direction', priority: 'high', target: { prefer } }],
    constraints:
      forbid.length > 0
        ? [{ key: 'no_go', kind: 'hard', value: { forbid } }]
        : [],
    triggerRefs: [],
    fallbackPlanIds: [],
    changeReasonRefs: [],
  };
  okResult(
    r.run(
      submitCommand(gm, { organizationId: org, termsType: TERMS_TYPE, terms }),
    ),
  );
  okResult(
    r.run({
      type: 'CommitPlanProposal',
      actingPersonId: gm,
      proposalId: r.kernel.world.decisions.proposals.at(-1)!.id,
      expectedRevision: 1,
      beliefIds: [],
      evidenceClaimIds: [],
      rationale: { note: 'adopt' },
    }),
  );
};

const viewOf = (
  w: FootballWorld,
  org: typeof NF.org,
  actor: typeof NF.gm,
): OrganizationDecisionView => {
  const res = buildOrganizationDecisionView(w, {
    organizationId: org,
    actorPersonId: actor,
    category: 'organizational_plan',
    optionIds: OPTIONS,
    deadline: null,
  });
  if (!res.ok) throw new Error(res.message);
  return res.view;
};

/** Same public situation; each organization holds a different private claim and plan. */
const divergentWorld = () => {
  const r = runnerFor(newOrgKernel());
  okResult(r.run(claimCmd(NF.scout, NF.org, { favors: 'opt-a' })));
  okResult(r.run(claimCmd(SP.scout, SP.org, { favors: 'opt-b' })));
  // A restricted claim only Northfield's scout (and an execute-holder) may see.
  okResult(
    r.run(
      claimCmd(
        NF.scout,
        NF.org,
        { opposes: 'opt-c' },
        { visibility: 'restricted' },
      ),
    ),
  );
  adoptPlan(r, NF.org, NF.gm, 'opt-a');
  adoptPlan(r, SP.org, SP.gm, 'opt-b', ['opt-c']);
  return r.kernel.world;
};

describe('the decision view', () => {
  it('exposes only knowledge-filtered fields and never the raw world', () => {
    const w = divergentWorld();
    const view = viewOf(w, NF.org, NF.gm);
    expect(Object.keys(view).sort()).toEqual([
      'actorPersonId',
      'asOf',
      'authority',
      'category',
      'deadline',
      'knowledge',
      'optionIds',
      'organizationId',
      'plans',
      'publicFacts',
      'relationships',
    ]);
    for (const hidden of [
      'rng',
      'worldModelVersion',
      'nextIds',
      'decisions',
      'information',
      'seed',
      'actorKind',
    ])
      expect(canonicalString(view)).not.toContain(`"${hidden}"`);
    // Nothing of the other organization's private records leaks in.
    const text = canonicalString(view);
    expect(text).not.toContain(SP.scout);
    expect(text).not.toContain('person-sp-gm');
    for (const p of view.plans) expect(p.organizationId).toBe(NF.org);
    // @ts-expect-error a FootballWorld is not an OrganizationDecisionView
    const notAView: OrganizationDecisionView = w;
    void notAView;
  });

  it('is built without mutating the world', () => {
    const w = divergentWorld();
    const before = canonicalString(w);
    viewOf(w, NF.org, NF.gm);
    viewOf(w, SP.org, SP.gm);
    expect(canonicalString(w)).toBe(before);
  });

  it('refuses a non-member and an unknown organization', () => {
    const w = divergentWorld();
    const req = (org: typeof NF.org, actor: typeof NF.gm) =>
      buildOrganizationDecisionView(w, {
        organizationId: org,
        actorPersonId: actor,
        category: 'organizational_plan',
        optionIds: OPTIONS,
        deadline: null,
      });
    expect(req(NF.org, SP.gm as typeof NF.gm).ok).toBe(false);
    expect(req('org-nowhere' as typeof NF.org, NF.gm).ok).toBe(false);
  });

  it('hides restricted claims from members who may not see them', () => {
    const w = divergentWorld();
    const gm = viewOf(w, NF.org, NF.gm); // GM holds execute on organizational_authority
    const owner = viewOf(w, NF.org, NF.owner);
    expect(owner.knowledge.claims.length).toBeGreaterThanOrEqual(
      gm.knowledge.claims.length,
    );
    const scoutOnly = (v: OrganizationDecisionView) =>
      v.knowledge.claims.some((c) => c.visibility === 'restricted');
    // The GM lacks execute on authority in the seed, so the restricted claim is hidden.
    expect(scoutOnly(gm)).toBe(false);
    expect(scoutOnly(owner)).toBe(true);
  });
});

describe('divergent recommendations from legitimate differences', () => {
  it('two organizations facing the same options decide differently, citing only their own records', () => {
    const w = divergentWorld();
    const nf = viewOf(w, NF.org, NF.gm);
    const sp = viewOf(w, SP.org, SP.gm);
    const a = referenceOrganizationReasoner.recommend(nf);
    const b = referenceOrganizationReasoner.recommend(sp);
    expect(a.selectedOptionId).toBe('opt-a');
    expect(b.selectedOptionId).toBe('opt-b');
    expect(b.trace.rejectedOptions).toEqual([
      { optionId: 'opt-c', reason: 'forbidden by a hard plan constraint' },
    ]);
    expect(traceViolations(nf, a)).toEqual([]);
    expect(traceViolations(sp, b)).toEqual([]);
    // Each trace cites records from its own organization only.
    expect(
      a.trace.goalPlanIds.every((id) => nf.plans.some((p) => p.id === id)),
    ).toBe(true);
    // Swapping views makes the other organization's citations visible violations.
    expect(traceViolations(sp, a).length).toBeGreaterThan(0);
  });

  it('is deterministic for the same view', () => {
    const w = divergentWorld();
    const v = viewOf(w, NF.org, NF.gm);
    expect(canonicalString(referenceOrganizationReasoner.recommend(v))).toBe(
      canonicalString(referenceOrganizationReasoner.recommend(v)),
    );
  });

  it('selects nothing when it has no evidence', () => {
    const r = runnerFor(newOrgKernel());
    const v = viewOf(r.kernel.world, NF.org, NF.gm);
    const rec = referenceOrganizationReasoner.recommend(v);
    expect(rec.selectedOptionId).toBeNull();
    expect(rec.trace.uncertainties.length).toBeGreaterThan(0);
  });
});

describe('DC-19 human/CPU symmetry', () => {
  it('identical role, grants and view give identical legal options regardless of actor kind', () => {
    const r = runnerFor(newOrgKernel());
    // Give the scout the GM's exact plan rights so the two are interchangeable here.
    okResult(
      r.run({
        type: 'GrantAuthority',
        organizationId: NF.org,
        actingPersonId: NF.owner,
        personId: NF.scout,
        category: 'organizational_plan',
        rights: ['approve', 'execute'],
        transferable: false,
      }),
    );
    const gm = viewOf(r.kernel.world, NF.org, NF.gm);
    const scout = viewOf(r.kernel.world, NF.org, NF.scout);
    expect(scout.authority.rights).toEqual(gm.authority.rights);
    expect(legalOptionIds(scout)).toEqual(legalOptionIds(gm));
    expect(legalOptionIds(gm)).toEqual(OPTIONS);
    // The view has no notion of who or what is acting.
    expect(canonicalString(gm)).not.toMatch(/cpu|human|actorKind/i);
  });

  it('an actor without propose gets no legal options, whoever it is', () => {
    const r = runnerFor(newOrgKernel());
    okResult(
      r.run({
        type: 'RevokeAuthority',
        actingPersonId: NF.owner,
        grantId: 'grant-nf-scout-plan',
      }),
    );
    const v = viewOf(r.kernel.world, NF.org, NF.scout);
    expect(legalOptionIds(v)).toEqual([]);
    const rec = referenceOrganizationReasoner.recommend(v);
    expect(rec.selectedOptionId).toBeNull();
    expect(traceViolations(v, rec)).toEqual([]);
  });
});
