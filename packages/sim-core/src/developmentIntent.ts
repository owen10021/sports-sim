import type { EntityId } from './ids';
import type { OrganizationPlan } from './plans';
import type { FootballWorld } from './world';

/** Existing B plans are intent, never a second strategy store or an execute right. */
export const activeDevelopmentPlans = (
  world: Pick<FootballWorld, 'plans' | 'simDate'>,
  organizationId: EntityId,
): readonly OrganizationPlan[] =>
  world.plans.plans
    .filter(
      (p) =>
        p.organizationId === organizationId &&
        p.status === 'active' &&
        (p.kind === 'development' || p.kind === 'succession') &&
        p.revisions.some(
          (r) =>
            r.revision === p.currentRevision && r.effectiveAt <= world.simDate,
        ),
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
