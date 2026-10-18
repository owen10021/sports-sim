import type { EventSpec } from './commandRouter';
import { mintRecordId } from './commandSupport';
import { developmentProfileFor } from './development';
import {
  applyFootballUsageEvidence,
  type FootballUsageEvidence,
} from './developmentFootballUsage';
import {
  createInitialGameState,
  designationProblems,
  type GameOrganizations,
} from './gameState';
import {
  type FootballGameRecord,
  type FootballPlayStateFact,
  type FootballState,
  type GameDayDesignation,
  type GameState,
  type ResolvedPlayFact,
} from './football';
import { scheduledGameProblems } from './footballCalendar';
import {
  createFootballObservationClaims,
  defaultFootballObserver,
  type FootballObservationInput,
} from './footballEvidence';
import { resolveFootballInjuryOccurrence } from './footballInjuries';
import { requireFootballRules, type FootballRulesV1 } from './footballRules';
import { deriveGameStatistics, reconcileFinalGame } from './footballStats';
import { hashCanonical } from './hash';
import type { EntityId, RecordId } from './ids';
import { medicalWorkloadCap } from './medical';
import { createMedicalEpisodeChange } from './medicalCommands';
import { resolvePlay, type ResolvedPlayDraft } from './playResolver';
import { DeterministicRng } from './rng';
import type { LeagueRulesetManifest } from './ruleset';
import type { FootballWorld } from './world';

export class FootballGameResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FootballGameResolutionError';
  }
}

export interface CompleteGamePlayDraft extends ResolvedPlayDraft {
  readonly id: RecordId;
  readonly medicalEpisodeIds: readonly RecordId[];
}

export interface CompleteGameDraft {
  readonly gameRecord: FootballGameRecord;
  readonly plays: readonly CompleteGamePlayDraft[];
  readonly finalState: GameState;
  readonly rngDrawStart: number;
  readonly rngDrawCount: number;
}

export interface ScheduledGameChange {
  readonly nextWorld: FootballWorld;
  readonly eventSpecs: readonly EventSpec[];
  readonly gameDraft: CompleteGameDraft;
}

const fail = (message: string): never => {
  throw new FootballGameResolutionError(message);
};

const workloadOf = (state: GameState, playerId: string): number =>
  state.workloadByPlayer.find((x) => x.playerId === playerId)?.workloadUnits ??
  0;

const maxPotentialWorkload = (
  rules: FootballRulesV1,
  football: FootballState,
  designation: GameDayDesignation,
): number => {
  if (
    designation.status !== 'active' ||
    designation.unitKey === null ||
    designation.roleKey === null
  )
    return 0;
  const plan = football.gamePlans.find(
    (p) =>
      p.fixtureId === designation.fixtureId &&
      p.organizationId === designation.organizationId,
  );
  if (plan === undefined) return 0;
  const loads = new Map(
    rules.exposureConversion.map((x) => [x.actionKey, x.loadUnitsPerExposure]),
  );
  let max = 0;
  for (const concept of rules.concepts) {
    if (
      concept.side !== designation.unitKey ||
      !plan.conceptKeys.includes(concept.conceptKey)
    )
      continue;
    for (const formationKey of concept.formationKeys) {
      const formation = rules.formations.find(
        (f) =>
          f.formationKey === formationKey && f.side === designation.unitKey,
      );
      if (formation === undefined) continue;
      for (const slot of formation.slots) {
        if (!slot.eligibleRoles.includes(designation.roleKey)) continue;
        const units = concept.assignments
          .filter((a) => a.slotKeys.includes(slot.slotKey))
          .reduce((sum, a) => sum + (loads.get(a.actionKey) ?? 0), 0);
        max = Math.max(max, units);
      }
    }
  }
  return max;
};

const footballForAvailablePlayers = (
  world: FootballWorld,
  state: GameState,
  rules: FootballRulesV1,
): FootballState => ({
  ...world.football,
  designations: world.football.designations.filter((d) => {
    if (d.status !== 'active' || d.fixtureId !== state.fixtureId) return true;
    const cap = medicalWorkloadCap(world, d.organizationId, d.playerId);
    if (cap === null) return true;
    const current = workloadOf(state, d.playerId);
    const nextMaximum = maxPotentialWorkload(rules, world.football, d);
    return current < cap && current + nextMaximum <= cap;
  }),
});

const assertMedicalCaps = (
  world: FootballWorld,
  state: GameState,
  play: ResolvedPlayDraft,
): void => {
  for (const p of play.participation) {
    const cap = medicalWorkloadCap(world, p.organizationId, p.playerId);
    if (cap === null) continue;
    const total = workloadOf(state, p.playerId);
    if (total > cap)
      fail(
        `player ${p.playerId} exceeded medical workload cap ${cap} with ${total} units`,
      );
  }
};

const usageEvidenceFor = (
  playId: RecordId,
  occurredAt: string,
  play: ResolvedPlayDraft,
): readonly FootballUsageEvidence[] =>
  play.participation.map((p) => ({
    fixtureId: play.fixtureId,
    playId,
    organizationId: p.organizationId,
    playerId: p.playerId,
    occurredAt,
    workloadUnits: p.workloadUnits,
    contactClass: p.contactClass,
    responsibilityExposures: p.responsibilityExposures,
    actionExposures: p.actionExposures,
  }));

const createdEpisodeId = (
  before: FootballWorld,
  after: FootballWorld,
): RecordId => {
  const prior = new Set(before.medical.episodes.map((e) => e.id));
  const created = after.medical.episodes.filter((e) => !prior.has(e.id));
  if (created.length !== 1)
    return fail(
      `football medical ingress created ${created.length} episodes, expected 1`,
    );
  return created[0]!.id;
};

const stateFact = (state: GameState): FootballPlayStateFact => ({
  possessionOrganizationId: state.possessionOrganizationId,
  period: state.period,
  clockSecondsRemaining: state.clockSecondsRemaining,
  down: state.down,
  yardsToGo: state.yardsToGo,
  yardLine: state.yardLine,
  homeScore: state.homeScore,
  awayScore: state.awayScore,
  nextSnap: state.nextSnap,
  status: state.status,
});

const persistedPlayFact = (input: {
  readonly id: RecordId;
  readonly gameId: RecordId;
  readonly homeOrganizationId: ResolvedPlayDraft['offenseOrganizationId'];
  readonly awayOrganizationId: ResolvedPlayDraft['offenseOrganizationId'];
  readonly preState: GameState;
  readonly postState: GameState;
  readonly draft: ResolvedPlayDraft;
  readonly medicalEpisodeIds: readonly RecordId[];
}): ResolvedPlayFact => ({
  id: input.id,
  gameId: input.gameId,
  fixtureId: input.draft.fixtureId,
  sequence: input.draft.sequence,
  homeOrganizationId: input.homeOrganizationId,
  awayOrganizationId: input.awayOrganizationId,
  offenseOrganizationId: input.draft.offenseOrganizationId,
  defenseOrganizationId: input.draft.defenseOrganizationId,
  pre: stateFact(input.preState),
  post: stateFact(input.postState),
  offense: input.draft.offense,
  defense: input.draft.defense,
  playCategory: input.draft.playCategory,
  resultKind: input.draft.resultKind,
  yardsGained: input.draft.yardsGained,
  turnover: input.draft.turnover,
  touchdown: input.draft.touchdown,
  safety: input.draft.safety,
  kick: input.draft.kick,
  penalty: input.draft.penalty,
  penaltyAccepted: input.draft.penaltyAccepted,
  playStands: input.draft.playStands,
  clockSecondsUsed: input.draft.clockSecondsUsed,
  principals: input.draft.principals,
  participation: input.draft.participation,
  medicalEpisodeIds: input.medicalEpisodeIds,
  rngDrawStart: input.draft.rngDrawStart,
  rngDrawCount: input.draft.rngDrawCount,
  traceHash: input.draft.traceHash,
});

const participationSummary = (plays: readonly CompleteGamePlayDraft[]) => {
  const byPlayer = new Map<
    EntityId,
    {
      organizationId: ResolvedPlayDraft['offenseOrganizationId'];
      plays: number;
      workloadUnits: number;
    }
  >();
  for (const play of plays) {
    for (const p of play.participation) {
      const held = byPlayer.get(p.playerId) ?? {
        organizationId: p.organizationId,
        plays: 0,
        workloadUnits: 0,
      };
      held.plays += 1;
      held.workloadUnits += p.workloadUnits;
      byPlayer.set(p.playerId, held);
    }
  }
  return [...byPlayer.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([playerId, value]) => ({ playerId, ...value }));
};

export const resolveScheduledGameChange = (
  world: FootballWorld,
  ruleset: LeagueRulesetManifest,
  fixtureId: string,
): ScheduledGameChange => {
  const problems = scheduledGameProblems(world, fixtureId);
  if (problems.length > 0) fail(problems.join('; '));
  const rules = requireFootballRules(ruleset);
  const fixture =
    world.football.fixtures.find((f) => f.id === fixtureId) ??
    fail(`${fixtureId} is not a fixture`);
  const orgs: GameOrganizations = {
    homeOrganizationId: fixture.homeOrganizationId,
    awayOrganizationId: fixture.awayOrganizationId,
  };
  const designationIssues = designationProblems({
    rules,
    orgs,
    fixtureId: fixture.id,
    designations: world.football.designations,
  });
  if (designationIssues.length > 0) fail(designationIssues.join('; '));

  const homePlan = world.football.gamePlans.find(
    (p) =>
      p.fixtureId === fixture.id &&
      p.organizationId === fixture.homeOrganizationId,
  )!;
  const awayPlan = world.football.gamePlans.find(
    (p) =>
      p.fixtureId === fixture.id &&
      p.organizationId === fixture.awayOrganizationId,
  )!;

  const rng = DeterministicRng.fromState(world.rng);
  const rngDrawStart = rng.snapshot().draws;
  let workingWorld = world;
  const gameMint = mintRecordId(workingWorld);
  const gameId = gameMint.id;
  workingWorld = {
    ...workingWorld,
    nextIds: { ...workingWorld.nextIds, record: gameMint.next },
  };
  let state = createInitialGameState(
    rules,
    orgs,
    fixture.id,
    fixture.awayOrganizationId,
  );
  const plays: CompleteGamePlayDraft[] = [];
  const eventSpecs: EventSpec[] = [];
  const medicalEpisodeIds: RecordId[] = [];
  const MAX_PLAYS = 2000;

  while (state.status !== 'final') {
    if (plays.length >= MAX_PLAYS)
      fail(
        `game ${fixture.id} exceeded ${MAX_PLAYS} plays without reaching final`,
      );
    const preState = state;
    const football = footballForAvailablePlayers(workingWorld, state, rules);
    let resolved;
    try {
      resolved = resolvePlay(
        {
          ruleset,
          football,
          latent: {
            roster: workingWorld.roster,
            development: workingWorld.development,
            medical: workingWorld.medical,
          },
          gameState: state,
        },
        rng,
      );
    } catch (error) {
      if (error instanceof Error) fail(error.message);
      throw error;
    }
    state = resolved.nextGameState;
    assertMedicalCaps(workingWorld, state, resolved.resolved);

    const playMint = mintRecordId(workingWorld);
    const playId = playMint.id;
    const provisional = persistedPlayFact({
      id: playId,
      gameId,
      homeOrganizationId: fixture.homeOrganizationId,
      awayOrganizationId: fixture.awayOrganizationId,
      preState,
      postState: state,
      draft: resolved.resolved,
      medicalEpisodeIds: [],
    });
    workingWorld = {
      ...workingWorld,
      rng: rng.snapshot(),
      nextIds: { ...workingWorld.nextIds, record: playMint.next },
      football: {
        ...workingWorld.football,
        plays: [...workingWorld.football.plays, provisional],
      },
    };

    const usage = applyFootballUsageEvidence(
      workingWorld,
      ruleset,
      usageEvidenceFor(playId, world.simDate, resolved.resolved),
    );
    workingWorld = usage.nextWorld;
    eventSpecs.push(...usage.eventSpecs);

    const playMedicalIds: RecordId[] = [];
    const participants = [...resolved.resolved.participation].sort((a, b) =>
      a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0,
    );
    for (const participant of participants) {
      const readiness =
        workingWorld.development.readiness.find(
          (r) => r.playerId === participant.playerId,
        ) ?? fail(`missing D readiness for ${participant.playerId}`);
      const profile =
        developmentProfileFor(workingWorld.development, participant.playerId) ??
        fail(`missing D development profile for ${participant.playerId}`);
      const occurrence = resolveFootballInjuryOccurrence(
        rules,
        {
          fixtureId: fixture.id,
          playId,
          organizationId: participant.organizationId,
          playerId: participant.playerId,
          occurredAt: world.simDate,
          playCategory: resolved.resolved.playCategory,
          contactClass: participant.contactClass,
          actionExposures: participant.actionExposures,
          fatigueBp: readiness.acuteFatigueBp,
          durabilityBp: profile.durabilityBp,
        },
        rng.nextU32(),
      );
      if (occurrence === null) continue;
      const beforeMedical = {
        ...workingWorld,
        rng: rng.snapshot(),
      };
      const medical = createMedicalEpisodeChange(
        beforeMedical,
        occurrence.medicalInput,
      );
      const episodeId = createdEpisodeId(beforeMedical, medical.nextWorld);
      workingWorld = medical.nextWorld;
      eventSpecs.push(...medical.eventSpecs);
      playMedicalIds.push(episodeId);
      medicalEpisodeIds.push(episodeId);
    }
    workingWorld = { ...workingWorld, rng: rng.snapshot() };
    if (playMedicalIds.length > 0) {
      workingWorld = {
        ...workingWorld,
        football: {
          ...workingWorld.football,
          plays: workingWorld.football.plays.map((p) =>
            p.id === playId ? { ...p, medicalEpisodeIds: playMedicalIds } : p,
          ),
        },
      };
    }
    plays.push({
      ...resolved.resolved,
      id: playId,
      medicalEpisodeIds: playMedicalIds,
    });
  }

  const playIds = plays.map((p) => p.id);
  const finalGamePlays = workingWorld.football.plays
    .filter((p) => p.gameId === gameId)
    .sort((a, b) => a.sequence - b.sequence);
  const statistics = deriveGameStatistics(finalGamePlays);
  const rngDrawCount = rng.snapshot().draws - rngDrawStart;
  const summary = participationSummary(plays);
  const gameRecord: FootballGameRecord = {
    id: gameId,
    fixtureId: fixture.id,
    playedAt: world.simDate,
    homeOrganizationId: fixture.homeOrganizationId,
    awayOrganizationId: fixture.awayOrganizationId,
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    gamePlanSnapshotIds: [homePlan.id, awayPlan.id],
    playIds,
    participationSummary: summary,
    statistics,
    medicalEpisodeIds: [...medicalEpisodeIds],
    rngDrawStart,
    rngDrawCount,
    reconciliation: {
      playCount: plays.length,
      finalPeriod: state.period,
      finalClockSecondsRemaining: state.clockSecondsRemaining,
      hash: hashCanonical({
        domain: 'sport-sim/package-e-game-draft',
        version: 1,
        fixtureId: fixture.id,
        finalState: state,
        traceHashes: plays.map((p) => p.traceHash),
      }),
    },
  };
  const reconciliationFindings = reconcileFinalGame(gameRecord, finalGamePlays);
  if (reconciliationFindings.length > 0)
    fail(
      `final game reconciliation failed: ${reconciliationFindings
        .map((finding) => finding.code)
        .join(', ')}`,
    );

  const nextFootball: FootballState = {
    ...workingWorld.football,
    fixtures: workingWorld.football.fixtures.map((f) =>
      f.id === fixture.id
        ? { ...f, status: 'final' as const, finalGameId: gameId }
        : f,
    ),
    games: [...workingWorld.football.games, gameRecord],
  };
  let nextWorld: FootballWorld = {
    ...workingWorld,
    football: nextFootball,
    rng: rng.snapshot(),
  };

  eventSpecs.push({
    type: 'ScheduledGameResolved',
    payload: {
      fixtureId: fixture.id,
      gameId,
      homeOrganizationId: fixture.homeOrganizationId,
      awayOrganizationId: fixture.awayOrganizationId,
      homeScore: state.homeScore,
      awayScore: state.awayScore,
      playCount: plays.length,
      rngDrawStart,
      rngDrawCount,
    },
  });

  const observationInputs: FootballObservationInput[] = [];
  for (const organizationId of [
    fixture.homeOrganizationId,
    fixture.awayOrganizationId,
  ] as const) {
    const sourcePersonId = defaultFootballObserver(nextWorld, organizationId);
    const observedPlay = finalGamePlays.find((play) =>
      play.participation.some((p) => p.organizationId === organizationId),
    );
    const subject = observedPlay?.participation.find(
      (p) => p.organizationId === organizationId,
    );
    if (
      sourcePersonId === null ||
      observedPlay === undefined ||
      subject === undefined
    )
      continue;
    observationInputs.push({
      sourcePersonId,
      organizationId,
      fixtureId: fixture.id,
      gameId,
      playId: observedPlay.id,
      observationType: 'execution_result',
      subjectPlayerId: subject.playerId,
    });
  }
  if (observationInputs.length > 0) {
    const observations = createFootballObservationClaims(
      nextWorld,
      observationInputs,
    );
    nextWorld = observations.nextWorld;
    eventSpecs.push(...observations.eventSpecs);
  }

  return {
    nextWorld,
    eventSpecs,
    gameDraft: {
      gameRecord,
      plays,
      finalState: state,
      rngDrawStart,
      rngDrawCount,
    },
  };
};
