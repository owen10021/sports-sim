import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_E_RULESET,
  auditFootballWorld,
  entityId,
  recordId,
  requireFootballRules,
  resolveScheduledGameChange,
  type FootballWorld,
} from '../src/index';
import { E_FIXTURE_1, NF, SP } from './support/packageEHarness';
import { selectionWorld } from './support/footballSelectionHarness';

const finalWorld = (): FootballWorld =>
  resolveScheduledGameChange(
    selectionWorld(),
    SYNTHETIC_PACKAGE_E_RULESET,
    E_FIXTURE_1,
  ).nextWorld;

const codes = (world: FootballWorld) =>
  auditFootballWorld(world, SYNTHETIC_PACKAGE_E_RULESET).map((f) => f.code);

const replaceFirstPlay = (
  world: FootballWorld,
  mutate: (
    play: FootballWorld['football']['plays'][number],
  ) => FootballWorld['football']['plays'][number],
): FootballWorld => ({
  ...world,
  football: {
    ...world.football,
    plays: world.football.plays.map((play, index) =>
      index === 0 ? mutate(play) : play,
    ),
  },
});

describe('football world audit', () => {
  it('is clean for an authoritative resolved game', () => {
    expect(typeof auditFootballWorld).toBe('function');
    expect(
      auditFootballWorld(finalWorld(), SYNTHETIC_PACKAGE_E_RULESET),
    ).toEqual([]);
  });

  it('finds fixture/game/play identity corruption and duplicate football truth', () => {
    const base = finalWorld();
    const game = base.football.games[0]!;
    const play = base.football.plays[0]!;

    const fixtureWithoutGame: FootballWorld = {
      ...base,
      football: {
        ...base.football,
        fixtures: base.football.fixtures.map((f) =>
          f.id === game.fixtureId ? { ...f, finalGameId: null } : f,
        ),
      },
    };
    expect(codes(fixtureWithoutGame)).toContain('FIXTURE_FINAL_WITHOUT_GAME');

    const gameWithoutFinalFixture: FootballWorld = {
      ...base,
      football: {
        ...base.football,
        fixtures: base.football.fixtures.map((f) =>
          f.id === game.fixtureId
            ? { ...f, status: 'scheduled' as const, finalGameId: null }
            : f,
        ),
      },
    };
    expect(codes(gameWithoutFinalFixture)).toContain(
      'GAME_WITHOUT_FINAL_FIXTURE',
    );

    const orphanPlay: FootballWorld = {
      ...base,
      football: {
        ...base.football,
        plays: [
          ...base.football.plays,
          {
            ...play,
            id: recordId('audit-orphan-play'),
            gameId: recordId('audit-missing-game'),
          },
        ],
      },
    };
    expect(codes(orphanPlay)).toContain('PLAY_WITHOUT_GAME');

    const duplicateGame: FootballWorld = {
      ...base,
      football: {
        ...base.football,
        games: [
          ...base.football.games,
          { ...game, id: recordId('audit-duplicate-game') },
        ],
      },
    };
    expect(codes(duplicateGame)).toContain('DUPLICATE_GAME_RESOLUTION');

    const duplicateTruth: FootballWorld = {
      ...base,
      football: { ...base.football, plays: [...base.football.plays, play] },
    };
    expect(codes(duplicateTruth)).toContain('DUPLICATE_FOOTBALL_TRUTH');
  });

  it('finds illegal/undesignated participation, medical-cap bypass and bad game reconciliation', () => {
    const base = finalWorld();
    const first = base.football.plays[0]!;
    const participant = first.participation[0]!;

    const illegal = replaceFirstPlay(base, (play) => ({
      ...play,
      participation: play.participation.map((p, index) =>
        index === 0 ? { ...p, playerId: entityId('audit-illegal-player') } : p,
      ),
    }));
    expect(codes(illegal)).toContain('ILLEGAL_PARTICIPANT');
    expect(codes(illegal)).toContain('UNDESIGNATED_PARTICIPANT');

    const episodeId = recordId('audit-medical-episode');
    const capped: FootballWorld = {
      ...base,
      medical: {
        ...base.medical,
        episodes: [
          ...base.medical.episodes,
          {
            id: episodeId,
            playerId: participant.playerId,
            conditionKey: 'audit_condition',
            onsetAt: base.football.games[0]!.playedAt,
            sourceKind: 'synthetic_test' as const,
            affectedActionKeys: [
              participant.actionExposures[0]?.actionKey ?? 'burst',
            ],
            initialStructuralSeverityBp: 1000,
            recoveryResponsivenessBp: 5000,
            baselineReinjuryRiskBp: 1000,
            status: 'open' as const,
          },
        ],
        clearances: [
          ...base.medical.clearances,
          {
            id: recordId('audit-zero-clearance'),
            episodeId,
            organizationId: participant.organizationId,
            playerId: participant.playerId,
            participation: 'out' as const,
            maxLoadUnits: null,
            sourceProposalId: recordId('audit-clearance-proposal'),
            committedAt: base.football.games[0]!.playedAt,
            supersedesClearanceId: null,
          },
        ],
      },
    };
    expect(codes(capped)).toContain('USAGE_EXCEEDS_MEDICAL_CLEARANCE');

    const badStats: FootballWorld = {
      ...base,
      football: {
        ...base.football,
        games: base.football.games.map((g, index) =>
          index === 0 ? { ...g, homeScore: g.homeScore + 1 } : g,
        ),
      },
    };
    expect(codes(badStats)).toContain('GAME_STATS_DO_NOT_RECONCILE');

    const badClock = replaceFirstPlay(base, (play) => ({
      ...play,
      pre: { ...play.pre, clockSecondsRemaining: -1, down: 0 },
    }));
    expect(codes(badClock)).toContain('GAME_CLOCK_STATE_INVALID');
  });

  it('finds missing D usage, missing football medical truth and causal inputs that never entered the play', () => {
    const base = finalWorld();
    const play = base.football.plays[0]!;
    const participant = play.participation[0]!;
    const withoutUsage: FootballWorld = {
      ...base,
      development: {
        ...base.development,
        events: base.development.events.filter(
          (event) =>
            !(
              event.kind === 'football_usage' &&
              event.playerId === participant.playerId &&
              event.causalRecordIds.includes(play.id)
            ),
        ),
      },
    };
    expect(codes(withoutUsage)).toContain('FOOTBALL_USAGE_NOT_REFLECTED_IN_D');

    const missingEpisode = replaceFirstPlay(base, (fact) => ({
      ...fact,
      medicalEpisodeIds: [recordId('audit-missing-football-episode')],
    }));
    expect(codes(missingEpisode)).toContain(
      'FOOTBALL_INJURY_WITHOUT_MEDICAL_EPISODE',
    );

    const link = base.football.causalLinks.find((l) => l.playId === play.id)!;
    const rules = requireFootballRules(SYNTHETIC_PACKAGE_E_RULESET);
    const usedActions = new Set(
      play.participation
        .filter((p) => p.organizationId === link.organizationId)
        .flatMap((p) => p.actionExposures.map((e) => e.actionKey)),
    );
    const unusedAction = rules.actions.find(
      (action) => !usedActions.has(action.actionKey),
    )!;
    const forged: FootballWorld = {
      ...base,
      football: {
        ...base.football,
        causalLinks: base.football.causalLinks.map((candidate) =>
          candidate.id === link.id
            ? {
                ...candidate,
                inputRefs: [
                  ...candidate.inputRefs,
                  {
                    kind: 'ruleset_key' as const,
                    keyKind: 'action' as const,
                    key: unusedAction.actionKey,
                  },
                ],
              }
            : candidate,
        ),
      },
    };
    expect(codes(forged)).toContain('CAUSAL_LINK_INPUT_NOT_USED');
  });

  it('detects latent football evidence and rival private-plan leakage', () => {
    const base = finalWorld();
    const claim = base.information.claims.find((c) =>
      c.propositionType.startsWith('football_'),
    )!;
    const rivalPlan = base.football.gamePlans.find(
      (p) => p.organizationId === SP.org,
    )!;
    const leaked: FootballWorld = {
      ...base,
      information: {
        ...base.information,
        claims: [
          ...base.information.claims,
          {
            ...claim,
            id: recordId('audit-latent-evidence'),
            holderOrganizationIds: [NF.org],
            proposition: { hiddenCapabilityBp: 9999 },
          },
          {
            ...claim,
            id: recordId('audit-private-call-leak'),
            holderOrganizationIds: [NF.org],
            proposition: { rivalGamePlanSnapshotId: rivalPlan.id },
          },
        ],
      },
    };
    const found = codes(leaked);
    expect(found).toContain('LATENT_TRUTH_IN_ORG_EVIDENCE');
    expect(found).toContain('PRIVATE_CALL_LEAKAGE');
  });
});
