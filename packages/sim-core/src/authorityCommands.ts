import type { CanonicalValue, CommandPayloadBase } from './audit';
import {
  DECISION_CATEGORIES,
  DECISION_RIGHTS,
  activeRightsAt,
  isProtectedAt,
  type AuthorityGrant,
  type DecisionCategory,
  type DecisionRight,
  type Mandate,
  type ProtectedConstraint,
} from './authority';
import type { EventSpec, RouteContext, RouteOutcome } from './commandRouter';
import {
  bad,
  byId,
  dayAfter,
  dayBefore,
  denied,
  finish,
  hasKind,
  isFailure,
  isPlainObject,
  mintRecordId,
  nonEmptyText,
  parseActingPerson,
  parseDate,
  parseOrganization,
  protectedBy,
  requireExecute,
  spec,
  type Cmd,
  type Failure,
} from './commandSupport';
import { entityId, isValidId } from './ids';
import {
  PERSON_ROLES,
  holdsRoleAt,
  type PersonRole,
  type RoleEpisode,
} from './people';

export const AUTHORITY_COMMAND_TYPES = [
  'StartRoleEpisode',
  'EndRoleEpisode',
  'GrantAuthority',
  'RevokeAuthority',
  'CreateMandate',
  'RevokeMandate',
  'CreateProtectedConstraint',
  'AmendProtectedConstraint',
] as const;
export type AuthorityCommandType = (typeof AUTHORITY_COMMAND_TYPES)[number];

const parseRights = (
  v: unknown,
  label: string,
): readonly DecisionRight[] | Failure => {
  if (!Array.isArray(v) || v.length === 0)
    return bad(`${label} must be a non-empty array of rights`);
  const seen = new Set<DecisionRight>();
  for (const r of v) {
    if (!(DECISION_RIGHTS as readonly unknown[]).includes(r))
      return bad(`${label} contains an unknown right`);
    if (seen.has(r as DecisionRight))
      return bad(`${label} contains a duplicate right`);
    seen.add(r as DecisionRight);
  }
  return DECISION_RIGHTS.filter((r) => seen.has(r));
};

const parseCategory = (v: unknown): DecisionCategory | Failure =>
  (DECISION_CATEGORIES as readonly unknown[]).includes(v)
    ? (v as DecisionCategory)
    : bad('category is not a known decision category');

// ---------------------------------------------------------------------------

const routeStartRole = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const today = world.simDate;
  const org = parseOrganization(ctx, c.organizationId);
  if (isFailure(org)) return org;
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  if (!isValidId(c.personId) || !hasKind(world, c.personId, 'person'))
    return bad('personId must name an existing person');
  const person = entityId(c.personId);
  if (!(PERSON_ROLES as readonly unknown[]).includes(c.role))
    return bad('role is not a known role');
  const role = c.role as PersonRole;
  if (!nonEmptyText(c.title, 120)) return bad('title must be 1-120 characters');
  let startDate = today;
  if (c.startDate !== undefined) {
    const d = parseDate(c.startDate, 'startDate');
    if (isFailure(d)) return d;
    if (d < today) return bad('a role cannot start in the past');
    startDate = d;
  }
  const overlaps = world.people.roleEpisodes.some(
    (e) =>
      e.personId === person &&
      e.organizationId === org &&
      e.role === role &&
      (e.endDate === null || e.endDate >= startDate),
  );
  if (overlaps) return bad('the person already holds or will hold that role');

  const noRight = requireExecute(world, org, by);
  if (noRight !== null) return noRight;

  const minted = mintRecordId(world);
  const episode: RoleEpisode = {
    id: minted.id,
    personId: person,
    organizationId: org,
    role,
    title: c.title,
    startDate,
    endDate: null,
  };
  const roleEpisodes = [...world.people.roleEpisodes, episode].sort(byId);
  return finish(
    ctx,
    { people: { ...world.people, roleEpisodes }, nextRecord: minted.next },
    [
      spec('RoleEpisodeStarted', {
        actingPersonId: by,
        episode: { ...episode },
      }),
    ],
    `${person} starts ${role} in ${org}`,
    `${by} may execute organizational_authority`,
  );
};

const routeEndRole = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const today = world.simDate;
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  const episode = world.people.roleEpisodes.find((e) => e.id === c.episodeId);
  if (episode === undefined)
    return bad('episodeId does not name a role episode');
  if (episode.endDate !== null && episode.endDate < today)
    return bad('the role episode has already ended');
  let endDate = dayBefore(today);
  if (c.lastDay !== undefined) {
    const d = parseDate(c.lastDay, 'lastDay');
    if (isFailure(d)) return d;
    if (d < endDate) return bad('lastDay cannot be before yesterday');
    endDate = d;
  }
  if (episode.endDate !== null && endDate >= episode.endDate)
    return bad('the role episode already ends on or before that day');

  const noRight = requireExecute(world, episode.organizationId, by);
  if (noRight !== null) return noRight;
  if (
    isProtectedAt(
      world,
      episode.organizationId,
      { kind: 'role_episode', id: episode.id },
      { action: 'end' },
      today,
    ).length > 0
  )
    return protectedBy(`role episode ${episode.id} is protected from ending`);

  const ended: RoleEpisode = { ...episode, endDate };
  const roleEpisodes = world.people.roleEpisodes.map((e) =>
    e.id === episode.id ? ended : e,
  );
  const specs: EventSpec[] = [
    spec('RoleEpisodeEnded', { actingPersonId: by, episode: { ...ended } }),
  ];

  // Role-bound authority ends with the last role the person holds in the organization.
  const next = dayAfter(endDate);
  const stillHolds = world.people.roleEpisodes.some(
    (e) =>
      e.id !== episode.id &&
      e.personId === episode.personId &&
      e.organizationId === episode.organizationId &&
      e.startDate <= next &&
      (e.endDate === null || e.endDate >= next),
  );
  let authority = world.authority;
  if (!stillHolds) {
    const grants = world.authority.grants.map((g): AuthorityGrant => {
      if (
        g.personId !== episode.personId ||
        g.organizationId !== episode.organizationId ||
        (g.effectiveUntil !== null && g.effectiveUntil <= endDate)
      )
        return g;
      const updated = {
        ...g,
        effectiveUntil: endDate,
        revision: g.revision + 1,
      };
      specs.push(
        spec('AuthorityRevoked', {
          cause: 'role_ended',
          roleEpisodeId: episode.id,
          grant: { ...updated },
        }),
      );
      return updated;
    });
    const mandates = world.authority.mandates.map((m): Mandate => {
      const involved =
        m.delegatorPersonId === episode.personId ||
        m.delegatePersonId === episode.personId;
      if (
        m.organizationId !== episode.organizationId ||
        !involved ||
        !m.active ||
        (m.effectiveUntil !== null && m.effectiveUntil <= endDate)
      )
        return m;
      const updated: Mandate =
        endDate < today
          ? { ...m, active: false, revision: m.revision + 1 }
          : { ...m, effectiveUntil: endDate, revision: m.revision + 1 };
      specs.push(
        spec('MandateRevoked', {
          cause: 'role_ended',
          roleEpisodeId: episode.id,
          mandate: { ...updated },
        }),
      );
      return updated;
    });
    authority = { ...world.authority, grants, mandates };
  }
  return finish(
    ctx,
    { people: { ...world.people, roleEpisodes }, authority },
    specs,
    `${episode.personId} role ${episode.id} ends ${endDate}`,
    `${by} may execute organizational_authority`,
  );
};

const parseValidity = (
  c: Cmd,
  today: string,
): { from: string; until: string | null } | Failure => {
  let from = today;
  if (c.effectiveFrom !== undefined) {
    const d = parseDate(c.effectiveFrom, 'effectiveFrom');
    if (isFailure(d)) return d;
    if (d < today) return bad('authority cannot start in the past');
    from = d;
  }
  let until: string | null = null;
  if (c.effectiveUntil !== undefined && c.effectiveUntil !== null) {
    const d = parseDate(c.effectiveUntil, 'effectiveUntil');
    if (isFailure(d)) return d;
    if (d < from) return bad('effectiveUntil cannot precede effectiveFrom');
    until = d;
  }
  return { from, until };
};

const routeGrant = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const org = parseOrganization(ctx, c.organizationId);
  if (isFailure(org)) return org;
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  if (!isValidId(c.personId) || !hasKind(world, c.personId, 'person'))
    return bad('personId must name an existing person');
  const category = parseCategory(c.category);
  if (isFailure(category)) return category;
  const rights = parseRights(c.rights, 'rights');
  if (isFailure(rights)) return rights;
  if (c.transferable !== undefined && typeof c.transferable !== 'boolean')
    return bad('transferable must be a boolean');
  const validity = parseValidity(c, world.simDate);
  if (isFailure(validity)) return validity;

  const noRight = requireExecute(world, org, by);
  if (noRight !== null) return noRight;
  const mine = activeRightsAt(world, org, by, category, world.simDate);
  const missing = rights.filter((r) => !mine.transferableRights.includes(r));
  if (missing.length > 0)
    return denied(
      `${by} cannot transfer ${missing.join(', ')} on ${category}: only transferable rights can be granted`,
    );

  const minted = mintRecordId(world);
  const grant: AuthorityGrant = {
    id: minted.id,
    personId: entityId(c.personId),
    organizationId: org,
    category,
    rights,
    transferable: c.transferable === true,
    effectiveFrom: validity.from,
    effectiveUntil: validity.until,
    sourcePersonId: by,
    revision: 1,
  };
  const grants = [...world.authority.grants, grant].sort(byId);
  return finish(
    ctx,
    { authority: { ...world.authority, grants }, nextRecord: minted.next },
    [spec('AuthorityGranted', { actingPersonId: by, grant: { ...grant } })],
    `${by} grants ${rights.join(',')} on ${category} to ${grant.personId}`,
    `${by} may execute organizational_authority and transfer the granted rights`,
  );
};

const routeRevokeGrant = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const today = world.simDate;
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  const grant = world.authority.grants.find((g) => g.id === c.grantId);
  if (grant === undefined) return bad('grantId does not name a grant');
  if (grant.effectiveUntil !== null && grant.effectiveUntil < today)
    return bad('the grant has already ended');

  const noRight = requireExecute(world, grant.organizationId, by);
  if (noRight !== null) return noRight;
  if (
    isProtectedAt(
      world,
      grant.organizationId,
      { kind: 'authority_grant', id: grant.id },
      { action: 'revoke' },
      today,
    ).length > 0
  )
    return protectedBy(`grant ${grant.id} is protected from revocation`);

  const updated: AuthorityGrant = {
    ...grant,
    effectiveUntil: dayBefore(today),
    revision: grant.revision + 1,
  };
  const grants = world.authority.grants.map((g) =>
    g.id === grant.id ? updated : g,
  );
  return finish(
    ctx,
    { authority: { ...world.authority, grants } },
    [
      spec('AuthorityRevoked', {
        cause: 'revoked',
        actingPersonId: by,
        grant: { ...updated },
      }),
    ],
    `${by} revokes grant ${grant.id}`,
    `${by} may execute organizational_authority`,
  );
};

const parseMandateBody = (
  c: Cmd,
):
  | {
      scope: { [key: string]: CanonicalValue };
      hard: { [key: string]: CanonicalValue };
      preferences: { [key: string]: CanonicalValue };
      fallback: { [key: string]: CanonicalValue };
      escalation: { [key: string]: CanonicalValue };
    }
  | Failure => {
  const scope = c.scope;
  if (
    !isPlainObject(scope) ||
    !Array.isArray(scope.scopeKeys) ||
    scope.scopeKeys.length === 0 ||
    !scope.scopeKeys.every((k) => nonEmptyText(k, 64)) ||
    new Set(scope.scopeKeys).size !== scope.scopeKeys.length
  )
    return bad('scope must be an object with unique non-empty scopeKeys');
  const hard = c.hardConstraints;
  if (!isPlainObject(hard)) return bad('hardConstraints must be an object');
  if (Object.keys(hard).length > 0) {
    if (
      !nonEmptyText(hard.unit, 64) ||
      typeof hard.maxAmount !== 'number' ||
      !Number.isSafeInteger(hard.maxAmount) ||
      hard.maxAmount < 0
    )
      return bad(
        'hardConstraints needs a unit and a non-negative integer maxAmount',
      );
  }
  const { preferences, fallback, escalationRules } = c;
  if (!isPlainObject(preferences)) return bad('preferences must be an object');
  if (!isPlainObject(fallback)) return bad('fallback must be an object');
  if (!isPlainObject(escalationRules))
    return bad('escalationRules must be an object');
  const rule = escalationRules.onExceedsHardConstraint;
  if (rule !== undefined && rule !== 'escalate' && rule !== 'reject')
    return bad('onExceedsHardConstraint must be escalate or reject');
  return {
    scope,
    hard,
    preferences,
    fallback,
    escalation: escalationRules,
  };
};

const routeCreateMandate = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const org = parseOrganization(ctx, c.organizationId);
  if (isFailure(org)) return org;
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  if (
    !isValidId(c.delegatePersonId) ||
    !hasKind(world, c.delegatePersonId, 'person') ||
    c.delegatePersonId === by ||
    !holdsRoleAt(world.people, org, entityId(c.delegatePersonId), world.simDate)
  )
    return bad('delegatePersonId must name another person who holds a role');
  const category = parseCategory(c.category);
  if (isFailure(category)) return category;
  const rights = parseRights(c.allowedRights, 'allowedRights');
  if (isFailure(rights)) return rights;
  const body = parseMandateBody(c);
  if (isFailure(body)) return body;
  const validity = parseValidity(c, world.simDate);
  if (isFailure(validity)) return validity;

  // A mandate narrows what the delegator can transfer from grants; mandates never chain.
  const mine = activeRightsAt(world, org, by, category, world.simDate);
  const missing = rights.filter((r) => !mine.transferableRights.includes(r));
  if (missing.length > 0)
    return denied(
      `${by} cannot delegate ${missing.join(', ')} on ${category}: not held transferably through a grant`,
    );

  const minted = mintRecordId(world);
  const mandate: Mandate = {
    id: minted.id,
    organizationId: org,
    delegatorPersonId: by,
    delegatePersonId: entityId(c.delegatePersonId),
    category,
    scope: body.scope,
    hardConstraints: body.hard,
    preferences: body.preferences,
    allowedRights: rights,
    fallback: body.fallback,
    escalationRules: body.escalation,
    effectiveFrom: validity.from,
    effectiveUntil: validity.until,
    revision: 1,
    active: true,
  };
  const mandates = [...world.authority.mandates, mandate].sort(byId);
  return finish(
    ctx,
    { authority: { ...world.authority, mandates }, nextRecord: minted.next },
    [spec('MandateCreated', { actingPersonId: by, mandate: { ...mandate } })],
    `${by} delegates ${rights.join(',')} on ${category} to ${mandate.delegatePersonId}`,
    `${by} holds the delegated rights transferably`,
  );
};

const routeRevokeMandate = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const today = world.simDate;
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  const mandate = world.authority.mandates.find((m) => m.id === c.mandateId);
  if (mandate === undefined) return bad('mandateId does not name a mandate');
  if (!mandate.active) return bad('the mandate is already revoked');

  const asDelegator =
    mandate.delegatorPersonId === by &&
    holdsRoleAt(world.people, mandate.organizationId, by, today);
  if (!asDelegator) {
    const noRight = requireExecute(world, mandate.organizationId, by);
    if (noRight !== null) return noRight;
  }
  if (
    isProtectedAt(
      world,
      mandate.organizationId,
      { kind: 'mandate', id: mandate.id },
      { action: 'revoke' },
      today,
    ).length > 0
  )
    return protectedBy(`mandate ${mandate.id} is protected from revocation`);

  const updated: Mandate = {
    ...mandate,
    active: false,
    revision: mandate.revision + 1,
  };
  const mandates = world.authority.mandates.map((m) =>
    m.id === mandate.id ? updated : m,
  );
  return finish(
    ctx,
    { authority: { ...world.authority, mandates } },
    [
      spec('MandateRevoked', {
        cause: 'revoked',
        actingPersonId: by,
        mandate: { ...updated },
      }),
    ],
    `${by} revokes mandate ${mandate.id}`,
    asDelegator
      ? `${by} is the delegator`
      : `${by} may execute organizational_authority`,
  );
};

const routeCreateConstraint = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const org = parseOrganization(ctx, c.organizationId);
  if (isFailure(org)) return org;
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  if (!isPlainObject(c.subject) || Object.keys(c.subject).length === 0)
    return bad('subject must be a non-empty object');
  if (
    !isPlainObject(c.prohibitedChange) ||
    Object.keys(c.prohibitedChange).length === 0
  )
    return bad('prohibitedChange must be a non-empty object');
  const amenders = c.amendableByPersonIds;
  if (
    !Array.isArray(amenders) ||
    !amenders.every((p) => isValidId(p) && hasKind(world, p, 'person')) ||
    new Set(amenders).size !== amenders.length
  )
    return bad('amendableByPersonIds must be unique existing persons');
  const validity = parseValidity(c, world.simDate);
  if (isFailure(validity)) return validity;

  const noRight = requireExecute(world, org, by);
  if (noRight !== null) return noRight;

  const minted = mintRecordId(world);
  const constraint: ProtectedConstraint = {
    id: minted.id,
    organizationId: org,
    subject: c.subject,
    prohibitedChange: c.prohibitedChange,
    originRecordId: null,
    effectiveFrom: validity.from,
    effectiveUntil: validity.until,
    amendableByPersonIds: (amenders as string[]).map(entityId).sort(),
    revision: 1,
    active: true,
  };
  const protectedConstraints = [
    ...world.authority.protectedConstraints,
    constraint,
  ].sort(byId);
  return finish(
    ctx,
    {
      authority: { ...world.authority, protectedConstraints },
      nextRecord: minted.next,
    },
    [
      spec('ProtectedConstraintCreated', {
        actingPersonId: by,
        constraint: { ...constraint },
      }),
    ],
    `${by} protects ${minted.id}`,
    `${by} may execute organizational_authority`,
  );
};

const routeAmendConstraint = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const today = world.simDate;
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  const constraint = world.authority.protectedConstraints.find(
    (p) => p.id === c.constraintId,
  );
  if (constraint === undefined)
    return bad('constraintId does not name a protected constraint');
  let active = constraint.active;
  let until = constraint.effectiveUntil;
  if (c.active !== undefined) {
    if (typeof c.active !== 'boolean') return bad('active must be a boolean');
    active = c.active;
  }
  if (c.effectiveUntil !== undefined) {
    if (c.effectiveUntil === null) until = null;
    else {
      const d = parseDate(c.effectiveUntil, 'effectiveUntil');
      if (isFailure(d)) return d;
      if (d < dayBefore(today))
        return bad('effectiveUntil cannot be before yesterday');
      until = d;
    }
  }
  if (active === constraint.active && until === constraint.effectiveUntil)
    return bad('the amendment changes nothing');

  if (
    !constraint.amendableByPersonIds.includes(by) ||
    !holdsRoleAt(world.people, constraint.organizationId, by, today)
  )
    return denied(`${by} may not amend protected constraint ${constraint.id}`);

  const updated: ProtectedConstraint = {
    ...constraint,
    active,
    effectiveUntil: until,
    revision: constraint.revision + 1,
  };
  const protectedConstraints = world.authority.protectedConstraints.map((p) =>
    p.id === constraint.id ? updated : p,
  );
  return finish(
    ctx,
    { authority: { ...world.authority, protectedConstraints } },
    [
      spec('ProtectedConstraintAmended', {
        actingPersonId: by,
        constraint: { ...updated },
      }),
    ],
    `${by} amends ${constraint.id}`,
    `${by} is an authorized amender with an active role`,
  );
};

/** Validation, authorization and pure resolution for one authority-structure command. */
export const routeAuthorityCommand = (
  ctx: RouteContext,
  command: CommandPayloadBase & { readonly type: AuthorityCommandType },
): RouteOutcome => {
  const c = command as Cmd;
  switch (command.type) {
    case 'StartRoleEpisode':
      return routeStartRole(ctx, c);
    case 'EndRoleEpisode':
      return routeEndRole(ctx, c);
    case 'GrantAuthority':
      return routeGrant(ctx, c);
    case 'RevokeAuthority':
      return routeRevokeGrant(ctx, c);
    case 'CreateMandate':
      return routeCreateMandate(ctx, c);
    case 'RevokeMandate':
      return routeRevokeMandate(ctx, c);
    case 'CreateProtectedConstraint':
      return routeCreateConstraint(ctx, c);
    case 'AmendProtectedConstraint':
      return routeAmendConstraint(ctx, c);
    default: {
      const unreachable: never = command.type;
      throw new Error(`unroutable authority command: ${String(unreachable)}`);
    }
  }
};
