import { hashCanonical } from './hash';
import {
  entityId,
  worldId,
  worldRevision,
  type EntityId,
  type WorldId,
  type WorldRevision,
} from './ids';
import { SCHEMA_VERSION, type ValidationIssue } from './provenance';
import {
  rulesetRefOf,
  validateRulesetManifest,
  type RulesetRef,
} from './ruleset';
import { DeterministicRng, type RngState } from './rng';
import {
  seedRefOf,
  validateForWorldCreation,
  validateSeedManifest,
  type SeedEntityKind,
  type SeedRef,
} from './seed';
import { deepFreeze } from './freeze';
import { emptyAuthorityState, type AuthorityState } from './authority';
import { emptyDecisionsState, type DecisionsState } from './decisions';
import { emptyInformationState, type InformationState } from './information';
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
import {
  WORLD_MODEL_VERSION,
  requireCurrentWorld,
  type StoredWorld,
} from './worldModel';

export { deepFreeze };

export interface Entity {
  readonly id: EntityId;
  readonly kind: SeedEntityKind;
  readonly name: string;
}

/** Monotonic counters for ids minted by the kernel (never by the clock or platform). */
export interface NextIds {
  /** Ordinal (1-based) of the next event: `evt-000001`, `evt-000002`, ... */
  readonly event: number;
  /** Ordinal (1-based) of the next Package B domain record id. */
  readonly record: number;
}

/**
 * The single authoritative football universe snapshot.
 *
 * EVERY field here is authoritative and part of the fingerprint. There are no caches,
 * presentation fields or derived values: those live outside the world and are rebuildable.
 * Instances are deeply frozen; the kernel produces new worlds rather than mutating.
 *
 * `worldModelVersion` identifies this representation (see worldModel.ts); Package A
 * worlds (model 1) have no such field and are migrated explicitly at load time.
 */
export interface FootballWorld {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly worldModelVersion: typeof WORLD_MODEL_VERSION;
  readonly worldId: WorldId;
  readonly ruleset: RulesetRef;
  readonly seed: SeedRef;
  /** Timezone-free simulation date `YYYY-MM-DD`. */
  readonly simDate: string;
  readonly revision: WorldRevision;
  readonly rng: RngState;
  readonly nextIds: NextIds;
  readonly entities: readonly Entity[];
  readonly people: PeopleState;
  readonly organizations: OrganizationsState;
  readonly authority: AuthorityState;
  readonly information: InformationState;
  readonly relationships: RelationshipsState;
  readonly plans: PlansState;
  readonly decisions: DecisionsState;
}

/** Platform-supplied identity source (the only impure input to world creation). */
export interface IdSource {
  newWorldId(): WorldId;
}

export class WorldCreationError extends Error {
  readonly issues: readonly ValidationIssue[];
  constructor(issues: readonly ValidationIssue[]) {
    super(
      `Cannot create world: ${issues.map((i) => `${i.code} (${i.message})`).join('; ')}`,
    );
    this.name = 'WorldCreationError';
    this.issues = issues;
  }
}

export const createWorld = (
  seedIn: unknown,
  rulesetIn: unknown,
  idSource: IdSource,
): FootballWorld => {
  const verdict = validateForWorldCreation(seedIn, rulesetIn);
  if (!verdict.ok) throw new WorldCreationError(verdict.issues);
  const ruleset = validateRulesetManifest(rulesetIn);
  const seed = validateSeedManifest(seedIn);

  const entities: Entity[] = seed.initialEntities
    .map((e) => ({ id: entityId(e.id), kind: e.kind, name: e.name }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    worldModelVersion: WORLD_MODEL_VERSION,
    worldId: worldId(idSource.newWorldId()),
    ruleset: rulesetRefOf(ruleset),
    seed: seedRefOf(seed),
    simDate: seed.startDate,
    revision: worldRevision(0),
    rng: DeterministicRng.fromSeed(seed.rngSeed32).snapshot(),
    nextIds: { event: 1, record: 1 },
    entities,
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
 * SHA-256 over the canonical bytes of the ENTIRE current-model authoritative world
 * (domain-separated; version 2 = world model 2). Package A worlds use
 * `fingerprintLegacyPackageAWorld` (version 1) and are migrated before comparison.
 */
export const fingerprintWorld = (world: FootballWorld): string =>
  hashCanonical({ domain: 'sport-sim/world-fingerprint', version: 2, world });

/**
 * Fingerprint of a stored world in the CURRENT model: a Package A world is migrated first,
 * so snapshots of either generation can be compared with replayed (current) state.
 */
export const currentModelFingerprintOf = (world: StoredWorld): string =>
  fingerprintWorld(requireCurrentWorld(world));
