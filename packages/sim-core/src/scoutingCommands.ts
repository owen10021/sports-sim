import type { CanonicalValue, CommandPayloadBase } from './audit';
import { effectiveRightsAt } from './authority';
import type { RouteContext, RouteOutcome } from './commandRouter';
import {
  bad,
  denied,
  isFailure,
  isPlainObject,
  mintRecordIds,
  nonEmptyText,
  parseActingPerson,
  parseOrganization,
  spec,
  type Cmd,
  type Failure,
} from './commandSupport';
import { isClaimVisibleTo } from './knowledgeView';
import { isUndraftedProspect } from './draft';
import { activeRightsFor, holdsContractRight } from './roster';
import { entityId, isValidId, type EntityId, type RecordId } from './ids';
import type { BeliefRecord, ClaimRecord } from './information';
import { holdsRoleAt } from './people';
import {
  NEUTRAL_LENS,
  SCOUTING_ASSESSMENT,
  SCOUTING_CONTEXT_KINDS,
  interpretEvidence,
  type ScoutingAssignment,
  type ScoutingContextKind,
  type ScoutingDecisionContext,
  type ScoutingQuestion,
  type ScoutingReport,
} from './scouting';
import { SimDate } from './simDate';
import type { FootballWorld } from './world';

export const SCOUTING_COMMAND_TYPES = [
  'AskScoutingQuestion',
  'AssignScoutingEvaluation',
  'ResolveScoutingAssignment',
] as const;
export type ScoutingCommandType = (typeof SCOUTING_COMMAND_TYPES)[number];

const byId = <T extends { readonly id: string }>(a: T, b: T): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

const MAX_DIMENSIONS = 8;

// --- shared reads ----------------------------------------------------------------

/** Scouting is acquisition-side advisory work: it needs `advise` on acquisition. */
const mayScout = (
  world: FootballWorld,
  org: EntityId,
  person: EntityId,
): Failure | null =>
  !holdsRoleAt(world.people, org, person, world.simDate)
    ? denied(`${person} holds no role in ${org}`)
    : effectiveRightsAt(
          world,
          org,
          person,
          'acquisition',
          world.simDate,
        ).rights.includes('advise')
      ? null
      : denied(`${person} lacks advise on acquisition in ${org}`);

const isScoutingBelief = (b: BeliefRecord, key: string): boolean =>
  b.assessmentType === SCOUTING_ASSESSMENT &&
  isPlainObject(b.assessment) &&
  (b.assessment as Record<string, unknown>).questionKey === key;

/** The organization's current (unsuperseded) scouting belief on one player and question. */
export const latestScoutingBelief = (
  world: FootballWorld,
  org: EntityId,
  playerId: string,
  questionKey: string,
): BeliefRecord | undefined => {
  const mine = world.information.beliefs.filter(
    (b) =>
      b.organizationId === org &&
      b.subject.kind === 'entity' &&
      b.subject.id === playerId &&
      isScoutingBelief(b, questionKey),
  );
  const superseded = new Set(mine.map((b) => b.supersedesBeliefId));
  return mine
    .filter((b) => !superseded.has(b.id))
    .sort(byId)
    .at(-1);
};

const claimsAbout = (
  world: FootballWorld,
  org: EntityId,
  viewer: EntityId,
  playerId: string,
): readonly ClaimRecord[] =>
  world.information.claims.filter(
    (c) =>
      c.subject.kind === 'entity' &&
      c.subject.id === playerId &&
      isClaimVisibleTo(world, org, viewer, c),
  );

const speaksTo = (c: ClaimRecord, dimensions: readonly string[]): boolean =>
  isPlainObject(c.proposition) &&
  dimensions.includes(
    String((c.proposition as Record<string, unknown>).dimension),
  ) &&
  ['positive', 'negative', 'mixed'].includes(
    String((c.proposition as Record<string, unknown>).signal),
  );

const SETTLED_READINGS: readonly string[] = ['supports', 'against'];
const settled = (b: BeliefRecord): boolean =>
  (b.confidence === 'medium' ||
    b.confidence === 'high' ||
    b.confidence === 'very_high') &&
  isPlainObject(b.assessment) &&
  SETTLED_READINGS.includes(
    String((b.assessment as Record<string, unknown>).reading),
  );

const evidenceKey = (ids: readonly string[]): string =>
  [...ids].sort().join('|');

// --- decision context ------------------------------------------------------------

const parseContext = (
  world: FootballWorld,
  org: EntityId,
  playerId: EntityId,
  v: unknown,
): ScoutingDecisionContext | Failure => {
  if (!isPlainObject(v)) return bad('decisionContext must be an object');
  if (!(SCOUTING_CONTEXT_KINDS as readonly unknown[]).includes(v.kind))
    return bad(
      `decisionContext.kind must be one of ${SCOUTING_CONTEXT_KINDS.join(', ')}`,
    );
  const kind = v.kind as ScoutingContextKind;
  const today = world.simDate;
  const rights = activeRightsFor(world.roster, playerId, today);
  switch (kind) {
    case 'draft_selection': {
      if (!isValidId(v.pickId))
        return bad('a draft_selection names the pick it serves');
      const pick = world.draft.picks.find((p) => p.id === v.pickId);
      if (pick === undefined) return bad('pickId does not name a draft pick');
      if (pick.ownerOrganizationId !== org || pick.status !== 'available')
        return bad('the pick is not an unused pick this organization owns');
      const inClass = world.draft.classes.some(
        (c) =>
          c.season === pick.season && c.eligiblePlayerIds.includes(playerId),
      );
      if (!inClass)
        return bad(`${playerId} is not eligible in the ${pick.season} draft`);
      return { kind, pickId: pick.id };
    }
    case 'free_agent_signing':
      if (rights.length > 0)
        return bad(
          `${playerId} is not a free agent: he is under someone's rights`,
        );
      if (isUndraftedProspect(world.draft, playerId))
        return bad(`${playerId} is a draft prospect, not a free agent`);
      return { kind, pickId: null };
    case 'trade_target':
      if (rights.length === 0 || rights[0]!.holderOrganizationId === org)
        return bad(`${playerId} is not held by another organization`);
      return { kind, pickId: null };
    case 'roster_decision':
      if (!holdsContractRight(world.roster, playerId, org, today))
        return bad(`${playerId} is not under ${org}'s contract`);
      return { kind, pickId: null };
  }
};

const questionOf = (world: FootballWorld, id: unknown) =>
  world.scouting.questions.find((q) => q.id === id);

// --- AskScoutingQuestion -----------------------------------------------------------

const routeAsk = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const org = parseOrganization(ctx, c.organizationId);
  if (isFailure(org)) return org;
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  const noRight = mayScout(world, org, by);
  if (noRight !== null) return noRight;
  if (
    !isValidId(c.playerId) ||
    !world.roster.players.some((p) => p.personId === c.playerId)
  )
    return bad('playerId must name an existing player');
  const playerId = entityId(c.playerId);
  if (!nonEmptyText(c.questionKey, 64))
    return bad('questionKey must be 1-64 characters');
  if (
    !Array.isArray(c.dimensions) ||
    c.dimensions.length === 0 ||
    c.dimensions.length > MAX_DIMENSIONS ||
    c.dimensions.some((d) => !nonEmptyText(d, 48)) ||
    new Set(c.dimensions).size !== c.dimensions.length
  )
    return bad(`dimensions must list 1-${MAX_DIMENSIONS} distinct names`);
  const dimensions = [...(c.dimensions as string[])].sort();
  const context = parseContext(world, org, playerId, c.decisionContext);
  if (isFailure(context)) return context;

  const open = world.scouting.questions.find(
    (q) =>
      q.organizationId === org &&
      q.playerId === playerId &&
      q.questionKey === c.questionKey &&
      q.status === 'open',
  );
  if (open !== undefined)
    return bad(`question ${open.id} is already open for this player`);

  // Value of information: a question must still have something to learn.
  const latest = latestScoutingBelief(world, org, playerId, c.questionKey);
  if (latest !== undefined && settled(latest)) {
    const known = new Set<string>(latest.evidenceClaimIds);
    const fresh = claimsAbout(world, org, by, playerId).filter(
      (x) => speaksTo(x, dimensions) && !known.has(x.id),
    );
    if (fresh.length === 0)
      return bad(
        'this question is already answered with confidence and no new evidence has arrived; asking again would learn nothing',
      );
  }

  const minted = mintRecordIds(world, 1);
  const question: ScoutingQuestion = {
    id: minted.ids[0]!,
    organizationId: org,
    playerId,
    questionKey: c.questionKey,
    dimensions,
    decisionContext: context,
    createdByPersonId: by,
    createdAt: world.simDate,
    status: 'open',
  };
  return {
    ok: true,
    authorizationDetail: `${by} holds advise on acquisition in ${org}`,
    resolution: {
      nextWorld: {
        ...world,
        scouting: {
          ...world.scouting,
          questions: [...world.scouting.questions, question].sort(byId),
        },
        nextIds: { ...world.nextIds, record: minted.next },
      },
      eventSpecs: [
        spec('ScoutingQuestionAsked', {
          questionId: question.id,
          organizationId: org,
          playerId,
          questionKey: question.questionKey,
          dimensions,
          decisionContext: {
            kind: context.kind,
            pickId: context.pickId,
          } as CanonicalValue,
          askedBy: by,
        }),
      ],
      detail: `${org} asks ${question.questionKey} about ${playerId}`,
    },
  };
};

// --- AssignScoutingEvaluation --------------------------------------------------------

const routeAssign = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  const question = questionOf(world, c.questionId);
  if (question === undefined) return bad('questionId does not name a question');
  const org = question.organizationId;
  const noRight = mayScout(world, org, by);
  if (noRight !== null) return noRight;
  if (!isValidId(c.evaluatorPersonId))
    return bad('evaluatorPersonId must be a valid id');
  const evaluator = entityId(c.evaluatorPersonId);
  if (!holdsRoleAt(world.people, org, evaluator, world.simDate))
    return bad(`${evaluator} holds no role in ${org}`);
  if (
    !Array.isArray(c.evidenceClaimIds) ||
    c.evidenceClaimIds.length === 0 ||
    c.evidenceClaimIds.some((i) => !isValidId(i))
  )
    return bad('evidenceClaimIds must list at least one claim id');
  const ids = [...new Set(c.evidenceClaimIds as string[])].sort();
  const claims: ClaimRecord[] = [];
  for (const id of ids) {
    // A claim the evaluator may not see looks exactly like one that does not exist.
    const claim = world.information.claims.find(
      (x) => x.id === id && isClaimVisibleTo(world, org, evaluator, x),
    );
    if (claim === undefined)
      return bad(`evidenceClaimIds: ${id} is not available to ${evaluator}`);
    if (
      claim.subject.kind !== 'entity' ||
      claim.subject.id !== question.playerId
    )
      return bad(`evidenceClaimIds: ${id} is not about ${question.playerId}`);
    claims.push(claim);
  }
  if (!claims.some((x) => speaksTo(x, question.dimensions)))
    return bad(
      `the evidence says nothing about ${question.dimensions.join(', ')}`,
    );

  const key = evidenceKey(ids);
  const repeat = world.scouting.assignments.find(
    (a) =>
      a.questionId === question.id &&
      a.evaluatorPersonId === evaluator &&
      evidenceKey(a.evidenceClaimIds) === key,
  );
  if (repeat !== undefined)
    return bad(
      `${evaluator} already has this exact work (${repeat.id}): reading the same evidence again cannot change the answer`,
    );
  const latest = latestScoutingBelief(
    world,
    org,
    question.playerId,
    question.questionKey,
  );
  if (latest !== undefined && settled(latest)) {
    const known = new Set<string>(latest.evidenceClaimIds);
    if (ids.every((i) => known.has(i)))
      return bad(
        'the current answer already rests on all of this evidence; nothing new would be learned',
      );
  }

  let workDays = 1;
  if (c.workDays !== undefined) {
    if (
      !Number.isInteger(c.workDays) ||
      (c.workDays as number) < 1 ||
      (c.workDays as number) > 14
    )
      return bad('workDays must be an integer 1..14');
    workDays = c.workDays as number;
  }
  const minted = mintRecordIds(world, 1);
  const assignment: ScoutingAssignment = {
    id: minted.ids[0]!,
    questionId: question.id,
    organizationId: org,
    playerId: question.playerId,
    evaluatorPersonId: evaluator,
    evidenceClaimIds: ids as RecordId[],
    requestedAt: world.simDate,
    dueAt: SimDate.parse(world.simDate).addDays(workDays).toISO(),
    status: 'assigned',
    resolvedReportId: null,
  };
  return {
    ok: true,
    authorizationDetail: `${by} holds advise on acquisition in ${org}`,
    resolution: {
      nextWorld: {
        ...world,
        scouting: {
          ...world.scouting,
          assignments: [...world.scouting.assignments, assignment].sort(byId),
        },
        nextIds: { ...world.nextIds, record: minted.next },
      },
      eventSpecs: [
        spec('ScoutingEvaluationAssigned', {
          assignmentId: assignment.id,
          questionId: question.id,
          organizationId: org,
          evaluatorPersonId: evaluator,
          evidenceClaimIds: ids,
          dueAt: assignment.dueAt,
        }),
      ],
      detail: `${evaluator} is asked to read ${ids.length} claim(s)`,
    },
  };
};

// --- ResolveScoutingAssignment --------------------------------------------------------

const routeResolve = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  const assignment = world.scouting.assignments.find(
    (a) => a.id === c.assignmentId,
  );
  if (assignment === undefined)
    return bad('assignmentId does not name an assignment');
  const org = assignment.organizationId;
  const noRight = mayScout(world, org, by);
  if (noRight !== null) return noRight;
  if (assignment.status !== 'assigned')
    return bad(`assignment is already ${assignment.status}`);
  const today = world.simDate;
  if (today < assignment.dueAt)
    return bad(`the work is not due until ${assignment.dueAt}`);
  const question = questionOf(world, assignment.questionId)!;

  // Authority and visibility are re-derived now; only visible claims may be read.
  const claims: ClaimRecord[] = [];
  for (const id of assignment.evidenceClaimIds) {
    const claim = world.information.claims.find(
      (x) =>
        x.id === id &&
        isClaimVisibleTo(world, org, assignment.evaluatorPersonId, x),
    );
    if (claim === undefined)
      return bad(`evidence ${id} is no longer available to the evaluator`);
    claims.push(claim);
  }
  const profile = world.scouting.evaluatorProfiles.find(
    (p) => p.personId === assignment.evaluatorPersonId,
  );
  const lens = profile ?? NEUTRAL_LENS;
  const result = interpretEvidence(question.dimensions, claims, lens);

  const minted = mintRecordIds(world, 2);
  const beliefId = minted.ids[0]!;
  const reportId = minted.ids[1]!;
  const prior = latestScoutingBelief(
    world,
    org,
    question.playerId,
    question.questionKey,
  );
  const belief: BeliefRecord = {
    id: beliefId,
    organizationId: org,
    authorPersonId: assignment.evaluatorPersonId,
    subject: { kind: 'entity', id: question.playerId },
    assessmentType: SCOUTING_ASSESSMENT,
    assessment: {
      questionId: question.id,
      questionKey: question.questionKey,
      reading: result.reading,
      dimensions: result.dimensions.map((d) => ({
        dimension: d.dimension,
        status: d.status,
        independentFamilies: d.independentFamilies,
        confidence: d.confidence,
      })),
      unresolvedQuestionKeys: [...result.unresolvedQuestionKeys],
      independentFamilyCount: result.independentFamilyCount,
      strongDimensions: [...lens.strongDimensions],
      weakDimensions: [...lens.weakDimensions],
      riskTolerance: lens.riskTolerance,
    } as CanonicalValue,
    confidence: result.confidence,
    evidenceClaimIds: [...assignment.evidenceClaimIds],
    formedAt: today,
    supersedesBeliefId: prior?.id ?? null,
  };
  const report: ScoutingReport = {
    id: reportId,
    assignmentId: assignment.id,
    organizationId: org,
    playerId: question.playerId,
    evaluatorPersonId: assignment.evaluatorPersonId,
    questionId: question.id,
    evidenceClaimIds: assignment.evidenceClaimIds,
    beliefId,
    unresolvedQuestionKeys: result.unresolvedQuestionKeys,
    formedAt: today,
  };
  return {
    ok: true,
    authorizationDetail: `${by} holds advise on acquisition in ${org}`,
    resolution: {
      nextWorld: {
        ...world,
        information: {
          ...world.information,
          beliefs: [...world.information.beliefs, belief].sort(byId),
        },
        scouting: {
          ...world.scouting,
          assignments: world.scouting.assignments.map((a) =>
            a.id === assignment.id
              ? {
                  ...a,
                  status: 'resolved' as const,
                  resolvedReportId: reportId,
                }
              : a,
          ),
          questions: world.scouting.questions.map((q) =>
            q.id === question.id ? { ...q, status: 'answered' as const } : q,
          ),
          reports: [...world.scouting.reports, report].sort(byId),
        },
        nextIds: { ...world.nextIds, record: minted.next },
      },
      eventSpecs: [
        spec('ScoutingReportFiled', {
          reportId,
          assignmentId: assignment.id,
          questionId: question.id,
          organizationId: org,
          playerId: question.playerId,
          evaluatorPersonId: assignment.evaluatorPersonId,
          beliefId,
          reading: result.reading,
          confidence: result.confidence,
          unresolvedQuestionKeys: [...result.unresolvedQuestionKeys],
        }),
      ],
      detail: `${assignment.evaluatorPersonId} files a ${result.reading} read`,
    },
  };
};

export const routeScoutingCommand = (
  ctx: RouteContext,
  command: CommandPayloadBase & { readonly type: ScoutingCommandType },
): RouteOutcome => {
  const c = command as Cmd;
  switch (command.type) {
    case 'AskScoutingQuestion':
      return routeAsk(ctx, c);
    case 'AssignScoutingEvaluation':
      return routeAssign(ctx, c);
    case 'ResolveScoutingAssignment':
      return routeResolve(ctx, c);
    default: {
      const unreachable: never = command.type;
      throw new Error(`unroutable scouting command: ${String(unreachable)}`);
    }
  }
};

// --- read projection ---------------------------------------------------------------

export type ScoutingView = {
  readonly organizationId: EntityId;
  readonly actorPersonId: EntityId;
  readonly asOf: string;
  readonly questions: readonly ScoutingQuestion[];
  readonly assignments: readonly ScoutingAssignment[];
  readonly reports: readonly ScoutingReport[];
};

/**
 * What one person may see of their own organization's scouting work. Scouting work is
 * organization-private; evidence links are limited to the claims the viewer may see. A
 * person with no role in the organization sees nothing.
 */
export const buildScoutingView = (
  world: FootballWorld,
  organizationId: EntityId,
  actorPersonId: EntityId,
): ScoutingView => {
  const member = holdsRoleAt(
    world.people,
    organizationId,
    actorPersonId,
    world.simDate,
  );
  const visible = new Set<string>(
    member
      ? world.information.claims
          .filter((c) =>
            isClaimVisibleTo(world, organizationId, actorPersonId, c),
          )
          .map((c) => c.id)
      : [],
  );
  const mine = <T extends { readonly organizationId: EntityId }>(
    xs: readonly T[],
  ): readonly T[] =>
    member ? xs.filter((x) => x.organizationId === organizationId) : [];
  const links = <T extends { readonly evidenceClaimIds: readonly RecordId[] }>(
    x: T,
  ): T => ({
    ...x,
    evidenceClaimIds: x.evidenceClaimIds.filter((id) => visible.has(id)),
  });
  return {
    organizationId,
    actorPersonId,
    asOf: world.simDate,
    questions: mine(world.scouting.questions),
    assignments: mine(world.scouting.assignments).map(links),
    reports: mine(world.scouting.reports).map(links),
  };
};
