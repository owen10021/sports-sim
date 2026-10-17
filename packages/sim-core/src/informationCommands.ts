import type { CommandPayloadBase } from './audit';
import { effectiveRightsAt, type DecisionRight } from './authority';
import type { RouteContext, RouteOutcome } from './commandRouter';
import {
  bad,
  byId,
  denied,
  finish,
  isFailure,
  isPlainObject,
  mintRecordId,
  nonEmptyText,
  parseActingPerson,
  parseDate,
  parseOrganization,
  spec,
  type Cmd,
  type Failure,
} from './commandSupport';
import { isValidId, recordId, type EntityId, type RecordId } from './ids';
import type {
  BeliefRecord,
  ClaimRecord,
  ClaimVisibility,
  ConfidenceBand,
  SubjectRef,
} from './information';
import { findVisibleClaim } from './knowledgeView';
import type { FootballWorld } from './world';

export const INFORMATION_COMMAND_TYPES = [
  'RecordClaim',
  'ShareClaim',
  'FormBelief',
] as const;
export type InformationCommandType = (typeof INFORMATION_COMMAND_TYPES)[number];

const VISIBILITIES: readonly ClaimVisibility[] = [
  'restricted',
  'organization',
  'public',
];
const CONFIDENCE_BANDS: readonly ConfidenceBand[] = [
  'very_low',
  'low',
  'medium',
  'high',
  'very_high',
];
const SUBJECT_KINDS: readonly SubjectRef['kind'][] = [
  'entity',
  'plan',
  'proposal',
  'world',
];

/** Information work is advisory/communicative; each needs its own explicit right. */
const requireRight = (
  world: FootballWorld,
  organizationId: EntityId,
  personId: EntityId,
  right: DecisionRight,
): Failure | null =>
  effectiveRightsAt(
    world,
    organizationId,
    personId,
    'organizational_plan',
    world.simDate,
  ).rights.includes(right)
    ? null
    : denied(
        `${personId} lacks ${right} on organizational_plan in ${organizationId}`,
      );

export const parseSubject = (
  world: FootballWorld,
  v: unknown,
): SubjectRef | Failure => {
  if (!isPlainObject(v)) return bad('subject must be an object');
  const { kind, id } = v;
  if (!(SUBJECT_KINDS as readonly unknown[]).includes(kind))
    return bad('subject.kind is not recognized');
  if (!isValidId(id)) return bad('subject.id is not a valid id');
  if (kind === 'entity' && !world.entities.some((e) => e.id === id))
    return bad('subject does not name a known entity');
  return { kind: kind as SubjectRef['kind'], id };
};

const parseEnum = <T extends string>(
  v: unknown,
  allowed: readonly T[],
  label: string,
): T | Failure =>
  (allowed as readonly unknown[]).includes(v)
    ? (v as T)
    : bad(`${label} is not recognized`);

/** One message for hidden and missing alike, so existence is never revealed. */
const unavailable = (id: unknown): Failure =>
  bad(`claim ${String(id)} is not available to this organization`);

const parseVisibleClaimIds = (
  ctx: RouteContext,
  org: EntityId,
  by: EntityId,
  v: unknown,
  label: string,
): readonly RecordId[] | Failure => {
  if (!Array.isArray(v)) return bad(`${label} must be an array`);
  const seen = new Set<string>();
  for (const id of v) {
    if (!isValidId(id)) return bad(`${label} contains an invalid id`);
    if (seen.has(id)) return bad(`${label} contains a duplicate id`);
    seen.add(id);
    if (findVisibleClaim(ctx.world, org, by, id) === undefined)
      return unavailable(id);
  }
  return v.map(recordId);
};

const sameSubject = (a: SubjectRef, b: SubjectRef): boolean =>
  a.kind === b.kind && a.id === b.id;

const routeRecordClaim = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const today = world.simDate;
  const org = parseOrganization(ctx, c.organizationId);
  if (isFailure(org)) return org;
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  if (c.sourcePersonId !== undefined)
    return bad(
      'the recorder is always the source; sourcePersonId is not accepted',
    );
  const subject = parseSubject(world, c.subject);
  if (isFailure(subject)) return subject;
  if (!nonEmptyText(c.propositionType, 64))
    return bad('propositionType must be 1-64 characters');
  if (!isPlainObject(c.proposition))
    return bad('proposition must be an object');
  if (!isValidId(c.sourceFamilyId))
    return bad('sourceFamilyId must be a valid id');
  const observedAt = parseDate(c.observedAt, 'observedAt');
  if (isFailure(observedAt)) return observedAt;
  if (observedAt > today)
    return bad('a claim cannot be observed in the future');
  const visibility = parseEnum(c.visibility, VISIBILITIES, 'visibility');
  if (isFailure(visibility)) return visibility;
  const confidence = parseEnum(c.confidence, CONFIDENCE_BANDS, 'confidence');
  if (isFailure(confidence)) return confidence;
  const bias = c.possibleBias;
  if (bias !== null && !nonEmptyText(bias, 200))
    return bad('possibleBias must be null or 1-200 characters');
  const corroborates = parseVisibleClaimIds(
    ctx,
    org,
    by,
    c.corroboratesClaimIds,
    'corroboratesClaimIds',
  );
  if (isFailure(corroborates)) return corroborates;
  const contradicts = parseVisibleClaimIds(
    ctx,
    org,
    by,
    c.contradictsClaimIds,
    'contradictsClaimIds',
  );
  if (isFailure(contradicts)) return contradicts;
  if (corroborates.some((id) => contradicts.includes(id)))
    return bad('a claim cannot both corroborate and contradict the same claim');

  const noRight = requireRight(world, org, by, 'advise');
  if (noRight !== null) return noRight;

  const minted = mintRecordId(world);
  const claim: ClaimRecord = {
    id: minted.id,
    subject,
    propositionType: c.propositionType,
    proposition: c.proposition,
    sourcePersonId: by,
    sourceFamilyId: c.sourceFamilyId,
    observedAt,
    acquiredAt: today,
    visibility,
    holderOrganizationIds: [org],
    confidence,
    possibleBias: bias,
    corroboratesClaimIds: corroborates,
    contradictsClaimIds: contradicts,
    sharedFromClaimId: null,
  };
  const claims = [...world.information.claims, claim].sort(byId);
  return finish(
    ctx,
    {
      information: { ...world.information, claims },
      nextRecord: minted.next,
    },
    [
      spec('ClaimRecorded', {
        actingPersonId: by,
        organizationId: org,
        claim: { ...claim },
      }),
    ],
    `${by} records ${claim.propositionType} for ${org}`,
    `${by} may advise on organizational_plan`,
  );
};

const routeShareClaim = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const today = world.simDate;
  const org = parseOrganization(ctx, c.organizationId);
  if (isFailure(org)) return org;
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  const claim = findVisibleClaim(world, org, by, String(c.claimId));
  if (claim === undefined) return unavailable(c.claimId);
  const to = parseOrganization(ctx, c.toOrganizationId);
  if (isFailure(to)) return to;
  if (to === org) return bad('a claim is shared with another organization');
  if (claim.visibility === 'public')
    return bad('a public claim needs no sharing');
  let visibility: ClaimVisibility = claim.visibility;
  if (c.visibility !== undefined) {
    const v = parseEnum(c.visibility, VISIBILITIES, 'visibility');
    if (isFailure(v)) return v;
    if (VISIBILITIES.indexOf(v) > VISIBILITIES.indexOf(claim.visibility))
      return bad('sharing cannot widen the visibility of a claim');
    visibility = v;
  }
  if (
    world.information.claims.some(
      (x) =>
        x.sharedFromClaimId === claim.id &&
        x.holderOrganizationIds.includes(to),
    )
  )
    return bad('the claim has already been shared with that organization');

  const noRight = requireRight(world, org, by, 'communicate');
  if (noRight !== null) return noRight;

  const minted = mintRecordId(world);
  const copy: ClaimRecord = {
    ...claim,
    id: minted.id,
    acquiredAt: today,
    visibility,
    holderOrganizationIds: [to],
    corroboratesClaimIds: [],
    contradictsClaimIds: [],
    sharedFromClaimId: claim.id,
  };
  const claims = [...world.information.claims, copy].sort(byId);
  return finish(
    ctx,
    {
      information: { ...world.information, claims },
      nextRecord: minted.next,
    },
    [
      spec('ClaimShared', {
        actingPersonId: by,
        fromOrganizationId: org,
        toOrganizationId: to,
        claim: { ...copy },
      }),
    ],
    `${by} shares ${claim.id} with ${to}`,
    `${by} may communicate on organizational_plan and can see the claim`,
  );
};

const routeFormBelief = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const org = parseOrganization(ctx, c.organizationId);
  if (isFailure(org)) return org;
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  const subject = parseSubject(world, c.subject);
  if (isFailure(subject)) return subject;
  if (!nonEmptyText(c.assessmentType, 64))
    return bad('assessmentType must be 1-64 characters');
  if (!isPlainObject(c.assessment)) return bad('assessment must be an object');
  const confidence = parseEnum(c.confidence, CONFIDENCE_BANDS, 'confidence');
  if (isFailure(confidence)) return confidence;
  const evidence = parseVisibleClaimIds(
    ctx,
    org,
    by,
    c.evidenceClaimIds,
    'evidenceClaimIds',
  );
  if (isFailure(evidence)) return evidence;
  if (evidence.length === 0)
    return bad('a belief needs at least one piece of evidence');

  let supersedes: RecordId | null = null;
  if (c.supersedesBeliefId !== undefined && c.supersedesBeliefId !== null) {
    const prior = world.information.beliefs.find(
      (b) => b.id === c.supersedesBeliefId && b.organizationId === org,
    );
    if (prior === undefined) return bad('supersedesBeliefId is not available');
    if (!sameSubject(prior.subject, subject))
      return bad('a belief chain stays about one subject');
    if (
      world.information.beliefs.some((b) => b.supersedesBeliefId === prior.id)
    )
      return bad('that belief has already been superseded');
    supersedes = prior.id;
  }

  const noRight = requireRight(world, org, by, 'advise');
  if (noRight !== null) return noRight;

  const minted = mintRecordId(world);
  const belief: BeliefRecord = {
    id: minted.id,
    organizationId: org,
    authorPersonId: by,
    subject,
    assessmentType: c.assessmentType,
    assessment: c.assessment,
    confidence,
    evidenceClaimIds: evidence,
    formedAt: world.simDate,
    supersedesBeliefId: supersedes,
  };
  const beliefs = [...world.information.beliefs, belief].sort(byId);
  return finish(
    ctx,
    {
      information: { ...world.information, beliefs },
      nextRecord: minted.next,
    },
    [spec('BeliefFormed', { actingPersonId: by, belief: { ...belief } })],
    `${by} forms ${belief.assessmentType} for ${org}`,
    `${by} may advise on organizational_plan`,
  );
};

export const routeInformationCommand = (
  ctx: RouteContext,
  command: CommandPayloadBase & { readonly type: InformationCommandType },
): RouteOutcome => {
  const c = command as Cmd;
  switch (command.type) {
    case 'RecordClaim':
      return routeRecordClaim(ctx, c);
    case 'ShareClaim':
      return routeShareClaim(ctx, c);
    case 'FormBelief':
      return routeFormBelief(ctx, c);
    default: {
      const unreachable: never = command.type;
      throw new Error(`unroutable information command: ${String(unreachable)}`);
    }
  }
};
