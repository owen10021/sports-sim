import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_E_RULESET,
  entityId,
  recordId,
  resolveScheduledGameChange,
  type FootballWorld,
  type MedicalParticipation,
} from '../src/index';
import { E_FIXTURE_1, NF, nf } from './support/packageEHarness';
import { selectionWorld } from './support/footballSelectionHarness';

const withClearance = (
  world: FootballWorld,
  playerId: string,
  participation: MedicalParticipation,
  maxLoadUnits: number | null,
): FootballWorld => ({
  ...world,
  medical: {
    ...world.medical,
    episodes: [
      ...world.medical.episodes,
      {
        id: recordId(`episode-${playerId}`),
        playerId: entityId(playerId),
        conditionKey: 'synthetic_game_limit',
        onsetAt: world.simDate,
        sourceKind: 'synthetic_test',
        affectedActionKeys: ['read_progression', 'throw_pass'],
        initialStructuralSeverityBp: 1000,
        recoveryResponsivenessBp: 5000,
        baselineReinjuryRiskBp: 500,
        status: 'open',
      },
    ],
    clearances: [
      ...world.medical.clearances,
      {
        id: recordId(`clearance-${playerId}`),
        episodeId: recordId(`episode-${playerId}`),
        organizationId: entityId(NF.org),
        playerId: entityId(playerId),
        participation,
        maxLoadUnits,
        sourceProposalId: recordId(`proposal-clearance-${playerId}`),
        committedAt: world.simDate,
        supersedesClearanceId: null,
      },
    ],
  },
});

const totalFor = (
  plays: readonly {
    readonly participation: readonly {
      readonly playerId: string;
      readonly workloadUnits: number;
    }[];
  }[],
  playerId: string,
): number =>
  plays.reduce(
    (sum, p) =>
      sum +
      p.participation
        .filter((x) => x.playerId === playerId)
        .reduce((n, x) => n + x.workloadUnits, 0),
    0,
  );

describe('complete-game medical workload enforcement', () => {
  it('never fields a zero-cap player and uses a legal backup', () => {
    const primary = nf(1);
    const backup = nf(2);
    const out = resolveScheduledGameChange(
      withClearance(selectionWorld(), primary, 'out', null),
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    );
    expect(totalFor(out.gameDraft.plays, primary)).toBe(0);
    expect(totalFor(out.gameDraft.plays, backup)).toBeGreaterThan(0);
  });

  it('keeps limited usage at or below the hard cap, then substitutes', () => {
    const primary = nf(1);
    const backup = nf(2);
    const cap = 12;
    const out = resolveScheduledGameChange(
      withClearance(selectionWorld(), primary, 'limited', cap),
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    );
    expect(totalFor(out.gameDraft.plays, primary)).toBeGreaterThan(0);
    expect(totalFor(out.gameDraft.plays, primary)).toBeLessThanOrEqual(cap);
    expect(totalFor(out.gameDraft.plays, backup)).toBeGreaterThan(0);
  });

  it('does not invent a cap for a full clearance', () => {
    const primary = nf(1);
    const out = resolveScheduledGameChange(
      withClearance(selectionWorld(), primary, 'full', null),
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    );
    expect(totalFor(out.gameDraft.plays, primary)).toBeGreaterThan(12);
  });
});
