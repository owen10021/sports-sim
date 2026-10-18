import type { CreateMedicalEpisodeInput } from './medicalCommands';
import type { FootballRulesV1, PlayCategory } from './footballRules';

export interface FootballInjuryExposure {
  readonly fixtureId: string;
  readonly playId: string;
  readonly organizationId: string;
  readonly playerId: string;
  readonly occurredAt: string;
  readonly playCategory: PlayCategory;
  readonly contactClass: string;
  readonly actionExposures: readonly {
    readonly actionKey: string;
    readonly attempts: number;
  }[];
  readonly fatigueBp: number;
  readonly durabilityBp: number;
}

export interface FootballInjuryOccurrence {
  readonly fixtureId: string;
  readonly playId: string;
  readonly organizationId: string;
  readonly playerId: string;
  readonly contactClass: string;
  readonly playCategory: PlayCategory;
  readonly actionKeys: readonly string[];
  readonly occurrenceRiskBp: number;
  readonly medicalInput: CreateMedicalEpisodeInput;
}

const clampBp = (value: number): number =>
  Math.max(0, Math.min(10000, Math.floor(value)));

const mulBp = (value: number, factorBp: number): number =>
  Math.floor((value * factorBp) / 10000);

const mix32 = (value: number): number => {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
};

const inRange = (roll: number, min: number, max: number): number =>
  min + (roll % (max - min + 1));

/**
 * Pure synthetic football injury occurrence derivation. One already-consumed U32 is the
 * entire random input; no rerolls or hidden RNG source exist here. This function creates
 * only the exact Package-D medical ingress values. It owns no medical state.
 */
export const resolveFootballInjuryOccurrence = (
  rules: FootballRulesV1,
  exposure: FootballInjuryExposure,
  roll: number,
): FootballInjuryOccurrence | null => {
  if (!Number.isSafeInteger(roll) || roll < 0 || roll > 0xffffffff)
    throw new Error('football injury roll must be one uint32');
  if (!rules.injury.contactClasses.includes(exposure.contactClass))
    throw new Error(
      `unknown football contact class "${exposure.contactClass}"`,
    );
  if (
    !Number.isSafeInteger(exposure.fatigueBp) ||
    exposure.fatigueBp < 0 ||
    exposure.fatigueBp > 10000 ||
    !Number.isSafeInteger(exposure.durabilityBp) ||
    exposure.durabilityBp < 0 ||
    exposure.durabilityBp > 10000
  )
    throw new Error('football injury fatigue/durability must be basis points');
  const category = rules.injury.exposureRiskBpByCategory.find(
    (x) => x.playCategory === exposure.playCategory,
  );
  if (category === undefined)
    throw new Error(`no injury exposure profile for ${exposure.playCategory}`);
  for (const action of exposure.actionExposures)
    if (!rules.actions.some((a) => a.actionKey === action.actionKey))
      throw new Error(`unknown football injury action "${action.actionKey}"`);

  const categoryAdjusted = mulBp(
    rules.injury.baseRiskBpPerExposure,
    category.riskBp,
  );
  const fatigueBonusBp = mulBp(
    exposure.fatigueBp,
    rules.injury.fatigueRiskScaleBp,
  );
  const durabilityProtectionBp = mulBp(
    exposure.durabilityBp,
    rules.injury.durabilityProtectionScaleBp,
  );
  const fatigueAdjusted = mulBp(categoryAdjusted, 10000 + fatigueBonusBp);
  const occurrenceRiskBp = clampBp(
    mulBp(fatigueAdjusted, 10000 - durabilityProtectionBp),
  );
  const sourceRoll = roll >>> 0;
  if (sourceRoll % 10000 >= occurrenceRiskBp) return null;

  const totalWeight = rules.injury.conditions.reduce(
    (sum, condition) => sum + condition.weightBp,
    0,
  );
  let conditionPick = mix32(sourceRoll ^ 0xa341316c) % totalWeight;
  let condition = rules.injury.conditions[0]!;
  for (const candidate of rules.injury.conditions) {
    if (conditionPick < candidate.weightBp) {
      condition = candidate;
      break;
    }
    conditionPick -= candidate.weightBp;
  }
  const severity = inRange(
    mix32(sourceRoll ^ 0xc8013ea4),
    condition.severityMinBp,
    condition.severityMaxBp,
  );
  const responsiveness = inRange(
    mix32(sourceRoll ^ 0xad90777d),
    rules.injury.recoveryResponsivenessMinBp,
    rules.injury.recoveryResponsivenessMaxBp,
  );
  const actionKeys = [...condition.affectedActionKeys].sort();

  return {
    fixtureId: exposure.fixtureId,
    playId: exposure.playId,
    organizationId: exposure.organizationId,
    playerId: exposure.playerId,
    contactClass: exposure.contactClass,
    playCategory: exposure.playCategory,
    actionKeys,
    occurrenceRiskBp,
    medicalInput: {
      playerId: exposure.playerId,
      conditionKey: condition.conditionKey,
      onsetAt: exposure.occurredAt,
      sourceKind: 'football',
      affectedActionKeys: actionKeys,
      initialStructuralSeverityBp: severity,
      recoveryResponsivenessBp: responsiveness,
      baselineReinjuryRiskBp: rules.injury.baselineReinjuryRiskBp,
    },
  };
};
