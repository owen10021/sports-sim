import type {
  FootballGameRecord,
  FootballPlayCallFact,
  FootballPlayKickFact,
  FootballPlayPenaltyFact,
  FootballPlayPrincipalsFact,
  FootballPlayResultKind,
  GameStatistics,
  ResolvedPlayFact,
} from './football';
import type { PlayCategory } from './footballRules';
import type { EntityId, RecordId } from './ids';
import {
  sundayProofForOrganization,
  type OrganizationSundayProofLink,
} from './sundayProof';
import type { FootballWorld } from './world';

export class FootballProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FootballProjectionError';
  }
}

const fail = (message: string): never => {
  throw new FootballProjectionError(message);
};

const gameFor = (world: FootballWorld, gameId: RecordId): FootballGameRecord =>
  world.football.games.find((game) => game.id === gameId) ??
  fail(`game ${gameId} does not exist`);

/** Exact authoritative play sequence for internal replay/reconstruction consumers. */
export const footballReplayFacts = (
  world: FootballWorld,
  gameId: RecordId,
): readonly ResolvedPlayFact[] => {
  const game = gameFor(world, gameId);
  return game.playIds.map((playId, index) => {
    const play =
      world.football.plays.find(
        (candidate) => candidate.id === playId && candidate.gameId === game.id,
      ) ?? fail(`game ${game.id} is missing play ${playId}`);
    if (play.sequence !== index + 1)
      return fail(
        `game ${game.id} play ${play.id} has sequence ${play.sequence}, expected ${index + 1}`,
      );
    return play;
  });
};

const copyStatistics = (statistics: GameStatistics): GameStatistics => ({
  teams: statistics.teams.map((team) => ({ ...team })),
  players: statistics.players.map((player) => ({ ...player })),
});

export interface FastSimSummary {
  readonly gameId: RecordId;
  readonly fixtureId: RecordId;
  readonly playedAt: string;
  readonly homeOrganizationId: EntityId;
  readonly awayOrganizationId: EntityId;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly statistics: GameStatistics;
  readonly playCount: number;
}

/** Final-game projection only. It does not simulate, resolve, draw RNG or mutate. */
export const fastSimSummary = (
  world: FootballWorld,
  gameId: RecordId,
): FastSimSummary => {
  const game = gameFor(world, gameId);
  return {
    gameId: game.id,
    fixtureId: game.fixtureId,
    playedAt: game.playedAt,
    homeOrganizationId: game.homeOrganizationId,
    awayOrganizationId: game.awayOrganizationId,
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    statistics: copyStatistics(game.statistics),
    playCount: game.playIds.length,
  };
};

export interface GameCastCall {
  readonly conceptKey: string;
  readonly formationKey: string;
  readonly personnelKey: string;
  readonly lineup: FootballPlayCallFact['lineup'];
}

export interface GameCastFrame {
  readonly gameId: RecordId;
  readonly playId: RecordId;
  readonly sequence: number;
  readonly period: number;
  readonly clockSecondsRemaining: number;
  readonly down: number;
  readonly yardsToGo: number;
  readonly yardLine: number;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly terminal: boolean;
  readonly offenseOrganizationId: EntityId;
  readonly defenseOrganizationId: EntityId;
  readonly offense: GameCastCall;
  readonly defense: GameCastCall;
  readonly playCategory: PlayCategory;
  readonly resultKind: FootballPlayResultKind;
  readonly yardsGained: number;
  readonly turnover: 'interception' | 'fumble' | null;
  readonly touchdown: boolean;
  readonly safety: boolean;
  readonly kick: FootballPlayKickFact | null;
  readonly penalty: FootballPlayPenaltyFact | null;
  readonly penaltyAccepted: boolean | null;
  readonly playStands: boolean;
  readonly principals: FootballPlayPrincipalsFact;
  readonly sundayProofLinks: readonly OrganizationSundayProofLink[];
}

const copyCall = (call: FootballPlayCallFact): GameCastCall => ({
  conceptKey: call.conceptKey,
  formationKey: call.formationKey,
  personnelKey: call.personnelKey,
  lineup: call.lineup.map((slot) => ({
    slotKey: slot.slotKey,
    playerId: slot.playerId,
  })),
});

const copyPrincipals = (
  principals: FootballPlayPrincipalsFact,
): FootballPlayPrincipalsFact => ({ ...principals });

const copyKick = (
  kick: FootballPlayKickFact | null,
): FootballPlayKickFact | null => (kick === null ? null : { ...kick });

const copyPenalty = (
  penalty: FootballPlayPenaltyFact | null,
): FootballPlayPenaltyFact | null => (penalty === null ? null : { ...penalty });

/**
 * GameCast is a projection over persisted facts. Organization-specific Sunday Proof is
 * already disclosure-filtered by Task 13; the generic projection contains none of it.
 */
export const gameCastFrames = (
  world: FootballWorld,
  gameId: RecordId,
  organizationId?: EntityId,
): readonly GameCastFrame[] => {
  const game = gameFor(world, gameId);
  const plays = footballReplayFacts(world, gameId);
  const proofByPlay = new Map<
    RecordId,
    readonly OrganizationSundayProofLink[]
  >();
  if (organizationId !== undefined) {
    const proof = sundayProofForOrganization(world, organizationId, gameId);
    for (const play of plays)
      proofByPlay.set(
        play.id,
        proof.links.filter((link) => link.playId === play.id),
      );
  }
  return plays.map((play, index) => ({
    gameId: game.id,
    playId: play.id,
    sequence: play.sequence,
    period: play.post.period,
    clockSecondsRemaining: play.post.clockSecondsRemaining,
    down: play.post.down,
    yardsToGo: play.post.yardsToGo,
    yardLine: play.post.yardLine,
    homeScore: play.post.homeScore,
    awayScore: play.post.awayScore,
    terminal: index === plays.length - 1 && play.post.status === 'final',
    offenseOrganizationId: play.offenseOrganizationId,
    defenseOrganizationId: play.defenseOrganizationId,
    offense: copyCall(play.offense),
    defense: copyCall(play.defense),
    playCategory: play.playCategory,
    resultKind: play.resultKind,
    yardsGained: play.yardsGained,
    turnover: play.turnover,
    touchdown: play.touchdown,
    safety: play.safety,
    kick: copyKick(play.kick),
    penalty: copyPenalty(play.penalty),
    penaltyAccepted: play.penaltyAccepted,
    playStands: play.playStands,
    principals: copyPrincipals(play.principals),
    sundayProofLinks: (proofByPlay.get(play.id) ?? []).map((link) => ({
      id: link.id,
      fixtureId: link.fixtureId,
      gameId: link.gameId,
      playId: link.playId,
      organizationId: link.organizationId,
      participantPlayerIds: [...link.participantPlayerIds],
      inputRefs: link.inputRefs.map((ref) => ({ ...ref })),
      consequenceRef: { ...link.consequenceRef },
      recordedAt: link.recordedAt,
    })),
  }));
};
