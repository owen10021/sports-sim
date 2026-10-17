import { hashCanonical, isHash } from './hash';
import { isValidId } from './ids';
import {
  ManifestFormatError,
  ManifestTamperError,
  SCHEMA_VERSION,
  UnsupportedSchemaVersionError,
  asRecord,
  asSafeInt,
  asString,
  parseProvenanceList,
  requireExactKeys,
  requireSupportedSchema,
  unacceptableProvenance,
  type SourceProvenance,
  type ValidationIssue,
  type ValidationResult,
} from './provenance';
import { SimDate } from './simDate';
import {
  validateRulesetManifest,
  type LeagueRulesetManifest,
  type RulesetRef,
} from './ruleset';

export type SeedEntityKind = 'person' | 'organization';
export const SEED_ENTITY_KINDS: readonly SeedEntityKind[] = [
  'person',
  'organization',
];

export interface SeedEntity {
  readonly id: string;
  readonly kind: SeedEntityKind;
  readonly name: string;
}

export interface SeedRef {
  readonly seedId: string;
  readonly seedVersion: number;
  readonly contentHash: string;
}

export interface WorldSeedBody {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly seedId: string;
  readonly seedVersion: number;
  /** The exact ruleset this seed was authored for (identity + version + content hash). */
  readonly ruleset: RulesetRef;
  /** Explicit RNG seed. RNG state is NOT derived incidentally from the content hash. */
  readonly rngSeed32: number;
  /** Initial simulation date (`YYYY-MM-DD`). */
  readonly startDate: string;
  readonly provenance: readonly SourceProvenance[];
  readonly initialEntities: readonly SeedEntity[];
}

export interface WorldSeedManifest extends WorldSeedBody {
  readonly contentHash: string;
}

const BODY_KEYS = [
  'schemaVersion',
  'seedId',
  'seedVersion',
  'ruleset',
  'rngSeed32',
  'startDate',
  'provenance',
  'initialEntities',
] as const;

const parseRulesetRef = (value: unknown): RulesetRef => {
  const rec = asRecord(value, 'seed.ruleset');
  requireExactKeys(
    rec,
    ['rulesetId', 'rulesetVersion', 'contentHash'],
    [],
    'seed.ruleset',
  );
  if (!isHash(rec.contentHash))
    throw new ManifestFormatError(
      'seed.ruleset.contentHash must be a sha256 hex',
    );
  return {
    rulesetId: asString(rec.rulesetId, 'seed.ruleset.rulesetId', 128),
    rulesetVersion: asSafeInt(
      rec.rulesetVersion,
      'seed.ruleset.rulesetVersion',
      1,
      1_000_000,
    ),
    contentHash: rec.contentHash,
  };
};

const parseEntities = (value: unknown): SeedEntity[] => {
  if (!Array.isArray(value))
    throw new ManifestFormatError('seed.initialEntities must be an array');
  return value.map((raw, i) => {
    const rec = asRecord(raw, `seed.initialEntities[${i}]`);
    requireExactKeys(
      rec,
      ['id', 'kind', 'name'],
      [],
      `seed.initialEntities[${i}]`,
    );
    const id = asString(rec.id, `seed.initialEntities[${i}].id`, 128);
    if (!isValidId(id))
      throw new ManifestFormatError(
        `seed.initialEntities[${i}].id is not a valid id`,
      );
    if (!(SEED_ENTITY_KINDS as readonly unknown[]).includes(rec.kind)) {
      throw new ManifestFormatError(
        `seed.initialEntities[${i}].kind is not recognized`,
      );
    }
    return {
      id,
      kind: rec.kind as SeedEntityKind,
      name: asString(rec.name, `seed.initialEntities[${i}].name`, 200),
    };
  });
};

const parseBody = (rec: Record<string, unknown>): WorldSeedBody => {
  const seedId = asString(rec.seedId, 'seed.seedId', 128);
  if (!isValidId(seedId))
    throw new ManifestFormatError('seed.seedId is not a valid id');
  const startDate = asString(rec.startDate, 'seed.startDate', 10);
  if (!SimDate.isValidISO(startDate))
    throw new ManifestFormatError('seed.startDate must be a valid YYYY-MM-DD');
  return {
    schemaVersion: SCHEMA_VERSION,
    seedId,
    seedVersion: asSafeInt(rec.seedVersion, 'seed.seedVersion', 1, 1_000_000),
    ruleset: parseRulesetRef(rec.ruleset),
    rngSeed32: asSafeInt(rec.rngSeed32, 'seed.rngSeed32', 0, 0xffffffff),
    startDate,
    provenance: parseProvenanceList(rec.provenance, 'seed.provenance'),
    initialEntities: parseEntities(rec.initialEntities),
  };
};

const bodyOf = (m: WorldSeedBody): WorldSeedBody => ({
  schemaVersion: m.schemaVersion,
  seedId: m.seedId,
  seedVersion: m.seedVersion,
  ruleset: m.ruleset,
  rngSeed32: m.rngSeed32,
  startDate: m.startDate,
  provenance: m.provenance,
  initialEntities: m.initialEntities,
});

export const sealSeed = (body: WorldSeedBody): WorldSeedManifest => {
  const rec = asRecord(body, 'seed body');
  requireExactKeys(rec, BODY_KEYS, [], 'seed body');
  requireSupportedSchema(rec, 'seed');
  const parsed = parseBody(rec);
  return { ...parsed, contentHash: hashCanonical(bodyOf(parsed)) };
};

export const validateSeedManifest = (value: unknown): WorldSeedManifest => {
  const rec = asRecord(value, 'seed manifest');
  requireSupportedSchema(rec, 'seed');
  requireExactKeys(rec, [...BODY_KEYS, 'contentHash'], [], 'seed manifest');
  const stored = rec.contentHash;
  if (!isHash(stored))
    throw new ManifestFormatError(
      'seed.contentHash must be 64 lowercase hex chars',
    );
  const parsed = parseBody(rec);
  if (hashCanonical(bodyOf(parsed)) !== stored) {
    throw new ManifestTamperError(
      `seed "${parsed.seedId}" v${parsed.seedVersion}: content hash mismatch`,
    );
  }
  return { ...parsed, contentHash: stored };
};

export const seedRefOf = (m: WorldSeedManifest): SeedRef => ({
  seedId: m.seedId,
  seedVersion: m.seedVersion,
  contentHash: m.contentHash,
});

const classify = (
  e: unknown,
  prefix: 'RULESET' | 'SEED',
  hashCode: string,
): ValidationIssue => {
  if (e instanceof UnsupportedSchemaVersionError) {
    return { code: `${prefix}_UNSUPPORTED_SCHEMA`, message: e.message };
  }
  if (e instanceof ManifestTamperError)
    return { code: hashCode, message: e.message };
  const message = e instanceof Error ? e.message : String(e);
  return { code: `${prefix}_MALFORMED`, message };
};

/**
 * A world may only be created from a seed + ruleset that are (a) structurally valid,
 * (b) untampered, (c) sourced from synthetic or verified provenance, and (d) an exact
 * seed->ruleset identity/version/hash match. Never throws; returns every issue found.
 */
export const validateForWorldCreation = (
  seedIn: unknown,
  rulesetIn: unknown,
): ValidationResult => {
  const issues: ValidationIssue[] = [];
  let ruleset: LeagueRulesetManifest | undefined;
  let seed: WorldSeedManifest | undefined;

  try {
    ruleset = validateRulesetManifest(rulesetIn);
  } catch (e) {
    issues.push(classify(e, 'RULESET', 'RULESET_HASH_MISMATCH'));
  }
  try {
    seed = validateSeedManifest(seedIn);
  } catch (e) {
    issues.push(classify(e, 'SEED', 'SEED_HASH_MISMATCH'));
  }

  if (ruleset)
    issues.push(...unacceptableProvenance(ruleset.provenance, 'ruleset'));
  if (seed) {
    issues.push(...unacceptableProvenance(seed.provenance, 'seed'));
    const seen = new Set<string>();
    for (const entity of seed.initialEntities) {
      if (seen.has(entity.id)) {
        issues.push({
          code: 'SEED_DUPLICATE_ENTITY',
          message: `duplicate initial entity id "${entity.id}"`,
        });
      }
      seen.add(entity.id);
    }
  }
  if (ruleset && seed) {
    const ref = seed.ruleset;
    if (
      ref.rulesetId !== ruleset.rulesetId ||
      ref.rulesetVersion !== ruleset.rulesetVersion ||
      ref.contentHash !== ruleset.contentHash
    ) {
      issues.push({
        code: 'SEED_RULESET_MISMATCH',
        message: `seed targets ruleset ${ref.rulesetId} v${ref.rulesetVersion} (${ref.contentHash.slice(0, 12)}), but ${ruleset.rulesetId} v${ruleset.rulesetVersion} (${ruleset.contentHash.slice(0, 12)}) was supplied`,
      });
    }
  }
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
};
