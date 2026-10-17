/**
 * Branded identifier and revision primitives.
 *
 * Brands exist only at the type level; at runtime an id is a plain string and a
 * revision a plain number, so they serialize canonically without wrappers.
 */
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type WorldId = Brand<string, 'WorldId'>;
export type EntityId = Brand<string, 'EntityId'>;
export type CommandId = Brand<string, 'CommandId'>;
export type EventId = Brand<string, 'EventId'>;
export type WorldRevision = Brand<number, 'WorldRevision'>;

/** 1-128 chars; starts alphanumeric; then alphanumerics and . _ : - */
export const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export const isValidId = (value: unknown): value is string =>
  typeof value === 'string' && ID_PATTERN.test(value);

const checkedId = (kind: string, value: string): string => {
  if (!isValidId(value)) {
    throw new TypeError(`Invalid ${kind}: must match ${ID_PATTERN.source}`);
  }
  return value;
};

export const worldId = (value: string): WorldId => checkedId('WorldId', value) as WorldId;
export const entityId = (value: string): EntityId => checkedId('EntityId', value) as EntityId;
export const commandId = (value: string): CommandId => checkedId('CommandId', value) as CommandId;
export const eventId = (value: string): EventId => checkedId('EventId', value) as EventId;

export const isValidRevision = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);

export const worldRevision = (value: number): WorldRevision => {
  if (!isValidRevision(value)) {
    throw new TypeError('Invalid WorldRevision: must be a non-negative safe integer');
  }
  return value as WorldRevision;
};

/** Who is submitting an intent. Authority is decided per command by the kernel. */
export const ACTOR_KINDS = [
  'human_gm',
  'cpu_org',
  'delegate',
  'commissioner',
  'system',
  'test_harness',
] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

export interface ActorRef {
  readonly kind: ActorKind;
  readonly id: EntityId;
}

export const isActorRef = (value: unknown): value is ActorRef => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { kind?: unknown; id?: unknown };
  return (
    typeof v.kind === 'string' &&
    (ACTOR_KINDS as readonly string[]).includes(v.kind) &&
    isValidId(v.id)
  );
};
