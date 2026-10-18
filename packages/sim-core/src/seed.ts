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
  DECISION_CATEGORIES,
  DECISION_RIGHTS,
  type DecisionCategory,
  type DecisionRight,
} from './authority';
import { PERSON_ROLES, type PersonRole } from './people';
import {
  packageCIssues,
  parsePackageCSubstrate,
  type PackageCSubstrateSeed,
} from './packageCSeedParse';
import {
  packageDIssues,
  parsePackageDSubstrate,
  type PackageDSubstrateSeed,
} from './packageDSeedParse';
import {
  packageEIssues,
  parsePackageESubstrate,
  type PackageESubstrateSeed,
} from './packageESeedParse';
import { parseSeedId, parseSeedInterval } from './seedParsing';
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

/** A role interval for a seeded person in a seeded organization. */
export interface SeedRoleEpisode {
  readonly id: string;
  readonly personId: string;
  readonly organizationId: string;
  readonly role: PersonRole;
  readonly title: string;
  readonly startDate: string;
  /** Inclusive end date, or null while the role is held. */
  readonly endDate: string | null;
}

/** Explicit starting authority. Nothing is implied by a role alone. */
export interface SeedAuthorityGrant {
  readonly id: string;
  readonly personId: string;
  readonly organizationId: string;
  readonly category: DecisionCategory;
  readonly rights: readonly DecisionRight[];
  readonly transferable: boolean;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly sourcePersonId: string | null;
  readonly revision: number;
}

/**
 * Optional Package B block. Person/organization identity stays in `initialEntities`
 * (the stable identity registry); this block only adds roles and authority that
 * reference those entity ids.
 */
export interface OrganizationSubstrateSeed {
  readonly roleEpisodes: readonly SeedRoleEpisode[];
  readonly authorityGrants: readonly SeedAuthorityGrant[];
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
  /** Absent in Package A seeds, whose content hashes therefore never change. */
  readonly organizationSubstrate?: OrganizationSubstrateSeed;
  /** Absent in Package A/B seeds, whose content hashes therefore never change. */
  readonly packageCSubstrate?: PackageCSubstrateSeed;
  /** Absent in Package A/B/C seeds, whose content hashes therefore never change. */
  readonly packageDSubstrate?: PackageDSubstrateSeed;
  /** Absent in Package A/B/C/D seeds, whose content hashes therefore never change. */
  readonly packageESubstrate?: PackageESubstrateSeed;
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

const parseRoleEpisodes = (value: unknown): SeedRoleEpisode[] => {
  if (!Array.isArray(value))
    throw new ManifestFormatError(
      'seed.organizationSubstrate.roleEpisodes must be an array',
    );
  return value.map((raw, i) => {
    const what = `seed.organizationSubstrate.roleEpisodes[${i}]`;
    const rec = asRecord(raw, what);
    requireExactKeys(
      rec,
      [
        'id',
        'personId',
        'organizationId',
        'role',
        'title',
        'startDate',
        'endDate',
      ],
      [],
      what,
    );
    if (!(PERSON_ROLES as readonly unknown[]).includes(rec.role))
      throw new ManifestFormatError(`${what}.role is not recognized`);
    const span = parseSeedInterval(rec.startDate, rec.endDate, what);
    return {
      id: parseSeedId(rec.id, `${what}.id`),
      personId: parseSeedId(rec.personId, `${what}.personId`),
      organizationId: parseSeedId(rec.organizationId, `${what}.organizationId`),
      role: rec.role as PersonRole,
      title: asString(rec.title, `${what}.title`, 200),
      startDate: span.from,
      endDate: span.until,
    };
  });
};

const parseAuthorityGrants = (value: unknown): SeedAuthorityGrant[] => {
  if (!Array.isArray(value))
    throw new ManifestFormatError(
      'seed.organizationSubstrate.authorityGrants must be an array',
    );
  return value.map((raw, i) => {
    const what = `seed.organizationSubstrate.authorityGrants[${i}]`;
    const rec = asRecord(raw, what);
    requireExactKeys(
      rec,
      [
        'id',
        'personId',
        'organizationId',
        'category',
        'rights',
        'transferable',
        'effectiveFrom',
        'effectiveUntil',
        'sourcePersonId',
        'revision',
      ],
      [],
      what,
    );
    if (!(DECISION_CATEGORIES as readonly unknown[]).includes(rec.category))
      throw new ManifestFormatError(`${what}.category is not recognized`);
    if (!Array.isArray(rec.rights) || rec.rights.length === 0)
      throw new ManifestFormatError(`${what}.rights must be a non-empty array`);
    const rights = rec.rights.map((r: unknown) => {
      if (!(DECISION_RIGHTS as readonly unknown[]).includes(r))
        throw new ManifestFormatError(`${what}.rights has an unknown right`);
      return r as DecisionRight;
    });
    if (new Set(rights).size !== rights.length)
      throw new ManifestFormatError(`${what}.rights has duplicates`);
    if (typeof rec.transferable !== 'boolean')
      throw new ManifestFormatError(`${what}.transferable must be a boolean`);
    const span = parseSeedInterval(rec.effectiveFrom, rec.effectiveUntil, what);
    return {
      id: parseSeedId(rec.id, `${what}.id`),
      personId: parseSeedId(rec.personId, `${what}.personId`),
      organizationId: parseSeedId(rec.organizationId, `${what}.organizationId`),
      category: rec.category as DecisionCategory,
      rights,
      transferable: rec.transferable,
      effectiveFrom: span.from,
      effectiveUntil: span.until,
      sourcePersonId:
        rec.sourcePersonId === null
          ? null
          : parseSeedId(rec.sourcePersonId, `${what}.sourcePersonId`),
      revision: asSafeInt(rec.revision, `${what}.revision`, 1, 1_000_000),
    };
  });
};

const parseSubstrate = (value: unknown): OrganizationSubstrateSeed => {
  const rec = asRecord(value, 'seed.organizationSubstrate');
  requireExactKeys(
    rec,
    ['roleEpisodes', 'authorityGrants'],
    [],
    'seed.organizationSubstrate',
  );
  return {
    roleEpisodes: parseRoleEpisodes(rec.roleEpisodes),
    authorityGrants: parseAuthorityGrants(rec.authorityGrants),
  };
};

const parseBody = (rec: Record<string, unknown>): WorldSeedBody => {
  const seedId = asString(rec.seedId, 'seed.seedId', 128);
  if (!isValidId(seedId))
    throw new ManifestFormatError('seed.seedId is not a valid id');
  const startDate = asString(rec.startDate, 'seed.startDate', 10);
  if (!SimDate.isValidISO(startDate))
    throw new ManifestFormatError('seed.startDate must be a valid YYYY-MM-DD');
  const substrate =
    rec.organizationSubstrate === undefined
      ? {}
      : { organizationSubstrate: parseSubstrate(rec.organizationSubstrate) };
  const packageC =
    rec.packageCSubstrate === undefined
      ? {}
      : { packageCSubstrate: parsePackageCSubstrate(rec.packageCSubstrate) };
  const packageD =
    rec.packageDSubstrate === undefined
      ? {}
      : { packageDSubstrate: parsePackageDSubstrate(rec.packageDSubstrate) };
  const packageE =
    rec.packageESubstrate === undefined
      ? {}
      : { packageESubstrate: parsePackageESubstrate(rec.packageESubstrate) };
  return {
    ...substrate,
    ...packageC,
    ...packageD,
    ...packageE,
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
  ...(m.organizationSubstrate === undefined
    ? {}
    : { organizationSubstrate: m.organizationSubstrate }),
  ...(m.packageCSubstrate === undefined
    ? {}
    : { packageCSubstrate: m.packageCSubstrate }),
  ...(m.packageDSubstrate === undefined
    ? {}
    : { packageDSubstrate: m.packageDSubstrate }),
  ...(m.packageESubstrate === undefined
    ? {}
    : { packageESubstrate: m.packageESubstrate }),
});

export const sealSeed = (body: WorldSeedBody): WorldSeedManifest => {
  const rec = asRecord(body, 'seed body');
  requireExactKeys(
    rec,
    BODY_KEYS,
    [
      'organizationSubstrate',
      'packageCSubstrate',
      'packageDSubstrate',
      'packageESubstrate',
    ],
    'seed body',
  );
  requireSupportedSchema(rec, 'seed');
  const parsed = parseBody(rec);
  return { ...parsed, contentHash: hashCanonical(bodyOf(parsed)) };
};

export const validateSeedManifest = (value: unknown): WorldSeedManifest => {
  const rec = asRecord(value, 'seed manifest');
  requireSupportedSchema(rec, 'seed');
  requireExactKeys(
    rec,
    [...BODY_KEYS, 'contentHash'],
    [
      'organizationSubstrate',
      'packageCSubstrate',
      'packageDSubstrate',
      'packageESubstrate',
    ],
    'seed manifest',
  );
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

const END_OF_TIME = '9999-12-31';

/** Cross-reference and consistency problems in the organization substrate block. */
const substrateIssues = (seed: WorldSeedManifest): ValidationIssue[] => {
  const sub = seed.organizationSubstrate;
  if (sub === undefined) return [];
  const issues: ValidationIssue[] = [];
  const kinds = new Map(seed.initialEntities.map((e) => [e.id, e.kind]));
  const requireKind = (
    ref: string,
    expected: SeedEntityKind,
    where: string,
  ): void => {
    const kind = kinds.get(ref);
    if (kind === undefined)
      issues.push({
        code: 'SEED_SUBSTRATE_UNKNOWN_ENTITY',
        message: `${where} references unknown entity "${ref}"`,
      });
    else if (kind !== expected)
      issues.push({
        code: 'SEED_SUBSTRATE_WRONG_ENTITY_KIND',
        message: `${where} references "${ref}" as a ${expected}, but it is a ${kind}`,
      });
  };
  const seenIds = new Set<string>();
  const claimId = (id: string, where: string): void => {
    if (seenIds.has(id))
      issues.push({
        code: 'SEED_SUBSTRATE_DUPLICATE_ID',
        message: `${where} reuses record id "${id}"`,
      });
    seenIds.add(id);
  };
  for (const r of sub.roleEpisodes) {
    const where = `role episode "${r.id}"`;
    claimId(r.id, where);
    requireKind(r.personId, 'person', where);
    requireKind(r.organizationId, 'organization', where);
  }
  for (const g of sub.authorityGrants) {
    const where = `authority grant "${g.id}"`;
    claimId(g.id, where);
    requireKind(g.personId, 'person', where);
    requireKind(g.organizationId, 'organization', where);
    if (g.sourcePersonId !== null)
      requireKind(g.sourcePersonId, 'person', where);
  }
  const groups = new Map<string, SeedRoleEpisode[]>();
  for (const r of sub.roleEpisodes) {
    const key = `${r.personId}|${r.organizationId}|${r.role}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i] as SeedRoleEpisode;
        const b = group[j] as SeedRoleEpisode;
        if (
          a.startDate <= (b.endDate ?? END_OF_TIME) &&
          b.startDate <= (a.endDate ?? END_OF_TIME)
        )
          issues.push({
            code: 'SEED_SUBSTRATE_OVERLAPPING_ROLE',
            message: `role episodes "${a.id}" and "${b.id}" overlap for ${a.personId} as ${a.role} in ${a.organizationId}`,
          });
      }
    }
  }
  return issues;
};

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
    issues.push(...substrateIssues(seed));
    if (seed.packageCSubstrate !== undefined)
      issues.push(
        ...packageCIssues(
          seed.packageCSubstrate,
          seed.initialEntities,
          seed.organizationSubstrate?.roleEpisodes ?? [],
          ruleset,
        ),
      );
    if (seed.packageDSubstrate !== undefined)
      issues.push(
        ...packageDIssues(
          seed.packageDSubstrate,
          seed.initialEntities,
          (seed.packageCSubstrate?.players ?? []).map((p) => ({
            personId: p.personId,
            capabilityKeys: p.capabilities.map((c) => c.key),
          })),
          ruleset,
        ),
      );
    if (seed.packageESubstrate !== undefined)
      issues.push(
        ...packageEIssues(
          seed.packageESubstrate,
          seed.startDate,
          seed.initialEntities,
          (seed.packageCSubstrate?.players ?? []).map((p) => ({
            personId: p.personId,
            capabilityKeys: p.capabilities.map((c) => c.key),
          })),
          seed.packageDSubstrate?.roleKnowledge ?? [],
          ruleset,
        ),
      );
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
