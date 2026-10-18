import { describe, expect, it } from 'vitest';
import { resolveCapabilityAdaptation } from '../src/index';
import { adaptationInput } from './support/developmentFixture';
describe('causal capability adaptation', () => {
  it('allows meaningful work to produce zero change and bounds every proposed delta', () => {
    const i = adaptationInput();
    expect(resolveCapabilityAdaptation({ ...i, rollU32: 0 })).toBe(0);
    expect(resolveCapabilityAdaptation({ ...i, meaningfulUnits: 0 })).toBe(0);
    expect(resolveCapabilityAdaptation({ ...i, malleabilityBp: 0 })).toBe(0);
    expect(resolveCapabilityAdaptation(i)).toBeGreaterThan(0);
    for (const currentValueBp of [0, 1, 9999, 10000]) {
      const delta = resolveCapabilityAdaptation({ ...i, currentValueBp });
      expect(Number.isSafeInteger(delta)).toBe(true);
      expect(currentValueBp + delta).toBeGreaterThanOrEqual(0);
      expect(currentValueBp + delta).toBeLessThanOrEqual(10000);
    }
  });
  it('makes maximum and redundant workload inferior to a meaningful recoverable dose', () => {
    const i = adaptationInput();
    const moderate = resolveCapabilityAdaptation(i);
    const maxed = resolveCapabilityAdaptation({
      ...i,
      meaningfulUnits: 100,
      loadUnits: 100,
    });
    expect(maxed).toBeLessThan(moderate);
    expect(maxed).toBeLessThanOrEqual(0);
    expect(
      resolveCapabilityAdaptation({ ...i, acuteFatigueBp: 10000 }),
    ).toBeLessThan(moderate);
  });
  it('does not accept salary, draft status, starts, statistics or beliefs as growth currency', () => {
    const i = adaptationInput();
    const withStatus = {
      ...i,
      draftSlot: 1,
      salary: 999999,
      starts: 17,
      stats: { yards: 9000 },
      organizationBelief: 'superstar',
    };
    expect(resolveCapabilityAdaptation(withStatus)).toBe(
      resolveCapabilityAdaptation(i),
    );
  });
});
