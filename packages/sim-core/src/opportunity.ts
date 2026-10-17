import type { CanonicalValue } from './audit';
import { canonicalString } from './canonical';
import type {
  OpportunityAllocation,
  OpportunityResourceKey,
  OpportunityWindow,
} from './development';
import { holdsRoleAt } from './people';
import { currentRosterMembership } from './roster';
import type { FootballWorld } from './world';

export const OPPORTUNITY_ALLOCATION_TERMS_TYPE = 'opportunity_allocation_v1';
const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const object = (
  v: CanonicalValue,
): v is { readonly [key: string]: CanonicalValue } =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Order-insensitive allocation terms are canonical before approval and hashing. */
export const canonicalOpportunityTerms = (terms: {
  readonly [key: string]: CanonicalValue;
}): { readonly [key: string]: CanonicalValue } => {
  if (!Array.isArray(terms.allocations)) return terms;
  return {
    ...terms,
    allocations: terms.allocations
      .map((a) => {
        if (!object(a)) return a;
        return {
          ...a,
          ...(Array.isArray(a.responsibilityKeys)
            ? {
                responsibilityKeys: [...a.responsibilityKeys].sort((a, b) =>
                  byText(canonicalString(a), canonicalString(b)),
                ),
              }
            : {}),
          ...(Array.isArray(a.basisPlanIds)
            ? {
                basisPlanIds: [...a.basisPlanIds].sort((a, b) =>
                  byText(canonicalString(a), canonicalString(b)),
                ),
              }
            : {}),
        };
      })
      .sort((a, b) => byText(canonicalString(a), canonicalString(b))),
  };
};

/** A derived balance; no pool capacity is ever inferred from player count. */
export const remainingOpportunity = (
  window: OpportunityWindow,
  allocations: readonly OpportunityAllocation[],
  resourceKey: OpportunityResourceKey,
  scopeKey: string,
): number => {
  const capacity =
    window.pools.find(
      (p) => p.resourceKey === resourceKey && p.scopeKey === scopeKey,
    )?.capacityUnits ?? 0;
  return (
    capacity -
    allocations
      .filter(
        (a) =>
          a.windowId === window.id &&
          a.resourceKey === resourceKey &&
          a.scopeKey === scopeKey,
      )
      .reduce((n, a) => n + a.units, 0)
  );
};

/**
 * Validate the full proposed window snapshot. World context is explicit because roster,
 * teachers and linked plans cannot be validated from two standalone arrays.
 * Reads no latent player capability, responsiveness or medical recovery state.
 */
export const opportunityProblems = (
  world: Pick<FootballWorld, 'roster' | 'people' | 'plans'>,
  window: OpportunityWindow,
  allocations: readonly OpportunityAllocation[],
): readonly string[] => {
  const problems = new Set<string>();
  if (window.status !== 'open') problems.add('WINDOW_ALREADY_RESOLVED');
  const seen = new Set<string>();
  for (const a of allocations) {
    if (!Number.isSafeInteger(a.units) || a.units <= 0)
      problems.add('INVALID_ALLOCATION_UNITS');
    if (a.windowId !== window.id) problems.add('WRONG_OPPORTUNITY_WINDOW');
    if (a.organizationId !== window.organizationId)
      problems.add('WRONG_ORGANIZATION');
    if (a.committedAt < window.fromDate || a.committedAt > window.toDate)
      problems.add('ALLOCATION_OUTSIDE_WINDOW');
    const membership = currentRosterMembership(
      world.roster,
      a.playerId,
      a.committedAt,
    );
    if (membership?.organizationId !== window.organizationId)
      problems.add('ALLOCATION_WITHOUT_ROSTER_ACCESS');
    if (
      !window.pools.some(
        (p) => p.resourceKey === a.resourceKey && p.scopeKey === a.scopeKey,
      )
    )
      problems.add('UNKNOWN_OPPORTUNITY_POOL');
    if (
      a.teacherPersonId !== null &&
      !holdsRoleAt(
        world.people,
        window.organizationId,
        a.teacherPersonId,
        a.committedAt,
      )
    )
      problems.add('MISSING_TEACHER');
    if (
      (a.resourceKey === 'meeting_attention' ||
        a.resourceKey === 'installation_work') &&
      a.teacherPersonId === null
    )
      problems.add('MISSING_TEACHER');
    if (
      new Set(a.responsibilityKeys).size !== a.responsibilityKeys.length ||
      new Set(a.basisPlanIds).size !== a.basisPlanIds.length
    )
      problems.add('DUPLICATE_ALLOCATION_REFERENCE');
    for (const id of a.basisPlanIds) {
      const plan = world.plans.plans.find((p) => p.id === id);
      const revision = plan?.revisions.find(
        (r) => r.revision === plan.currentRevision,
      );
      if (
        plan?.organizationId !== window.organizationId ||
        plan.status !== 'active' ||
        (plan.kind !== 'development' && plan.kind !== 'succession') ||
        revision === undefined ||
        revision.effectiveAt > a.committedAt
      )
        problems.add('INVALID_DEVELOPMENT_PLAN');
    }
    // A duplicate cannot bypass conservation by changing its ID, proposal or units.
    const key = canonicalString({
      playerId: a.playerId,
      resourceKey: a.resourceKey,
      scopeKey: a.scopeKey,
      teacherPersonId: a.teacherPersonId,
      responsibilityKeys: [...a.responsibilityKeys].sort(byText),
    });
    if (seen.has(key)) problems.add('DUPLICATE_ALLOCATION');
    seen.add(key);
  }
  for (const p of window.pools)
    if (
      remainingOpportunity(window, allocations, p.resourceKey, p.scopeKey) < 0
    )
      problems.add('OPPORTUNITY_OVERALLOCATED');
  return [...problems].sort(byText);
};
