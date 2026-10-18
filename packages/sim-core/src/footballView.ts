import type {
  FootballGameRecord,
  GameDayDesignation,
  GamePlanExecutionSnapshot,
  ResolvedPlayFact,
} from './football';
import type { EntityId, RecordId } from './ids';
import {
  buildOrganizationKnowledgeView,
  type OrganizationKnowledgeView,
} from './knowledgeView';
import { holdsRoleAt } from './people';
import type { FootballWorld } from './world';

export type PublicFootballGameFact = Omit<
  FootballGameRecord,
  'gamePlanSnapshotIds' | 'medicalEpisodeIds' | 'rngDrawStart' | 'rngDrawCount'
>;

export type PublicResolvedPlayFact = Omit<
  ResolvedPlayFact,
  'medicalEpisodeIds' | 'rngDrawStart' | 'rngDrawCount' | 'traceHash'
>;

export interface FootballDecisionView {
  readonly organizationId: EntityId;
  readonly actorPersonId: EntityId;
  readonly asOf: string;
  readonly game: PublicFootballGameFact;
  readonly plays: readonly PublicResolvedPlayFact[];
  readonly ownGamePlan: GamePlanExecutionSnapshot | null;
  readonly ownGamePlans: readonly GamePlanExecutionSnapshot[];
  readonly ownDesignations: readonly GameDayDesignation[];
  readonly observedOpponentConceptKeys: readonly string[];
  readonly knowledge: OrganizationKnowledgeView;
  readonly opponentPublic: {
    readonly organizationId: EntityId;
    readonly finalScore: number;
    readonly playCount: number;
  };
}

export class FootballViewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FootballViewError';
  }
}

const publicGame = (game: FootballGameRecord): PublicFootballGameFact => {
  const {
    gamePlanSnapshotIds: _plans,
    medicalEpisodeIds: _medical,
    rngDrawStart: _rngStart,
    rngDrawCount: _rngCount,
    ...fact
  } = game;
  void _plans;
  void _medical;
  void _rngStart;
  void _rngCount;
  return fact;
};

const publicPlay = (play: ResolvedPlayFact): PublicResolvedPlayFact => {
  const {
    medicalEpisodeIds: _medical,
    rngDrawStart: _rngStart,
    rngDrawCount: _rngCount,
    traceHash: _traceHash,
    ...fact
  } = play;
  void _medical;
  void _rngStart;
  void _rngCount;
  void _traceHash;
  return fact;
};

/**
 * Knowledge-safe football/history view. A member sees public resolved facts and their own
 * club's private plan/designation inputs, then Package B's existing claim/belief filter.
 */
export const buildFootballDecisionView = (
  world: FootballWorld,
  organizationId: EntityId,
  actorPersonId: EntityId,
  gameId: RecordId,
): FootballDecisionView => {
  if (!holdsRoleAt(world.people, organizationId, actorPersonId, world.simDate))
    throw new FootballViewError(
      'viewer does not hold an active role in organization',
    );
  const game = world.football.games.find(
    (candidate) => candidate.id === gameId,
  );
  if (game === undefined)
    throw new FootballViewError(`game ${gameId} does not exist`);
  if (
    organizationId !== game.homeOrganizationId &&
    organizationId !== game.awayOrganizationId
  )
    throw new FootballViewError('organization did not participate in game');
  const opponentId =
    organizationId === game.homeOrganizationId
      ? game.awayOrganizationId
      : game.homeOrganizationId;
  const opponentScore =
    opponentId === game.homeOrganizationId ? game.homeScore : game.awayScore;
  const playIds = new Set(game.playIds);
  const plays = world.football.plays
    .filter((play) => play.gameId === game.id && playIds.has(play.id))
    .sort((a, b) => a.sequence - b.sequence)
    .map(publicPlay);
  const ownGamePlans = world.football.gamePlans.filter(
    (plan) =>
      plan.fixtureId === game.fixtureId &&
      plan.organizationId === organizationId,
  );
  const observedOpponentConceptKeys = [
    ...new Set(
      plays.map((play) =>
        play.offenseOrganizationId === opponentId
          ? play.offense.conceptKey
          : play.defense.conceptKey,
      ),
    ),
  ].sort();
  return {
    organizationId,
    actorPersonId,
    asOf: world.simDate,
    game: publicGame(game),
    plays,
    ownGamePlan: ownGamePlans[0] ?? null,
    ownGamePlans,
    ownDesignations: world.football.designations.filter(
      (designation) =>
        designation.fixtureId === game.fixtureId &&
        designation.organizationId === organizationId,
    ),
    observedOpponentConceptKeys,
    knowledge: buildOrganizationKnowledgeView(
      world,
      organizationId,
      actorPersonId,
    ),
    opponentPublic: {
      organizationId: opponentId,
      finalScore: opponentScore,
      playCount: plays.length,
    },
  };
};
