import { canonicalString } from './canonical';
import type {
  FootballGameRecord,
  FootballPlayerStatistics,
  FootballReconciliationFinding,
  FootballTeamStatistics,
  GameStatistics,
  ResolvedPlayFact,
} from './football';
import type { EntityId, RecordId } from './ids';

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const emptyTeam = (organizationId: EntityId): FootballTeamStatistics => ({
  organizationId,
  points: 0,
  scrimmagePlays: 0,
  rushAttempts: 0,
  rushingYards: 0,
  passAttempts: 0,
  completions: 0,
  passingYards: 0,
  turnovers: 0,
});

const emptyPlayer = (
  playerId: EntityId,
  organizationId: EntityId,
): FootballPlayerStatistics => ({
  playerId,
  organizationId,
  participationPlays: 0,
  workloadUnits: 0,
  passAttempts: 0,
  completions: 0,
  passingYards: 0,
  rushAttempts: 0,
  rushingYards: 0,
  targets: 0,
  receptions: 0,
  tackles: 0,
});

const updateTeam = (
  map: Map<string, FootballTeamStatistics>,
  organizationId: EntityId,
  update: (value: FootballTeamStatistics) => FootballTeamStatistics,
): void => {
  const current = map.get(organizationId) ?? emptyTeam(organizationId);
  map.set(organizationId, update(current));
};

const updatePlayer = (
  map: Map<string, FootballPlayerStatistics>,
  playerId: EntityId,
  organizationId: EntityId,
  update: (value: FootballPlayerStatistics) => FootballPlayerStatistics,
): void => {
  const current = map.get(playerId) ?? emptyPlayer(playerId, organizationId);
  map.set(playerId, update(current));
};

const participantOrganization = (
  play: ResolvedPlayFact,
  playerId: EntityId,
): EntityId | null =>
  play.participation.find((p) => p.playerId === playerId)?.organizationId ??
  null;

/** Derives every V1 counting statistic from retained play facts and nothing else. */
export const deriveGameStatistics = (
  plays: readonly ResolvedPlayFact[],
): GameStatistics => {
  const teams = new Map<string, FootballTeamStatistics>();
  const players = new Map<string, FootballPlayerStatistics>();

  for (const play of [...plays].sort((a, b) => a.sequence - b.sequence)) {
    updateTeam(teams, play.homeOrganizationId, (team) => ({
      ...team,
      points: team.points + (play.post.homeScore - play.pre.homeScore),
    }));
    updateTeam(teams, play.awayOrganizationId, (team) => ({
      ...team,
      points: team.points + (play.post.awayScore - play.pre.awayScore),
    }));

    for (const participant of play.participation)
      updatePlayer(
        players,
        participant.playerId,
        participant.organizationId,
        (player) => ({
          ...player,
          participationPlays: player.participationPlays + 1,
          workloadUnits: player.workloadUnits + participant.workloadUnits,
        }),
      );

    if (!play.playStands) continue;
    const isScrimmage =
      play.playCategory === 'run' || play.playCategory === 'pass';
    if (isScrimmage)
      updateTeam(teams, play.offenseOrganizationId, (team) => ({
        ...team,
        scrimmagePlays: team.scrimmagePlays + 1,
      }));

    if (play.playCategory === 'run') {
      updateTeam(teams, play.offenseOrganizationId, (team) => ({
        ...team,
        rushAttempts: team.rushAttempts + 1,
        rushingYards: team.rushingYards + play.yardsGained,
      }));
      const runner = play.principals.ballCarrierPlayerId;
      if (runner !== null) {
        const org =
          participantOrganization(play, runner) ?? play.offenseOrganizationId;
        updatePlayer(players, runner, org, (player) => ({
          ...player,
          rushAttempts: player.rushAttempts + 1,
          rushingYards: player.rushingYards + play.yardsGained,
        }));
      }
    }

    const officialPassAttempt =
      play.playCategory === 'pass' &&
      (play.resultKind === 'completion' ||
        play.resultKind === 'incompletion' ||
        play.resultKind === 'interception');
    if (officialPassAttempt) {
      const complete = play.resultKind === 'completion';
      updateTeam(teams, play.offenseOrganizationId, (team) => ({
        ...team,
        passAttempts: team.passAttempts + 1,
        completions: team.completions + (complete ? 1 : 0),
        passingYards: team.passingYards + (complete ? play.yardsGained : 0),
      }));
      const passer = play.principals.passerPlayerId;
      if (passer !== null) {
        const org =
          participantOrganization(play, passer) ?? play.offenseOrganizationId;
        updatePlayer(players, passer, org, (player) => ({
          ...player,
          passAttempts: player.passAttempts + 1,
          completions: player.completions + (complete ? 1 : 0),
          passingYards: player.passingYards + (complete ? play.yardsGained : 0),
        }));
      }
      const target = play.principals.targetPlayerId;
      if (target !== null) {
        const org =
          participantOrganization(play, target) ?? play.offenseOrganizationId;
        updatePlayer(players, target, org, (player) => ({
          ...player,
          targets: player.targets + 1,
          receptions: player.receptions + (complete ? 1 : 0),
        }));
      }
    }

    if (play.turnover !== null)
      updateTeam(teams, play.offenseOrganizationId, (team) => ({
        ...team,
        turnovers: team.turnovers + 1,
      }));

    const tackler = play.principals.tacklerPlayerId;
    if (tackler !== null) {
      const org =
        participantOrganization(play, tackler) ?? play.defenseOrganizationId;
      updatePlayer(players, tackler, org, (player) => ({
        ...player,
        tackles: player.tackles + 1,
      }));
    }
  }

  return {
    teams: [...teams.values()].sort((a, b) =>
      byText(a.organizationId, b.organizationId),
    ),
    players: [...players.values()].sort((a, b) =>
      byText(a.playerId, b.playerId),
    ),
  };
};

const same = (a: unknown, b: unknown): boolean =>
  canonicalString(a) === canonicalString(b);

const participationFromStats = (stats: GameStatistics) =>
  stats.players
    .map((p) => ({
      playerId: p.playerId,
      organizationId: p.organizationId,
      plays: p.participationPlays,
      workloadUnits: p.workloadUnits,
    }))
    .sort((a, b) => byText(a.playerId, b.playerId));

const uniqueSorted = (ids: readonly RecordId[]): readonly RecordId[] =>
  [...new Set(ids)].sort(byText);

/** Pure final-game self-consistency audit over the persisted ledger. */
export const reconcileFinalGame = (
  game: FootballGameRecord,
  plays: readonly ResolvedPlayFact[],
): readonly FootballReconciliationFinding[] => {
  const findings: FootballReconciliationFinding[] = [];
  const ordered = [...plays].sort((a, b) => a.sequence - b.sequence);
  const expectedIds = ordered.map((p) => p.id);

  const sequenceBad = ordered.some((p, index) => p.sequence !== index + 1);
  if (sequenceBad)
    findings.push({
      code: 'sequence_mismatch',
      message: 'play sequence is not contiguous from one',
    });

  const refsBad =
    !same(game.playIds, expectedIds) ||
    ordered.some(
      (p) =>
        p.gameId !== game.id ||
        p.fixtureId !== game.fixtureId ||
        p.homeOrganizationId !== game.homeOrganizationId ||
        p.awayOrganizationId !== game.awayOrganizationId,
    );
  if (refsBad)
    findings.push({
      code: 'play_reference_mismatch',
      message: 'game/play identity references do not reconcile',
    });

  let transitionBad = false;
  for (let i = 1; i < ordered.length; i += 1)
    if (!same(ordered[i - 1]!.post, ordered[i]!.pre)) {
      transitionBad = true;
      break;
    }
  if (transitionBad)
    findings.push({
      code: 'transition_mismatch',
      message: 'adjacent play pre/post game states do not join',
    });

  const derived = deriveGameStatistics(ordered);
  const homePoints =
    derived.teams.find((t) => t.organizationId === game.homeOrganizationId)
      ?.points ?? 0;
  const awayPoints =
    derived.teams.find((t) => t.organizationId === game.awayOrganizationId)
      ?.points ?? 0;
  if (homePoints !== game.homeScore || awayPoints !== game.awayScore)
    findings.push({
      code: 'score_mismatch',
      message: 'game score does not equal scoring deltas in the play ledger',
    });

  if (!same(derived, game.statistics))
    findings.push({
      code: 'statistics_mismatch',
      message:
        'stored statistics do not equal statistics derived from play facts',
    });

  const expectedParticipation = participationFromStats(derived);
  const storedParticipation = [...game.participationSummary].sort((a, b) =>
    byText(a.playerId, b.playerId),
  );
  if (!same(expectedParticipation, storedParticipation))
    findings.push({
      code: 'participation_mismatch',
      message: 'game participation summary does not equal play exposure facts',
    });

  const playMedicalIds = uniqueSorted(
    ordered.flatMap((p) => [...p.medicalEpisodeIds]),
  );
  if (!same(playMedicalIds, uniqueSorted(game.medicalEpisodeIds)))
    findings.push({
      code: 'medical_reference_mismatch',
      message: 'game medical references do not equal play medical references',
    });

  const last = ordered.at(-1);
  if (
    game.reconciliation.playCount !== ordered.length ||
    (last !== undefined &&
      (game.reconciliation.finalPeriod !== last.post.period ||
        game.reconciliation.finalClockSecondsRemaining !==
          last.post.clockSecondsRemaining))
  )
    findings.push({
      code: 'reconciliation_counter_mismatch',
      message: 'stored final reconciliation counters do not equal the ledger',
    });

  return findings;
};
