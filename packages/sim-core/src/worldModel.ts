import { canonicalString } from './canonical';
import { deepFreeze } from './freeze';
import { hashCanonical } from './hash';
import { emptyAuthorityState } from './authority';
import { emptyDecisionsState } from './decisions';
import { emptyInformationState } from './information';
import { emptyOrganizationsState } from './organizations';
import { emptyPeopleState } from './people';
import { emptyPlansState } from './plans';
import { emptyRelationshipsState } from './relationships';
import type { Entity, FootballWorld } from './world';
import type { WorldId } from './ids';
import type { RulesetRef } from './ruleset';
import type { RngState } from './rng';
import type { SeedRef } from './seed';
import { SCHEMA_VERSION } from './provenance';

/**
 * Version of the AUTHORITATIVE WORLD REPRESENTATION. It is independent of the
 * manifest/persistence `SCHEMA_VERSION`: schema 1 snapshots can carry a world model 1
 * (Package A, no marker field) or world model 2 (Package B).
 */
export const WORLD_MODEL_VERSION = 2 as const;

/** The authoritative Package B collections, in canonical order. */
export const DOMAIN_STATE_KEYS = {
  people: ['persons', 'roleEpisodes'],
  organizations: ['organizations'],
  authority: ['grants', 'mandates', 'protectedConstraints'],
  information: ['claims', 'beliefs'],
  relationships: ['edges', 'effects'],
  plans: ['plans'],
  decisions: ['proposals', 'approvals', 'receipts'],
} as const;

const DOMAIN_NAMES = Object.keys(DOMAIN_STATE_KEYS) as readonly string[];

/** Package A world (model 1): exactly these fields, no `worldModelVersion`. */
export interface LegacyPackageAWorld {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly worldId: WorldId;
  readonly ruleset: RulesetRef;
  readonly seed: SeedRef;
  readonly simDate: string;
  readonly revision: FootballWorld['revision'];
  readonly rng: RngState;
  readonly nextIds: { readonly event: number };
  readonly entities: readonly Entity[];
}

/** A world exactly as stored: Package A (legacy) or current. */
export type StoredWorld = FootballWorld | LegacyPackageAWorld;

const LEGACY_KEYS: readonly string[] = [
  'schemaVersion',
  'worldId',
  'ruleset',
  'seed',
  'simDate',
  'revision',
  'rng',
  'nextIds',
  'entities',
];

const CURRENT_KEYS: readonly string[] = [
  'schemaVersion',
  'worldModelVersion',
  'worldId',
  'ruleset',
  'seed',
  'simDate',
  'revision',
  'rng',
  'nextIds',
  'entities',
  ...DOMAIN_NAMES,
];

/** A world model newer than this build understands. We never guess; we fail explicitly. */
export class UnsupportedWorldModelVersionError extends Error {
  readonly found: unknown;
  constructor(what: string, found: unknown) {
    super(
      `Unsupported ${what} world model version ${String(found)}; this build supports only world model ${WORLD_MODEL_VERSION} (and migrates Package A world model 1)`,
    );
    this.name = 'UnsupportedWorldModelVersionError';
    this.found = found;
  }
}

/** The value is neither a genuine Package A world nor a complete current world. */
export class InvalidWorldModelError extends Error {
  readonly problems: readonly string[];
  constructor(problems: readonly string[]) {
    super(`Invalid world model: ${problems.join('; ')}`);
    this.name = 'InvalidWorldModelError';
    this.problems = problems;
  }
}

const isPlain = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isCount = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 1;

const keyProblems = (
  value: Record<string, unknown>,
  expected: readonly string[],
  what: string,
): string[] => {
  const out: string[] = [];
  for (const k of expected)
    if (!(k in value) || value[k] === undefined)
      out.push(`${what}: missing "${k}"`);
  for (const k of Object.keys(value))
    if (!expected.includes(k)) out.push(`${what}: unexpected "${k}"`);
  return out;
};

/** Genuine Package A world: exactly the legacy fields and no Package B marker. */
export const isLegacyPackageAWorld = (
  value: unknown,
): value is LegacyPackageAWorld => {
  if (!isPlain(value)) return false;
  if (keyProblems(value, LEGACY_KEYS, 'world').length > 0) return false;
  if (value.schemaVersion !== SCHEMA_VERSION) return false;
  const ids = value.nextIds;
  if (!isPlain(ids) || keyProblems(ids, ['event'], 'nextIds').length > 0)
    return false;
  return (
    isCount(ids.event) &&
    typeof value.simDate === 'string' &&
    Array.isArray(value.entities) &&
    isPlain(value.rng) &&
    isPlain(value.ruleset) &&
    isPlain(value.seed)
  );
};

/** The integer world model version if it is newer than this build supports, else null. */
export const futureWorldModelVersion = (value: unknown): number | null => {
  if (!isPlain(value)) return null;
  const v = value.worldModelVersion;
  return typeof v === 'number' && Number.isInteger(v) && v > WORLD_MODEL_VERSION
    ? v
    : null;
};

/** Everything wrong with `value` as a current-model world (empty when it is valid). */
export const worldModelProblems = (value: unknown): readonly string[] => {
  if (!isPlain(value)) return ['world is not an object'];
  if (!('worldModelVersion' in value))
    return ['worldModelVersion missing: not a current-model world'];
  const problems: string[] = [];
  if (value.worldModelVersion !== WORLD_MODEL_VERSION)
    problems.push(`worldModelVersion must be ${WORLD_MODEL_VERSION}`);
  problems.push(...keyProblems(value, CURRENT_KEYS, 'world'));
  if (value.schemaVersion !== SCHEMA_VERSION)
    problems.push(`schemaVersion must be ${SCHEMA_VERSION}`);
  const ids = value.nextIds;
  if (!isPlain(ids)) problems.push('nextIds missing');
  else {
    problems.push(...keyProblems(ids, ['event', 'record'], 'nextIds'));
    if (!isCount(ids.event)) problems.push('nextIds.event invalid');
    if (!isCount(ids.record)) problems.push('nextIds.record invalid');
  }
  for (const domain of DOMAIN_NAMES) {
    const state = value[domain];
    const collections = (
      DOMAIN_STATE_KEYS as Record<string, readonly string[]>
    )[domain] as readonly string[];
    if (!isPlain(state)) {
      problems.push(`${domain}: state missing`);
      continue;
    }
    problems.push(...keyProblems(state, collections, domain));
    for (const c of collections)
      if (c in state && !Array.isArray(state[c]))
        problems.push(`${domain}.${c} must be an array`);
  }
  return problems;
};

/** Strict check for a world that must ALREADY be current (no migration). */
export const assertCurrentWorld = (value: unknown): FootballWorld => {
  const future = futureWorldModelVersion(value);
  if (future !== null)
    throw new UnsupportedWorldModelVersionError('world', future);
  const problems = worldModelProblems(value);
  if (problems.length > 0) throw new InvalidWorldModelError(problems);
  return value as FootballWorld;
};

/**
 * Package A -> Package B world model migration. Pure and deterministic: it adds empty
 * domain state and a record counter. It never touches simDate, revision, RNG, entity
 * identity, event counters or history, and it creates no event.
 */
export const migrateLegacyPackageAWorld = (
  world: LegacyPackageAWorld,
): FootballWorld => {
  if (!isLegacyPackageAWorld(world))
    throw new InvalidWorldModelError([
      'only a genuine Package A world model 1 can be migrated',
    ]);
  const w = JSON.parse(canonicalString(world)) as LegacyPackageAWorld;
  return deepFreeze({
    schemaVersion: w.schemaVersion,
    worldModelVersion: WORLD_MODEL_VERSION,
    worldId: w.worldId,
    ruleset: w.ruleset,
    seed: w.seed,
    simDate: w.simDate,
    revision: w.revision,
    rng: w.rng,
    nextIds: { event: w.nextIds.event, record: 1 },
    entities: w.entities,
    people: emptyPeopleState(),
    organizations: emptyOrganizationsState(),
    authority: emptyAuthorityState(),
    information: emptyInformationState(),
    relationships: emptyRelationshipsState(),
    plans: emptyPlansState(),
    decisions: emptyDecisionsState(),
  });
};

/**
 * THE boundary every load/resume/replay path goes through: a current world is validated
 * and returned, a Package A world is migrated, a future model throws, anything else is
 * rejected. Nothing structurally incomplete is ever accepted as current.
 */
export const requireCurrentWorld = (value: unknown): FootballWorld =>
  isLegacyPackageAWorld(value)
    ? migrateLegacyPackageAWorld(value)
    : assertCurrentWorld(value);

/** Fingerprint with Package A (world model 1) semantics. Kept byte-identical to Package A. */
export const fingerprintLegacyPackageAWorld = (
  world: LegacyPackageAWorld,
): string =>
  hashCanonical({ domain: 'sport-sim/world-fingerprint', version: 1, world });
