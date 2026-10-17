import type { CanonicalValue, CommandPayloadBase } from './audit';
import { effectiveRightsAt, type AuthorityState } from './authority';
import type { EventSpec, RouteContext, RouteOutcome } from './commandRouter';
import { entityId, isValidId, recordId, type EntityId } from './ids';
import type { InformationState } from './information';
import type { PeopleState } from './people';
import { SimDate } from './simDate';
import type { FootballWorld } from './world';

/** Shared plumbing for command routers: payload parsing, failures, id minting, resolution. */
export type Cmd = CommandPayloadBase & { readonly [key: string]: unknown };
export type Failure = Extract<RouteOutcome, { ok: false }>;

export const bad = (message: string): Failure => ({
  ok: false,
  stage: 'validation',
  code: 'INVALID_PAYLOAD',
  message,
});
export const denied = (message: string): Failure => ({
  ok: false,
  stage: 'authorization',
  code: 'INSUFFICIENT_AUTHORITY',
  message,
});
export const protectedBy = (message: string): Failure => ({
  ok: false,
  stage: 'authorization',
  code: 'PROTECTED_CONSTRAINT',
  message,
});

export const isFailure = (v: unknown): v is Failure =>
  typeof v === 'object' && v !== null && 'ok' in v;

export const byId = <T extends { readonly id: string }>(a: T, b: T): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

export const dayBefore = (date: string): string =>
  SimDate.parse(date).addDays(-1).toISO();
export const dayAfter = (date: string): string =>
  SimDate.parse(date).addDays(1).toISO();

export const isPlainObject = (
  v: unknown,
): v is { [key: string]: CanonicalValue } =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const nonEmptyText = (v: unknown, max = 200): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;

export const hasKind = (
  world: FootballWorld,
  id: string,
  kind: 'person' | 'organization',
): boolean => world.entities.some((e) => e.id === id && e.kind === kind);

export const parseDate = (v: unknown, label: string): string | Failure =>
  SimDate.isValidISO(v) ? v : bad(`${label} must be a YYYY-MM-DD date`);

/** The acting person is data in the command; the actor kind confers nothing. */
export const parseActingPerson = (
  ctx: RouteContext,
  c: Cmd,
): EntityId | Failure =>
  isValidId(c.actingPersonId) && hasKind(ctx.world, c.actingPersonId, 'person')
    ? entityId(c.actingPersonId)
    : bad('actingPersonId must name an existing person');

export const parseOrganization = (
  ctx: RouteContext,
  value: unknown,
): EntityId | Failure =>
  isValidId(value) && hasKind(ctx.world, value, 'organization')
    ? entityId(value)
    : bad('organizationId must name an existing organization');

export const requireExecute = (
  world: FootballWorld,
  organizationId: EntityId,
  personId: EntityId,
): Failure | null =>
  effectiveRightsAt(
    world,
    organizationId,
    personId,
    'organizational_authority',
    world.simDate,
  ).rights.includes('execute')
    ? null
    : denied(
        `${personId} lacks execute on organizational_authority in ${organizationId}`,
      );

/** Next free `rec-NNNNNN` id. Skips any id already used by an authoritative record. */
export const mintRecordId = (world: FootballWorld) => {
  const taken = new Set<string>([
    ...world.people.roleEpisodes.map((x) => x.id),
    ...world.authority.grants.map((x) => x.id),
    ...world.authority.mandates.map((x) => x.id),
    ...world.authority.protectedConstraints.map((x) => x.id),
    ...world.information.claims.map((x) => x.id),
    ...world.information.beliefs.map((x) => x.id),
  ]);
  let n = world.nextIds.record;
  for (;;) {
    const id = `rec-${String(n).padStart(6, '0')}`;
    n += 1;
    if (!taken.has(id)) return { id: recordId(id), next: n };
  }
};

export interface Changes {
  readonly people?: PeopleState;
  readonly authority?: AuthorityState;
  readonly information?: InformationState;
  readonly nextRecord?: number;
}

export const finish = (
  ctx: RouteContext,
  changes: Changes,
  eventSpecs: readonly EventSpec[],
  detail: string,
  authorizationDetail: string,
): RouteOutcome => ({
  ok: true,
  authorizationDetail,
  resolution: {
    nextWorld: {
      ...ctx.world,
      people: changes.people ?? ctx.world.people,
      authority: changes.authority ?? ctx.world.authority,
      information: changes.information ?? ctx.world.information,
      nextIds: {
        ...ctx.world.nextIds,
        record: changes.nextRecord ?? ctx.world.nextIds.record,
      },
    },
    eventSpecs,
    detail,
  },
});

export const spec = (
  type: string,
  payload: { [key: string]: CanonicalValue },
): EventSpec => ({
  type,
  payload,
});
