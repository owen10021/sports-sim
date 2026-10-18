import {
  requireDevelopmentRules,
  SYNTHETIC_PACKAGE_D_RULESET,
} from '../../src/index';
const rules = requireDevelopmentRules(SYNTHETIC_PACKAGE_D_RULESET);
export const adaptationInput = () => ({
  currentValueBp: 5000,
  family: rules.capabilityFamilies.find((f) => f.familyKey === 'technique')!,
  ageDays: 9497,
  malleabilityBp: 10000,
  meaningfulUnits: 50,
  loadUnits: 50,
  maxLoadUnits: 100,
  teachingBp: 10000,
  conditioningBp: 10000,
  acuteFatigueBp: 0,
  elapsedDays: 7,
  rollU32: 10000,
});
