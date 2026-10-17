import { isValidId } from './ids';
import {
  ManifestFormatError,
  asRecord,
  asSafeInt,
  requireExactKeys,
} from './provenance';
import {
  OPPORTUNITY_RESOURCE_KEYS,
  type OpportunityResourceKey,
} from './development';

/**
 * Package D rules and synthetic calibration (`rules.development`).
 *
 * RULESET-OWNED vs CALIBRATED: structure (which resources exist, which capability keys
 * belong to which family, cadence, hard capacity) is ruleset content the simulation obeys;
 * the scale parameters (basis-point scales, age midpoints, decline rates) are CALIBRATION.
 * Every calibration in this repository is synthetic: a test boundary, never a claim about
 * how real players develop or recover, and never validated NFL empirical truth.
 *
 * OPTIONAL in the ruleset body: Package A/B/C rulesets omit it and keep their content
 * hashes. Package D commands call `requireDevelopmentRules` and fail closed when absent.
 */
export type OpportunityPoolRule = {
  readonly resourceKey: OpportunityResourceKey;
  readonly scopeKey: string;
  readonly capacityUnits: number;
};

export type CapabilityFamilyRule = {
  readonly familyKey: string;
  readonly capabilityKeys: readonly string[];
  /** Age (in days) around which this family's adaptation is strongest. */
  readonly maturationMidpointAgeDays: number;
  /** Age (in days) after which decline pressure begins for this family. */
  readonly declineOnsetAgeDays: number;
  readonly adaptationScaleBp: number;
  readonly declineScaleBpPerYear: number;
};

export type DevelopmentRulesV1 = {
  readonly modelVersion: 1;
  readonly checkpointCadenceDays: number;
  readonly opportunityPools: readonly OpportunityPoolRule[];
  readonly maxPlayerLoadUnitsPerCheckpoint: number;
  readonly recoveryUnitsPerDay: number;
  readonly roleLearningScaleBp: number;
  readonly conditioningScaleBp: number;
  readonly medicalRecoveryScaleBp: number;
  readonly capabilityFamilies: readonly CapabilityFamilyRule[];
};

/** Names that would smuggle a summary rating, ceiling, tier or multiplier into the rules. */
const FORBIDDEN_FRAGMENTS = [
  'overall',
  'ovr',
  'potential',
  'ceiling',
  'grade',
  'rating',
  'tradevalue',
  'destination',
  'destiny',
  'tier',
  'multiplier',
  'skillpoint',
  'aura',
] as const;

/** True when a key looks like a summary rating, ceiling, XP, tier or multiplier. */
export const looksLikeSummaryRating = (key: string): boolean => {
  const flat = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    flat === 'xp' ||
    flat === 'exp' ||
    FORBIDDEN_FRAGMENTS.some((f) => flat.includes(f))
  );
};

const fail = (path: string, message: string): never => {
  throw new ManifestFormatError(`${path}: ${message}`);
};

const asKey = (v: unknown, path: string): string => {
  if (typeof v !== 'string' || !isValidId(v))
    return fail(path, 'must be a valid key');
  if (looksLikeSummaryRating(v))
    return fail(
      path,
      `"${v}" looks like a summary rating, ceiling, tier, XP or multiplier`,
    );
  return v;
};

const asBp = (v: unknown, path: string): number => asSafeInt(v, path, 0, 10000);

const asArray = (v: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(v)) return fail(path, 'must be an array');
  return v as readonly unknown[];
};

const parsePool = (v: unknown, path: string): OpportunityPoolRule => {
  const r = asRecord(v, path);
  requireExactKeys(r, ['resourceKey', 'scopeKey', 'capacityUnits'], [], path);
  if (
    !(OPPORTUNITY_RESOURCE_KEYS as readonly unknown[]).includes(r.resourceKey)
  )
    fail(`${path}.resourceKey`, 'is not a recognized opportunity resource');
  return {
    resourceKey: r.resourceKey as OpportunityResourceKey,
    scopeKey: asKey(r.scopeKey, `${path}.scopeKey`),
    capacityUnits: asSafeInt(r.capacityUnits, `${path}.capacityUnits`, 1, 1e9),
  };
};

const parseFamily = (v: unknown, path: string): CapabilityFamilyRule => {
  const r = asRecord(v, path);
  requireExactKeys(
    r,
    [
      'familyKey',
      'capabilityKeys',
      'maturationMidpointAgeDays',
      'declineOnsetAgeDays',
      'adaptationScaleBp',
      'declineScaleBpPerYear',
    ],
    [],
    path,
  );
  const keys = asArray(r.capabilityKeys, `${path}.capabilityKeys`).map((k, i) =>
    asKey(k, `${path}.capabilityKeys[${i}]`),
  );
  if (keys.length === 0) fail(`${path}.capabilityKeys`, 'must not be empty');
  if (new Set(keys).size !== keys.length)
    fail(`${path}.capabilityKeys`, 'has a duplicate key');
  const midpoint = asSafeInt(
    r.maturationMidpointAgeDays,
    `${path}.maturationMidpointAgeDays`,
    1,
    60000,
  );
  const onset = asSafeInt(
    r.declineOnsetAgeDays,
    `${path}.declineOnsetAgeDays`,
    1,
    60000,
  );
  if (midpoint >= onset)
    fail(path, 'maturationMidpointAgeDays must precede declineOnsetAgeDays');
  return {
    familyKey: asKey(r.familyKey, `${path}.familyKey`),
    capabilityKeys: keys,
    maturationMidpointAgeDays: midpoint,
    declineOnsetAgeDays: onset,
    adaptationScaleBp: asBp(r.adaptationScaleBp, `${path}.adaptationScaleBp`),
    declineScaleBpPerYear: asBp(
      r.declineScaleBpPerYear,
      `${path}.declineScaleBpPerYear`,
    ),
  };
};

/** Parse + validate the untrusted `rules.development` block. Throws ManifestFormatError. */
export const parseDevelopmentRulesV1 = (
  v: unknown,
  path: string,
): DevelopmentRulesV1 => {
  const r = asRecord(v, path);
  requireExactKeys(
    r,
    [
      'modelVersion',
      'checkpointCadenceDays',
      'opportunityPools',
      'maxPlayerLoadUnitsPerCheckpoint',
      'recoveryUnitsPerDay',
      'roleLearningScaleBp',
      'conditioningScaleBp',
      'medicalRecoveryScaleBp',
      'capabilityFamilies',
    ],
    [],
    path,
  );
  if (r.modelVersion !== 1)
    fail(
      `${path}.modelVersion`,
      `unsupported development rules model version ${String(r.modelVersion)}`,
    );
  const pools = asArray(r.opportunityPools, `${path}.opportunityPools`).map(
    (p, i) => parsePool(p, `${path}.opportunityPools[${i}]`),
  );
  if (pools.length === 0) fail(`${path}.opportunityPools`, 'must not be empty');
  if (
    new Set(pools.map((p) => `${p.resourceKey}|${p.scopeKey}`)).size !==
    pools.length
  )
    fail(`${path}.opportunityPools`, 'has a duplicate resource/scope pool');
  const families = asArray(
    r.capabilityFamilies,
    `${path}.capabilityFamilies`,
  ).map((f, i) => parseFamily(f, `${path}.capabilityFamilies[${i}]`));
  if (families.length === 0)
    fail(`${path}.capabilityFamilies`, 'must not be empty');
  if (new Set(families.map((f) => f.familyKey)).size !== families.length)
    fail(`${path}.capabilityFamilies`, 'has a duplicate familyKey');
  const allKeys = families.flatMap((f) => f.capabilityKeys);
  if (new Set(allKeys).size !== allKeys.length)
    fail(
      `${path}.capabilityFamilies`,
      'a capability key belongs to more than one family',
    );
  return {
    modelVersion: 1,
    checkpointCadenceDays: asSafeInt(
      r.checkpointCadenceDays,
      `${path}.checkpointCadenceDays`,
      1,
      365,
    ),
    opportunityPools: pools,
    maxPlayerLoadUnitsPerCheckpoint: asSafeInt(
      r.maxPlayerLoadUnitsPerCheckpoint,
      `${path}.maxPlayerLoadUnitsPerCheckpoint`,
      1,
      1e9,
    ),
    recoveryUnitsPerDay: asSafeInt(
      r.recoveryUnitsPerDay,
      `${path}.recoveryUnitsPerDay`,
      0,
      1e9,
    ),
    roleLearningScaleBp: asBp(
      r.roleLearningScaleBp,
      `${path}.roleLearningScaleBp`,
    ),
    conditioningScaleBp: asBp(
      r.conditioningScaleBp,
      `${path}.conditioningScaleBp`,
    ),
    medicalRecoveryScaleBp: asBp(
      r.medicalRecoveryScaleBp,
      `${path}.medicalRecoveryScaleBp`,
    ),
    capabilityFamilies: families,
  };
};

export class MissingDevelopmentRulesError extends Error {
  constructor(rulesetId: string) {
    super(`The active ruleset "${rulesetId}" declares no development rules`);
    this.name = 'MissingDevelopmentRulesError';
  }
}

/** Fail-closed access: Package D commands never guess at missing development rules. */
export const requireDevelopmentRules = (ruleset: {
  readonly rulesetId: string;
  readonly rules: { readonly development?: DevelopmentRulesV1 };
}): DevelopmentRulesV1 => {
  const d = ruleset.rules.development;
  if (d === undefined)
    throw new MissingDevelopmentRulesError(ruleset.rulesetId);
  return d;
};

/** The capability family a capability key belongs to, or undefined. */
export const familyOfCapability = (
  rules: DevelopmentRulesV1,
  capabilityKey: string,
): CapabilityFamilyRule | undefined =>
  rules.capabilityFamilies.find((f) =>
    f.capabilityKeys.includes(capabilityKey),
  );
