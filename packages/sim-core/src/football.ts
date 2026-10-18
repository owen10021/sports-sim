import { entityId, recordId, type EntityId, type RecordId } from './ids';
import type { PackageESubstrateSeed } from './packageESeedParse';

/**
 * Package E football state (world model 5).
 *
 * Owns the six authoritative collection boundaries. Task 2 adds the fixture schedule only;
 * later Package E tasks add the remaining record fields and behavior, and no gameplay truth
 * is invented here.
 */
export interface FootballFixture {
  readonly id: RecordId;
  /** Logical date the game becomes due (`YYYY-MM-DD`). */
  readonly fixtureDate: string;
  readonly homeOrganizationId: EntityId;
  readonly awayOrganizationId: EntityId;
  /** Which football rules profile governs the game. */
  readonly rulesProfileKey: string;
}
export interface GameDayDesignation {
  readonly id: RecordId;
}
export interface GamePlanExecutionSnapshot {
  readonly id: RecordId;
}
export interface FootballGameRecord {
  readonly id: RecordId;
}
export interface ResolvedPlayFact {
  readonly id: RecordId;
}
export interface FootballCausalLink {
  readonly id: RecordId;
}

export interface FootballState {
  readonly fixtures: readonly FootballFixture[];
  readonly designations: readonly GameDayDesignation[];
  readonly gamePlans: readonly GamePlanExecutionSnapshot[];
  readonly games: readonly FootballGameRecord[];
  readonly plays: readonly ResolvedPlayFact[];
  readonly causalLinks: readonly FootballCausalLink[];
}

/**
 * Football state at world creation: the seeded fixture schedule only. Designations, game
 * plans, games, plays and causal links start empty; older seeds have no fixtures at all.
 */
export const seededFootballState = (
  seed: PackageESubstrateSeed | undefined,
): FootballState => ({
  ...emptyFootballState(),
  fixtures: (seed?.fixtures ?? []).map((f) => ({
    id: recordId(f.id),
    fixtureDate: f.fixtureDate,
    homeOrganizationId: entityId(f.homeOrganizationId),
    awayOrganizationId: entityId(f.awayOrganizationId),
    rulesProfileKey: f.rulesProfileKey,
  })),
});

export const emptyFootballState = (): FootballState => ({
  fixtures: [],
  designations: [],
  gamePlans: [],
  games: [],
  plays: [],
  causalLinks: [],
});
