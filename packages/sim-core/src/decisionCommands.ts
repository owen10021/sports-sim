import {
  GAME_DAY_ACTIVATION_TERMS_TYPE,
  canonicalGameDayTerms,
} from './gameDay';
import {
  canonicalOpportunityTerms,
  OPPORTUNITY_ALLOCATION_TERMS_TYPE,
} from './opportunity';
import type { CanonicalValue, CommandPayloadBase } from './audit';
import { DECISION_CATEGORIES, type DecisionCategory } from './authority';
import type { EventSpec, RouteContext, RouteOutcome } from './commandRouter';
import {
  bad,
  denied,
  dayBefore,
  finish,
  hasKind,
  isFailure,
  isPlainObject,
  mintRecordIds,
  nonEmptyText,
  parseActingPerson,
  parseDate,
  parseOrganization,
  spec,
  type Cmd,
  type Failure,
} from './commandSupport';
import {
  evaluateProposalAuthority,
  isProposalLiveAt,
  isTerminalProposalState,
  latestProposal,
  proposalTermsHash,
  rightBackingAt,
  type ApprovalRecord,
  type DecisionReceipt,
  type DecisionsState,
  type ProposalRecord,
  type ProposalState,
} from './decisions';
import { canonicalString } from './canonical';
import {
  entityId,
  eventId,
  isValidId,
  recordId,
  type EntityId,
  type RecordId,
} from './ids';
import type { SubjectRef } from './information';
import { parseSubject } from './informationCommands';
import { findVisibleClaim, isBeliefVisibleTo } from './knowledgeView';
import { holdsRoleAt } from './people';
import type { FootballWorld } from './world';

export const DECISION_COMMAND_TYPES = [
  'SubmitProposal',
  'ReviseProposal',
  'ApproveProposal',
  'VetoProposal',
  'WithdrawProposal',
  'ExpireProposal',
] as const;
export type DecisionCommandType = (typeof DECISION_COMMAND_TYPES)[number];

/**
 * Package B exercised the first three categories. Package C opens the four acquisition
 * categories. Package D additively opens workload, medical clearance and scheme;
 * Package E additively opens game-day activation; staff hiring remains reserved.
 */
export const PACKAGE_C_PROPOSAL_CATEGORIES: readonly DecisionCategory[] = [
  'acquisition',
  'contract',
  'roster',
  'major_trade',
];
export const PACKAGE_D_PROPOSAL_CATEGORIES: readonly DecisionCategory[] = [
  'workload_usage',
  'medical_clearance',
  'scheme',
];
export const PACKAGE_E_PROPOSAL_CATEGORIES: readonly DecisionCategory[] = [
  'game_day_activation',
];
const PROPOSAL_CATEGORIES: readonly DecisionCategory[] = [
  ...DECISION_CATEGORIES.slice(0, 3),
  ...PACKAGE_C_PROPOSAL_CATEGORIES,
  ...PACKAGE_D_PROPOSAL_CATEGORIES,
  ...PACKAGE_E_PROPOSAL_CATEGORIES,
];

const MAX_SUBJECTS = 8;

const compareProposals = (a: ProposalRecord, b: ProposalRecord): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : a.revision - b.revision;
const compareById = <T extends { readonly id: string }>(a: T, b: T): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

const pad = (n: number): string => String(n).padStart(6, '0');

// --- parsing ---------------------------------------------------------------

interface ProposalFields {
  readonly subjects: readonly SubjectRef[];
  readonly termsType: string;
  readonly terms: { [key: string]: CanonicalValue };
  readonly requiredApproverPersonIds: readonly EntityId[];
  readonly expiresAt: string | null;
  readonly contingencies: { [key: string]: CanonicalValue };
}

const parseSubjects = (
  world: FootballWorld,
  v: unknown,
): readonly SubjectRef[] | Failure => {
  if (!Array.isArray(v) || v.length === 0 || v.length > MAX_SUBJECTS)
    return bad(`subjects must list 1-${MAX_SUBJECTS} subjects`);
  const out: SubjectRef[] = [];
  for (const item of v) {
    const s = parseSubject(world, item);
    if (isFailure(s)) return s;
    out.push(s);
  }
  return out;
};

const parseRequiredApprovers = (
  world: FootballWorld,
  organizationId: EntityId,
  v: unknown,
): readonly EntityId[] | Failure => {
  if (!Array.isArray(v))
    return bad('requiredApproverPersonIds must be an array');
  if (new Set(v).size !== v.length)
    return bad('requiredApproverPersonIds contains a duplicate');
  for (const p of v)
    if (
      !isValidId(p) ||
      !hasKind(world, p, 'person') ||
      !holdsRoleAt(world.people, organizationId, entityId(p), world.simDate)
    )
      return bad('each required approver must be a person with a role here');
  return v.map(entityId).sort();
};

const parseDeadline = (
  world: FootballWorld,
  v: unknown,
): string | null | Failure => {
  if (v === null) return null;
  const d = parseDate(v, 'expiresAt');
  if (isFailure(d)) return d;
  return d > world.simDate ? d : bad('expiresAt must be after today');
};

const parseObject = (
  v: unknown,
  label: string,
): { [key: string]: CanonicalValue } | Failure =>
  isPlainObject(v) ? v : bad(`${label} must be an object`);

/** Fields given in the command, falling back to `base` (a revision supplies its predecessor). */
const parseFields = (
  world: FootballWorld,
  organizationId: EntityId,
  c: Cmd,
  base: ProposalRecord | null,
): ProposalFields | Failure => {
  const pick = <T>(
    key: string,
    parse: (v: unknown) => T | Failure,
    fallback?: T,
  ) => (c[key] !== undefined ? parse(c[key]) : (fallback as T | Failure));
  const subjects = pick(
    'subjects',
    (v) => parseSubjects(world, v),
    base?.subjects,
  );
  if (subjects === undefined) return bad('subjects is required');
  if (isFailure(subjects)) return subjects;
  const termsType = pick<string>(
    'termsType',
    (v) => (nonEmptyText(v, 64) ? v : bad('termsType must be 1-64 characters')),
    base?.termsType,
  );
  if (termsType === undefined) return bad('termsType is required');
  if (isFailure(termsType)) return termsType;
  const terms = pick(
    'terms',
    (v) => parseObject(v, 'terms'),
    base?.terms as { [key: string]: CanonicalValue } | undefined,
  );
  if (terms === undefined) return bad('terms is required');
  if (isFailure(terms)) return terms;
  const required = pick(
    'requiredApproverPersonIds',
    (v) => parseRequiredApprovers(world, organizationId, v),
    base?.requiredApproverPersonIds,
  );
  if (required === undefined)
    return bad('requiredApproverPersonIds is required');
  if (isFailure(required)) return required;
  let expiresAt: string | null;
  if (c.expiresAt !== undefined) {
    const d = parseDeadline(world, c.expiresAt);
    if (isFailure(d)) return d;
    expiresAt = d;
  } else if (base !== null) expiresAt = base.expiresAt;
  else return bad('expiresAt is required (use null for none)');
  const contingencies = pick(
    'contingencies',
    (v) => parseObject(v, 'contingencies'),
    base?.contingencies as { [key: string]: CanonicalValue } | undefined,
  );
  if (contingencies === undefined) return bad('contingencies is required');
  if (isFailure(contingencies)) return contingencies;
  return {
    subjects,
    termsType,
    terms:
      termsType === OPPORTUNITY_ALLOCATION_TERMS_TYPE
        ? canonicalOpportunityTerms(terms, world)
        : termsType === GAME_DAY_ACTIVATION_TERMS_TYPE
          ? canonicalGameDayTerms(terms)
          : terms,
    requiredApproverPersonIds: required,
    expiresAt,
    contingencies,
  };
};

// --- shared state helpers ---------------------------------------------------

const withDecisions = (
  world: FootballWorld,
  decisions: DecisionsState,
): FootballWorld => ({ ...world, decisions });

/** What state a non-terminal proposal reaches given current approvals and rights. */
const settle = (
  world: FootballWorld,
  decisions: DecisionsState,
  proposal: ProposalRecord,
): { state: 'authorized' | 'awaiting_approval'; basis: string | null } => {
  const evaluation = evaluateProposalAuthority(
    withDecisions(world, decisions),
    proposal,
    world.simDate,
  );
  return evaluation.satisfied
    ? { state: 'authorized', basis: evaluation.basis }
    : { state: 'awaiting_approval', basis: null };
};

const replaceProposal = (
  decisions: DecisionsState,
  next: ProposalRecord,
): DecisionsState => ({
  ...decisions,
  proposals: decisions.proposals
    .map((p) => (p.id === next.id && p.revision === next.revision ? next : p))
    .sort(compareProposals),
});

const authorizedEvent = (
  proposal: ProposalRecord,
  basis: string | null,
): EventSpec =>
  spec('ProposalAuthorized', {
    proposalId: proposal.id,
    revision: proposal.revision,
    basis,
  });

interface Located {
  readonly by: EntityId;
  readonly proposal: ProposalRecord;
}

const locate = (ctx: RouteContext, c: Cmd): Located | Failure => {
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  if (!isValidId(c.proposalId)) return bad('proposalId must be a valid id');
  const proposal = latestProposal(ctx.world.decisions, c.proposalId);
  if (proposal === undefined) return bad('proposalId does not name a proposal');
  if (c.expectedRevision !== proposal.revision)
    return bad(
      `proposal revision is stale: expected ${String(c.expectedRevision)}, latest is ${proposal.revision}`,
    );
  return { by, proposal };
};

const requireOpen = (
  world: FootballWorld,
  p: ProposalRecord,
): Failure | null => {
  if (isTerminalProposalState(p.state))
    return bad(`proposal is already ${p.state}`);
  if (!isProposalLiveAt(p, world.simDate)) return bad('proposal has expired');
  return null;
};

// --- commands -----------------------------------------------------------------

const routeSubmit = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const org = parseOrganization(ctx, c.organizationId);
  if (isFailure(org)) return org;
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  if (!(PROPOSAL_CATEGORIES as readonly unknown[]).includes(c.category))
    return bad('category is not available in this package');
  const category = c.category as DecisionCategory;
  const fields = parseFields(world, org, c, null);
  if (isFailure(fields)) return fields;

  if (
    rightBackingAt(world, org, by, category, 'propose', world.simDate) === null
  )
    return denied(`${by} lacks propose on ${category} in ${org}`);

  const minted = mintRecordIds(world, 1);
  const submitted: ProposalRecord = {
    id: minted.ids[0]!,
    revision: 1,
    organizationId: org,
    authorPersonId: by,
    category,
    subjects: fields.subjects,
    termsType: fields.termsType,
    terms: fields.terms,
    termsHash: proposalTermsHash({
      category,
      subjects: fields.subjects,
      termsType: fields.termsType,
      terms: fields.terms,
    }),
    relevantWorldRevision: Number(world.revision),
    requiredApproverPersonIds: fields.requiredApproverPersonIds,
    expiresAt: fields.expiresAt,
    contingencies: fields.contingencies,
    state: 'submitted',
    createdAt: world.simDate,
    supersedesRevision: null,
  };
  const draft = {
    ...world.decisions,
    proposals: [...world.decisions.proposals, submitted].sort(compareProposals),
  };
  const outcome = settle(world, draft, submitted);
  const stored: ProposalRecord = { ...submitted, state: outcome.state };
  const specs: EventSpec[] = [
    spec('ProposalSubmitted', {
      actingPersonId: by,
      proposal: { ...submitted },
    }),
  ];
  if (outcome.state === 'authorized')
    specs.push(authorizedEvent(stored, outcome.basis));
  return finish(
    ctx,
    { decisions: replaceProposal(draft, stored), nextRecord: minted.next },
    specs,
    `${by} submits ${stored.id} (${outcome.state})`,
    `${by} may propose on ${category}`,
  );
};

const routeApprove = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const located = locate(ctx, c);
  if (isFailure(located)) return located;
  const { by, proposal } = located;
  const open = requireOpen(world, proposal);
  if (open !== null) return open;
  if (proposal.state !== 'awaiting_approval')
    return bad(`proposal is ${proposal.state}; it is not awaiting approval`);
  if (
    world.decisions.approvals.some(
      (a) =>
        a.proposalId === proposal.id &&
        a.active &&
        a.right === 'approve' &&
        a.approverPersonId === by &&
        a.termsHash === proposal.termsHash,
    )
  )
    return bad(`${by} has already approved this revision`);

  const backing = rightBackingAt(
    world,
    proposal.organizationId,
    by,
    proposal.category,
    'approve',
    world.simDate,
  );
  if (backing === null)
    return denied(`${by} lacks approve on ${proposal.category}`);
  if (
    proposal.requiredApproverPersonIds.length > 0 &&
    !proposal.requiredApproverPersonIds.includes(by)
  )
    return bad(`${by} is not a required approver of this proposal`);

  const minted = mintRecordIds(world, 1);
  const approval: ApprovalRecord = {
    id: minted.ids[0]!,
    proposalId: proposal.id,
    proposalRevision: proposal.revision,
    approverPersonId: by,
    right: 'approve',
    authorityGrantId: backing.grantIds[0]!,
    mandateId: backing.mandateId,
    termsHash: proposal.termsHash,
    decidedAt: world.simDate,
    active: true,
  };
  const withApproval: DecisionsState = {
    ...world.decisions,
    approvals: [...world.decisions.approvals, approval].sort(compareById),
  };
  const outcome = settle(world, withApproval, proposal);
  const stored: ProposalRecord = { ...proposal, state: outcome.state };
  const specs: EventSpec[] = [
    spec('ProposalApproved', { actingPersonId: by, approval: { ...approval } }),
  ];
  if (outcome.state === 'authorized')
    specs.push(authorizedEvent(stored, outcome.basis));
  return finish(
    ctx,
    {
      decisions: replaceProposal(withApproval, stored),
      nextRecord: minted.next,
    },
    specs,
    `${by} approves ${proposal.id}/${proposal.revision}`,
    `${by} holds approve on ${proposal.category}`,
  );
};

const routeVeto = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const located = locate(ctx, c);
  if (isFailure(located)) return located;
  const { by, proposal } = located;
  const open = requireOpen(world, proposal);
  if (open !== null) return open;
  const backing = rightBackingAt(
    world,
    proposal.organizationId,
    by,
    proposal.category,
    'veto',
    world.simDate,
  );
  if (backing === null)
    return denied(`${by} lacks veto on ${proposal.category}`);

  const minted = mintRecordIds(world, 1);
  const veto: ApprovalRecord = {
    id: minted.ids[0]!,
    proposalId: proposal.id,
    proposalRevision: proposal.revision,
    approverPersonId: by,
    right: 'veto',
    authorityGrantId: backing.grantIds[0]!,
    mandateId: backing.mandateId,
    termsHash: proposal.termsHash,
    decidedAt: world.simDate,
    active: true,
  };
  const decisions = replaceProposal(
    {
      ...world.decisions,
      approvals: [...world.decisions.approvals, veto].sort(compareById),
    },
    { ...proposal, state: 'rejected' },
  );
  return finish(
    ctx,
    { decisions, nextRecord: minted.next },
    [
      spec('ProposalVetoed', {
        actingPersonId: by,
        proposalId: proposal.id,
        revision: proposal.revision,
        approval: { ...veto },
      }),
    ],
    `${by} vetoes ${proposal.id}/${proposal.revision}`,
    `${by} holds veto on ${proposal.category}`,
  );
};

const routeSimpleTransition = (
  ctx: RouteContext,
  c: Cmd,
  kind: 'withdraw' | 'expire',
): RouteOutcome => {
  const { world } = ctx;
  const located = locate(ctx, c);
  if (isFailure(located)) return located;
  const { by, proposal } = located;
  if (isTerminalProposalState(proposal.state))
    return bad(`proposal is already ${proposal.state}`);
  if (
    kind === 'expire' &&
    (proposal.expiresAt === null || world.simDate < proposal.expiresAt)
  )
    return bad('proposal has not reached its deadline');
  if (kind === 'withdraw') {
    if (proposal.authorPersonId !== by)
      return denied(`${by} is not the author of ${proposal.id}`);
  } else if (
    !holdsRoleAt(world.people, proposal.organizationId, by, world.simDate)
  ) {
    return denied(`${by} holds no role in ${proposal.organizationId}`);
  }
  const state: ProposalState = kind === 'withdraw' ? 'withdrawn' : 'expired';
  return finish(
    ctx,
    { decisions: replaceProposal(world.decisions, { ...proposal, state }) },
    [
      spec(kind === 'withdraw' ? 'ProposalWithdrawn' : 'ProposalExpired', {
        actingPersonId: by,
        proposalId: proposal.id,
        revision: proposal.revision,
      }),
    ],
    `${by} ${kind}s ${proposal.id}/${proposal.revision}`,
    kind === 'withdraw' ? `${by} is the author` : `${by} holds a role here`,
  );
};

const routeRevise = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const located = locate(ctx, c);
  if (isFailure(located)) return located;
  const { by, proposal } = located;
  if (proposal.state === 'committed')
    return bad('a committed proposal cannot change');
  if (c.category !== undefined)
    return bad('category cannot change in a revision');
  const fields = parseFields(world, proposal.organizationId, c, proposal);
  if (isFailure(fields)) return fields;
  const termsHash = proposalTermsHash({
    category: proposal.category,
    subjects: fields.subjects,
    termsType: fields.termsType,
    terms: fields.terms,
  });
  const unchanged =
    termsHash === proposal.termsHash &&
    canonicalString(fields.requiredApproverPersonIds) ===
      canonicalString(proposal.requiredApproverPersonIds) &&
    fields.expiresAt === proposal.expiresAt &&
    canonicalString(fields.contingencies) ===
      canonicalString(proposal.contingencies);
  if (unchanged) return bad('the revision changes nothing');

  if (proposal.authorPersonId !== by)
    return denied(`${by} is not the author of ${proposal.id}`);
  if (
    rightBackingAt(
      world,
      proposal.organizationId,
      by,
      proposal.category,
      'propose',
      world.simDate,
    ) === null
  )
    return denied(`${by} lacks propose on ${proposal.category}`);

  const wasTerminal = isTerminalProposalState(proposal.state);
  const material = termsHash !== proposal.termsHash;
  const invalidate = wasTerminal || material;
  const specs: EventSpec[] = [];
  const revised: ProposalRecord = {
    ...proposal,
    revision: proposal.revision + 1,
    subjects: fields.subjects,
    termsType: fields.termsType,
    terms: fields.terms,
    termsHash,
    relevantWorldRevision: Number(world.revision),
    requiredApproverPersonIds: fields.requiredApproverPersonIds,
    expiresAt: fields.expiresAt,
    contingencies: fields.contingencies,
    state: 'submitted',
    createdAt: world.simDate,
    supersedesRevision: proposal.revision,
  };
  specs.push(
    spec('ProposalRevised', {
      actingPersonId: by,
      supersededRevision: proposal.revision,
      proposal: { ...revised },
    }),
  );
  let approvals = world.decisions.approvals;
  if (invalidate) {
    approvals = approvals.map((a) => {
      if (a.proposalId !== proposal.id || !a.active) return a;
      const off = { ...a, active: false };
      specs.push(
        spec('ApprovalInvalidated', {
          approvalId: a.id,
          proposalId: proposal.id,
          reason: wasTerminal ? 'retry' : 'material_revision',
        }),
      );
      return off;
    });
  }
  const closed: ProposalRecord = isTerminalProposalState(proposal.state)
    ? proposal
    : { ...proposal, state: 'withdrawn' };
  const draft: DecisionsState = {
    ...world.decisions,
    approvals,
    proposals: [
      ...world.decisions.proposals.map((p) =>
        p.id === proposal.id && p.revision === proposal.revision ? closed : p,
      ),
      revised,
    ].sort(compareProposals),
  };
  const outcome = settle(world, draft, revised);
  const stored: ProposalRecord = { ...revised, state: outcome.state };
  if (outcome.state === 'authorized')
    specs.push(authorizedEvent(stored, outcome.basis));
  return finish(
    ctx,
    { decisions: replaceProposal(draft, stored) },
    specs,
    `${by} revises ${proposal.id} to revision ${stored.revision}`,
    `${by} is the author and may propose on ${proposal.category}`,
  );
};

// --- the commit gate ----------------------------------------------------------

export interface CommitPart {
  readonly proposalId: string;
  readonly expectedRevision: number;
  readonly actorPersonId: EntityId;
  readonly beliefIds: readonly string[];
  readonly evidenceClaimIds: readonly string[];
  readonly rationale: CanonicalValue;
}

export interface CommitProposalInput extends CommitPart {
  /** The world after the domain adapter's own changes. Decision state is layered on top. */
  readonly nextWorld: FootballWorld;
  /** The adapter's own events; the gate appends the commit and receipt events after them. */
  readonly domainEvents: readonly EventSpec[];
}

export interface CommitProposalsInput {
  readonly nextWorld: FootballWorld;
  /** One part per proposal that this single atomic domain change executes (a trade has two). */
  readonly parts: readonly CommitPart[];
  readonly domainEvents: readonly EventSpec[];
}

const checkedIds = (
  v: readonly string[],
  label: string,
  exists: (id: string) => boolean,
): readonly RecordId[] | Failure => {
  if (new Set(v).size !== v.length) return bad(`${label} contains a duplicate`);
  for (const id of v)
    if (!isValidId(id) || !exists(id))
      return bad(`${label} contains an id that is not available`);
  return v.map(recordId);
};

interface ValidatedPart {
  readonly part: CommitPart;
  readonly proposal: ProposalRecord;
  readonly beliefs: readonly RecordId[];
  readonly evidence: readonly RecordId[];
  readonly execute: NonNullable<ReturnType<typeof rightBackingAt>>;
  readonly authorization: ReturnType<typeof evaluateProposalAuthority>;
}

/** Everything that must still hold at the instant of commit, re-derived from current state. */
const validatePart = (
  world: FootballWorld,
  part: CommitPart,
): ValidatedPart | Failure => {
  const today = world.simDate;
  const proposal = latestProposal(world.decisions, part.proposalId);
  if (proposal === undefined) return bad('proposalId does not name a proposal');
  if (part.expectedRevision !== proposal.revision)
    return bad(
      `proposal revision is stale: expected ${part.expectedRevision}, latest is ${proposal.revision}`,
    );
  if (proposal.state !== 'authorized')
    return bad(
      `proposal is ${proposal.state}; only an authorized proposal commits`,
    );
  if (!isProposalLiveAt(proposal, today)) return bad('proposal has expired');
  if (proposalTermsHash(proposal) !== proposal.termsHash)
    return bad('proposal terms no longer match their hash');
  const beliefs = checkedIds(part.beliefIds, 'beliefIds', (id) =>
    world.information.beliefs.some(
      (b) =>
        b.id === id &&
        b.organizationId === proposal.organizationId &&
        isBeliefVisibleTo(
          world,
          proposal.organizationId,
          part.actorPersonId,
          b,
        ),
    ),
  );
  if (isFailure(beliefs)) return beliefs;
  const evidence = checkedIds(
    part.evidenceClaimIds,
    'evidenceClaimIds',
    (id) =>
      findVisibleClaim(
        world,
        proposal.organizationId,
        part.actorPersonId,
        id,
      ) !== undefined,
  );
  if (isFailure(evidence)) return evidence;

  const execute = rightBackingAt(
    world,
    proposal.organizationId,
    part.actorPersonId,
    proposal.category,
    'execute',
    today,
  );
  if (execute === null)
    return denied(
      `${part.actorPersonId} lacks execute on ${proposal.category} in ${proposal.organizationId}`,
    );
  const authorization = evaluateProposalAuthority(world, proposal, today);
  if (!authorization.satisfied)
    return denied(
      `authorization no longer holds: ${authorization.reasons.join('; ')}`,
    );
  return { part, proposal, beliefs, evidence, execute, authorization };
};

/**
 * The only way proposals become committed. A domain adapter (never a generic command)
 * calls this with the world it has already changed; the gate re-derives authority from
 * current rights, checks the exact terms hash and deadline, requires `execute`, and layers
 * the proposal state, immutable receipts, and the commit events onto the result. Every
 * proposal in `parts` commits in the same resolution or none does.
 */
export const commitProposals = (
  ctx: RouteContext,
  input: CommitProposalsInput,
): RouteOutcome => {
  const { world } = ctx;
  const today = world.simDate;
  if (input.parts.length === 0) return bad('at least one proposal must commit');
  if (new Set(input.parts.map((p) => p.proposalId)).size !== input.parts.length)
    return bad('the same proposal cannot commit twice in one resolution');
  const ordered = [...input.parts].sort((a, b) =>
    a.proposalId < b.proposalId ? -1 : a.proposalId > b.proposalId ? 1 : 0,
  );
  const validated: ValidatedPart[] = [];
  for (const part of ordered) {
    const v = validatePart(world, part);
    if (isFailure(v)) return v;
    validated.push(v);
  }

  const minted = mintRecordIds(input.nextWorld, validated.length);
  const firstEvent = world.nextIds.event;
  const total = input.domainEvents.length + 2 * validated.length;
  const outcomeEventIds = Array.from({ length: total }, (_, i) =>
    eventId(`evt-${pad(firstEvent + i)}`),
  );
  const receipts: DecisionReceipt[] = validated.map((v, i) => ({
    id: minted.ids[i]!,
    proposalId: v.proposal.id,
    proposalRevision: v.proposal.revision,
    commandId: ctx.commandId,
    actorPersonId: v.part.actorPersonId,
    authorityGrantIds: [
      ...new Set([...v.execute.grantIds, ...v.authorization.grantIds]),
    ].sort(),
    evidenceClaimIds: v.evidence,
    beliefIds: v.beliefs,
    approvalIds: v.authorization.approvalIds,
    mandateId: v.execute.mandateId,
    executedTermsHash: v.proposal.termsHash,
    committedAt: today,
    outcomeEventIds,
    originalRationale: v.part.rationale,
  }));
  let decisions: DecisionsState = input.nextWorld.decisions;
  for (const v of validated)
    decisions = replaceProposal(decisions, {
      ...v.proposal,
      state: 'committed',
    });
  decisions = {
    ...decisions,
    receipts: [...decisions.receipts, ...receipts].sort(compareById),
  };
  const commitSpecs: EventSpec[] = [];
  validated.forEach((v, i) => {
    commitSpecs.push(
      spec('ProposalCommitted', {
        proposalId: v.proposal.id,
        revision: v.proposal.revision,
        actingPersonId: v.part.actorPersonId,
      }),
      spec('DecisionReceiptRecorded', { receipt: { ...receipts[i]! } }),
    );
  });
  return {
    ok: true,
    authorizationDetail:
      validated.length === 1
        ? `${validated[0]!.part.actorPersonId} holds execute; authorization re-derived`
        : validated
            .map(
              (v) =>
                `${v.part.actorPersonId} holds execute on ${v.proposal.id}; authorization re-derived`,
            )
            .join('; '),
    resolution: {
      nextWorld: {
        ...input.nextWorld,
        decisions,
        nextIds: { ...input.nextWorld.nextIds, record: minted.next },
      },
      eventSpecs: [...input.domainEvents, ...commitSpecs],
      detail: validated
        .map((v) => `committed ${v.proposal.id}/${v.proposal.revision}`)
        .join('; '),
    },
  };
};

/** Single-proposal commit: the established Package B gate, now a one-part `commitProposals`. */
export const commitProposal = (
  ctx: RouteContext,
  input: CommitProposalInput,
): RouteOutcome =>
  commitProposals(ctx, {
    nextWorld: input.nextWorld,
    domainEvents: input.domainEvents,
    parts: [
      {
        proposalId: input.proposalId,
        expectedRevision: input.expectedRevision,
        actorPersonId: input.actorPersonId,
        beliefIds: input.beliefIds,
        evidenceClaimIds: input.evidenceClaimIds,
        rationale: input.rationale,
      },
    ],
  });

export const routeDecisionCommand = (
  ctx: RouteContext,
  command: CommandPayloadBase & { readonly type: DecisionCommandType },
): RouteOutcome => {
  const c = command as Cmd;
  switch (command.type) {
    case 'SubmitProposal':
      return routeSubmit(ctx, c);
    case 'ReviseProposal':
      return routeRevise(ctx, c);
    case 'ApproveProposal':
      return routeApprove(ctx, c);
    case 'VetoProposal':
      return routeVeto(ctx, c);
    case 'WithdrawProposal':
      return routeSimpleTransition(ctx, c, 'withdraw');
    case 'ExpireProposal':
      return routeSimpleTransition(ctx, c, 'expire');
    default: {
      const unreachable: never = command.type;
      throw new Error(`unroutable decision command: ${String(unreachable)}`);
    }
  }
};

void dayBefore;
