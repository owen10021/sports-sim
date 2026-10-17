import type { CanonicalValue, CommandPayloadBase } from './audit';
import type { EventSpec, RouteContext, RouteOutcome } from './commandRouter';
import {
  bad,
  hasKind,
  isFailure,
  isPlainObject,
  mintRecordIds,
  nonEmptyText,
  parseActingPerson,
  parseDate,
  spec,
  type Cmd,
  type Failure,
} from './commandSupport';
import { commitProposal } from './decisionCommands';
import { latestProposal } from './decisions';
import { canonicalString } from './canonical';
import {
  entityId,
  isValidId,
  recordId,
  type EntityId,
  type RecordId,
} from './ids';
import { findVisibleClaim, isBeliefVisibleTo } from './knowledgeView';
import { holdsRoleAt } from './people';
import {
  PLAN_KINDS,
  type OrganizationPlan,
  type PlanConstraint,
  type PlanKind,
  type PlanObjective,
  type PlanPriority,
  type PlanRevision,
  type PlanTrigger,
} from './plans';
import type { FootballWorld } from './world';

export const PLAN_COMMAND_TYPES = ['CommitPlanProposal'] as const;
export type PlanCommandType = (typeof PLAN_COMMAND_TYPES)[number];

export const ORGANIZATION_PLAN_TERMS_TYPE = 'organization_plan_v1';

const PRIORITIES: readonly PlanPriority[] = [
  'low',
  'medium',
  'high',
  'critical',
];
const TRIGGER_KINDS: readonly PlanTrigger['kind'][] = [
  'date',
  'claim',
  'event',
  'manual_review',
];
const MAX_ITEMS = 32;

const byKey = <T extends { readonly key: string }>(a: T, b: T): number =>
  a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
const byPlanId = (a: OrganizationPlan, b: OrganizationPlan): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** A plan revision's terms, as parsed from an `organization_plan_v1` proposal. */
interface PlanTerms {
  readonly planId: RecordId | null;
  readonly kind: PlanKind;
  readonly scopeKey: string;
  readonly ownerPersonId: EntityId;
  readonly effectiveAt: string;
  readonly horizon: CanonicalValue;
  readonly objectives: readonly PlanObjective[];
  readonly constraints: readonly PlanConstraint[];
  readonly triggerRefs: readonly PlanTrigger[];
  readonly fallbackPlanIds: readonly RecordId[];
  readonly changeReasonRefs: readonly RecordId[];
}

const list = (v: unknown, label: string): readonly unknown[] | Failure =>
  Array.isArray(v) && v.length <= MAX_ITEMS
    ? v
    : bad(`${label} must be an array of at most ${MAX_ITEMS} items`);

const parseObjectives = (v: unknown): readonly PlanObjective[] | Failure => {
  const items = list(v, 'objectives');
  if (isFailure(items)) return items;
  const out: PlanObjective[] = [];
  for (const o of items) {
    if (
      !isPlainObject(o) ||
      !nonEmptyText(o.key, 64) ||
      !(PRIORITIES as readonly unknown[]).includes(o.priority) ||
      o.target === undefined
    )
      return bad('each objective needs a key, a priority and a target');
    out.push({
      key: o.key,
      priority: o.priority as PlanPriority,
      target: o.target,
    });
  }
  if (new Set(out.map((o) => o.key)).size !== out.length)
    return bad('objective keys must be unique');
  return out.sort(byKey);
};

const parseConstraints = (v: unknown): readonly PlanConstraint[] | Failure => {
  const items = list(v, 'constraints');
  if (isFailure(items)) return items;
  const out: PlanConstraint[] = [];
  for (const c of items) {
    if (
      !isPlainObject(c) ||
      !nonEmptyText(c.key, 64) ||
      (c.kind !== 'hard' && c.kind !== 'preference') ||
      c.value === undefined
    )
      return bad(
        'each constraint needs a key, a kind (hard|preference) and a value',
      );
    out.push({ key: c.key, kind: c.kind, value: c.value });
  }
  if (new Set(out.map((c) => c.key)).size !== out.length)
    return bad('constraint keys must be unique');
  return out.sort(byKey);
};

const parseTriggers = (v: unknown): readonly PlanTrigger[] | Failure => {
  const items = list(v, 'triggerRefs');
  if (isFailure(items)) return items;
  const out: PlanTrigger[] = [];
  for (const t of items) {
    if (
      !isPlainObject(t) ||
      !(TRIGGER_KINDS as readonly unknown[]).includes(t.kind) ||
      !nonEmptyText(t.refId, 64) ||
      !nonEmptyText(t.note, 200)
    )
      return bad('each trigger needs a kind, a refId and a note');
    out.push({
      kind: t.kind as PlanTrigger['kind'],
      refId: t.refId,
      note: t.note,
    });
  }
  return out;
};

const parseRecordIds = (
  v: unknown,
  label: string,
): readonly RecordId[] | Failure => {
  const items = list(v, label);
  if (isFailure(items)) return items;
  if (new Set(items).size !== items.length)
    return bad(`${label} contains a duplicate`);
  if (!items.every((i) => isValidId(i)))
    return bad(`${label} must hold valid ids`);
  return (items as string[]).map(recordId);
};

const parseTerms = (
  world: FootballWorld,
  organizationId: EntityId,
  terms: unknown,
): PlanTerms | Failure => {
  if (!isPlainObject(terms)) return bad('plan terms must be an object');
  if (terms.planId !== null && !isValidId(terms.planId))
    return bad('planId must be null (a new plan) or a plan id');
  if (!(PLAN_KINDS as readonly unknown[]).includes(terms.kind))
    return bad('plan kind is not recognised');
  if (!nonEmptyText(terms.scopeKey, 64))
    return bad('scopeKey must be 1-64 characters');
  if (
    !isValidId(terms.ownerPersonId) ||
    !hasKind(world, terms.ownerPersonId, 'person') ||
    !holdsRoleAt(
      world.people,
      organizationId,
      entityId(terms.ownerPersonId),
      world.simDate,
    )
  )
    return bad(
      'the plan owner must be a person with a role in the organization',
    );
  const effectiveAt = parseDate(terms.effectiveAt, 'effectiveAt');
  if (isFailure(effectiveAt)) return effectiveAt;
  if (effectiveAt < world.simDate)
    return bad('effectiveAt cannot be in the past');
  if (terms.horizon === undefined) return bad('horizon is required');
  const objectives = parseObjectives(terms.objectives);
  if (isFailure(objectives)) return objectives;
  const constraints = parseConstraints(terms.constraints);
  if (isFailure(constraints)) return constraints;
  const triggers = parseTriggers(terms.triggerRefs);
  if (isFailure(triggers)) return triggers;
  const fallbacks = parseRecordIds(terms.fallbackPlanIds, 'fallbackPlanIds');
  if (isFailure(fallbacks)) return fallbacks;
  const reasons = parseRecordIds(terms.changeReasonRefs, 'changeReasonRefs');
  if (isFailure(reasons)) return reasons;
  return {
    planId: terms.planId === null ? null : recordId(String(terms.planId)),
    kind: terms.kind as PlanKind,
    scopeKey: terms.scopeKey,
    ownerPersonId: entityId(terms.ownerPersonId),
    effectiveAt,
    horizon: terms.horizon,
    objectives,
    constraints,
    triggerRefs: triggers,
    fallbackPlanIds: fallbacks,
    changeReasonRefs: reasons,
  };
};

/** A revision reverses the plan when it changes or drops an objective or a hard constraint. */
const reversesPrior = (prior: PlanRevision, terms: PlanTerms): boolean => {
  const sameObjective = (o: PlanObjective) =>
    terms.objectives.some((n) => canonicalString(n) === canonicalString(o));
  const sameHard = (c: PlanConstraint) =>
    terms.constraints.some((n) => canonicalString(n) === canonicalString(c));
  return (
    !prior.objectives.every(sameObjective) ||
    !prior.constraints.filter((c) => c.kind === 'hard').every(sameHard)
  );
};

export const routePlanCommand = (
  ctx: RouteContext,
  command: CommandPayloadBase & { readonly type: PlanCommandType },
): RouteOutcome => {
  const { world } = ctx;
  const c = command as Cmd;
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  if (!isValidId(c.proposalId)) return bad('proposalId must be a valid id');
  const proposal = latestProposal(world.decisions, c.proposalId);
  if (proposal === undefined) return bad('proposalId does not name a proposal');
  if (typeof c.expectedRevision !== 'number')
    return bad('expectedRevision must be the proposal revision');
  if (proposal.termsType !== ORGANIZATION_PLAN_TERMS_TYPE)
    return bad(
      `only ${ORGANIZATION_PLAN_TERMS_TYPE} proposals commit as plans`,
    );
  if (!Array.isArray(c.beliefIds) || !Array.isArray(c.evidenceClaimIds))
    return bad('beliefIds and evidenceClaimIds must be arrays');
  if (!isPlainObject(c.rationale)) return bad('rationale must be an object');
  if (!c.beliefIds.every((b) => isValidId(b)))
    return bad('beliefIds must hold valid ids');

  const organizationId = proposal.organizationId;
  const terms = parseTerms(world, organizationId, proposal.terms);
  if (isFailure(terms)) return terms;

  const plans = world.plans.plans;
  const existing =
    terms.planId === null
      ? undefined
      : plans.find(
          (p) => p.id === terms.planId && p.organizationId === organizationId,
        );
  if (terms.planId !== null && existing === undefined)
    return bad('planId does not name a plan of this organization');
  if (existing !== undefined) {
    if (existing.status !== 'active')
      return bad(`plan is ${existing.status}, not active`);
    if (existing.kind !== terms.kind || existing.scopeKey !== terms.scopeKey)
      return bad('a revision cannot change the plan kind or scope');
  }
  const occupant =
    existing === undefined
      ? plans.find(
          (p) =>
            p.organizationId === organizationId &&
            p.status === 'active' &&
            p.kind === terms.kind &&
            p.scopeKey === terms.scopeKey,
        )
      : undefined;

  // Plan inertia: reversing or replacing an active plan needs a cause on record.
  const priorRevision = existing?.revisions.find(
    (r) => r.revision === existing.currentRevision,
  );
  const reversal =
    occupant !== undefined ||
    (priorRevision !== undefined && reversesPrior(priorRevision, terms));
  if (reversal && terms.changeReasonRefs.length === 0)
    return bad(
      'reversing an active plan requires at least one changeReasonRef',
    );
  for (const ref of terms.changeReasonRefs) {
    const visibleClaim =
      findVisibleClaim(world, organizationId, by, ref) !== undefined;
    const visibleBelief = world.information.beliefs.some(
      (b) => b.id === ref && isBeliefVisibleTo(world, organizationId, by, b),
    );
    if (!visibleClaim && !visibleBelief)
      return bad('changeReasonRefs contains a reference that is not available');
  }

  const selfId = existing?.id ?? null;
  for (const fb of terms.fallbackPlanIds) {
    const target = plans.find((p) => p.id === fb);
    if (
      target === undefined ||
      target.organizationId !== organizationId ||
      target.status !== 'active' ||
      fb === selfId ||
      fb === occupant?.id
    )
      return bad(
        'fallbackPlanIds must name other active plans of this organization',
      );
  }

  const minted = existing === undefined ? mintRecordIds(world, 1) : null;
  const planId = existing?.id ?? minted!.ids[0]!;
  const revision: PlanRevision = {
    revision: (existing?.currentRevision ?? 0) + 1,
    ownerPersonId: terms.ownerPersonId,
    effectiveAt: terms.effectiveAt,
    horizon: terms.horizon,
    objectives: terms.objectives,
    constraints: terms.constraints,
    triggerRefs: terms.triggerRefs,
    fallbackPlanIds: terms.fallbackPlanIds,
    basisBeliefIds: (c.beliefIds as string[]).map(recordId),
    changeReasonRefs: terms.changeReasonRefs,
  };
  const nextPlan: OrganizationPlan =
    existing === undefined
      ? {
          id: planId,
          organizationId,
          kind: terms.kind,
          scopeKey: terms.scopeKey,
          status: 'active',
          currentRevision: 1,
          revisions: [revision],
        }
      : {
          ...existing,
          currentRevision: revision.revision,
          revisions: [...existing.revisions, revision],
        };
  const events: EventSpec[] = [
    spec(existing === undefined ? 'PlanCreated' : 'PlanRevised', {
      planId,
      organizationId,
      kind: terms.kind,
      scopeKey: terms.scopeKey,
      proposalId: proposal.id,
      proposalRevision: proposal.revision,
      revision: { ...revision },
    }),
  ];
  const nextPlans = plans
    .filter((p) => p.id !== planId)
    .map((p) => {
      if (p.id !== occupant?.id) return p;
      events.push(
        spec('PlanSuperseded', {
          planId: p.id,
          supersededByPlanId: planId,
          proposalId: proposal.id,
        }),
      );
      return { ...p, status: 'superseded' as const };
    });
  nextPlans.push(nextPlan);

  return commitProposal(ctx, {
    nextWorld: {
      ...world,
      plans: { plans: nextPlans.sort(byPlanId) },
      nextIds: {
        ...world.nextIds,
        record: minted?.next ?? world.nextIds.record,
      },
    },
    proposalId: proposal.id,
    expectedRevision: c.expectedRevision,
    actorPersonId: by,
    beliefIds: c.beliefIds as string[],
    evidenceClaimIds: c.evidenceClaimIds as string[],
    rationale: c.rationale,
    domainEvents: events,
  });
};
