import { describe, expect, it } from 'vitest';
import {
  resolveCapabilityAdaptation,
  resolveRoleLearning,
  requireDevelopmentRules,
  SYNTHETIC_PACKAGE_D_RULESET,
  entityId,
  recordId,
} from '../src/index';
import { adaptationInput } from './support/developmentFixture';
import { COACH, NF, D_TODAY } from './support/packageDHarness';
const rules = requireDevelopmentRules(SYNTHETIC_PACKAGE_D_RULESET);

describe('family-specific maturation and decline', () => {
  it('a veteran can lose explosiveness while retaining cognitive capability and learned knowledge', () => {
    const i = {
      ...adaptationInput(),
      ageDays: 33 * 365,
      meaningfulUnits: 0,
      loadUnits: 0,
      elapsedDays: 365,
    };
    const physical = rules.capabilityFamilies.find(
      (f) => f.familyKey === 'explosive_athleticism',
    )!;
    const cognitive =
      rules.capabilityFamilies.find((f) => f.familyKey === 'processing') ??
      rules.capabilityFamilies.find((f) =>
        f.capabilityKeys.includes('processing'),
      )!;
    expect(
      resolveCapabilityAdaptation({ ...i, family: physical }),
    ).toBeLessThan(0);
    expect(resolveCapabilityAdaptation({ ...i, family: cognitive })).toBe(0);
    const playerId = entityId('player-veteran');
    const learned = resolveRoleLearning({
      playerId,
      schemeKey: 'base_offense',
      responsibilityKey: 'run_reads',
      transferFamilyKey: 'ball_carrier',
      knowledge: [
        {
          playerId,
          schemeKey: 'base_offense',
          responsibilityKey: 'run_reads',
          transferFamilyKey: 'ball_carrier',
          familiarityBp: 8000,
          lastMeaningfulRepAt: null,
        },
      ],
      allocations: [
        {
          id: recordId('veteran-lesson'),
          playerId,
          organizationId: NF.org,
          windowId: recordId('window-veteran'),
          resourceKey: 'development_reps',
          scopeKey: 'running_back',
          units: 40,
          teacherPersonId: COACH,
          responsibilityKeys: ['run_reads'],
          basisPlanIds: [],
          sourceProposalId: recordId('proposal-veteran'),
          committedAt: D_TODAY,
        },
      ],
      teachingProfiles: [
        {
          personId: COACH,
          bandwidthUnits: 80,
          expertise: [{ responsibilityKey: 'run_reads', teachingBp: 10000 }],
        },
      ],
      processingBp: 10000,
      adaptabilityBp: 10000,
      rules,
      occurredAt: '2027-03-01',
    });
    expect(learned.afterBp).toBeGreaterThan(8000);
  });
  it('has no universal age-30 switch and different families peak differently', () => {
    const i = adaptationInput();
    const a = rules.capabilityFamilies[0]!,
      b = rules.capabilityFamilies.at(-1)!;
    expect(
      resolveCapabilityAdaptation({ ...i, family: a, ageDays: 30 * 365 }),
    ).not.toBe(
      resolveCapabilityAdaptation({ ...i, family: b, ageDays: 30 * 365 }),
    );
    const before = resolveCapabilityAdaptation({ ...i, ageDays: 30 * 365 - 1 });
    const after = resolveCapabilityAdaptation({ ...i, ageDays: 30 * 365 });
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
  });
});
