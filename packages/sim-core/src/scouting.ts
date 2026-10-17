/**
 * Draft & Scouting domain: scouting state (Package C). Evaluator lenses, questions,
 * assignments and report links. Evidence and beliefs stay in Package B's information
 * domain; this state never becomes a second evidence store. Refined by Tasks 3 and 11.
 */
export type ScoutingState = {
  readonly evaluatorProfiles: readonly unknown[];
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
