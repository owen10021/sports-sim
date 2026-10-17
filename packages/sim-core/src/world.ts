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

export interface Entity {
  readonly id: EntityId;
  readonly kind: SeedEntityKind;
  readonly name: string;
}

/** Monotonic counters for ids minted by the kernel (never by the clock or platform). */
export interface NextIds {
  /** Ordinal (1-based) of the next event: `evt-000001`, `evt-000002`, ... */
  readonly event: number;
}

/**
 * The single authoritative football universe snapshot.
 *
 * EVERY field here is authoritative and part of the fingerprint. There are no caches,
 * presentation fields or derived values: those live outside the world and are rebuildable.
 * Instances are deeply frozen; the kernel produces new worlds rather than mutating.
 */
export interface FootballWorld {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly worldId: WorldId;
  readonly ruleset: RulesetRef;
  readonly seed: SeedRef;
  /** Timezone-free simulation date `YYYY-MM-DD`. */
  readonly simDate: string;
  readonly revision: WorldRevision;
  readonly rng: RngState;
  readonly nextIds: NextIds;
  readonly entities: readonly Entity[];
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

export const deepFreeze = <T>(value: T): T => {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value))
      deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
};

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
    worldId: worldId(idSource.newWorldId()),
    ruleset: rulesetRefOf(ruleset),
    seed: seedRefOf(seed),
    simDate: seed.startDate,
    revision: worldRevision(0),
    rng: DeterministicRng.fromSeed(seed.rngSeed32).snapshot(),
    nextIds: { event: 1 },
    entities,
  });
};

/** SHA-256 over the canonical bytes of the ENTIRE authoritative world (domain-separated). */
export const fingerprintWorld = (world: FootballWorld): string =>
  hashCanonical({ domain: 'sport-sim/world-fingerprint', version: 1, world });
