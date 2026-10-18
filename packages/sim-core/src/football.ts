import { entityId, recordId, type EntityId, type RecordId } from './ids';
import type { PackageESubstrateSeed } from './packageESeedParse';

/**
 * Package E football state (world model 5).
 *
 * Owns the six authoritative collection boundaries. Later Package E tasks add the remaining
 * record fields and behavior, and no gameplay truth is invented here.
 */
export interface FootballFixture {
  readonly id: RecordId;
  /** Logical date the game becomes due (`YYYY-MM-DD`). */
  readonly fixtureDate: string;
  readonly homeOrganizationId: EntityId;
  readonly awayOrganizationId: EntityId;
  /** Which football rules profile governs the game. */
  readonly rulesProfileKey: string;
  /** `final` once the complete game has been resolved; never rewound. */
  readonly status: 'scheduled' | 'final';
  /** The game record that finalized this fixture, or `null` while it is scheduled. */
  readonly finalGameId: RecordId | null;
}

/**
 * One organization's committed game-day designation of one player for one fixture. An
 * `active` designation names the unit, role and depth the coach intends; an `inactive` one
 * names none of them. Designations never alter Package C roster membership, rights or
 * contracts: they are a per-game layer over the roster.
 */
export interface GameDayDesignation {
  readonly id: RecordId;
  readonly fixtureId: RecordId;
  readonly organizationId: EntityId;
  readonly playerId: EntityId;
  readonly status: 'active' | 'inactive';
  /** Formation side (`offense`, `defense`, `kicking`, `returning`); `null` when inactive. */
  readonly unitKey: string | null;
  /** Player role the designation fills in that unit; `null` when inactive. */
  readonly roleKey: string | null;
  /** 1-based order within the unit and role (1 = first choice); `null` when inactive. */
  readonly depthOrder: number | null;
  /** The authorized proposal whose exact terms created this record. */
  readonly sourceProposalId: RecordId;
  readonly committedAt: string;
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
    status: 'scheduled' as const,
    finalGameId: null,
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
