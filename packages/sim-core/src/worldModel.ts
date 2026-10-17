import { canonicalString } from './canonical';
import { deepFreeze } from './freeze';
import { hashCanonical } from './hash';
import { emptyAuthorityState, type AuthorityState } from './authority';
import { emptyContractsState, type ContractsState } from './contracts';
import { emptyDevelopmentState } from './development';
import { emptyMedicalState } from './medical';
import { emptyDecisionsState, type DecisionsState } from './decisions';
import { emptyDraftState, type DraftState } from './draft';
import { emptyInformationState, type InformationState } from './information';
import { emptyMarketState, type MarketState } from './market';
import {
  emptyOrganizationsState,
  type OrganizationsState,
} from './organizations';
import { emptyPeopleState, type PeopleState } from './people';
import { emptyPlansState, type PlansState } from './plans';
import {
  emptyRelationshipsState,
  type RelationshipsState,
} from './relationships';
import { emptyRosterState, type RosterState } from './roster';
import { emptyScoutingState, type ScoutingState } from './scouting';
import type { Entity, FootballWorld } from './world';
import type { WorldId } from './ids';
import type { RulesetRef } from './ruleset';
import type { RngState } from './rng';
import type { SeedRef } from './seed';
import { SCHEMA_VERSION } from './provenance';

/**
 * Version of the AUTHORITATIVE WORLD REPRESENTATION. It is independent of the
 * manifest/persistence `SCHEMA_VERSION`: schema 1 snapshots can carry a world model 1
 * (Package A, no marker field), world model 2 (Package B), world model 3 (Package C) or
 * world model 4 (Package D).
 */
export const WORLD_MODEL_VERSION = 4 as const;

/** The authoritative Package B collections (world model 2), in canonical order. */
export const PACKAGE_B_DOMAIN_STATE_KEYS = {
  people: ['persons', 'roleEpisodes'],
  organizations: ['organizations'],
  authority: ['grants', 'mandates', 'protectedConstraints'],
  information: ['claims', 'beliefs'],
  relationships: ['edges', 'effects'],
  plans: ['plans'],
  decisions: ['proposals', 'approvals', 'receipts'],
} as const;

/** The authoritative collections of world model 3: Package B's, then Package C's. */
export const PACKAGE_C_DOMAIN_STATE_KEYS = {
  ...PACKAGE_B_DOMAIN_STATE_KEYS,
  roster: [
    'players',
    'rights',
    'memberships',
    'waivers',
    'waiverClaims',
    'waiverPriority',
  ],
  contracts: ['agreements', 'terminations'],
  market: [
    'agentClients',
    'playerPreferences',
    'inquiries',
    'tradeOffers',
    'contractOffers',
    'reservations',
    'responses',
  ],
  scouting: ['evaluatorProfiles', 'questions', 'assignments', 'reports'],
  draft: ['classes', 'picks', 'boards', 'sessions', 'selections'],
} as const;

/** The collections Package D adds in world model 4. */
export const PACKAGE_D_DOMAIN_STATE_KEYS = {
  development: [
    'playerProfiles',
    'teachingProfiles',
    'roleKnowledge',
    'readiness',
    'opportunityWindows',
    'opportunityAllocations',
    'checkpoints',
    'events',
  ],
  medical: [
    'episodes',
    'progress',
    'reports',
    'preferences',
    'recommendations',
    'clearances',
  ],
} as const;

/** The authoritative collections of the current model: Package B's, C's, then D's. */
export const DOMAIN_STATE_KEYS = {
  ...PACKAGE_C_DOMAIN_STATE_KEYS,
  ...PACKAGE_D_DOMAIN_STATE_KEYS,
} as const;

type DomainKeys = Readonly<Record<string, readonly string[]>>;

const DOMAIN_NAMES = Object.keys(DOMAIN_STATE_KEYS) as readonly string[];
const PACKAGE_B_DOMAIN_NAMES = Object.keys(
  PACKAGE_B_DOMAIN_STATE_KEYS,
) as readonly string[];
const PACKAGE_C_DOMAIN_NAMES = Object.keys(
  PACKAGE_C_DOMAIN_STATE_KEYS,
) as readonly string[];

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

/** Package B world (model 2): the Package B domains and no Package C domains. */
export interface LegacyPackageBWorld {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly worldModelVersion: 2;
  readonly worldId: WorldId;
  readonly ruleset: RulesetRef;
  readonly seed: SeedRef;
  readonly simDate: string;
  readonly revision: FootballWorld['revision'];
  readonly rng: RngState;
  readonly nextIds: { readonly event: number; readonly record: number };
  readonly entities: readonly Entity[];
  readonly people: PeopleState;
  readonly organizations: OrganizationsState;
  readonly authority: AuthorityState;
  readonly information: InformationState;
  readonly relationships: RelationshipsState;
  readonly plans: PlansState;
  readonly decisions: DecisionsState;
}

/** Package C world (model 3): the Package B and C domains and no Package D domains. */
export interface LegacyPackageCWorld {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly worldModelVersion: 3;
  readonly worldId: WorldId;
  readonly ruleset: RulesetRef;
  readonly seed: SeedRef;
  readonly simDate: string;
  readonly revision: FootballWorld['revision'];
  readonly rng: RngState;
  readonly nextIds: { readonly event: number; readonly record: number };
  readonly entities: readonly Entity[];
  readonly people: PeopleState;
  readonly organizations: OrganizationsState;
  readonly authority: AuthorityState;
  readonly information: InformationState;
  readonly relationships: RelationshipsState;
  readonly plans: PlansState;
  readonly decisions: DecisionsState;
  readonly roster: RosterState;
  readonly contracts: ContractsState;
  readonly market: MarketState;
  readonly scouting: ScoutingState;
  readonly draft: DraftState;
}

/** A world exactly as stored: Package A, B or C (legacy) or current. */
export type StoredWorld =
  | FootballWorld
  | LegacyPackageAWorld
  | LegacyPackageBWorld
  | LegacyPackageCWorld;

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

const MODEL_KEYS: readonly string[] = [
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
];

const LEGACY_B_KEYS: readonly string[] = [
  ...MODEL_KEYS,
  ...PACKAGE_B_DOMAIN_NAMES,
];

const LEGACY_C_KEYS: readonly string[] = [
  ...MODEL_KEYS,
  ...PACKAGE_C_DOMAIN_NAMES,
];

const CURRENT_KEYS: readonly string[] = [...MODEL_KEYS, ...DOMAIN_NAMES];

/** A world model newer than this build understands. We never guess; we fail explicitly. */
export class UnsupportedWorldModelVersionError extends Error {
  readonly found: unknown;
  constructor(what: string, found: unknown) {
    super(
      `Unsupported ${what} world model version ${String(found)}; this build supports only world model ${WORLD_MODEL_VERSION} (and migrates Package A world model 1, Package B world model 2 and Package C world model 3)`,
    );
    this.name = 'UnsupportedWorldModelVersionError';
    this.found = found;
  }
}

/** The value is neither a genuine legacy world nor a complete current world. */
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

/** Shape problems of a model-N world: marker, exact top-level keys, counters, domains. */
const shapeProblems = (
  value: Record<string, unknown>,
  version: number,
  topKeys: readonly string[],
  domainKeys: DomainKeys,
): readonly string[] => {
  const problems: string[] = [];
  if (value.worldModelVersion !== version)
    problems.push(`worldModelVersion must be ${version}`);
  problems.push(...keyProblems(value, topKeys, 'world'));
  if (value.schemaVersion !== SCHEMA_VERSION)
    problems.push(`schemaVersion must be ${SCHEMA_VERSION}`);
  const ids = value.nextIds;
  if (!isPlain(ids)) problems.push('nextIds missing');
  else {
    problems.push(...keyProblems(ids, ['event', 'record'], 'nextIds'));
    if (!isCount(ids.event)) problems.push('nextIds.event invalid');
    if (!isCount(ids.record)) problems.push('nextIds.record invalid');
  }
  for (const [domain, collections] of Object.entries(domainKeys)) {
    const state = value[domain];
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

/** Genuine Package B world: model marker 2, exactly the Package B domains, all well formed. */
export const isLegacyPackageBWorld = (
  value: unknown,
): value is LegacyPackageBWorld =>
  isPlain(value) &&
  value.worldModelVersion === 2 &&
  shapeProblems(value, 2, LEGACY_B_KEYS, PACKAGE_B_DOMAIN_STATE_KEYS).length ===
    0;

/** Genuine Package C world: model marker 3, exactly the Package B and C domains, all well formed. */
export const isLegacyPackageCWorld = (
  value: unknown,
): value is LegacyPackageCWorld =>
  isPlain(value) &&
  value.worldModelVersion === 3 &&
  shapeProblems(value, 3, LEGACY_C_KEYS, PACKAGE_C_DOMAIN_STATE_KEYS).length ===
    0;

/** Everything wrong with `value` as a current-model world (empty when it is valid). */
export const worldModelProblems = (value: unknown): readonly string[] => {
  if (!isPlain(value)) return ['world is not an object'];
  if (!('worldModelVersion' in value))
    return ['worldModelVersion missing: not a current-model world'];
  return shapeProblems(
    value,
    WORLD_MODEL_VERSION,
    CURRENT_KEYS,
    DOMAIN_STATE_KEYS,
  );
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
 * Package A -> Package B (model 2) step. Pure and deterministic: it adds empty Package B
 * domain state and a record counter. It never touches simDate, revision, RNG, entity
 * identity, event counters or history, and it creates no event.
 */
export const migrateLegacyPackageAWorldToModel2 = (
  world: LegacyPackageAWorld,
): LegacyPackageBWorld => {
  if (!isLegacyPackageAWorld(world))
    throw new InvalidWorldModelError([
      'only a genuine Package A world model 1 can be migrated',
    ]);
  const w = JSON.parse(canonicalString(world)) as LegacyPackageAWorld;
  return deepFreeze({
    schemaVersion: w.schemaVersion,
    worldModelVersion: 2 as const,
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
 * Package B (model 2) -> Package C (model 3). Pure, deterministic, RNG-free and
 * event-free: it adds only EMPTY Package C domain state. Every pre-C byte (world id,
 * date, revision, RNG, counters, Package B domains, history meaning) is preserved.
 */
export const migrateLegacyPackageBWorldToModel3 = (
  world: LegacyPackageBWorld,
): LegacyPackageCWorld => {
  if (!isLegacyPackageBWorld(world))
    throw new InvalidWorldModelError([
      'only a genuine Package B world model 2 can be migrated',
    ]);
  const w = JSON.parse(canonicalString(world)) as LegacyPackageBWorld;
  return deepFreeze({
    schemaVersion: w.schemaVersion,
    worldModelVersion: 3 as const,
    worldId: w.worldId,
    ruleset: w.ruleset,
    seed: w.seed,
    simDate: w.simDate,
    revision: w.revision,
    rng: w.rng,
    nextIds: { event: w.nextIds.event, record: w.nextIds.record },
    entities: w.entities,
    people: w.people,
    organizations: w.organizations,
    authority: w.authority,
    information: w.information,
    relationships: w.relationships,
    plans: w.plans,
    decisions: w.decisions,
    roster: emptyRosterState(),
    contracts: emptyContractsState(),
    market: emptyMarketState(),
    scouting: emptyScoutingState(),
    draft: emptyDraftState(),
  });
};

/**
 * Package C (model 3) -> Package D (model 4). Pure, deterministic, RNG-free and
 * event-free: it adds only EMPTY Package D domain state (development, medical). Every
 * pre-D byte (world id, date, revision, RNG, counters, Package B and C domains, history
 * meaning) is preserved.
 */
export const migrateLegacyPackageCWorld = (
  world: LegacyPackageCWorld,
): FootballWorld => {
  if (!isLegacyPackageCWorld(world))
    throw new InvalidWorldModelError([
      'only a genuine Package C world model 3 can be migrated',
    ]);
  const w = JSON.parse(canonicalString(world)) as LegacyPackageCWorld;
  return deepFreeze({
    schemaVersion: w.schemaVersion,
    worldModelVersion: WORLD_MODEL_VERSION,
    worldId: w.worldId,
    ruleset: w.ruleset,
    seed: w.seed,
    simDate: w.simDate,
    revision: w.revision,
    rng: w.rng,
    nextIds: { event: w.nextIds.event, record: w.nextIds.record },
    entities: w.entities,
    people: w.people,
    organizations: w.organizations,
    authority: w.authority,
    information: w.information,
    relationships: w.relationships,
    plans: w.plans,
    decisions: w.decisions,
    roster: w.roster,
    contracts: w.contracts,
    market: w.market,
    scouting: w.scouting,
    draft: w.draft,
    development: emptyDevelopmentState(),
    medical: emptyMedicalState(),
  });
};

/** Package B world -> current model, chaining B -> C -> D through the explicit steps. */
export const migrateLegacyPackageBWorld = (
  world: LegacyPackageBWorld,
): FootballWorld =>
  migrateLegacyPackageCWorld(migrateLegacyPackageBWorldToModel3(world));

/** Package A world -> current model, chaining A -> B -> C -> D through the explicit steps. */
export const migrateLegacyPackageAWorld = (
  world: LegacyPackageAWorld,
): FootballWorld =>
  migrateLegacyPackageBWorld(migrateLegacyPackageAWorldToModel2(world));

/**
 * THE boundary every load/resume/replay path goes through: a current world is validated
 * and returned, a Package A, B or C world is migrated, a future model throws,
 * anything else is rejected. Nothing structurally incomplete is ever accepted as current.
 */
export const requireCurrentWorld = (value: unknown): FootballWorld => {
  if (isLegacyPackageAWorld(value)) return migrateLegacyPackageAWorld(value);
  if (isLegacyPackageBWorld(value)) return migrateLegacyPackageBWorld(value);
  if (isLegacyPackageCWorld(value)) return migrateLegacyPackageCWorld(value);
  return assertCurrentWorld(value);
};

/** Fingerprint with Package A (world model 1) semantics. Kept byte-identical to Package A. */
export const fingerprintLegacyPackageAWorld = (
  world: LegacyPackageAWorld,
): string =>
  hashCanonical({ domain: 'sport-sim/world-fingerprint', version: 1, world });

/** Fingerprint with Package B (world model 2) semantics. Kept byte-identical to Package B. */
export const fingerprintLegacyPackageBWorld = (
  world: LegacyPackageBWorld,
): string =>
  hashCanonical({ domain: 'sport-sim/world-fingerprint', version: 2, world });

/** Fingerprint with Package C (world model 3) semantics. Kept byte-identical to Package C. */
export const fingerprintLegacyPackageCWorld = (
  world: LegacyPackageCWorld,
): string =>
  hashCanonical({ domain: 'sport-sim/world-fingerprint', version: 3, world });
