import type { CanonicalValue } from './audit';
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
/**
 * One club's immutable, committed game plan for one fixture. It pins the exact strategy-plan
 * revisions and the exact proposal revision and terms hash that authorized it, so it never
 * follows later plan revisions or newer proposals.
 */
export interface GamePlanExecutionSnapshot {
  readonly id: RecordId;
  readonly fixtureId: RecordId;
  readonly organizationId: EntityId;
  readonly capturedAt: string;
  readonly strategyPlanRefs: readonly {
    readonly planId: RecordId;
    readonly revision: number;
  }[];
  readonly schemeProposalRef: {
    readonly proposalId: RecordId;
    readonly revision: number;
    readonly termsHash: string;
  };
  readonly authorizedStaffPersonIds: readonly EntityId[];
  readonly schemeKey: string;
  readonly conceptKeys: readonly string[];
  readonly personnelPreferenceKeys: readonly string[];
  readonly constraints: { readonly [key: string]: CanonicalValue };
  readonly sourceProposalId: RecordId;
}
/**
 * The publicly observable situation of a game in progress: everything both sidelines can
 * see on the scoreboard and in the play-by-play, and nothing else. Selection reads only
 * this. The authoritative `GameState` (Task 8) must stay assignable to it, so the caller
 * can pass the real state; selection views copy these fields one by one and never retain
 * the object they were given.
 */
export interface FootballSelectionSituation {
  /** The organization that has the ball on the next play. */
  readonly possessionOrganizationId: EntityId;
  readonly period: number;
  readonly clockSecondsRemaining: number;
  readonly down: number;
  readonly yardsToGo: number;
  /** Yards the possessing team has advanced from its own goal line (0..100). */
  readonly yardLine: number;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly homeTimeoutsRemaining: number;
  readonly awayTimeoutsRemaining: number;
  /**
   * The concepts both sides committed on the plays already resolved in this game. Once a
   * play has been run both calls are public, so this is legitimate observed tendency.
   * CONTRACT: only plays whose resolution is complete may appear here. The complete-game
   * resolver derives this list from its own authoritative play history, never from a
   * call that has been selected but not yet resolved. Each entry needs BOTH concepts, so
   * a half-committed play cannot be expressed.
   */
  readonly resolvedCalls: readonly {
    readonly offenseConceptKey: string;
    readonly defenseConceptKey: string;
  }[];
}

/** Why a kickoff is being taken; it decides the kicking spot. */
export type KickoffKind =
  'opening' | 'after_score' | 'after_safety' | 'second_half' | 'overtime';

/**
 * Ephemeral complete-game resolution state that the pure play resolver reads and returns.
 * It is the public scoreboard plus resolver bookkeeping, and it is NOT a world collection.
 *
 * `possessionOrganizationId` is the organization that has the ball on the NEXT snap: the
 * offense for a scrimmage play, the scoring team for an extra point, and the KICKING team
 * for a kickoff. All field coordinates are yards advanced from that organization's own
 * goal line.
 */
export interface GameState extends FootballSelectionSituation {
  readonly fixtureId: RecordId;
  /** Plays already resolved in this game; the next play is sequence `playsResolved + 1`. */
  readonly playsResolved: number;
  /** What the next snap is. */
  readonly nextSnap: 'scrimmage' | 'extra_point' | 'kickoff';
  readonly status: 'in_progress' | 'final';
  /** Set exactly while `nextSnap` is `kickoff`. */
  readonly kickoffKind: KickoffKind | null;
  /** The organization that received the game's opening kickoff. */
  readonly openingReceiverOrganizationId: EntityId;
  /** Drives started so far, including the one in progress. */
  readonly driveCount: number;
  /** Scrimmage plays run in the current drive. */
  readonly drivePlays: number;
  /**
   * Football workload units each participant has accumulated this game, sorted by player
   * id. The complete-game resolver enforces medical hard caps against these counters.
   */
  readonly workloadByPlayer: readonly {
    readonly playerId: EntityId;
    readonly workloadUnits: number;
  }[];
}

export interface FootballGameRecord {
  readonly id: RecordId;
  readonly fixtureId: RecordId;
  readonly playedAt: string;
  readonly homeOrganizationId: EntityId;
  readonly awayOrganizationId: EntityId;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly gamePlanSnapshotIds: readonly [RecordId, RecordId];
  readonly playIds: readonly RecordId[];
  readonly participationSummary: readonly {
    readonly playerId: string;
    readonly organizationId: EntityId;
    readonly plays: number;
    readonly workloadUnits: number;
  }[];
  readonly teamStatSummary: {
    readonly homeOffensivePlays: number;
    readonly awayOffensivePlays: number;
  };
  readonly medicalEpisodeIds: readonly RecordId[];
  readonly rngDrawStart: number;
  readonly rngDrawCount: number;
  readonly reconciliation: {
    readonly playCount: number;
    readonly finalPeriod: number;
    readonly finalClockSecondsRemaining: number;
    readonly hash: string;
  };
}
export interface ResolvedPlayFact {
  readonly id: RecordId;
  readonly gameId: RecordId;
  readonly fixtureId: RecordId;
  readonly sequence: number;
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
