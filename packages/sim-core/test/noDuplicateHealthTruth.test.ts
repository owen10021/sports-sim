import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_FOOTBALL_RULES,
  createMedicalEpisodeChange,
  resolveFootballInjuryOccurrence,
  type FootballRulesV1,
} from '../src/index';
import { E_FIXTURE_1, NF, nf } from './support/packageEHarness';
import { selectionWorld } from './support/footballSelectionHarness';

const guaranteed = (): FootballRulesV1 => ({
  ...SYNTHETIC_FOOTBALL_RULES,
  injury: {
    ...SYNTHETIC_FOOTBALL_RULES.injury,
    baseRiskBpPerExposure: 10000,
    fatigueRiskScaleBp: 0,
    durabilityProtectionScaleBp: 0,
    exposureRiskBpByCategory:
      SYNTHETIC_FOOTBALL_RULES.injury.exposureRiskBpByCategory.map((x) => ({
        ...x,
        riskBp: 10000,
      })),
    conditions: [
      {
        conditionKey: 'synthetic_single_truth_injury',
        affectedActionKeys: ['carry_ball'],
        weightBp: 10000,
        severityMinBp: 7000,
        severityMaxBp: 7000,
      },
    ],
    recoveryResponsivenessMinBp: 4000,
    recoveryResponsivenessMaxBp: 4000,
  },
});

describe('football injury has one authoritative health truth', () => {
  it('stores the occurrence only as a Package D medical episode, never as E injury state', () => {
    const world = selectionWorld();
    const occurrence = resolveFootballInjuryOccurrence(
      guaranteed(),
      {
        fixtureId: E_FIXTURE_1,
        playId: 'play-single-truth',
        organizationId: NF.org,
        playerId: nf(3),
        occurredAt: world.simDate,
        playCategory: 'run',
        contactClass: 'tackle',
        actionExposures: [{ actionKey: 'carry_ball', attempts: 1 }],
        fatigueBp: 2000,
        durabilityBp: 5000,
      },
      1,
    )!;
    const footballBefore = JSON.stringify(world.football);
    const change = createMedicalEpisodeChange(world, occurrence.medicalInput);

    expect(JSON.stringify(change.nextWorld.football)).toBe(footballBefore);
    expect('injuries' in (change.nextWorld.football as object)).toBe(false);
    expect(change.nextWorld.medical.episodes).toHaveLength(
      world.medical.episodes.length + 1,
    );
    const episode = change.nextWorld.medical.episodes.at(-1)!;
    expect(episode.sourceKind).toBe('football');
    expect(episode.initialStructuralSeverityBp).toBe(7000);
    expect('returnDate' in occurrence.medicalInput).toBe(false);
    expect('prognosis' in occurrence.medicalInput).toBe(false);
  });
});
