import type { CommandPayloadBase, CanonicalValue } from './audit';
import { DeterministicRng } from './rng';
import { SimDate } from './simDate';
import {
  DevelopmentResolutionError,
  resolveDevelopmentWindow,
} from './developmentResolution';
import { validateMandateAt } from './authority';
import type { RouteContext, RouteOutcome } from './commandRouter';
import {
  bad,
  denied,
  byId,
  finish,
  hasKind,
  isFailure,
  isPlainObject,
  mintRecordId,
  mintRecordIds,
  nonEmptyText,
  parseActingPerson,
  parseDate,
  parseOrganization,
  spec,
  type Cmd,
  type Failure,
} from './commandSupport';
import { latestProposal, rightBackingAt } from './decisions';
import type {
  OpportunityAllocation,
  OpportunityResourceKey,
  OpportunityWindow,
} from './development';
import { OPPORTUNITY_RESOURCE_KEYS } from './development';
import {
  MissingDevelopmentRulesError,
  requireDevelopmentRules,
} from './developmentRules';
import { entityId, isValidId, recordId } from './ids';
import {
  OPPORTUNITY_ALLOCATION_TERMS_TYPE,
  canonicalOpportunityTerms,
  opportunityProblems,
} from './opportunity';
import { commitAuthorizedDomainChange } from './transactionCommit';

export const DEVELOPMENT_COMMAND_TYPES = [
  'OpenOpportunityWindow',
  'CommitOpportunityAllocationProposal',
  'ResolveDevelopmentCheckpoint',
] as const;
export type DevelopmentCommandType = (typeof DEVELOPMENT_COMMAND_TYPES)[number];

const routeOpen = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  if (!['system', 'commissioner', 'test_harness'].includes(ctx.actor.kind))
    return {
      ok: false,
      stage: 'authorization',
      code: 'UNAUTHORIZED_ACTOR',
      message: ctx.actor.kind + ' cannot open opportunity windows',
    };
  const org = parseOrganization(ctx, c.organizationId);
  if (isFailure(org)) return org;
  const from = parseDate(c.fromDate, 'fromDate'),
    to = parseDate(c.toDate, 'toDate');
  if (isFailure(from)) return from;
  if (isFailure(to)) return to;
  if (from < ctx.world.simDate || to <= from)
    return bad('window must start now or later and end after its start');
  if (!nonEmptyText(c.phaseKey, 64)) return bad('phaseKey is required');
  if (c.pools !== undefined)
    return bad('opportunity pools are owned by the ruleset');
  if (
    ctx.world.development.opportunityWindows.some(
      (w) => w.organizationId === org && w.fromDate < to && from < w.toDate,
    )
  )
    return bad('organization already has an overlapping opportunity window');
  const rules = requireDevelopmentRules(ctx.ruleset);
  if (
    SimDate.parse(to).daysSince(SimDate.parse(from)) !==
    rules.checkpointCadenceDays
  )
    return bad('window duration must equal the ruleset checkpoint cadence');
  const minted = mintRecordId(ctx.world);
  const window: OpportunityWindow = {
    id: minted.id,
    organizationId: org,
    phaseKey: c.phaseKey,
    fromDate: from,
    toDate: to,
    pools: rules.opportunityPools.map((p) => ({ ...p })),
    status: 'open',
  };
  return finish(
    ctx,
    {
      development: {
        ...ctx.world.development,
        opportunityWindows: [
          ...ctx.world.development.opportunityWindows,
          window,
        ].sort(byId),
      },
      nextRecord: minted.next,
    },
    [
      spec('OpportunityWindowOpened', {
        window: { ...window, pools: window.pools.map((p) => ({ ...p })) },
      }),
    ],
    'opened opportunity window ' + window.id,
    'simulation-owned finite window',
  );
};

const parseAllocations = (
  ctx: RouteContext,
  terms: CanonicalValue,
  sourceProposalId: string,
):
  | {
      window: OpportunityWindow;
      allocations: readonly OpportunityAllocation[];
      nextRecord: number;
      executedTerms: { readonly [key: string]: CanonicalValue };
    }
  | Failure => {
  if (
    !isPlainObject(terms) ||
    Object.keys(terms).sort().join(',') !== 'allocations,windowId' ||
    !isValidId(terms.windowId) ||
    !Array.isArray(terms.allocations)
  )
    return bad('opportunity terms must be exactly { windowId, allocations }');
  const window = ctx.world.development.opportunityWindows.find(
    (w) => w.id === terms.windowId,
  );
  if (window === undefined)
    return bad('windowId must name an opportunity window');
  if (
    ctx.world.development.opportunityAllocations.some(
      (a) => a.windowId === window.id,
    )
  )
    return bad('window allocations already committed');
  if (ctx.world.development.checkpoints.some((c) => c.windowId === window.id))
    return bad('window already checkpointed');
  if (ctx.world.simDate < window.fromDate || ctx.world.simDate >= window.toDate)
    return bad(
      'allocation must commit inside the opportunity window before its end',
    );
  if (terms.allocations.length === 0)
    return bad('allocations must contain at least one entry');
  const canonical = canonicalOpportunityTerms(terms);
  const raw = canonical.allocations as readonly CanonicalValue[];
  const minted = mintRecordIds(ctx.world, raw.length);
  const allocations: OpportunityAllocation[] = [];
  for (const [i, a] of raw.entries()) {
    if (
      !isPlainObject(a) ||
      Object.keys(a).sort().join(',') !==
        'basisPlanIds,basisPlanRevisions,playerId,resourceKey,responsibilityKeys,scopeKey,teacherPersonId,units'
    )
      return bad('allocation contains unsupported or missing fields');
    if (
      !isValidId(a.playerId) ||
      !ctx.world.roster.players.some((p) => p.personId === a.playerId)
    )
      return bad('allocation playerId must name an existing player');
    if (
      !(OPPORTUNITY_RESOURCE_KEYS as readonly unknown[]).includes(
        a.resourceKey,
      ) ||
      !nonEmptyText(a.scopeKey, 64) ||
      typeof a.units !== 'number' ||
      !Number.isSafeInteger(a.units) ||
      a.units <= 0
    )
      return bad(
        'allocation resource, scope and positive integer units are required',
      );
    if (
      a.teacherPersonId !== null &&
      (!isValidId(a.teacherPersonId) ||
        !hasKind(ctx.world, a.teacherPersonId, 'person'))
    )
      return bad('teacher must name an existing person or be null');
    if (
      !Array.isArray(a.responsibilityKeys) ||
      !a.responsibilityKeys.every(
        (x) => typeof x === 'string' && isValidId(x),
      ) ||
      !Array.isArray(a.basisPlanIds) ||
      !a.basisPlanIds.every((x) => typeof x === 'string' && isValidId(x))
    )
      return bad(
        'responsibilityKeys and basisPlanIds must contain valid keys/IDs',
      );
    const basisPlanIds = a.basisPlanIds;
    if (
      !Array.isArray(a.basisPlanRevisions) ||
      a.basisPlanRevisions.length !== a.basisPlanIds.length ||
      !a.basisPlanRevisions.every(
        (pin) =>
          isPlainObject(pin) &&
          isValidId(pin.planId) &&
          typeof pin.revision === 'number' &&
          Number.isSafeInteger(pin.revision) &&
          pin.revision > 0 &&
          basisPlanIds.includes(pin.planId),
      )
    )
      return bad('basis plan revisions must pin every referenced plan');
    allocations.push({
      id: minted.ids[i]!,
      windowId: window.id,
      organizationId: window.organizationId,
      playerId: entityId(a.playerId),
      resourceKey: a.resourceKey as OpportunityResourceKey,
      scopeKey: a.scopeKey,
      units: a.units,
      teacherPersonId:
        a.teacherPersonId === null
          ? null
          : entityId(a.teacherPersonId as string),
      responsibilityKeys: a.responsibilityKeys as string[],
      basisPlanIds: (a.basisPlanIds as string[]).map(recordId),
      basisPlanRevisions: a.basisPlanRevisions.map((pin) => {
        const p = pin as { planId: string; revision: number };
        return { planId: recordId(p.planId), revision: p.revision };
      }),
      sourceProposalId: recordId(sourceProposalId),
      committedAt: ctx.world.simDate,
    });
  }
  const maxLoad = requireDevelopmentRules(
    ctx.ruleset,
  ).maxPlayerLoadUnitsPerCheckpoint;
  const playerLoads = new Map<string, number>();
  for (const a of allocations)
    playerLoads.set(a.playerId, (playerLoads.get(a.playerId) ?? 0) + a.units);
  if (
    [...playerLoads.values()].some(
      (n) => !Number.isSafeInteger(n) || n > maxLoad,
    )
  )
    return bad('player workload exceeds maxPlayerLoadUnitsPerCheckpoint');
  const problems = opportunityProblems(ctx.world, window, allocations);
  if (problems.length > 0) return bad(problems.join('; '));
  return {
    window,
    allocations,
    nextRecord: minted.next,
    executedTerms: canonical,
  };
};

const routeCommit = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  requireDevelopmentRules(ctx.ruleset);
  const actor = parseActingPerson(ctx, c);
  if (isFailure(actor)) return actor;
  if (!isValidId(c.proposalId)) return bad('proposalId must be valid');
  const p = latestProposal(ctx.world.decisions, c.proposalId);
  if (p === undefined || p.state !== 'authorized')
    return bad('proposal must exist and be authorized');
  if (
    p.category !== 'workload_usage' ||
    p.termsType !== OPPORTUNITY_ALLOCATION_TERMS_TYPE
  )
    return bad('proposal must be workload_usage opportunity_allocation_v1');
  if (c.expectedRevision !== p.revision)
    return bad('proposal revision is stale');
  if (
    !Array.isArray(c.beliefIds) ||
    !Array.isArray(c.evidenceClaimIds) ||
    !isPlainObject(c.rationale)
  )
    return bad('beliefIds, evidenceClaimIds and rationale are required');
  const parsed = parseAllocations(ctx, p.terms, p.id);
  if (isFailure(parsed)) return parsed;
  if (parsed.window.organizationId !== p.organizationId)
    return bad('proposal belongs to a different organization');
  if (
    !p.subjects.some((s) => s.kind === 'entity' && s.id === p.organizationId) &&
    !p.subjects.some(
      (s) =>
        s.kind === 'plan' &&
        ctx.world.plans.plans.some(
          (plan) =>
            plan.id === s.id &&
            plan.organizationId === p.organizationId &&
            plan.kind === 'development',
        ),
    )
  )
    return bad(
      'proposal subject must include the organization or its development plan',
    );
  // A caller declaration cannot shrink the real workload or hide another scope.
  const amount = parsed.allocations.reduce((n, a) => n + a.units, 0);
  if (!Number.isSafeInteger(amount))
    return bad('total opportunity units exceed safe integer range');
  const scopes = [...new Set(parsed.allocations.map((a) => a.scopeKey))].sort();
  const backing = rightBackingAt(
    ctx.world,
    p.organizationId,
    actor,
    'workload_usage',
    'execute',
    ctx.world.simDate,
  );
  if (backing?.mandateId !== null && backing?.mandateId !== undefined) {
    for (const scopeKey of scopes) {
      const verdict = validateMandateAt(
        ctx.world,
        backing.mandateId,
        ctx.world.simDate,
        {
          unit: 'opportunity_units',
          amount,
          scopeKey,
        },
      );
      if (!verdict.ok) return denied(verdict.reasons.join('; '));
    }
  }
  return commitAuthorizedDomainChange(ctx, {
    nextWorld: {
      ...ctx.world,
      development: {
        ...ctx.world.development,
        opportunityAllocations: [
          ...ctx.world.development.opportunityAllocations,
          ...parsed.allocations,
        ].sort(byId),
      },
      nextIds: { ...ctx.world.nextIds, record: parsed.nextRecord },
    },
    domainEvents: [
      spec('OpportunityAllocated', {
        windowId: parsed.window.id,
        allocationIds: parsed.allocations.map((a) => a.id),
        sourceProposalId: p.id,
      }),
    ],
    requests: [
      {
        organizationId: p.organizationId,
        actorPersonId: actor,
        proposalId: p.id,
        expectedRevision: p.revision,
        expectedCategory: 'workload_usage',
        executedTerms: {
          termsType: OPPORTUNITY_ALLOCATION_TERMS_TYPE,
          terms: parsed.executedTerms,
        },
        beliefIds: c.beliefIds as string[],
        evidenceClaimIds: c.evidenceClaimIds as string[],
        rationale: c.rationale,
        protectedChange: {
          subject: { kind: 'entity', id: p.organizationId },
          change: {
            kind: 'opportunity_allocation',
            windowId: parsed.window.id,
          },
        },
        mandateUsage: {
          unit: 'opportunity_units',
          amount,
          scopeKey: scopes[0]!,
        },
      },
    ],
  });
};

export const routeDevelopmentCommand = (
  ctx: RouteContext,
  command: CommandPayloadBase & { readonly type: DevelopmentCommandType },
): RouteOutcome => {
  try {
    switch (command.type) {
      case 'ResolveDevelopmentCheckpoint': {
        if (
          !['system', 'commissioner', 'test_harness'].includes(ctx.actor.kind)
        )
          return {
            ok: false,
            stage: 'authorization',
            code: 'UNAUTHORIZED_ACTOR',
            message: 'Only simulation actors resolve development',
          };
        const c = command as Cmd;
        if (!isValidId(c.windowId)) return bad('windowId must be valid');
        const resolved = resolveDevelopmentWindow(
          ctx.world,
          ctx.ruleset,
          c.windowId,
          DeterministicRng.fromState(ctx.world.rng),
        );
        return {
          ok: true,
          authorizationDetail: 'simulation-owned development checkpoint',
          resolution: {
            nextWorld: resolved.world,
            eventSpecs: resolved.eventSpecs,
            detail: 'resolved development window ' + c.windowId,
          },
        };
      }
      case 'OpenOpportunityWindow':
        return routeOpen(ctx, command as Cmd);
      case 'CommitOpportunityAllocationProposal':
        return routeCommit(ctx, command as Cmd);
    }
  } catch (e) {
    if (
      e instanceof MissingDevelopmentRulesError ||
      e instanceof DevelopmentResolutionError
    )
      return bad(e.message);
    throw e;
  }
};
