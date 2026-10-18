import type { RecordId } from './ids';

/**
 * Package E football state (world model 5).
 *
 * This Task-1 skeleton owns only the six authoritative collection boundaries. Later
 * Package E tasks add record fields and behavior; no gameplay truth is invented here.
 */
export interface FootballFixture {
  readonly id: RecordId;
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

export const emptyFootballState = (): FootballState => ({
  fixtures: [],
  designations: [],
  gamePlans: [],
  games: [],
  plays: [],
  causalLinks: [],
});
