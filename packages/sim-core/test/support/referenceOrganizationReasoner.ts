import {
  legalOptionIds,
  type OrganizationDecisionView,
  type OrganizationReasoner,
  type OrganizationRecommendation,
  type RejectedOption,
} from '../../src/index';

/**
 * TEST ONLY. A tiny deterministic reasoner that proves the interface. It is deliberately
 * not a football-value formula: it just counts what the view says.
 *  - an active plan objective `target: { prefer: <optionId> }` adds its priority weight;
 *  - a hard plan constraint `value: { forbid: [<optionId>…] }` removes those options;
 *  - a visible claim `proposition: { favors | opposes: <optionId> }` adds or subtracts 1.
 * Ties break to the smallest option id; no evidence at all selects nothing.
 */
const WEIGHT = { low: 1, medium: 2, high: 3, critical: 4 } as const;

const asRecord = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

export const referenceOrganizationReasoner: OrganizationReasoner = {
  recommend(view: OrganizationDecisionView): OrganizationRecommendation {
    const legal = legalOptionIds(view);
    const rejected: RejectedOption[] = view.optionIds
      .filter((o) => !legal.includes(o))
      .map((optionId) => ({ optionId, reason: 'actor may not propose' }));
    const forbidden = new Set<string>();
    const scores = new Map<string, number>(legal.map((o) => [o, 0]));
    const goalPlanIds = new Set<string>();
    const claimIds = new Set<string>();

    for (const plan of view.plans) {
      const current = plan.revisions.find(
        (r) => r.revision === plan.currentRevision,
      )!;
      for (const o of current.objectives) {
        const prefer = asRecord(o.target).prefer;
        if (typeof prefer === 'string' && scores.has(prefer)) {
          scores.set(prefer, scores.get(prefer)! + WEIGHT[o.priority]);
          goalPlanIds.add(plan.id);
        }
      }
      for (const c of current.constraints) {
        const forbid = asRecord(c.value).forbid;
        if (c.kind === 'hard' && Array.isArray(forbid)) {
          for (const f of forbid)
            if (typeof f === 'string' && scores.has(f)) {
              forbidden.add(f);
              goalPlanIds.add(plan.id);
            }
        }
      }
    }
    for (const claim of view.knowledge.claims) {
      const p = asRecord(claim.proposition);
      for (const [key, delta] of [
        ['favors', 1],
        ['opposes', -1],
      ] as const) {
        const target = p[key];
        if (typeof target === 'string' && scores.has(target)) {
          scores.set(target, scores.get(target)! + delta);
          claimIds.add(claim.id);
        }
      }
    }
    for (const f of [...forbidden].sort())
      rejected.push({
        optionId: f,
        reason: 'forbidden by a hard plan constraint',
      });

    const candidates = [...scores.entries()]
      .filter(([o]) => !forbidden.has(o))
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    const best = candidates[0];
    const selected = best !== undefined && best[1] > 0 ? best[0] : null;
    return {
      selectedOptionId: selected,
      rationale:
        selected === null
          ? 'no supporting evidence or plan preference'
          : `${selected} scores highest on plans and visible evidence`,
      trace: {
        organizationId: view.organizationId,
        actorPersonId: view.actorPersonId,
        category: view.category,
        goalPlanIds: [...goalPlanIds].sort() as never,
        beliefIds: [],
        claimIds: [...claimIds].sort() as never,
        authorityGrantIds: [...view.authority.grantIds],
        consideredOptionIds: [...legal],
        rejectedOptions: rejected.sort((a, b) =>
          a.optionId < b.optionId ? -1 : a.optionId > b.optionId ? 1 : 0,
        ),
        uncertainties:
          selected === null ? ['no evidence favors any option'] : [],
      },
    };
  },
};
