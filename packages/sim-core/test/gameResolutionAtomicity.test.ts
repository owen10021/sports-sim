import { describe, expect, it } from 'vitest';
import { SYNTHETIC_PACKAGE_E_RULESET, WorldKernel } from '../src/index';
import { E_FIXTURE_1 } from './support/packageEHarness';
import { selectionWorld } from './support/footballSelectionHarness';
import { codeOf, runnerFor, snapshotOf } from './support/orgHarness';

describe('ResolveScheduledGame atomicity', () => {
  it('commits nothing when a late pre-commit fault occurs after full game resolution', () => {
    const kernel = WorldKernel.fromGenesis(
      selectionWorld(),
      SYNTHETIC_PACKAGE_E_RULESET,
      {
        beforeCommit: () => {
          throw new Error('synthetic late game commit fault');
        },
      },
    );
    const r = runnerFor(kernel);
    const before = snapshotOf(kernel);
    const res = r.run({ type: 'ResolveScheduledGame', fixtureId: E_FIXTURE_1 });
    expect(codeOf(res)).toBe('INTERNAL_ERROR');
    expect(snapshotOf(kernel)).toEqual(before);
    expect(kernel.world.football.games).toHaveLength(0);
    expect(
      kernel.world.football.fixtures.find((f) => f.id === E_FIXTURE_1)?.status,
    ).toBe('scheduled');
  });
});
