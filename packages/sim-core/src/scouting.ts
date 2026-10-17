import { entityId, type EntityId } from './ids';
import type { PackageCSubstrateSeed } from './packageCSeedParse';
import type { PreferenceLevel } from './market';

/**
 * Draft & Scouting domain: scouting state (Package C). Evaluator lenses, questions,
 * assignments and report links. Evidence and beliefs stay in Package B's information
 * domain; this state never becomes a second evidence store. Question/assignment/report
 * element types are refined by Task 11.
 */

/** A small scouting lens: which dimensions an evaluator reads well or poorly, and risk appetite. */
export type ScoutEvaluatorProfile = {
  readonly personId: EntityId;
  readonly strongDimensions: readonly string[];
  readonly weakDimensions: readonly string[];
  readonly riskTolerance: PreferenceLevel;
};

export type ScoutingState = {
  readonly evaluatorProfiles: readonly ScoutEvaluatorProfile[];
  readonly questions: readonly unknown[];
  readonly assignments: readonly unknown[];
  readonly reports: readonly unknown[];
};

export const emptyScoutingState = (): ScoutingState => ({
  evaluatorProfiles: [],
  questions: [],
  assignments: [],
  reports: [],
});

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Initial scouting state from the seed's Package C block, in canonical order. */
export const seededScoutingState = (
  sub: PackageCSubstrateSeed | undefined,
): ScoutingState => {
  if (sub === undefined) return emptyScoutingState();
  return {
    ...emptyScoutingState(),
    evaluatorProfiles: sub.evaluatorProfiles
      .map((e): ScoutEvaluatorProfile => ({
        personId: entityId(e.personId),
        strongDimensions: [...e.strongDimensions].sort(byText),
        weakDimensions: [...e.weakDimensions].sort(byText),
        riskTolerance: e.riskTolerance,
      }))
      .sort((a, b) => byText(a.personId, b.personId)),
  };
};
