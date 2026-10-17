import {
  ManifestFormatError,
  asRecord,
  asSafeInt,
  requireExactKeys,
  type ValidationIssue,
} from './provenance';
import { parseSeedDate, parseSeedId } from './seedParsing';
import { looksLikeSummaryRating, familyOfCapability } from './developmentRules';
import type { LeagueRulesetManifest } from './ruleset';

/**
 * Optional Package D seed block: private development substrate and starting readiness.
 * Person identity stays in `initialEntities`; players come from the Package C block. There
 * is deliberately NO field here for a current capability copy, a final ceiling/destination,
 * an overall/summary rating, XP, a development tier or a coach multiplier.
 * Plain-string ids here; the world builds branded records from them.
 */
export type SeedCapabilityResponse = {
  readonly capabilityKey: string;
  readonly malleabilityBp: number;
};

export type SeedPlayerDevelopmentProfile = {
  readonly personId: string;
  readonly capabilityResponses: readonly SeedCapabilityResponse[];
  readonly processingBp: number;
  readonly adaptabilityBp: number;
  readonly recoveryBp: number;
  readonly durabilityBp: number;
};

export type SeedTeachingExpertise = {
  readonly responsibilityKey: string;
  readonly teachingBp: number;
};

export type SeedTeachingProfile = {
  readonly personId: string;
  readonly bandwidthUnits: number;
  readonly expertise: readonly SeedTeachingExpertise[];
};

export type SeedRoleKnowledge = {
  readonly playerId: string;
  readonly schemeKey: string;
  readonly responsibilityKey: string;
  readonly transferFamilyKey: string;
  readonly familiarityBp: number;
};

export type SeedReadiness = {
  readonly playerId: string;
  readonly conditioningBp: number;
  readonly acuteFatigueBp: number;
  readonly accumulatedLoadUnits: number;
};

/** Synthetic-test medical episode (the only seeded kind). */
export type SeedMedicalEpisode = {
  readonly id: string;
  readonly playerId: string;
  readonly conditionKey: string;
  readonly onsetAt: string;
  readonly affectedActionKeys: readonly string[];
  readonly initialStructuralSeverityBp: number;
  readonly recoveryResponsivenessBp: number;
  readonly baselineReinjuryRiskBp: number;
};

export type PackageDSubstrateSeed = {
  readonly playerProfiles: readonly SeedPlayerDevelopmentProfile[];
  readonly teachingProfiles: readonly SeedTeachingProfile[];
  readonly roleKnowledge: readonly SeedRoleKnowledge[];
  readonly readiness: readonly SeedReadiness[];
  readonly medicalEpisodes?: readonly SeedMedicalEpisode[];
};

const REQUIRED_KEYS = [
  'playerProfiles',
  'teachingProfiles',
  'roleKnowledge',
  'readiness',
] as const;

const arrayOf = <T>(
  value: unknown,
  what: string,
  parse: (raw: unknown, where: string) => T,
): T[] => {
  if (!Array.isArray(value))
    throw new ManifestFormatError(`${what} must be an array`);
  return value.map((raw, i) => parse(raw, `${what}[${i}]`));
};

const bp = (value: unknown, what: string): number =>
  asSafeInt(value, what, 0, 10000);

const key = (value: unknown, what: string): string => {
  const k = parseSeedId(value, what);
  if (looksLikeSummaryRating(k))
    throw new ManifestFormatError(
      `${what} "${k}" looks like a summary rating, ceiling, tier, XP or multiplier`,
    );
  return k;
};

/** Reject smuggled summary/destiny fields with a specific message before exact-key checks. */
const rejectSmuggledFields = (
  rec: Record<string, unknown>,
  allowed: readonly string[],
  what: string,
): void => {
  for (const k of Object.keys(rec))
    if (!allowed.includes(k) && looksLikeSummaryRating(k))
      throw new ManifestFormatError(
        `${what}.${k} is a forbidden summary-rating, ceiling, tier, XP or multiplier field; development is causal, not a destiny`,
      );
};

const PROFILE_KEYS = [
  'personId',
  'capabilityResponses',
  'processingBp',
  'adaptabilityBp',
  'recoveryBp',
  'durabilityBp',
] as const;

const parseResponse = (raw: unknown, what: string): SeedCapabilityResponse => {
  const rec = asRecord(raw, what);
  rejectSmuggledFields(rec, ['capabilityKey', 'malleabilityBp'], what);
  requireExactKeys(rec, ['capabilityKey', 'malleabilityBp'], [], what);
  return {
    capabilityKey: key(rec.capabilityKey, `${what}.capabilityKey`),
    malleabilityBp: bp(rec.malleabilityBp, `${what}.malleabilityBp`),
  };
};

const parseProfile = (
  raw: unknown,
  what: string,
): SeedPlayerDevelopmentProfile => {
  const rec = asRecord(raw, what);
  rejectSmuggledFields(rec, PROFILE_KEYS, what);
  requireExactKeys(rec, PROFILE_KEYS, [], what);
  const responses = arrayOf(
    rec.capabilityResponses,
    `${what}.capabilityResponses`,
    parseResponse,
  );
  if (new Set(responses.map((r) => r.capabilityKey)).size !== responses.length)
    throw new ManifestFormatError(
      `${what}.capabilityResponses has a duplicate capability key`,
    );
  return {
    personId: parseSeedId(rec.personId, `${what}.personId`),
    capabilityResponses: responses,
    processingBp: bp(rec.processingBp, `${what}.processingBp`),
    adaptabilityBp: bp(rec.adaptabilityBp, `${what}.adaptabilityBp`),
    recoveryBp: bp(rec.recoveryBp, `${what}.recoveryBp`),
    durabilityBp: bp(rec.durabilityBp, `${what}.durabilityBp`),
  };
};

const parseExpertise = (raw: unknown, what: string): SeedTeachingExpertise => {
  const rec = asRecord(raw, what);
  rejectSmuggledFields(rec, ['responsibilityKey', 'teachingBp'], what);
  requireExactKeys(rec, ['responsibilityKey', 'teachingBp'], [], what);
  return {
    responsibilityKey: key(rec.responsibilityKey, `${what}.responsibilityKey`),
    teachingBp: bp(rec.teachingBp, `${what}.teachingBp`),
  };
};

const TEACHING_KEYS = ['personId', 'bandwidthUnits', 'expertise'] as const;

const parseTeaching = (raw: unknown, what: string): SeedTeachingProfile => {
  const rec = asRecord(raw, what);
  rejectSmuggledFields(rec, TEACHING_KEYS, what);
  requireExactKeys(rec, TEACHING_KEYS, [], what);
  const expertise = arrayOf(rec.expertise, `${what}.expertise`, parseExpertise);
  if (
    new Set(expertise.map((e) => e.responsibilityKey)).size !== expertise.length
  )
    throw new ManifestFormatError(
      `${what}.expertise has a duplicate responsibility key`,
    );
  return {
    personId: parseSeedId(rec.personId, `${what}.personId`),
    bandwidthUnits: asSafeInt(
      rec.bandwidthUnits,
      `${what}.bandwidthUnits`,
      1,
      1_000_000,
    ),
    expertise,
  };
};

const ROLE_KEYS = [
  'playerId',
  'schemeKey',
  'responsibilityKey',
  'transferFamilyKey',
  'familiarityBp',
] as const;

const parseRoleKnowledge = (raw: unknown, what: string): SeedRoleKnowledge => {
  const rec = asRecord(raw, what);
  rejectSmuggledFields(rec, ROLE_KEYS, what);
  requireExactKeys(rec, ROLE_KEYS, [], what);
  return {
    playerId: parseSeedId(rec.playerId, `${what}.playerId`),
    schemeKey: key(rec.schemeKey, `${what}.schemeKey`),
    responsibilityKey: key(rec.responsibilityKey, `${what}.responsibilityKey`),
    transferFamilyKey: key(rec.transferFamilyKey, `${what}.transferFamilyKey`),
    familiarityBp: bp(rec.familiarityBp, `${what}.familiarityBp`),
  };
};

const READINESS_KEYS = [
  'playerId',
  'conditioningBp',
  'acuteFatigueBp',
  'accumulatedLoadUnits',
] as const;

const parseReadiness = (raw: unknown, what: string): SeedReadiness => {
  const rec = asRecord(raw, what);
  rejectSmuggledFields(rec, READINESS_KEYS, what);
  requireExactKeys(rec, READINESS_KEYS, [], what);
  return {
    playerId: parseSeedId(rec.playerId, `${what}.playerId`),
    conditioningBp: bp(rec.conditioningBp, `${what}.conditioningBp`),
    acuteFatigueBp: bp(rec.acuteFatigueBp, `${what}.acuteFatigueBp`),
    accumulatedLoadUnits: asSafeInt(
      rec.accumulatedLoadUnits,
      `${what}.accumulatedLoadUnits`,
      0,
      1e9,
    ),
  };
};

const EPISODE_KEYS = [
  'id',
  'playerId',
  'conditionKey',
  'onsetAt',
  'affectedActionKeys',
  'initialStructuralSeverityBp',
  'recoveryResponsivenessBp',
  'baselineReinjuryRiskBp',
] as const;

const parseEpisode = (raw: unknown, what: string): SeedMedicalEpisode => {
  const rec = asRecord(raw, what);
  requireExactKeys(rec, EPISODE_KEYS, [], what);
  const actions = arrayOf(
    rec.affectedActionKeys,
    `${what}.affectedActionKeys`,
    (r, w) => parseSeedId(r, w),
  );
  if (new Set(actions).size !== actions.length)
    throw new ManifestFormatError(
      `${what}.affectedActionKeys has a duplicate key`,
    );
  return {
    id: parseSeedId(rec.id, `${what}.id`),
    playerId: parseSeedId(rec.playerId, `${what}.playerId`),
    conditionKey: parseSeedId(rec.conditionKey, `${what}.conditionKey`),
    onsetAt: parseSeedDate(rec.onsetAt, `${what}.onsetAt`),
    affectedActionKeys: actions,
    initialStructuralSeverityBp: bp(
      rec.initialStructuralSeverityBp,
      `${what}.initialStructuralSeverityBp`,
    ),
    recoveryResponsivenessBp: bp(
      rec.recoveryResponsivenessBp,
      `${what}.recoveryResponsivenessBp`,
    ),
    baselineReinjuryRiskBp: bp(
      rec.baselineReinjuryRiskBp,
      `${what}.baselineReinjuryRiskBp`,
    ),
  };
};

/** Structural parse of the untrusted Package D block. Cross references are checked later. */
export const parsePackageDSubstrate = (
  value: unknown,
): PackageDSubstrateSeed => {
  const what = 'seed.packageDSubstrate';
  const rec = asRecord(value, what);
  rejectSmuggledFields(rec, [...REQUIRED_KEYS, 'medicalEpisodes'], what);
  requireExactKeys(rec, REQUIRED_KEYS, ['medicalEpisodes'], what);
  return {
    playerProfiles: arrayOf(
      rec.playerProfiles,
      `${what}.playerProfiles`,
      parseProfile,
    ),
    teachingProfiles: arrayOf(
      rec.teachingProfiles,
      `${what}.teachingProfiles`,
      parseTeaching,
    ),
    roleKnowledge: arrayOf(
      rec.roleKnowledge,
      `${what}.roleKnowledge`,
      parseRoleKnowledge,
    ),
    readiness: arrayOf(rec.readiness, `${what}.readiness`, parseReadiness),
    ...(rec.medicalEpisodes === undefined
      ? {}
      : {
          medicalEpisodes: arrayOf(
            rec.medicalEpisodes,
            `${what}.medicalEpisodes`,
            parseEpisode,
          ),
        }),
  };
};

// ---------------------------------------------------------------------------
// Cross-reference validation
// ---------------------------------------------------------------------------

export type PackageDEntityRef = {
  readonly id: string;
  readonly kind: 'person' | 'organization';
};

/** The Package C player facts Package D validates against (no authoritative copy kept). */
export type PackageDPlayerRef = {
  readonly personId: string;
  readonly capabilityKeys: readonly string[];
};

/** Minted record ids look like `rec-000123`; seeded ids must never collide with them. */
const MINTED_RECORD_ID = /^rec-\d+$/;

/**
 * Cross-reference and consistency problems in the Package D block. Never throws.
 * `ruleset` is the (already validated) ruleset the seed will be created with, if any.
 */
export const packageDIssues = (
  sub: PackageDSubstrateSeed,
  entities: readonly PackageDEntityRef[],
  players: readonly PackageDPlayerRef[],
  ruleset: LeagueRulesetManifest | undefined,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const add = (code: string, message: string): void => {
    issues.push({ code: `SEED_D_${code}`, message });
  };
  const kinds = new Map(entities.map((e) => [e.id, e.kind]));
  const playersById = new Map(players.map((p) => [p.personId, p]));
  const development = ruleset?.rules.development;

  if (ruleset !== undefined && development === undefined)
    add(
      'MISSING_DEVELOPMENT_RULES',
      `the seed carries a Package D block but ruleset "${ruleset.rulesetId}" declares no development rules`,
    );

  const requirePlayer = (ref: string, where: string): boolean => {
    if (!playersById.has(ref)) {
      add(
        'UNKNOWN_PLAYER',
        `${where} references "${ref}", which is not a seeded player`,
      );
      return false;
    }
    return true;
  };
  const seen = (
    set: Set<string>,
    id: string,
    code: string,
    where: string,
  ): void => {
    if (set.has(id)) add(code, `${where} is duplicated`);
    set.add(id);
  };

  const profileIds = new Set<string>();
  for (const p of sub.playerProfiles) {
    const where = `development profile for "${p.personId}"`;
    seen(profileIds, p.personId, 'DUPLICATE_PROFILE', where);
    const player = playersById.get(p.personId);
    if (!requirePlayer(p.personId, where)) continue;
    for (const r of p.capabilityResponses) {
      if (!player!.capabilityKeys.includes(r.capabilityKey))
        add(
          'UNKNOWN_CAPABILITY_RESPONSE',
          `${where} responds on "${r.capabilityKey}", which the player does not have`,
        );
      else if (
        development !== undefined &&
        familyOfCapability(development, r.capabilityKey) === undefined
      )
        add(
          'CAPABILITY_WITHOUT_FAMILY',
          `${where} responds on "${r.capabilityKey}", which no ruleset capability family covers`,
        );
    }
  }

  const teachingIds = new Set<string>();
  for (const t of sub.teachingProfiles) {
    const where = `teaching profile for "${t.personId}"`;
    seen(teachingIds, t.personId, 'DUPLICATE_TEACHING_PROFILE', where);
    const kind = kinds.get(t.personId);
    if (kind === undefined)
      add('UNKNOWN_ENTITY', `${where} references an unknown entity`);
    else if (kind !== 'person')
      add(
        'WRONG_ENTITY_KIND',
        `${where} references "${t.personId}" as a person, but it is a ${kind}`,
      );
  }

  const roleIds = new Set<string>();
  for (const k of sub.roleKnowledge) {
    const where = `role knowledge "${k.playerId}/${k.schemeKey}/${k.responsibilityKey}"`;
    seen(
      roleIds,
      `${k.playerId}|${k.schemeKey}|${k.responsibilityKey}`,
      'DUPLICATE_ROLE_KNOWLEDGE',
      where,
    );
    requirePlayer(k.playerId, where);
  }

  const readinessIds = new Set<string>();
  for (const r of sub.readiness) {
    const where = `readiness for "${r.playerId}"`;
    seen(readinessIds, r.playerId, 'DUPLICATE_READINESS', where);
    requirePlayer(r.playerId, where);
  }

  const episodeIds = new Set<string>();
  for (const e of sub.medicalEpisodes ?? []) {
    const where = `medical episode "${e.id}"`;
    seen(episodeIds, e.id, 'DUPLICATE_MEDICAL_EPISODE', where);
    if (MINTED_RECORD_ID.test(e.id))
      add(
        'RESERVED_RECORD_ID',
        `${where} uses the id shape reserved for minted records`,
      );
    requirePlayer(e.playerId, where);
  }
  return issues;
};
