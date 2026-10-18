import type { EventSpec } from './commandRouter';
import { mintRecordIds } from './commandSupport';
import {
  createInitialGameState,
  designationProblems,
  type GameOrganizations,
} from './gameState';
import {
  type FootballGameRecord,
  type FootballState,
  type GameDayDesignation,
  type GameState,
  type ResolvedPlayFact,
} from './football';
import { scheduledGameProblems } from './footballCalendar';
import { requireFootballRules, type FootballRulesV1 } from './footballRules';
import { hashCanonical } from './hash';
import { medicalWorkloadCap } from './medical';
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

export interface CompleteGameDraft {
  readonly gameRecord: FootballGameRecord;
  readonly plays: readonly ResolvedPlayDraft[];
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

const participationSummary = (plays: readonly ResolvedPlayDraft[]) => {
  const byPlayer = new Map<
    string,
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
  let state = createInitialGameState(
    rules,
    orgs,
    fixture.id,
    fixture.awayOrganizationId,
  );
  const plays: ResolvedPlayDraft[] = [];
  const MAX_PLAYS = 2000;

  while (state.status !== 'final') {
    if (plays.length >= MAX_PLAYS)
      fail(
        `game ${fixture.id} exceeded ${MAX_PLAYS} plays without reaching final`,
      );
    const football = footballForAvailablePlayers(world, state, rules);
    let resolved;
    try {
      resolved = resolvePlay(
        {
          ruleset,
          football,
          latent: {
            roster: world.roster,
            development: world.development,
            medical: world.medical,
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
    assertMedicalCaps(world, state, resolved.resolved);
    plays.push(resolved.resolved);
  }

  const minted = mintRecordIds(world, 1 + plays.length);
  const gameId = minted.ids[0]!;
  const playIds = minted.ids.slice(1);
  const playRecords: ResolvedPlayFact[] = playIds.map((id, index) => ({
    id,
    gameId,
    fixtureId: fixture.id,
    sequence: index + 1,
  }));
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
    teamStatSummary: {
      homeOffensivePlays: plays.filter(
        (p) => p.offenseOrganizationId === fixture.homeOrganizationId,
      ).length,
      awayOffensivePlays: plays.filter(
        (p) => p.offenseOrganizationId === fixture.awayOrganizationId,
      ).length,
    },
    medicalEpisodeIds: [],
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

  const nextFootball: FootballState = {
    ...world.football,
    fixtures: world.football.fixtures.map((f) =>
      f.id === fixture.id
        ? { ...f, status: 'final' as const, finalGameId: gameId }
        : f,
    ),
    games: [...world.football.games, gameRecord],
    plays: [...world.football.plays, ...playRecords],
  };
  const nextWorld: FootballWorld = {
    ...world,
    football: nextFootball,
    rng: rng.snapshot(),
    nextIds: { ...world.nextIds, record: minted.next },
  };

  return {
    nextWorld,
    eventSpecs: [
      {
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
      },
    ],
    gameDraft: {
      gameRecord,
      plays,
      finalState: state,
      rngDrawStart,
      rngDrawCount,
    },
  };
};
