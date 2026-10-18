import { isValidId } from './ids';
import {
  ManifestFormatError,
  asRecord,
  asSafeInt,
  requireExactKeys,
} from './provenance';
import { looksLikeSummaryRating } from './developmentRules';

/**
 * Package E football rules and vocabulary (`rules.football`).
 *
 * RULESET-OWNED vs CALIBRATED: field/clock/down/scoring semantics, penalties, substitution
 * and eligibility structure, formations, personnel, concept/responsibility/action
 * vocabularies, action -> capability bindings and canonical ordering are ruleset STRUCTURE
 * the simulation obeys. The `outcome` and `injury` blocks and the exposure conversion are
 * CALIBRATION. Every calibration in this repository is SYNTHETIC: a test boundary, never a
 * claim about NFL probabilities, injury rates, player distributions or tactical value.
 *
 * Nothing here creates persistent player truth. An action only NAMES the existing Package C
 * capability keys (with integer weights) that matter to it; there is no stored ability,
 * overall, team-strength or hidden-winner field anywhere in this profile.
 *
 * OPTIONAL in the ruleset body: Package A-D rulesets omit it and keep their content hashes.
 * Package E commands call `requireFootballRules` and fail closed when it is absent.
 */
export const FOOTBALL_SIDES = [
  'offense',
  'defense',
  'kicking',
  'returning',
] as const;
export type FootballSide = (typeof FOOTBALL_SIDES)[number];

export const PLAY_CATEGORIES = [
  'run',
  'pass',
  'defense',
  'kickoff',
  'punt',
  'field_goal',
  'extra_point',
] as const;
export type PlayCategory = (typeof PLAY_CATEGORIES)[number];

/** The only nine resolution phases, in the only order they may be declared. */
export const RESOLUTION_PHASES = [
  'pre_snap_recognition',
  'assignment_execution',
  'protection_and_pressure',
  'progression_and_target',
  'coverage_and_contest',
  'ball_progression_and_result',
  'contact_and_exposure',
  'flags_and_administration',
  'clock_possession_score',
] as const;
export type ResolutionPhase = (typeof RESOLUTION_PHASES)[number];

export type FootballFieldRules = {
  readonly fieldLengthYards: number;
  readonly firstDownYards: number;
  readonly downsPerSeries: number;
  readonly kickoffYardLine: number;
  readonly touchbackYardLine: number;
  readonly safetyKickYardLine: number;
  readonly extraPointYardLine: number;
  readonly twoPointYardLine: number;
};

export type FootballClockRules = {
  readonly quartersPerGame: number;
  readonly quarterSeconds: number;
  readonly overtimePeriods: number;
  readonly overtimeSeconds: number;
  readonly timeoutsPerHalf: number;
  readonly tieAllowedAfterOvertime: boolean;
  readonly playDurations: readonly {
    readonly playCategory: PlayCategory;
    readonly minSeconds: number;
    readonly maxSeconds: number;
  }[];
};

export type FootballScoringRules = {
  readonly touchdown: number;
  readonly fieldGoal: number;
  readonly safety: number;
  readonly extraPoint: number;
  readonly twoPointConversion: number;
};

export type PenaltyEnforcement = 'dead_ball' | 'spot' | 'previous_spot';
export const PENALTY_ENFORCEMENTS: readonly PenaltyEnforcement[] = [
  'dead_ball',
  'spot',
  'previous_spot',
];

export type FootballPenaltyRule = {
  readonly penaltyKey: string;
  readonly against: 'offense' | 'defense' | 'kicking' | 'returning';
  readonly yards: number;
  readonly automaticFirstDown: boolean;
  readonly lossOfDown: boolean;
  readonly enforcement: PenaltyEnforcement;
  readonly weightBp: number;
};

export type FootballSubstitutionRules = {
  readonly playersPerSide: number;
  readonly minOffensiveLinemenOnLine: number;
  readonly eligibleReceiverRoles: readonly string[];
  readonly maxActiveGameDayPlayers: number;
};

export type FootballSchemeRule = {
  readonly schemeKey: string;
  readonly side: 'offense' | 'defense' | 'special_teams';
};

export type FootballPersonnelRule = {
  readonly personnelKey: string;
  readonly side: FootballSide;
};

export type FootballFormationSlot = {
  readonly slotKey: string;
  readonly eligibleRoles: readonly string[];
};

export type FootballFormationRule = {
  readonly formationKey: string;
  readonly side: FootballSide;
  readonly personnelKey: string;
  readonly slots: readonly FootballFormationSlot[];
};

export type FootballResponsibilityRule = {
  readonly responsibilityKey: string;
  readonly transferFamilyKey: string;
};

export type FootballCapabilityBinding = {
  readonly capabilityKey: string;
  readonly weightBp: number;
};

export type FootballParticipationPolicy = {
  /** Below this functional-readiness level the player is not eligible to attempt the action. */
  readonly minFunctionalReadinessBp: number;
  /** Role familiarity below this scales execution down; it never makes a player ineligible. */
  readonly familiarityFloorBp: number;
  readonly belowFloorExecutionScaleBp: number;
};

export type FootballActionRule = {
  readonly actionKey: string;
  readonly capabilityBindings: readonly FootballCapabilityBinding[];
  readonly responsibilityKeys: readonly string[];
  readonly participation: FootballParticipationPolicy;
};

export type FootballConceptAssignment = {
  readonly responsibilityKey: string;
  readonly actionKey: string;
  readonly slotKeys: readonly string[];
};

export type FootballConceptRule = {
  readonly conceptKey: string;
  readonly side: FootballSide;
  readonly playCategory: PlayCategory;
  readonly schemeKey: string;
  readonly formationKeys: readonly string[];
  readonly assignments: readonly FootballConceptAssignment[];
};

export type FootballMatchupEdge = {
  readonly offenseConceptKey: string;
  readonly defenseConceptKey: string;
  /** Signed synthetic tactical edge for the offense, in basis points. */
  readonly edgeBp: number;
};

export type FootballExposureConversion = {
  readonly actionKey: string;
  readonly loadUnitsPerExposure: number;
};

export type FootballOutcomeParameters = {
  readonly marginScaleBp: number;
  readonly executionNoiseBp: number;
  readonly baselineCompletionBp: number;
  readonly baselineSackBp: number;
  readonly baselineInterceptionBp: number;
  readonly baselineFumbleBp: number;
  readonly baselineRushYardsTenths: number;
  readonly baselineCompletionYardsTenths: number;
  readonly yardsPerMarginTenths: number;
  readonly maxPlayYards: number;
  readonly baselineKickMakeBp: number;
  readonly kickDistancePenaltyBpPerYard: number;
  readonly baselinePuntYards: number;
  readonly baselineKickoffYards: number;
  readonly baselineReturnYardsTenths: number;
  readonly penaltyChanceBp: number;
};

export type FootballInjuryCondition = {
  readonly conditionKey: string;
  readonly affectedActionKeys: readonly string[];
  readonly weightBp: number;
  readonly severityMinBp: number;
  readonly severityMaxBp: number;
};

export type FootballInjuryParameters = {
  /** Ruleset-declared contact classes a play participant's exposure may be tagged with. */
  readonly contactClasses: readonly string[];
  readonly baseRiskBpPerExposure: number;
  readonly fatigueRiskScaleBp: number;
  readonly durabilityProtectionScaleBp: number;
  readonly exposureRiskBpByCategory: readonly {
    readonly playCategory: PlayCategory;
    readonly riskBp: number;
  }[];
  readonly conditions: readonly FootballInjuryCondition[];
  readonly recoveryResponsivenessMinBp: number;
  readonly recoveryResponsivenessMaxBp: number;
  readonly baselineReinjuryRiskBp: number;
};

export type FootballOrderingRules = {
  readonly selectionOrder: readonly ('offense' | 'defense')[];
  readonly participantOrder: 'slot_declaration';
  readonly phaseOrder: readonly ResolutionPhase[];
};

export type FootballRulesV1 = {
  readonly modelVersion: 1;
  readonly profileKey: string;
  readonly field: FootballFieldRules;
  readonly clock: FootballClockRules;
  readonly scoring: FootballScoringRules;
  readonly penalties: readonly FootballPenaltyRule[];
  readonly substitution: FootballSubstitutionRules;
  readonly schemes: readonly FootballSchemeRule[];
  readonly personnelGroups: readonly FootballPersonnelRule[];
  readonly formations: readonly FootballFormationRule[];
  readonly responsibilities: readonly FootballResponsibilityRule[];
  readonly actions: readonly FootballActionRule[];
  readonly concepts: readonly FootballConceptRule[];
  readonly matchupEdges: readonly FootballMatchupEdge[];
  readonly exposureConversion: readonly FootballExposureConversion[];
  readonly outcome: FootballOutcomeParameters;
  readonly injury: FootballInjuryParameters;
  readonly ordering: FootballOrderingRules;
};

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

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

const asSignedBp = (v: unknown, path: string): number =>
  asSafeInt(v, path, -10000, 10000);

const asBool = (v: unknown, path: string): boolean => {
  if (typeof v !== 'boolean') return fail(path, 'must be a boolean');
  return v;
};

const asArray = (v: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(v)) return fail(path, 'must be an array');
  return v as readonly unknown[];
};

const oneOf = <T extends string>(
  v: unknown,
  allowed: readonly T[],
  path: string,
): T => {
  if (!(allowed as readonly unknown[]).includes(v))
    return fail(path, `"${String(v)}" is not recognized`);
  return v as T;
};

const keyList = (v: unknown, path: string): string[] => {
  const keys = asArray(v, path).map((k, i) => asKey(k, `${path}[${i}]`));
  if (new Set(keys).size !== keys.length) fail(path, 'has a duplicate key');
  return keys;
};

const uniqueBy = <T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  path: string,
  what: string,
): void => {
  const seen = new Set<string>();
  for (const item of items) {
    const k = keyOf(item);
    if (seen.has(k)) fail(path, `has a duplicate ${what} "${k}"`);
    seen.add(k);
  }
};

const parseField = (v: unknown, path: string): FootballFieldRules => {
  const r = asRecord(v, path);
  requireExactKeys(
    r,
    [
      'fieldLengthYards',
      'firstDownYards',
      'downsPerSeries',
      'kickoffYardLine',
      'touchbackYardLine',
      'safetyKickYardLine',
      'extraPointYardLine',
      'twoPointYardLine',
    ],
    [],
    path,
  );
  const yard = (k: keyof FootballFieldRules, lo: number, hi: number): number =>
    asSafeInt(r[k], `${path}.${k}`, lo, hi);
  return {
    fieldLengthYards: yard('fieldLengthYards', 50, 120),
    firstDownYards: yard('firstDownYards', 1, 20),
    downsPerSeries: yard('downsPerSeries', 1, 10),
    kickoffYardLine: yard('kickoffYardLine', 1, 99),
    touchbackYardLine: yard('touchbackYardLine', 1, 99),
    safetyKickYardLine: yard('safetyKickYardLine', 1, 99),
    extraPointYardLine: yard('extraPointYardLine', 1, 99),
    twoPointYardLine: yard('twoPointYardLine', 1, 99),
  };
};

const parseClock = (v: unknown, path: string): FootballClockRules => {
  const r = asRecord(v, path);
  requireExactKeys(
    r,
    [
      'quartersPerGame',
      'quarterSeconds',
      'overtimePeriods',
      'overtimeSeconds',
      'timeoutsPerHalf',
      'tieAllowedAfterOvertime',
      'playDurations',
    ],
    [],
    path,
  );
  const durations = asArray(r.playDurations, `${path}.playDurations`).map(
    (d, i) => {
      const w = `${path}.playDurations[${i}]`;
      const rec = asRecord(d, w);
      requireExactKeys(
        rec,
        ['playCategory', 'minSeconds', 'maxSeconds'],
        [],
        w,
      );
      const min = asSafeInt(rec.minSeconds, `${w}.minSeconds`, 0, 120);
      const max = asSafeInt(rec.maxSeconds, `${w}.maxSeconds`, 0, 120);
      if (min > max) fail(w, 'minSeconds must not exceed maxSeconds');
      return {
        playCategory: oneOf(
          rec.playCategory,
          PLAY_CATEGORIES,
          `${w}.playCategory`,
        ),
        minSeconds: min,
        maxSeconds: max,
      };
    },
  );
  uniqueBy(
    durations,
    (d) => d.playCategory,
    `${path}.playDurations`,
    'category',
  );
  for (const c of PLAY_CATEGORIES)
    if (!durations.some((d) => d.playCategory === c))
      fail(`${path}.playDurations`, `has no duration for play category "${c}"`);
  return {
    quartersPerGame: asSafeInt(
      r.quartersPerGame,
      `${path}.quartersPerGame`,
      2,
      8,
    ),
    quarterSeconds: asSafeInt(
      r.quarterSeconds,
      `${path}.quarterSeconds`,
      60,
      3600,
    ),
    overtimePeriods: asSafeInt(
      r.overtimePeriods,
      `${path}.overtimePeriods`,
      0,
      4,
    ),
    overtimeSeconds: asSafeInt(
      r.overtimeSeconds,
      `${path}.overtimeSeconds`,
      0,
      3600,
    ),
    timeoutsPerHalf: asSafeInt(
      r.timeoutsPerHalf,
      `${path}.timeoutsPerHalf`,
      0,
      10,
    ),
    tieAllowedAfterOvertime: asBool(
      r.tieAllowedAfterOvertime,
      `${path}.tieAllowedAfterOvertime`,
    ),
    playDurations: durations,
  };
};

const parseScoring = (v: unknown, path: string): FootballScoringRules => {
  const r = asRecord(v, path);
  requireExactKeys(
    r,
    ['touchdown', 'fieldGoal', 'safety', 'extraPoint', 'twoPointConversion'],
    [],
    path,
  );
  const pts = (k: keyof FootballScoringRules): number =>
    asSafeInt(r[k], `${path}.${k}`, 1, 20);
  return {
    touchdown: pts('touchdown'),
    fieldGoal: pts('fieldGoal'),
    safety: pts('safety'),
    extraPoint: pts('extraPoint'),
    twoPointConversion: pts('twoPointConversion'),
  };
};

const PENALTY_SIDES = ['offense', 'defense', 'kicking', 'returning'] as const;

const parsePenalty = (v: unknown, path: string): FootballPenaltyRule => {
  const r = asRecord(v, path);
  requireExactKeys(
    r,
    [
      'penaltyKey',
      'against',
      'yards',
      'automaticFirstDown',
      'lossOfDown',
      'enforcement',
      'weightBp',
    ],
    [],
    path,
  );
  return {
    penaltyKey: asKey(r.penaltyKey, `${path}.penaltyKey`),
    against: oneOf(r.against, PENALTY_SIDES, `${path}.against`),
    yards: asSafeInt(r.yards, `${path}.yards`, 0, 50),
    automaticFirstDown: asBool(
      r.automaticFirstDown,
      `${path}.automaticFirstDown`,
    ),
    lossOfDown: asBool(r.lossOfDown, `${path}.lossOfDown`),
    enforcement: oneOf(
      r.enforcement,
      PENALTY_ENFORCEMENTS,
      `${path}.enforcement`,
    ),
    weightBp: asSafeInt(r.weightBp, `${path}.weightBp`, 1, 10000),
  };
};

const parseSubstitution = (
  v: unknown,
  path: string,
): FootballSubstitutionRules => {
  const r = asRecord(v, path);
  requireExactKeys(
    r,
    [
      'playersPerSide',
      'minOffensiveLinemenOnLine',
      'eligibleReceiverRoles',
      'maxActiveGameDayPlayers',
    ],
    [],
    path,
  );
  const roles = keyList(
    r.eligibleReceiverRoles,
    `${path}.eligibleReceiverRoles`,
  );
  if (roles.length === 0)
    fail(`${path}.eligibleReceiverRoles`, 'must not be empty');
  const playersPerSide = asSafeInt(
    r.playersPerSide,
    `${path}.playersPerSide`,
    1,
    11,
  );
  const maxActive = asSafeInt(
    r.maxActiveGameDayPlayers,
    `${path}.maxActiveGameDayPlayers`,
    1,
    100,
  );
  if (maxActive < playersPerSide)
    fail(path, 'maxActiveGameDayPlayers must cover a full side');
  return {
    playersPerSide,
    minOffensiveLinemenOnLine: asSafeInt(
      r.minOffensiveLinemenOnLine,
      `${path}.minOffensiveLinemenOnLine`,
      0,
      11,
    ),
    eligibleReceiverRoles: roles,
    maxActiveGameDayPlayers: maxActive,
  };
};

const SCHEME_SIDES = ['offense', 'defense', 'special_teams'] as const;

const parseScheme = (v: unknown, path: string): FootballSchemeRule => {
  const r = asRecord(v, path);
  requireExactKeys(r, ['schemeKey', 'side'], [], path);
  return {
    schemeKey: asKey(r.schemeKey, `${path}.schemeKey`),
    side: oneOf(r.side, SCHEME_SIDES, `${path}.side`),
  };
};

const parsePersonnel = (v: unknown, path: string): FootballPersonnelRule => {
  const r = asRecord(v, path);
  requireExactKeys(r, ['personnelKey', 'side'], [], path);
  return {
    personnelKey: asKey(r.personnelKey, `${path}.personnelKey`),
    side: oneOf(r.side, FOOTBALL_SIDES, `${path}.side`),
  };
};

const parseFormation = (v: unknown, path: string): FootballFormationRule => {
  const r = asRecord(v, path);
  requireExactKeys(
    r,
    ['formationKey', 'side', 'personnelKey', 'slots'],
    [],
    path,
  );
  const slots = asArray(r.slots, `${path}.slots`).map((s, i) => {
    const w = `${path}.slots[${i}]`;
    const rec = asRecord(s, w);
    requireExactKeys(rec, ['slotKey', 'eligibleRoles'], [], w);
    const roles = keyList(rec.eligibleRoles, `${w}.eligibleRoles`);
    if (roles.length === 0) fail(`${w}.eligibleRoles`, 'must not be empty');
    return {
      slotKey: asKey(rec.slotKey, `${w}.slotKey`),
      eligibleRoles: roles,
    };
  });
  uniqueBy(slots, (s) => s.slotKey, `${path}.slots`, 'slotKey');
  return {
    formationKey: asKey(r.formationKey, `${path}.formationKey`),
    side: oneOf(r.side, FOOTBALL_SIDES, `${path}.side`),
    personnelKey: asKey(r.personnelKey, `${path}.personnelKey`),
    slots,
  };
};

const parseResponsibility = (
  v: unknown,
  path: string,
): FootballResponsibilityRule => {
  const r = asRecord(v, path);
  requireExactKeys(r, ['responsibilityKey', 'transferFamilyKey'], [], path);
  return {
    responsibilityKey: asKey(r.responsibilityKey, `${path}.responsibilityKey`),
    transferFamilyKey: asKey(r.transferFamilyKey, `${path}.transferFamilyKey`),
  };
};

const parseAction = (v: unknown, path: string): FootballActionRule => {
  const r = asRecord(v, path);
  requireExactKeys(
    r,
    ['actionKey', 'capabilityBindings', 'responsibilityKeys', 'participation'],
    [],
    path,
  );
  const bindings = asArray(
    r.capabilityBindings,
    `${path}.capabilityBindings`,
  ).map((b, i) => {
    const w = `${path}.capabilityBindings[${i}]`;
    const rec = asRecord(b, w);
    requireExactKeys(rec, ['capabilityKey', 'weightBp'], [], w);
    return {
      capabilityKey: asKey(rec.capabilityKey, `${w}.capabilityKey`),
      weightBp: asSafeInt(rec.weightBp, `${w}.weightBp`, 0, 10000),
    };
  });
  if (bindings.length === 0)
    fail(`${path}.capabilityBindings`, 'must not be empty');
  uniqueBy(
    bindings,
    (b) => b.capabilityKey,
    `${path}.capabilityBindings`,
    'capability',
  );
  const total = bindings.reduce((s, b) => s + b.weightBp, 0);
  if (total !== 10000)
    fail(
      `${path}.capabilityBindings`,
      `weights must sum to exactly 10000 basis points, got ${total}`,
    );
  const responsibilityKeys = keyList(
    r.responsibilityKeys,
    `${path}.responsibilityKeys`,
  );
  if (responsibilityKeys.length === 0)
    fail(`${path}.responsibilityKeys`, 'must not be empty');
  const p = asRecord(r.participation, `${path}.participation`);
  requireExactKeys(
    p,
    [
      'minFunctionalReadinessBp',
      'familiarityFloorBp',
      'belowFloorExecutionScaleBp',
    ],
    [],
    `${path}.participation`,
  );
  return {
    actionKey: asKey(r.actionKey, `${path}.actionKey`),
    capabilityBindings: bindings,
    responsibilityKeys,
    participation: {
      minFunctionalReadinessBp: asBp(
        p.minFunctionalReadinessBp,
        `${path}.participation.minFunctionalReadinessBp`,
      ),
      familiarityFloorBp: asBp(
        p.familiarityFloorBp,
        `${path}.participation.familiarityFloorBp`,
      ),
      belowFloorExecutionScaleBp: asBp(
        p.belowFloorExecutionScaleBp,
        `${path}.participation.belowFloorExecutionScaleBp`,
      ),
    },
  };
};

const parseConcept = (v: unknown, path: string): FootballConceptRule => {
  const r = asRecord(v, path);
  requireExactKeys(
    r,
    [
      'conceptKey',
      'side',
      'playCategory',
      'schemeKey',
      'formationKeys',
      'assignments',
    ],
    [],
    path,
  );
  const formationKeys = keyList(r.formationKeys, `${path}.formationKeys`);
  if (formationKeys.length === 0)
    fail(`${path}.formationKeys`, 'must not be empty');
  const assignments = asArray(r.assignments, `${path}.assignments`).map(
    (a, i) => {
      const w = `${path}.assignments[${i}]`;
      const rec = asRecord(a, w);
      requireExactKeys(
        rec,
        ['responsibilityKey', 'actionKey', 'slotKeys'],
        [],
        w,
      );
      const slotKeys = keyList(rec.slotKeys, `${w}.slotKeys`);
      if (slotKeys.length === 0) fail(`${w}.slotKeys`, 'must not be empty');
      return {
        responsibilityKey: asKey(
          rec.responsibilityKey,
          `${w}.responsibilityKey`,
        ),
        actionKey: asKey(rec.actionKey, `${w}.actionKey`),
        slotKeys,
      };
    },
  );
  if (assignments.length === 0)
    fail(`${path}.assignments`, 'must not be empty');
  return {
    conceptKey: asKey(r.conceptKey, `${path}.conceptKey`),
    side: oneOf(r.side, FOOTBALL_SIDES, `${path}.side`),
    playCategory: oneOf(
      r.playCategory,
      PLAY_CATEGORIES,
      `${path}.playCategory`,
    ),
    schemeKey: asKey(r.schemeKey, `${path}.schemeKey`),
    formationKeys,
    assignments,
  };
};

const parseEdge = (v: unknown, path: string): FootballMatchupEdge => {
  const r = asRecord(v, path);
  requireExactKeys(
    r,
    ['offenseConceptKey', 'defenseConceptKey', 'edgeBp'],
    [],
    path,
  );
  return {
    offenseConceptKey: asKey(r.offenseConceptKey, `${path}.offenseConceptKey`),
    defenseConceptKey: asKey(r.defenseConceptKey, `${path}.defenseConceptKey`),
    edgeBp: asSignedBp(r.edgeBp, `${path}.edgeBp`),
  };
};

const parseExposure = (
  v: unknown,
  path: string,
): FootballExposureConversion => {
  const r = asRecord(v, path);
  requireExactKeys(r, ['actionKey', 'loadUnitsPerExposure'], [], path);
  return {
    actionKey: asKey(r.actionKey, `${path}.actionKey`),
    loadUnitsPerExposure: asSafeInt(
      r.loadUnitsPerExposure,
      `${path}.loadUnitsPerExposure`,
      0,
      1000,
    ),
  };
};

const OUTCOME_KEYS = [
  'marginScaleBp',
  'executionNoiseBp',
  'baselineCompletionBp',
  'baselineSackBp',
  'baselineInterceptionBp',
  'baselineFumbleBp',
  'baselineRushYardsTenths',
  'baselineCompletionYardsTenths',
  'yardsPerMarginTenths',
  'maxPlayYards',
  'baselineKickMakeBp',
  'kickDistancePenaltyBpPerYard',
  'baselinePuntYards',
  'baselineKickoffYards',
  'baselineReturnYardsTenths',
  'penaltyChanceBp',
] as const;

const parseOutcome = (v: unknown, path: string): FootballOutcomeParameters => {
  const r = asRecord(v, path);
  requireExactKeys(r, OUTCOME_KEYS, [], path);
  const n = (
    k: (typeof OUTCOME_KEYS)[number],
    lo: number,
    hi: number,
  ): number => asSafeInt(r[k], `${path}.${k}`, lo, hi);
  return {
    marginScaleBp: n('marginScaleBp', 1, 100000),
    executionNoiseBp: n('executionNoiseBp', 0, 10000),
    baselineCompletionBp: n('baselineCompletionBp', 0, 10000),
    baselineSackBp: n('baselineSackBp', 0, 10000),
    baselineInterceptionBp: n('baselineInterceptionBp', 0, 10000),
    baselineFumbleBp: n('baselineFumbleBp', 0, 10000),
    baselineRushYardsTenths: n('baselineRushYardsTenths', 0, 1000),
    baselineCompletionYardsTenths: n('baselineCompletionYardsTenths', 0, 1000),
    yardsPerMarginTenths: n('yardsPerMarginTenths', 0, 1000),
    maxPlayYards: n('maxPlayYards', 1, 100),
    baselineKickMakeBp: n('baselineKickMakeBp', 0, 10000),
    kickDistancePenaltyBpPerYard: n('kickDistancePenaltyBpPerYard', 0, 1000),
    baselinePuntYards: n('baselinePuntYards', 1, 100),
    baselineKickoffYards: n('baselineKickoffYards', 1, 100),
    baselineReturnYardsTenths: n('baselineReturnYardsTenths', 0, 1000),
    penaltyChanceBp: n('penaltyChanceBp', 0, 10000),
  };
};

const parseInjury = (v: unknown, path: string): FootballInjuryParameters => {
  const r = asRecord(v, path);
  requireExactKeys(
    r,
    [
      'contactClasses',
      'baseRiskBpPerExposure',
      'fatigueRiskScaleBp',
      'durabilityProtectionScaleBp',
      'exposureRiskBpByCategory',
      'conditions',
      'recoveryResponsivenessMinBp',
      'recoveryResponsivenessMaxBp',
      'baselineReinjuryRiskBp',
    ],
    [],
    path,
  );
  const byCategory = asArray(
    r.exposureRiskBpByCategory,
    `${path}.exposureRiskBpByCategory`,
  ).map((c, i) => {
    const w = `${path}.exposureRiskBpByCategory[${i}]`;
    const rec = asRecord(c, w);
    requireExactKeys(rec, ['playCategory', 'riskBp'], [], w);
    return {
      playCategory: oneOf(
        rec.playCategory,
        PLAY_CATEGORIES,
        `${w}.playCategory`,
      ),
      // A relative exposure scale: 10000 is the base risk, so it may exceed one whole.
      riskBp: asSafeInt(rec.riskBp, `${w}.riskBp`, 0, 100000),
    };
  });
  uniqueBy(
    byCategory,
    (c) => c.playCategory,
    `${path}.exposureRiskBpByCategory`,
    'category',
  );
  for (const c of PLAY_CATEGORIES)
    if (!byCategory.some((b) => b.playCategory === c))
      fail(
        `${path}.exposureRiskBpByCategory`,
        `has no exposure risk for play category "${c}"`,
      );
  const conditions = asArray(r.conditions, `${path}.conditions`).map((c, i) => {
    const w = `${path}.conditions[${i}]`;
    const rec = asRecord(c, w);
    requireExactKeys(
      rec,
      [
        'conditionKey',
        'affectedActionKeys',
        'weightBp',
        'severityMinBp',
        'severityMaxBp',
      ],
      [],
      w,
    );
    const min = asBp(rec.severityMinBp, `${w}.severityMinBp`);
    const max = asBp(rec.severityMaxBp, `${w}.severityMaxBp`);
    if (min > max) fail(w, 'severityMinBp must not exceed severityMaxBp');
    const affected = keyList(rec.affectedActionKeys, `${w}.affectedActionKeys`);
    if (affected.length === 0)
      fail(`${w}.affectedActionKeys`, 'must not be empty');
    return {
      conditionKey: asKey(rec.conditionKey, `${w}.conditionKey`),
      affectedActionKeys: affected,
      weightBp: asSafeInt(rec.weightBp, `${w}.weightBp`, 1, 10000),
      severityMinBp: min,
      severityMaxBp: max,
    };
  });
  if (conditions.length === 0) fail(`${path}.conditions`, 'must not be empty');
  uniqueBy(
    conditions,
    (c) => c.conditionKey,
    `${path}.conditions`,
    'condition',
  );
  const respMin = asBp(
    r.recoveryResponsivenessMinBp,
    `${path}.recoveryResponsivenessMinBp`,
  );
  const respMax = asBp(
    r.recoveryResponsivenessMaxBp,
    `${path}.recoveryResponsivenessMaxBp`,
  );
  if (respMin > respMax)
    fail(
      path,
      'recoveryResponsivenessMinBp must not exceed recoveryResponsivenessMaxBp',
    );
  const contactClasses = keyList(r.contactClasses, `${path}.contactClasses`);
  if (contactClasses.length === 0)
    fail(`${path}.contactClasses`, 'must not be empty');
  return {
    contactClasses,
    baseRiskBpPerExposure: asBp(
      r.baseRiskBpPerExposure,
      `${path}.baseRiskBpPerExposure`,
    ),
    fatigueRiskScaleBp: asBp(
      r.fatigueRiskScaleBp,
      `${path}.fatigueRiskScaleBp`,
    ),
    durabilityProtectionScaleBp: asBp(
      r.durabilityProtectionScaleBp,
      `${path}.durabilityProtectionScaleBp`,
    ),
    exposureRiskBpByCategory: byCategory,
    conditions,
    recoveryResponsivenessMinBp: respMin,
    recoveryResponsivenessMaxBp: respMax,
    baselineReinjuryRiskBp: asBp(
      r.baselineReinjuryRiskBp,
      `${path}.baselineReinjuryRiskBp`,
    ),
  };
};

const parseOrdering = (v: unknown, path: string): FootballOrderingRules => {
  const r = asRecord(v, path);
  requireExactKeys(
    r,
    ['selectionOrder', 'participantOrder', 'phaseOrder'],
    [],
    path,
  );
  const selection = asArray(r.selectionOrder, `${path}.selectionOrder`).map(
    (s, i) =>
      oneOf(s, ['offense', 'defense'] as const, `${path}.selectionOrder[${i}]`),
  );
  if (selection.length !== 2 || new Set(selection).size !== 2)
    fail(
      `${path}.selectionOrder`,
      'must list offense and defense exactly once',
    );
  const participantOrder = oneOf(
    r.participantOrder,
    ['slot_declaration'] as const,
    `${path}.participantOrder`,
  );
  const phases = asArray(r.phaseOrder, `${path}.phaseOrder`);
  if (
    phases.length !== RESOLUTION_PHASES.length ||
    phases.some((p, i) => p !== RESOLUTION_PHASES[i])
  )
    fail(
      `${path}.phaseOrder`,
      `must be exactly: ${RESOLUTION_PHASES.join(', ')}`,
    );
  return {
    selectionOrder: selection,
    participantOrder,
    phaseOrder: [...RESOLUTION_PHASES],
  };
};

const list = <T>(
  v: unknown,
  path: string,
  parse: (item: unknown, where: string) => T,
): T[] => {
  const items = asArray(v, path);
  if (items.length === 0) fail(path, 'must not be empty');
  return items.map((item, i) => parse(item, `${path}[${i}]`));
};

/** Parse + validate the untrusted `rules.football` block. Throws ManifestFormatError. */
export const parseFootballRulesV1 = (
  v: unknown,
  path: string,
): FootballRulesV1 => {
  const r = asRecord(v, path);
  requireExactKeys(
    r,
    [
      'modelVersion',
      'profileKey',
      'field',
      'clock',
      'scoring',
      'penalties',
      'substitution',
      'schemes',
      'personnelGroups',
      'formations',
      'responsibilities',
      'actions',
      'concepts',
      'matchupEdges',
      'exposureConversion',
      'outcome',
      'injury',
      'ordering',
    ],
    [],
    path,
  );
  if (r.modelVersion !== 1)
    fail(
      `${path}.modelVersion`,
      `unsupported football rules model version ${String(r.modelVersion)}`,
    );
  const penalties = list(r.penalties, `${path}.penalties`, parsePenalty);
  uniqueBy(penalties, (p) => p.penaltyKey, `${path}.penalties`, 'penaltyKey');
  const schemes = list(r.schemes, `${path}.schemes`, parseScheme);
  uniqueBy(schemes, (s) => s.schemeKey, `${path}.schemes`, 'schemeKey');
  const personnelGroups = list(
    r.personnelGroups,
    `${path}.personnelGroups`,
    parsePersonnel,
  );
  uniqueBy(
    personnelGroups,
    (p) => p.personnelKey,
    `${path}.personnelGroups`,
    'personnelKey',
  );
  const formations = list(r.formations, `${path}.formations`, parseFormation);
  uniqueBy(
    formations,
    (f) => f.formationKey,
    `${path}.formations`,
    'formationKey',
  );
  const responsibilities = list(
    r.responsibilities,
    `${path}.responsibilities`,
    parseResponsibility,
  );
  uniqueBy(
    responsibilities,
    (x) => x.responsibilityKey,
    `${path}.responsibilities`,
    'responsibilityKey',
  );
  const actions = list(r.actions, `${path}.actions`, parseAction);
  uniqueBy(actions, (a) => a.actionKey, `${path}.actions`, 'actionKey');
  const concepts = list(r.concepts, `${path}.concepts`, parseConcept);
  uniqueBy(concepts, (c) => c.conceptKey, `${path}.concepts`, 'conceptKey');
  const edges = asArray(r.matchupEdges, `${path}.matchupEdges`).map((e, i) =>
    parseEdge(e, `${path}.matchupEdges[${i}]`),
  );
  uniqueBy(
    edges,
    (e) => `${e.offenseConceptKey}|${e.defenseConceptKey}`,
    `${path}.matchupEdges`,
    'concept pair',
  );
  const exposure = list(
    r.exposureConversion,
    `${path}.exposureConversion`,
    parseExposure,
  );
  uniqueBy(
    exposure,
    (e) => e.actionKey,
    `${path}.exposureConversion`,
    'actionKey',
  );
  const rules: FootballRulesV1 = {
    modelVersion: 1,
    profileKey: asKey(r.profileKey, `${path}.profileKey`),
    field: parseField(r.field, `${path}.field`),
    clock: parseClock(r.clock, `${path}.clock`),
    scoring: parseScoring(r.scoring, `${path}.scoring`),
    penalties,
    substitution: parseSubstitution(r.substitution, `${path}.substitution`),
    schemes,
    personnelGroups,
    formations,
    responsibilities,
    actions,
    concepts,
    matchupEdges: edges,
    exposureConversion: exposure,
    outcome: parseOutcome(r.outcome, `${path}.outcome`),
    injury: parseInjury(r.injury, `${path}.injury`),
    ordering: parseOrdering(r.ordering, `${path}.ordering`),
  };
  crossReference(rules, path);
  return rules;
};

/** Internal consistency: every reference inside the block resolves inside the block. */
const crossReference = (rules: FootballRulesV1, path: string): void => {
  const schemeKeys = new Set(rules.schemes.map((s) => s.schemeKey));
  const personnelKeys = new Set(
    rules.personnelGroups.map((p) => p.personnelKey),
  );
  const formationKeys = new Set(rules.formations.map((f) => f.formationKey));
  const responsibilityKeys = new Set(
    rules.responsibilities.map((x) => x.responsibilityKey),
  );
  const actionByKey = new Map(rules.actions.map((a) => [a.actionKey, a]));
  const conceptByKey = new Map(rules.concepts.map((c) => [c.conceptKey, c]));
  const formationByKey = new Map(
    rules.formations.map((f) => [f.formationKey, f]),
  );

  for (const f of rules.formations) {
    const w = `${path}.formations["${f.formationKey}"]`;
    const group = rules.personnelGroups.find(
      (p) => p.personnelKey === f.personnelKey,
    );
    if (group === undefined)
      fail(w, `references unknown personnel group "${f.personnelKey}"`);
    else if (group.side !== f.side)
      fail(w, `personnel group "${f.personnelKey}" belongs to another side`);
    if (f.slots.length !== rules.substitution.playersPerSide)
      fail(
        w,
        `has ${f.slots.length} slots, but the ruleset fields ${rules.substitution.playersPerSide} players per side`,
      );
  }
  for (const a of rules.actions) {
    const w = `${path}.actions["${a.actionKey}"]`;
    for (const k of a.responsibilityKeys)
      if (!responsibilityKeys.has(k))
        fail(w, `references unknown responsibility "${k}"`);
  }
  for (const c of rules.concepts) {
    const w = `${path}.concepts["${c.conceptKey}"]`;
    if (!schemeKeys.has(c.schemeKey))
      fail(w, `references unknown scheme "${c.schemeKey}"`);
    for (const fk of c.formationKeys) {
      if (!formationKeys.has(fk))
        fail(w, `references unknown formation "${fk}"`);
      const formation = formationByKey.get(fk)!;
      if (formation.side !== c.side)
        fail(w, `formation "${fk}" belongs to another side`);
    }
    for (const a of c.assignments) {
      const action = actionByKey.get(a.actionKey);
      if (action === undefined)
        fail(w, `references unknown action "${a.actionKey}"`);
      else if (!action.responsibilityKeys.includes(a.responsibilityKey))
        fail(
          w,
          `action "${a.actionKey}" does not carry responsibility "${a.responsibilityKey}"`,
        );
      if (!responsibilityKeys.has(a.responsibilityKey))
        fail(w, `references unknown responsibility "${a.responsibilityKey}"`);
      for (const fk of c.formationKeys) {
        const slotKeys = new Set(
          formationByKey.get(fk)!.slots.map((s) => s.slotKey),
        );
        for (const sk of a.slotKeys)
          if (!slotKeys.has(sk))
            fail(w, `formation "${fk}" has no slot "${sk}"`);
      }
    }
  }
  for (const e of rules.matchupEdges) {
    const w = `${path}.matchupEdges`;
    const off = conceptByKey.get(e.offenseConceptKey);
    const def = conceptByKey.get(e.defenseConceptKey);
    if (off === undefined || off.side !== 'offense')
      fail(w, `"${e.offenseConceptKey}" is not an offensive concept`);
    if (def === undefined || def.side !== 'defense')
      fail(w, `"${e.defenseConceptKey}" is not a defensive concept`);
  }
  for (const a of rules.actions)
    if (!rules.exposureConversion.some((x) => x.actionKey === a.actionKey))
      fail(
        `${path}.exposureConversion`,
        `has no workload conversion for action "${a.actionKey}"`,
      );
  for (const x of rules.exposureConversion)
    if (!actionByKey.has(x.actionKey))
      fail(
        `${path}.exposureConversion`,
        `references unknown action "${x.actionKey}"`,
      );
  for (const c of rules.injury.conditions)
    for (const k of c.affectedActionKeys)
      if (!actionByKey.has(k))
        fail(
          `${path}.injury.conditions["${c.conditionKey}"]`,
          `references unknown action "${k}"`,
        );
  void personnelKeys;
};

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

export class MissingFootballRulesError extends Error {
  constructor(rulesetId: string) {
    super(`The active ruleset "${rulesetId}" declares no football rules`);
    this.name = 'MissingFootballRulesError';
  }
}

/** Fail-closed access: Package E commands never guess at missing football rules. */
export const requireFootballRules = (ruleset: {
  readonly rulesetId: string;
  readonly rules: { readonly football?: FootballRulesV1 };
}): FootballRulesV1 => {
  const f = ruleset.rules.football;
  if (f === undefined) throw new MissingFootballRulesError(ruleset.rulesetId);
  return f;
};

export const footballAction = (
  rules: FootballRulesV1,
  actionKey: string,
): FootballActionRule | undefined =>
  rules.actions.find((a) => a.actionKey === actionKey);

export const footballConcept = (
  rules: FootballRulesV1,
  conceptKey: string,
): FootballConceptRule | undefined =>
  rules.concepts.find((c) => c.conceptKey === conceptKey);

export const footballFormation = (
  rules: FootballRulesV1,
  formationKey: string,
): FootballFormationRule | undefined =>
  rules.formations.find((f) => f.formationKey === formationKey);

/** Every capability key the football rules read, sorted for a stable order. */
export const footballCapabilityKeys = (rules: FootballRulesV1): string[] =>
  [
    ...new Set(
      rules.actions.flatMap((a) =>
        a.capabilityBindings.map((b) => b.capabilityKey),
      ),
    ),
  ].sort();
