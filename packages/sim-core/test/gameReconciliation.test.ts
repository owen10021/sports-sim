import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_E_RULESET,
  reconcileFinalGame,
  recordId,
  resolveScheduledGameChange,
} from '../src/index';
import { E_FIXTURE_1 } from './support/packageEHarness';
import { selectionWorld } from './support/footballSelectionHarness';

const resolved = () => {
  const out = resolveScheduledGameChange(
    selectionWorld(),
    SYNTHETIC_PACKAGE_E_RULESET,
    E_FIXTURE_1,
  );
  const game = out.nextWorld.football.games[0]!;
  const plays = out.nextWorld.football.plays.filter(
    (p) => p.gameId === game.id,
  );
  return { out, game, plays };
};

const codes = (findings: readonly { readonly code: string }[]) =>
  findings.map((f) => f.code);

describe('final game reconciliation', () => {
  it('returns zero findings for an authoritative complete game', () => {
    const { game, plays } = resolved();
    expect(reconcileFinalGame(game, plays)).toEqual([]);
  });

  it('flags deliberate score, statistics, participation and medical-summary drift', () => {
    const { game, plays } = resolved();
    const firstParticipant = game.participationSummary[0]!;
    const bad = {
      ...game,
      homeScore: game.homeScore + 1,
      participationSummary: game.participationSummary.map((p) =>
        p.playerId === firstParticipant.playerId
          ? { ...p, workloadUnits: p.workloadUnits + 1 }
          : p,
      ),
      statistics: {
        ...game.statistics,
        teams: game.statistics.teams.map((t, i) =>
          i === 0 ? { ...t, turnovers: t.turnovers + 1 } : t,
        ),
      },
      medicalEpisodeIds: [
        ...game.medicalEpisodeIds,
        recordId('rec-not-from-play'),
      ],
    };
    const found = codes(reconcileFinalGame(bad, plays));
    expect(found).toContain('score_mismatch');
    expect(found).toContain('statistics_mismatch');
    expect(found).toContain('participation_mismatch');
    expect(found).toContain('medical_reference_mismatch');
  });

  it('flags broken sequence and pre/post transition joins', () => {
    const { game, plays } = resolved();
    expect(plays.length).toBeGreaterThan(2);
    const broken = plays.map((p, i) =>
      i === 1
        ? {
            ...p,
            sequence: 99,
            pre: {
              ...p.pre,
              clockSecondsRemaining: p.pre.clockSecondsRemaining + 1,
            },
          }
        : p,
    );
    const found = codes(reconcileFinalGame(game, broken));
    expect(found).toContain('sequence_mismatch');
    expect(found).toContain('transition_mismatch');
    expect(found).toContain('play_reference_mismatch');
  });
});
