import { describe, expect, it } from 'vitest';
import { MemoryCareerStore, careerStoreContractCases } from '../src/index';

describe('MemoryCareerStore satisfies the CareerStore contract', () => {
  const cases = careerStoreContractCases(async () => {
    const store = new MemoryCareerStore();
    return { store, failNextCommit: () => store.failNextCommit() };
  });

  it('exposes the full contract (guards against silently dropping cases)', () => {
    expect(cases.length).toBeGreaterThanOrEqual(12);
    expect(new Set(cases.map((c) => c.name)).size).toBe(cases.length);
  });

  for (const c of cases) {
    it(c.name, async () => {
      await c.run();
    });
  }
});
