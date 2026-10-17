import type { CanonicalValue, CommandPayloadBase } from './audit';
import type { EventSpec, RouteContext, RouteOutcome } from './commandRouter';
import {
  bad,
  byId,
  finish,
  hasKind,
  isFailure,
  isPlainObject,
  mintRecordIds,
  nonEmptyText,
  spec,
  type Cmd,
  type Failure,
} from './commandSupport';
import { entityId, isValidId } from './ids';
import {
  RELATIONSHIP_DIMENSIONS,
  RELATIONSHIP_LEVELS,
  findRelationshipEdge,
  orderParties,
  type RelationshipDimension,
  type RelationshipEdge,
  type RelationshipEffect,
  type RelationshipLevel,
  type RelationshipPartyRef,
} from './relationships';

export const RELATIONSHIP_COMMAND_TYPES = ['RecordRelationshipEffect'] as const;
export type RelationshipCommandType =
  (typeof RELATIONSHIP_COMMAND_TYPES)[number];

/**
 * Only these actor kinds may record relationship effects directly. Ordinary actors cannot
 * farm relationship values; domain resolvers will exercise this through the system actor.
 */
const RELATIONSHIP_EFFECT_ACTORS: ReadonlySet<string> = new Set([
  'system',
  'commissioner',
  'test_harness',
]);

const parseParty = (
  ctx: RouteContext,
  v: unknown,
  label: string,
): RelationshipPartyRef | Failure => {
  if (!isPlainObject(v)) return bad(`${label} must be an object`);
  const { kind, entityId: id } = v;
  if (kind !== 'person' && kind !== 'organization')
    return bad(`${label}.kind must be person or organization`);
  if (!isValidId(id) || !hasKind(ctx.world, id, kind))
    return bad(`${label} must name an existing ${kind}`);
  return { kind, entityId: entityId(id) };
};

interface ParsedChange {
  readonly dimension: RelationshipDimension;
  readonly to: RelationshipLevel;
}

const parseChanges = (v: unknown): readonly ParsedChange[] | Failure => {
  if (!Array.isArray(v) || v.length === 0)
    return bad('changes must be a non-empty array');
  const seen = new Set<string>();
  const out: ParsedChange[] = [];
  for (const item of v) {
    if (!isPlainObject(item)) return bad('each change must be an object');
    const { dimension, to } = item;
    if (!(RELATIONSHIP_DIMENSIONS as readonly unknown[]).includes(dimension))
      return bad('change.dimension is not a relationship dimension');
    if (!(RELATIONSHIP_LEVELS as readonly unknown[]).includes(to))
      return bad('change.to is not a relationship level');
    if (seen.has(dimension as string))
      return bad('a dimension may change once per effect');
    seen.add(dimension as string);
    out.push({
      dimension: dimension as RelationshipDimension,
      to: to as RelationshipLevel,
    });
  }
  return out;
};

const routeRecordEffect = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const a = parseParty(ctx, c.partyA, 'partyA');
  if (isFailure(a)) return a;
  const b = parseParty(ctx, c.partyB, 'partyB');
  if (isFailure(b)) return b;
  if (a.kind === b.kind && a.entityId === b.entityId)
    return bad('a relationship needs two different parties');
  if (!nonEmptyText(c.causeType, 64))
    return bad('causeType must be 1-64 characters');
  if (!isValidId(c.causeId)) return bad('causeId must be a valid id');
  const changes = parseChanges(c.changes);
  if (isFailure(changes)) return changes;

  const [partyA, partyB] = orderParties(a, b);
  const existing = findRelationshipEdge(world.relationships, partyA, partyB);
  const changed: {
    [key: string]: CanonicalValue;
  }[] = [];
  for (const change of changes) {
    const from = existing === undefined ? 'none' : existing[change.dimension];
    if (from === change.to)
      return bad(
        `${change.dimension} is already ${change.to}; nothing to record`,
      );
    changed.push({ dimension: change.dimension, from, to: change.to });
  }

  if (!RELATIONSHIP_EFFECT_ACTORS.has(ctx.actor.kind))
    return {
      ok: false,
      stage: 'authorization',
      code: 'UNAUTHORIZED_ACTOR',
      message: `${ctx.actor.kind} cannot record relationship effects directly`,
    };

  const specs: EventSpec[] = [];
  const minted = mintRecordIds(world, existing === undefined ? 2 : 1);
  const effectId = minted.ids[minted.ids.length - 1]!;
  let edge: RelationshipEdge;
  let edges = world.relationships.edges;
  if (existing === undefined) {
    edge = {
      id: minted.ids[0]!,
      partyA,
      partyB,
      trust: 'none',
      professionalRespect: 'none',
      familiarity: 'none',
      alignment: 'none',
      access: 'none',
      tension: 'none',
      createdAt: world.simDate,
      revision: 1,
    };
    specs.push(spec('RelationshipEdgeCreated', { edge: { ...edge } }));
  } else {
    edge = existing;
    edges = edges.filter((e) => e.id !== edge.id);
  }

  const updated: RelationshipEdge = changes.reduce<RelationshipEdge>(
    (acc, change) => ({ ...acc, [change.dimension]: change.to }),
    { ...edge, revision: edge.revision + 1 },
  );
  const effect: RelationshipEffect = {
    id: effectId,
    relationshipId: edge.id,
    causeType: c.causeType,
    causeId: c.causeId,
    occurredAt: world.simDate,
    changes: changed,
  };
  specs.push(
    spec('RelationshipEffectRecorded', {
      effect: { ...effect },
      relationship: { ...updated },
    }),
  );
  return finish(
    ctx,
    {
      relationships: {
        edges: [...edges, updated].sort(byId),
        effects: [...world.relationships.effects, effect].sort(byId),
      },
      nextRecord: minted.next,
    },
    specs,
    `${ctx.actor.kind} records ${changes.length} relationship change(s) on ${updated.id}`,
    `${ctx.actor.kind} may record relationship effects`,
  );
};

export const routeRelationshipCommand = (
  ctx: RouteContext,
  command: CommandPayloadBase & { readonly type: RelationshipCommandType },
): RouteOutcome => {
  switch (command.type) {
    case 'RecordRelationshipEffect':
      return routeRecordEffect(ctx, command as Cmd);
    default: {
      const unreachable: never = command.type;
      throw new Error(
        `unroutable relationship command: ${String(unreachable)}`,
      );
    }
  }
};
