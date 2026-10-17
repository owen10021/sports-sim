/**
 * Roster & Player domain state (Package C). Authoritative: player football-capability
 * truth, roster rights, roster membership and the waiver process. Derived views (rosters,
 * capacity counts) are rebuildable and never stored here.
 *
 * Task 1 only versions the world model: the collections exist and are empty. Element
 * types are refined by the tasks that populate them (3: seed, 5: rights, 7: waivers).
 */
export type RosterState = {
  readonly players: readonly unknown[];
  readonly rights: readonly unknown[];
  readonly memberships: readonly unknown[];
  readonly waivers: readonly unknown[];
  readonly waiverClaims: readonly unknown[];
  /** One complete, unique organization order (empty until seeded). */
  readonly waiverPriority: readonly string[];
};

export const emptyRosterState = (): RosterState => ({
  players: [],
  rights: [],
  memberships: [],
  waivers: [],
  waiverClaims: [],
  waiverPriority: [],
});
