import { parseTransactionRulesV1, type TransactionRulesV1 } from './economy';
import {
  parseDevelopmentRulesV1,
  type DevelopmentRulesV1,
} from './developmentRules';
import { parseFootballRulesV1, type FootballRulesV1 } from './footballRules';
import { hashCanonical, isHash } from './hash';
import { isValidId } from './ids';
import {
  ManifestFormatError,
  ManifestTamperError,
  SCHEMA_VERSION,
  asRecord,
  asSafeInt,
  asString,
  parseProvenanceList,
  requireExactKeys,
  requireSupportedSchema,
  type SourceProvenance,
} from './provenance';

/** Package A ruleset content is intentionally tiny and non-football. */
export interface LeagueRules {
  /** Upper bound for one AdvanceDays command. */
  readonly maxAdvanceDaysPerCommand: number;
  /**
   * Package C transaction mechanics. OPTIONAL: Package A/B rulesets omit it and keep their
   * content hashes. Package C commands call `requireTransactionRules` and fail closed
   * when it is absent.
   */
  readonly transactions?: TransactionRulesV1;
  /**
   * Package D development rules and SYNTHETIC calibration. OPTIONAL: Package A/B/C
   * rulesets omit it and keep their content hashes. Package D commands call
   * `requireDevelopmentRules` and fail closed when it is absent.
   */
  readonly development?: DevelopmentRulesV1;
  /**
   * Package E football rules and SYNTHETIC calibration. OPTIONAL: Package A-D rulesets omit
   * it and keep their content hashes. Package E commands call `requireFootballRules` and
   * fail closed when it is absent.
   */
  readonly football?: FootballRulesV1;
}

export interface RulesetRef {
  readonly rulesetId: string;
  readonly rulesetVersion: number;
  readonly contentHash: string;
}

export interface LeagueRulesetBody {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly rulesetId: string;
  readonly rulesetVersion: number;
  readonly displayName: string;
  readonly provenance: readonly SourceProvenance[];
  readonly rules: LeagueRules;
}

export interface LeagueRulesetManifest extends LeagueRulesetBody {
  /** SHA-256 over the canonical body (every field except this one). */
  readonly contentHash: string;
}

const BODY_KEYS = [
  'schemaVersion',
  'rulesetId',
  'rulesetVersion',
  'displayName',
  'provenance',
  'rules',
] as const;

const parseBody = (rec: Record<string, unknown>): LeagueRulesetBody => {
  const rulesId = asString(rec.rulesetId, 'ruleset.rulesetId', 128);
  if (!isValidId(rulesId))
    throw new ManifestFormatError('ruleset.rulesetId is not a valid id');
  const rules = asRecord(rec.rules, 'ruleset.rules');
  requireExactKeys(
    rules,
    ['maxAdvanceDaysPerCommand'],
    ['transactions', 'development', 'football'],
    'ruleset.rules',
  );
  const transactions =
    rules.transactions === undefined
      ? undefined
      : parseTransactionRulesV1(
          rules.transactions,
          'ruleset.rules.transactions',
        );
  const development =
    rules.development === undefined
      ? undefined
      : parseDevelopmentRulesV1(rules.development, 'ruleset.rules.development');
  const football =
    rules.football === undefined
      ? undefined
      : parseFootballRulesV1(rules.football, 'ruleset.rules.football');
  return {
    schemaVersion: SCHEMA_VERSION,
    rulesetId: rulesId,
    rulesetVersion: asSafeInt(
      rec.rulesetVersion,
      'ruleset.rulesetVersion',
      1,
      1_000_000,
    ),
    displayName: asString(rec.displayName, 'ruleset.displayName', 200),
    provenance: parseProvenanceList(rec.provenance, 'ruleset.provenance'),
    rules: {
      maxAdvanceDaysPerCommand: asSafeInt(
        rules.maxAdvanceDaysPerCommand,
        'rules.maxAdvanceDaysPerCommand',
        1,
        3650,
      ),
      ...(transactions === undefined ? {} : { transactions }),
      ...(development === undefined ? {} : { development }),
      ...(football === undefined ? {} : { football }),
    },
  };
};

const bodyOf = (m: LeagueRulesetBody): LeagueRulesetBody => ({
  schemaVersion: m.schemaVersion,
  rulesetId: m.rulesetId,
  rulesetVersion: m.rulesetVersion,
  displayName: m.displayName,
  provenance: m.provenance,
  rules: m.rules,
});

/** Validate an unsealed body and attach its content hash. */
export const sealRuleset = (body: LeagueRulesetBody): LeagueRulesetManifest => {
  const rec = asRecord(body, 'ruleset body');
  requireExactKeys(rec, BODY_KEYS, [], 'ruleset body');
  requireSupportedSchema(rec, 'ruleset');
  const parsed = parseBody(rec);
  return { ...parsed, contentHash: hashCanonical(bodyOf(parsed)) };
};

/**
 * Parse + verify an untrusted manifest. Throws:
 *  - UnsupportedSchemaVersionError for a future/unknown schemaVersion,
 *  - ManifestFormatError for structural problems,
 *  - ManifestTamperError if the embedded hash does not match the body.
 */
export const validateRulesetManifest = (
  value: unknown,
): LeagueRulesetManifest => {
  const rec = asRecord(value, 'ruleset manifest');
  requireSupportedSchema(rec, 'ruleset');
  requireExactKeys(rec, [...BODY_KEYS, 'contentHash'], [], 'ruleset manifest');
  const stored = rec.contentHash;
  if (!isHash(stored))
    throw new ManifestFormatError(
      'ruleset.contentHash must be 64 lowercase hex chars',
    );
  const parsed = parseBody(rec);
  if (hashCanonical(bodyOf(parsed)) !== stored) {
    throw new ManifestTamperError(
      `ruleset "${parsed.rulesetId}" v${parsed.rulesetVersion}: content hash mismatch`,
    );
  }
  return { ...parsed, contentHash: stored };
};

export const rulesetRefOf = (m: LeagueRulesetManifest): RulesetRef => ({
  rulesetId: m.rulesetId,
  rulesetVersion: m.rulesetVersion,
  contentHash: m.contentHash,
});
