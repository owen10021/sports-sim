import { describe, expect, it } from 'vitest';
import { resolvePassiveDevelopment } from '../src/developmentPassive';
import { SYNTHETIC_PACKAGE_D_RULESET } from '../src/index';
import { dWorld, D_TODAY, D_END } from './support/packageDHarness';

describe('person-owned passive development time', () => {
  it('ages unrostered veterans without granting opportunity, learning or RNG draws', () => {
    const world = dWorld(),
      before = JSON.stringify(world);
    const next = resolvePassiveDevelopment(
      world,
      SYNTHETIC_PACKAGE_D_RULESET,
      D_TODAY,
      D_END,
    ).world;
    const id = 'player-fa-04';
    const oldPlayer = world.roster.players.find((p) => p.personId === id)!;
    const newPlayer = next.roster.players.find((p) => p.personId === id)!;
    expect(
      newPlayer.capabilities.some(
        (c, i) => c.valueBp < oldPlayer.capabilities[i]!.valueBp,
      ),
    ).toBe(true);
    expect(next.rng).toEqual(world.rng);
    expect(next.development.opportunityWindows).toEqual(
      world.development.opportunityWindows,
    );
    expect(next.development.roleKnowledge).toEqual(
      world.development.roleKnowledge,
    );
    expect(
      next.development.events.some(
        (e) => e.playerId === id && e.kind === 'passive_aging',
      ),
    ).toBe(true);
    expect(JSON.stringify(world)).toBe(before);
  });
  it('is once-only, monotone, and equivalent across daily or coarse intervals', () => {
    const world = dWorld();
    const coarse = resolvePassiveDevelopment(
      world,
      SYNTHETIC_PACKAGE_D_RULESET,
      D_TODAY,
      D_END,
    ).world;
    const repeated = resolvePassiveDevelopment(
      coarse,
      SYNTHETIC_PACKAGE_D_RULESET,
      D_TODAY,
      D_END,
    ).world;
    expect(repeated).toEqual(coarse);
    expect(() =>
      resolvePassiveDevelopment(
        coarse,
        SYNTHETIC_PACKAGE_D_RULESET,
        D_TODAY,
        '2027-02-20',
      ),
    ).toThrow();
    let fine = world;
    for (let d = 15; d < 22; d++)
      fine = resolvePassiveDevelopment(
        fine,
        SYNTHETIC_PACKAGE_D_RULESET,
        '2027-02-' + d,
        '2027-02-' + (d + 1),
      ).world;
    expect(fine.roster.players).toEqual(coarse.roster.players);
    expect(fine.development.readiness).toEqual(coarse.development.readiness);
  });
});
