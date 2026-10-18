import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_FOOTBALL_RULES,
  createMedicalEpisodeChange,
  functionalReadiness,
  resolveFootballInjuryOccurrence,
  type FootballRulesV1,
} from '../src/index';
import { E_FIXTURE_1, NF, nf } from './support/packageEHarness';
import { selectionWorld } from './support/footballSelectionHarness';

const forcedInjuryRules = (): FootballRulesV1 => ({
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
        conditionKey: 'synthetic_forced_throwing_injury',
        affectedActionKeys: ['throw_pass'],
        weightBp: 10000,
        severityMinBp: 10000,
        severityMaxBp: 10000,
      },
    ],
    recoveryResponsivenessMinBp: 5000,
    recoveryResponsivenessMaxBp: 5000,
  },
});

const exposure = (occurredAt: string) => ({
  fixtureId: E_FIXTURE_1,
  playId: 'play-forced-injury',
  organizationId: NF.org,
  playerId: nf(1),
  occurredAt,
  playCategory: 'pass' as const,
  contactClass: 'tackle',
  actionExposures: [{ actionKey: 'throw_pass', attempts: 1 }],
  fatigueBp: 0,
  durabilityBp: 0,
});

describe('football-origin injury ingress', () => {
  it('derives a deterministic football occurrence from one roll and hands exact input to D', () => {
    const world = selectionWorld();
    const rules = forcedInjuryRules();
    const a = resolveFootballInjuryOccurrence(
      rules,
      exposure(world.simDate),
      0,
    );
    const b = resolveFootballInjuryOccurrence(
      rules,
      exposure(world.simDate),
      0,
    );
    expect(a).toEqual(b);
    expect(a).not.toBeNull();
    expect(a!.medicalInput).toEqual({
      playerId: nf(1),
      conditionKey: 'synthetic_forced_throwing_injury',
      onsetAt: world.simDate,
      sourceKind: 'football',
      affectedActionKeys: ['throw_pass'],
      initialStructuralSeverityBp: 10000,
      recoveryResponsivenessBp: 5000,
      baselineReinjuryRiskBp: rules.injury.baselineReinjuryRiskBp,
    });

    const change = createMedicalEpisodeChange(world, a!.medicalInput);
    const created = change.nextWorld.medical.episodes.filter(
      (e) => e.sourceKind === 'football' && e.playerId === nf(1),
    );
    expect(created).toHaveLength(1);
    expect(change.eventSpecs).toHaveLength(1);
  });

  it('makes the new D episode affect the next football action immediately', () => {
    const world = selectionWorld();
    const before = functionalReadiness(world, nf(1), 'throw_pass')!;
    const occurrence = resolveFootballInjuryOccurrence(
      forcedInjuryRules(),
      exposure(world.simDate),
      0,
    )!;
    const injured = createMedicalEpisodeChange(
      world,
      occurrence.medicalInput,
    ).nextWorld;
    const after = functionalReadiness(injured, nf(1), 'throw_pass')!;
    expect(before).toBeGreaterThan(0);
    expect(after).toBe(0);
  });
});
