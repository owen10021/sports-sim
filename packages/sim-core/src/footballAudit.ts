import { canonicalString } from './canonical';
import type {
  FootballCausalInputRef,
  FootballGameRecord,
  ResolvedPlayFact,
} from './football';
import {
  fastSimSummary,
  footballReplayFacts,
  gameCastFrames,
  type FastSimSummary,
  type GameCastFrame,
} from './gameCast';
import { reconcileFinalGame } from './footballStats';
import { requireFootballRules } from './footballRules';
import type { EntityId, RecordId } from './ids';
import { currentRosterMembership } from './roster';
import type { LeagueRulesetManifest } from './ruleset';
import type { FootballWorld } from './world';

export const FOOTBALL_FINDING_CODES = [
  'FIXTURE_FINAL_WITHOUT_GAME',
  'GAME_WITHOUT_FINAL_FIXTURE',
  'PLAY_WITHOUT_GAME',
  'DUPLICATE_GAME_RESOLUTION',
  'DUPLICATE_FOOTBALL_TRUTH',
  'ILLEGAL_PARTICIPANT',
  'UNDESIGNATED_PARTICIPANT',
  'USAGE_EXCEEDS_MEDICAL_CLEARANCE',
  'GAME_STATS_DO_NOT_RECONCILE',
  'GAME_CLOCK_STATE_INVALID',
  'FOOTBALL_USAGE_NOT_REFLECTED_IN_D',
  'FOOTBALL_INJURY_WITHOUT_MEDICAL_EPISODE',
  'CAUSAL_LINK_INPUT_NOT_USED',
  'LATENT_TRUTH_IN_ORG_EVIDENCE',
  'PRIVATE_CALL_LEAKAGE',
  'PRESENTATION_OUTCOME_DIVERGENCE',
  'DUPLICATE_PLAYER_TRUTH',
] as const;

export type FootballFindingCode = (typeof FOOTBALL_FINDING_CODES)[number];
export type FootballFindingSeverity = 'error' | 'warning';

export interface FootballFinding {
  readonly code: FootballFindingCode;
  readonly severity: FootballFindingSeverity;
  readonly organizationId?: EntityId;
  readonly subjectIds: readonly string[];
  readonly detail: string;
}

export interface FootballAuditPresentationInput {
  readonly gameId: RecordId;
  readonly fastSim?: FastSimSummary;
  readonly gameCast?: readonly GameCastFrame[];
  readonly replay?: readonly ResolvedPlayFact[];
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const same = (a: unknown, b: unknown): boolean =>
  canonicalString(a) === canonicalString(b);

const duplicateIds = <T extends { readonly id: string }>(
  rows: readonly T[],
): string[] => {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.id, (counts.get(row.id) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort(byText);
};

const historicalMedicalCap = (
  world: FootballWorld,
  organizationId: EntityId,
  playerId: EntityId,
  at: string,
): number | null => {
  let cap: number | null = null;
  for (const episode of world.medical.episodes) {
    if (episode.playerId !== playerId || episode.onsetAt > at) continue;
    const clearance = world.medical.clearances
      .filter(
        (candidate) =>
          candidate.episodeId === episode.id &&
          candidate.organizationId === organizationId &&
          candidate.playerId === playerId &&
          candidate.committedAt <= at,
      )
      .sort((a, b) =>
        a.committedAt === b.committedAt
          ? byText(a.id, b.id)
          : byText(a.committedAt, b.committedAt),
      )
      .at(-1);
    if (clearance === undefined || clearance.participation === 'full') continue;
    const episodeCap =
      clearance.participation === 'out' ? 0 : clearance.maxLoadUnits;
    if (episodeCap === null) continue;
    cap = cap === null ? episodeCap : Math.min(cap, episodeCap);
  }
  return cap;
};

const validClockState = (
  play: ResolvedPlayFact,
  downsPerSeries: number,
): boolean => {
  const states = [play.pre, play.post];
  return states.every(
    (state) =>
      Number.isSafeInteger(state.period) &&
      state.period >= 1 &&
      Number.isSafeInteger(state.clockSecondsRemaining) &&
      state.clockSecondsRemaining >= 0 &&
      Number.isSafeInteger(state.down) &&
      state.down >= 1 &&
      state.down <= downsPerSeries &&
      Number.isSafeInteger(state.yardsToGo) &&
      state.yardsToGo >= 0 &&
      Number.isSafeInteger(state.yardLine) &&
      state.yardLine >= 0 &&
      state.yardLine <= 100 &&
      Number.isSafeInteger(state.homeScore) &&
      state.homeScore >= 0 &&
      Number.isSafeInteger(state.awayScore) &&
      state.awayScore >= 0,
  );
};

const participantIdsFor = (
  play: ResolvedPlayFact,
  organizationId: EntityId,
): ReadonlySet<EntityId> =>
  new Set(
    play.participation
      .filter((participant) => participant.organizationId === organizationId)
      .map((participant) => participant.playerId),
  );

const relevantProposalIds = (
  world: FootballWorld,
  play: ResolvedPlayFact,
  organizationId: EntityId,
): ReadonlySet<RecordId> => {
  const ids = new Set<RecordId>();
  const plan = world.football.gamePlans.find(
    (candidate) =>
      candidate.fixtureId === play.fixtureId &&
      candidate.organizationId === organizationId,
  );
  if (plan !== undefined) ids.add(plan.sourceProposalId);
  const participants = participantIdsFor(play, organizationId);
  for (const designation of world.football.designations)
    if (
      designation.fixtureId === play.fixtureId &&
      designation.organizationId === organizationId &&
      participants.has(designation.playerId)
    )
      ids.add(designation.sourceProposalId);
  return ids;
};

const causalInputUsed = (
  world: FootballWorld,
  play: ResolvedPlayFact,
  organizationId: EntityId,
  ref: FootballCausalInputRef,
): boolean => {
  const participantIds = participantIdsFor(play, organizationId);
  const orgParticipants = play.participation.filter(
    (participant) => participant.organizationId === organizationId,
  );
  if (ref.kind === 'ruleset_key') {
    if (ref.keyKind === 'concept') {
      const concept =
        play.offenseOrganizationId === organizationId
          ? play.offense.conceptKey
          : play.defense.conceptKey;
      return ref.key === concept;
    }
    if (ref.keyKind === 'action')
      return orgParticipants.some((participant) =>
        participant.actionExposures.some(
          (exposure) => exposure.actionKey === ref.key,
        ),
      );
    return orgParticipants.some((participant) =>
      participant.responsibilityExposures.some(
        (exposure) => exposure.responsibilityKey === ref.key,
      ),
    );
  }
  if (ref.kind === 'role_knowledge')
    return (
      participantIds.has(ref.playerId) &&
      orgParticipants.some(
        (participant) =>
          participant.playerId === ref.playerId &&
          participant.responsibilityExposures.some(
            (exposure) =>
              exposure.schemeKey === ref.schemeKey &&
              exposure.responsibilityKey === ref.responsibilityKey,
          ),
      ) &&
      world.development.roleKnowledge.some(
        (knowledge) =>
          knowledge.playerId === ref.playerId &&
          knowledge.schemeKey === ref.schemeKey &&
          knowledge.responsibilityKey === ref.responsibilityKey,
      )
    );

  switch (ref.recordKind) {
    case 'game_plan_snapshot':
      return world.football.gamePlans.some(
        (plan) =>
          plan.id === ref.id &&
          plan.fixtureId === play.fixtureId &&
          plan.organizationId === organizationId,
      );
    case 'game_day_designation':
      return world.football.designations.some(
        (designation) =>
          designation.id === ref.id &&
          designation.fixtureId === play.fixtureId &&
          designation.organizationId === organizationId &&
          designation.status === 'active' &&
          participantIds.has(designation.playerId),
      );
    case 'roster_membership':
      return world.roster.memberships.some(
        (membership) =>
          membership.id === ref.id &&
          membership.organizationId === organizationId &&
          participantIds.has(membership.playerId),
      );
    case 'medical_episode':
      return world.medical.episodes.some(
        (episode) =>
          episode.id === ref.id && participantIds.has(episode.playerId),
      );
    case 'medical_clearance':
      return world.medical.clearances.some(
        (clearance) =>
          clearance.id === ref.id &&
          clearance.organizationId === organizationId &&
          participantIds.has(clearance.playerId),
      );
    case 'decision_receipt': {
      const relevant = relevantProposalIds(world, play, organizationId);
      return world.decisions.receipts.some(
        (receipt) => receipt.id === ref.id && relevant.has(receipt.proposalId),
      );
    }
  }
};

const containsForbiddenEvidenceTruth = (value: unknown): boolean => {
  const encoded = canonicalString(value).toLowerCase();
  return [
    'capability',
    'readiness',
    'structuralhealing',
    'reinjuryrisk',
    'recoveryresponsiveness',
    'acutefatigue',
    'conditioningbp',
    'rngdraw',
    'rngstate',
  ].some((token) => encoded.includes(token));
};

const containsPrivateCallLeak = (
  world: FootballWorld,
  holderOrganizationIds: readonly EntityId[],
  proposition: unknown,
): boolean => {
  const encoded = canonicalString(proposition).toLowerCase();
  if (
    encoded.includes('rivalgameplan') ||
    encoded.includes('opponentgameplan') ||
    encoded.includes('privatecall') ||
    encoded.includes('finalcall')
  )
    return true;
  return world.football.gamePlans.some(
    (plan) =>
      !holderOrganizationIds.includes(plan.organizationId) &&
      encoded.includes(plan.id.toLowerCase()),
  );
};

const footballHasDuplicatePlayerTruth = (world: FootballWorld): boolean => {
  const encoded = canonicalString(world.football).toLowerCase();
  return [
    'capabilitybp',
    'readinessbp',
    'structuralhealingbp',
    'reinjuryriskbp',
    'acutefatiguebp',
    'conditioningbp',
    'teamstrength',
    'overallrating',
    'overall_rating',
    'usercontrolled',
    'user_controlled',
  ].some((token) => encoded.includes(token));
};

/** Read-only Package E integrity audit. It reports corruption/exploits and never repairs them. */
export const auditFootballWorld = (
  world: FootballWorld,
  ruleset: LeagueRulesetManifest,
  presentation?: FootballAuditPresentationInput,
): readonly FootballFinding[] => {
  const footballRules = requireFootballRules(ruleset);
  const findings: FootballFinding[] = [];
  const add = (
    code: FootballFindingCode,
    detail: string,
    subjectIds: readonly string[],
    organizationId?: EntityId,
    severity: FootballFindingSeverity = 'error',
  ): void => {
    findings.push({
      code,
      severity,
      ...(organizationId === undefined ? {} : { organizationId }),
      subjectIds: [...subjectIds].sort(byText),
      detail,
    });
  };

  for (const fixture of world.football.fixtures) {
    const matching = world.football.games.filter(
      (game) => game.fixtureId === fixture.id,
    );
    if (
      fixture.status === 'final' &&
      (fixture.finalGameId === null ||
        !matching.some((game) => game.id === fixture.finalGameId))
    )
      add(
        'FIXTURE_FINAL_WITHOUT_GAME',
        'final fixture does not point to its resolved game',
        [
          fixture.id,
          ...(fixture.finalGameId === null ? [] : [fixture.finalGameId]),
        ],
      );
    if (matching.length > 1)
      add(
        'DUPLICATE_GAME_RESOLUTION',
        `fixture has ${matching.length} authoritative game records`,
        [fixture.id, ...matching.map((game) => game.id)],
      );
  }

  for (const game of world.football.games) {
    const fixture = world.football.fixtures.find(
      (candidate) => candidate.id === game.fixtureId,
    );
    if (
      fixture === undefined ||
      fixture.status !== 'final' ||
      fixture.finalGameId !== game.id
    )
      add(
        'GAME_WITHOUT_FINAL_FIXTURE',
        'game record is not the final game named by its fixture',
        [game.id, game.fixtureId],
      );
    const plays = world.football.plays.filter(
      (play) => play.gameId === game.id,
    );
    if (reconcileFinalGame(game, plays).length > 0)
      add(
        'GAME_STATS_DO_NOT_RECONCILE',
        'game score/statistics/participation/history do not reconcile to play facts',
        [game.id],
      );
  }

  for (const play of world.football.plays) {
    const game = world.football.games.find(
      (candidate) => candidate.id === play.gameId,
    );
    if (game === undefined) {
      add('PLAY_WITHOUT_GAME', 'play references a missing game', [
        play.id,
        play.gameId,
      ]);
      continue;
    }
    if (!validClockState(play, footballRules.field.downsPerSeries))
      add(
        'GAME_CLOCK_STATE_INVALID',
        'play contains an impossible clock/down/distance/field/score state',
        [play.id],
      );

    for (const participant of play.participation) {
      const membership = currentRosterMembership(
        world.roster,
        participant.playerId,
        game.playedAt,
      );
      if (membership?.organizationId !== participant.organizationId)
        add(
          'ILLEGAL_PARTICIPANT',
          'participant lacked matching roster membership on game day',
          [play.id, participant.playerId],
          participant.organizationId,
        );
      const designation = world.football.designations.find(
        (candidate) =>
          candidate.fixtureId === play.fixtureId &&
          candidate.organizationId === participant.organizationId &&
          candidate.playerId === participant.playerId &&
          candidate.status === 'active',
      );
      if (designation === undefined)
        add(
          'UNDESIGNATED_PARTICIPANT',
          'participant lacked an active game-day designation',
          [play.id, participant.playerId],
          participant.organizationId,
        );
      const hasUsage = world.development.events.some(
        (event) =>
          event.kind === 'football_usage' &&
          event.playerId === participant.playerId &&
          event.causalRecordIds.includes(play.fixtureId) &&
          event.causalRecordIds.includes(play.id),
      );
      if (!hasUsage)
        add(
          'FOOTBALL_USAGE_NOT_REFLECTED_IN_D',
          'resolved football participation has no Package D football-usage event',
          [play.id, participant.playerId],
          participant.organizationId,
        );
    }

    for (const episodeId of play.medicalEpisodeIds) {
      const episode = world.medical.episodes.find(
        (candidate) => candidate.id === episodeId,
      );
      if (
        episode === undefined ||
        episode.sourceKind !== 'football' ||
        episode.onsetAt !== game.playedAt ||
        !play.participation.some(
          (participant) => participant.playerId === episode.playerId,
        )
      )
        add(
          'FOOTBALL_INJURY_WITHOUT_MEDICAL_EPISODE',
          'play injury reference is not backed by a same-game football medical episode',
          [play.id, episodeId],
        );
    }
  }

  for (const game of world.football.games) {
    const perPlayer = new Map<
      string,
      { organizationId: EntityId; playerId: EntityId; units: number }
    >();
    for (const play of world.football.plays.filter(
      (candidate) => candidate.gameId === game.id,
    ))
      for (const participant of play.participation) {
        const key = `${participant.organizationId}|${participant.playerId}`;
        const current = perPlayer.get(key) ?? {
          organizationId: participant.organizationId,
          playerId: participant.playerId,
          units: 0,
        };
        current.units += participant.workloadUnits;
        perPlayer.set(key, current);
      }
    for (const entry of perPlayer.values()) {
      const cap = historicalMedicalCap(
        world,
        entry.organizationId,
        entry.playerId,
        game.playedAt,
      );
      if (cap !== null && entry.units > cap)
        add(
          'USAGE_EXCEEDS_MEDICAL_CLEARANCE',
          `game workload ${entry.units} exceeds medical cap ${cap}`,
          [game.id, entry.playerId],
          entry.organizationId,
        );
    }
  }

  const duplicateCollections: readonly (readonly { readonly id: string }[])[] =
    [
      world.football.fixtures,
      world.football.designations,
      world.football.gamePlans,
      world.football.games,
      world.football.plays,
      world.football.causalLinks,
    ];
  for (const collection of duplicateCollections)
    for (const id of duplicateIds(collection))
      add(
        'DUPLICATE_FOOTBALL_TRUTH',
        'football collection contains a duplicate record id',
        [id],
      );

  for (const link of world.football.causalLinks) {
    const play = world.football.plays.find(
      (candidate) => candidate.id === link.playId,
    );
    const expectedParticipantIds =
      play === undefined
        ? new Set<EntityId>()
        : participantIdsFor(play, link.organizationId);
    const linkParticipantsValid =
      play !== undefined &&
      link.gameId === play.gameId &&
      link.fixtureId === play.fixtureId &&
      link.consequenceRef.kind === 'play_fact' &&
      link.consequenceRef.playId === play.id &&
      link.consequenceRef.resultKind === play.resultKind &&
      link.participantPlayerIds.length === expectedParticipantIds.size &&
      link.participantPlayerIds.every((id) => expectedParticipantIds.has(id));
    const inputsValid =
      play !== undefined &&
      link.inputRefs.every((ref) =>
        causalInputUsed(world, play, link.organizationId, ref),
      );
    if (!linkParticipantsValid || !inputsValid)
      add(
        'CAUSAL_LINK_INPUT_NOT_USED',
        'Sunday-Proof link cites an input/consequence that did not enter this play resolution',
        [link.id, link.playId],
        link.organizationId,
      );
  }

  for (const claim of world.information.claims) {
    if (!claim.propositionType.startsWith('football_')) continue;
    if (containsForbiddenEvidenceTruth(claim.proposition))
      add(
        'LATENT_TRUTH_IN_ORG_EVIDENCE',
        'football observation claim contains latent/private engine truth',
        [claim.id],
        claim.holderOrganizationIds[0],
      );
    if (
      containsPrivateCallLeak(
        world,
        claim.holderOrganizationIds,
        claim.proposition,
      )
    )
      add(
        'PRIVATE_CALL_LEAKAGE',
        'football observation claim contains a rival/private game-plan or final-call reference',
        [claim.id],
        claim.holderOrganizationIds[0],
      );
  }

  if (footballHasDuplicatePlayerTruth(world))
    add(
      'DUPLICATE_PLAYER_TRUTH',
      'football domain persists player ability/readiness/medical/team-strength truth it does not own',
      [],
    );

  if (presentation !== undefined) {
    try {
      const expectedFast = fastSimSummary(world, presentation.gameId);
      if (
        presentation.fastSim !== undefined &&
        !same(expectedFast, presentation.fastSim)
      )
        add(
          'PRESENTATION_OUTCOME_DIVERGENCE',
          'supplied Fast Sim projection diverges from the authoritative football ledger',
          [presentation.gameId],
        );
      if (
        presentation.gameCast !== undefined &&
        !same(gameCastFrames(world, presentation.gameId), presentation.gameCast)
      )
        add(
          'PRESENTATION_OUTCOME_DIVERGENCE',
          'supplied GameCast projection diverges from the authoritative football ledger',
          [presentation.gameId],
        );
      if (
        presentation.replay !== undefined &&
        !same(
          footballReplayFacts(world, presentation.gameId),
          presentation.replay,
        )
      )
        add(
          'PRESENTATION_OUTCOME_DIVERGENCE',
          'supplied replay projection diverges from the authoritative football ledger',
          [presentation.gameId],
        );
    } catch {
      add(
        'PRESENTATION_OUTCOME_DIVERGENCE',
        'presentation input cannot be reconciled to an authoritative final game',
        [presentation.gameId],
      );
    }
  }

  return findings.sort(
    (a, b) =>
      byText(a.code, b.code) ||
      byText(a.organizationId ?? '', b.organizationId ?? '') ||
      byText(a.subjectIds.join(','), b.subjectIds.join(',')) ||
      byText(a.detail, b.detail),
  );
};

export interface FootballMetrics {
  readonly fixtures: number;
  readonly finalFixtures: number;
  readonly games: number;
  readonly plays: number;
  readonly scrimmagePlays: number;
  readonly specialTeamsPlays: number;
  readonly totalPoints: number;
  readonly participationPlays: number;
  readonly workloadUnits: number;
  readonly footballInjuries: number;
  readonly acceptedPenalties: number;
  readonly causalLinks: number;
  readonly footballObservationClaims: number;
  readonly serializedBytes: {
    readonly football: number;
    readonly fixtures: number;
    readonly designations: number;
    readonly gamePlans: number;
    readonly games: number;
    readonly plays: number;
    readonly causalLinks: number;
  };
}

const utf8ByteLength = (value: string): number => {
  let bytes = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i += 1;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
};

const serializedBytes = (value: unknown): number =>
  utf8ByteLength(canonicalString(value));

/** Deterministic Package G-facing football/storage counters. Pure measurement only. */
export const collectFootballMetrics = (
  world: FootballWorld,
): FootballMetrics => ({
  fixtures: world.football.fixtures.length,
  finalFixtures: world.football.fixtures.filter(
    (fixture) => fixture.status === 'final',
  ).length,
  games: world.football.games.length,
  plays: world.football.plays.length,
  scrimmagePlays: world.football.plays.filter(
    (play) => play.playCategory === 'run' || play.playCategory === 'pass',
  ).length,
  specialTeamsPlays: world.football.plays.filter(
    (play) => play.playCategory !== 'run' && play.playCategory !== 'pass',
  ).length,
  totalPoints: world.football.games.reduce(
    (sum, game) => sum + game.homeScore + game.awayScore,
    0,
  ),
  participationPlays: world.football.plays.reduce(
    (sum, play) => sum + play.participation.length,
    0,
  ),
  workloadUnits: world.football.plays.reduce(
    (sum, play) =>
      sum +
      play.participation.reduce(
        (participantSum, participant) =>
          participantSum + participant.workloadUnits,
        0,
      ),
    0,
  ),
  footballInjuries: world.medical.episodes.filter(
    (episode) => episode.sourceKind === 'football',
  ).length,
  acceptedPenalties: world.football.plays.filter(
    (play) => play.penaltyAccepted === true,
  ).length,
  causalLinks: world.football.causalLinks.length,
  footballObservationClaims: world.information.claims.filter((claim) =>
    claim.propositionType.startsWith('football_'),
  ).length,
  serializedBytes: {
    football: serializedBytes(world.football),
    fixtures: serializedBytes(world.football.fixtures),
    designations: serializedBytes(world.football.designations),
    gamePlans: serializedBytes(world.football.gamePlans),
    games: serializedBytes(world.football.games),
    plays: serializedBytes(world.football.plays),
    causalLinks: serializedBytes(world.football.causalLinks),
  },
});
