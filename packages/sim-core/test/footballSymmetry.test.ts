import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_E_RULESET,
  WorldKernel,
  canonicalString,
  fastSimSummary,
  resolveScheduledGameChange,
} from '../src/index';
import { E_FIXTURE_1 } from './support/packageEHarness';
import { okResult, runnerFor } from './support/orgHarness';
import { selectionWorld } from './support/footballSelectionHarness';

describe('football symmetry and insertion-order resistance', () => {
  it('produces identical accepted football facts for every permitted progression actor', () => {
    const kinds = [
      'human_gm',
      'commissioner',
      'system',
      'test_harness',
    ] as const;
    const identities = kinds.map((kind) => {
      const kernel = WorldKernel.fromGenesis(
        selectionWorld(),
        SYNTHETIC_PACKAGE_E_RULESET,
      );
      const r = runnerFor(kernel);
      const result = okResult(
        r.run({ type: 'ResolveScheduledGame', fixtureId: E_FIXTURE_1 }, kind),
      );
      const game = result.world.football.games[0]!;
      return canonicalString({
        summary: fastSimSummary(result.world, game.id),
        plays: result.world.football.plays,
        causalLinks: result.world.football.causalLinks,
        rng: result.world.rng,
      });
    });
    for (const identity of identities) expect(identity).toBe(identities[0]);
  }, 10_000);

  it('does not let designation/game-plan insertion order choose the winner or draw stream', () => {
    const normal = selectionWorld();
    const permuted = {
      ...normal,
      football: {
        ...normal.football,
        designations: [...normal.football.designations].reverse(),
        gamePlans: [...normal.football.gamePlans].reverse(),
      },
    };
    const a = resolveScheduledGameChange(
      normal,
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    ).nextWorld;
    const b = resolveScheduledGameChange(
      permuted,
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    ).nextWorld;
    const gameA = a.football.games[0]!;
    const gameB = b.football.games[0]!;
    expect(fastSimSummary(a, gameA.id)).toEqual(fastSimSummary(b, gameB.id));
    expect(a.football.plays).toEqual(b.football.plays);
    expect(a.rng).toEqual(b.rng);
  });

  it('stores no team-strength/OVR/user-control winner oracle in authoritative football truth', () => {
    const world = resolveScheduledGameChange(
      selectionWorld(),
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    ).nextWorld;
    const encoded = canonicalString(world.football).toLowerCase();
    for (const forbidden of [
      'overallrating',
      'overall_rating',
      'ovr',
      'teamstrength',
      'team_strength',
      'usercontrolled',
      'user_controlled',
      'humanbonus',
      'cpuPenalty',
    ])
      expect(encoded).not.toContain(forbidden.toLowerCase());
  });
});
