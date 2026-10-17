import { canonicalString } from './canonical';
import type { EntityId } from './ids';
import { holdsRoleAt } from './people';
import type { OrganizationPlan, PlanRevision } from './plans';
import type { FootballWorld } from './world';

/**
 * Read-only QA over authoritative state. Findings describe incoherence; nothing here
 * ever repairs or rewrites a record, and the world is never mutated.
 */
export const COHERENCE_CODES = [
  'MISSING_DECISION_REFERENCE',
  'STALE_MANDATE',
  'UNEXPLAINED_PLAN_REVERSAL',
] as const;
export type CoherenceCode = (typeof COHERENCE_CODES)[number];

export type CoherenceFinding = {
  readonly code: CoherenceCode;
  readonly organizationId: EntityId;
  readonly subjectIds: readonly string[];
  readonly message: string;
};

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** A revision reverses its predecessor when an objective or hard constraint changed or went. */
const reverses = (prev: PlanRevision, next: PlanRevision): boolean => {
  const kept = (xs: readonly unknown[], ys: readonly unknown[]) =>
    xs.every((x) => ys.some((y) => canonicalString(x) === canonicalString(y)));
  const hard = (r: PlanRevision) =>
    r.constraints.filter((c) => c.kind === 'hard');
  return (
    !kept(prev.objectives, next.objectives) || !kept(hard(prev), hard(next))
  );
};

const planFindings = (
  plans: readonly OrganizationPlan[],
  organizationId: EntityId,
): CoherenceFinding[] => {
  const out: CoherenceFinding[] = [];
  for (const plan of plans) {
    for (let i = 1; i < plan.revisions.length; i += 1) {
      const prev = plan.revisions[i - 1]!;
      const next = plan.revisions[i]!;
      if (reverses(prev, next) && next.changeReasonRefs.length === 0)
        out.push({
          code: 'UNEXPLAINED_PLAN_REVERSAL',
          organizationId,
          subjectIds: [plan.id],
          message: `plan ${plan.id} revision ${next.revision} reverses revision ${prev.revision} with no change reason`,
        });
    }
    // A plan that replaced a superseded plan in the same scope also needs a cause.
    const replaced = plans.some(
      (p) =>
        p.id < plan.id &&
        p.status === 'superseded' &&
        p.kind === plan.kind &&
        p.scopeKey === plan.scopeKey,
    );
    if (replaced && plan.revisions[0]!.changeReasonRefs.length === 0)
      out.push({
        code: 'UNEXPLAINED_PLAN_REVERSAL',
        organizationId,
        subjectIds: [plan.id],
        message: `plan ${plan.id} replaced an earlier plan in scope ${plan.scopeKey} with no change reason`,
      });
  }
  return out;
};

/** Deterministic findings for one organization, sorted by code then subject ids. */
export const auditOrganizationCoherence = (
  world: FootballWorld,
  organizationId: EntityId,
): readonly CoherenceFinding[] => {
  const today = world.simDate;
  const out: CoherenceFinding[] = planFindings(
    world.plans.plans.filter((p) => p.organizationId === organizationId),
    organizationId,
  );

  for (const m of world.authority.mandates) {
    if (m.organizationId !== organizationId || !m.active) continue;
    if (m.effectiveFrom > today) continue;
    if (m.effectiveUntil !== null && m.effectiveUntil < today) continue;
    const delegator = holdsRoleAt(
      world.people,
      organizationId,
      m.delegatorPersonId,
      today,
    );
    const delegate = holdsRoleAt(
      world.people,
      organizationId,
      m.delegatePersonId,
      today,
    );
    if (!delegator || !delegate)
      out.push({
        code: 'STALE_MANDATE',
        organizationId,
        subjectIds: [m.id],
        message: `mandate ${m.id} is still active but its ${
          delegator ? 'delegate' : 'delegator'
        } no longer holds a role`,
      });
  }

  const d = world.decisions;
  const proposalOf = (id: string) => d.proposals.filter((p) => p.id === id);
  for (const p of d.proposals) {
    if (p.organizationId !== organizationId || p.state !== 'committed')
      continue;
    if (
      !d.receipts.some(
        (r) => r.proposalId === p.id && r.proposalRevision === p.revision,
      )
    )
      out.push({
        code: 'MISSING_DECISION_REFERENCE',
        organizationId,
        subjectIds: [p.id],
        message: `committed proposal ${p.id} revision ${p.revision} has no decision receipt`,
      });
  }
  for (const r of d.receipts) {
    const owner = proposalOf(r.proposalId)[0];
    if (owner === undefined || owner.organizationId !== organizationId)
      continue;
    const missing: string[] = [];
    if (
      !proposalOf(r.proposalId).some((p) => p.revision === r.proposalRevision)
    )
      missing.push(`${r.proposalId} revision ${r.proposalRevision}`);
    for (const id of r.approvalIds)
      if (!d.approvals.some((a) => a.id === id)) missing.push(id);
    for (const id of r.beliefIds)
      if (!world.information.beliefs.some((b) => b.id === id)) missing.push(id);
    for (const id of r.evidenceClaimIds)
      if (!world.information.claims.some((c) => c.id === id)) missing.push(id);
    for (const id of r.authorityGrantIds)
      if (!world.authority.grants.some((g) => g.id === id)) missing.push(id);
    if (missing.length > 0)
      out.push({
        code: 'MISSING_DECISION_REFERENCE',
        organizationId,
        subjectIds: [r.id, ...missing.sort(byText)],
        message: `receipt ${r.id} cites records that do not exist`,
      });
  }

  return out.sort(
    (a, b) =>
      byText(a.code, b.code) ||
      byText(a.subjectIds.join('|'), b.subjectIds.join('|')),
  );
};
