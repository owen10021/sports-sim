/**
 * Draft & Scouting domain: draft state (Package C). Draft classes, pick assets,
 * organizational board revisions, sessions and selections. Refined by Tasks 3, 12, 13.
 */
export type DraftState = {
  readonly classes: readonly unknown[];
  readonly picks: readonly unknown[];
  readonly boards: readonly unknown[];
  readonly sessions: readonly unknown[];
  readonly selections: readonly unknown[];
};

export const emptyDraftState = (): DraftState => ({
  classes: [],
  picks: [],
  boards: [],
  sessions: [],
  selections: [],
});
