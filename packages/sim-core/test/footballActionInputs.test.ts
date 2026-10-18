import { describe, expect, it } from 'vitest';
import {
  FootballActionError,
  MissingFootballRulesError,
  deriveFootballActionInput,
  entityId,
  functionalReadiness,
  requireFootballRules,
  type FootballWorld,
} from '../src/index';
import { nf } from './support/packageEHarness';
import { RULESET, selectionWorld } from './support/footballSelectionHarness';

const world = selectionWorld();
const rules = requireFootballRules(RULESET);
const QB = entityId(nf(1));
const ACTION = 'throw_pass';
const SCHEME = 'base_offense';
const RESP = 'progression_reads';
const action = rules.actions.find((a) => a.actionKey === ACTION)!;
const family = rules.responsibilities.find(
  (r) => r.responsibilityKey === RESP,
)!.transferFamilyKey;

const derive = (
  w: FootballWorld = world,
  id = QB,
  a = ACTION,
  s = SCHEME,
  r = RESP,
) => deriveFootballActionInput(w, RULESET, id, a, s, r);

const withCapability = (key: string, valueBp: number): FootballWorld => ({
  ...world,
  roster: {
    ...world.roster,
    players: world.roster.players.map((p) =>
      p.personId === QB
        ? {
            ...p,
            capabilities: [
              ...p.capabilities.filter((c) => c.key !== key),
              ...(valueBp < 0 ? [] : [{ key, valueBp }]),
            ],
          }
        : p,
    ),
  },
});

const withReadiness = (
  conditioningBp: number,
  acuteFatigueBp: number,
): FootballWorld => ({
  ...world,
  development: {
    ...world.development,
    readiness: world.development.readiness.map((r) =>
      r.playerId === QB ? { ...r, conditioningBp, acuteFatigueBp } : r,
    ),
  },
});

const withFamiliarity = (
  familiarityBp: number | null,
  schemeKey = SCHEME,
): FootballWorld => ({
  ...world,
  development: {
    ...world.development,
    roleKnowledge: [
      ...world.development.roleKnowledge.filter((k) => k.playerId !== QB),
      ...(familiarityBp === null
        ? []
        : [
            {
              playerId: QB,
              schemeKey,
              responsibilityKey: RESP,
              transferFamilyKey: family,
              familiarityBp,
              lastMeaningfulRepAt: null,
            },
          ]),
    ],
  },
});

describe('football action inputs', () => {
  it('blend the bound capabilities by the ruleset weights using integer math', () => {
    const w = action.capabilityBindings.reduce(
      (acc, b, i) => withCapabilities(acc, b.capabilityKey, 2000 + i * 1500),
      world,
    );
    const d = derive(w);
    expect(d.components.map((c) => c.capabilityKey)).toEqual(
      action.capabilityBindings.map((b) => b.capabilityKey),
    );
    const expected = Math.floor(
      action.capabilityBindings.reduce(
        (n, b, i) => n + (2000 + i * 1500) * b.weightBp,
        0,
      ) / 10000,
    );
    expect(d.capabilityBp).toBe(expected);
    expect(Number.isInteger(d.executionBp)).toBe(true);
  });

  it('raise execution when a bound capability rises and ignore capabilities the action does not bind', () => {
    const key = action.capabilityBindings[0]!.capabilityKey;
    const low = derive(withCapability(key, 3000));
    const high = derive(withCapability(key, 9000));
    expect(high.capabilityBp).toBeGreaterThan(low.capabilityBp);
    expect(high.executionBp).toBeGreaterThanOrEqual(low.executionBp);
    const unbound = 'not_bound_to_throw_pass';
    expect(derive(withCapability(unbound, 10000))).toEqual(derive());
  });

  it('count a capability the ledger does not hold as zero', () => {
    const key = action.capabilityBindings[0]!.capabilityKey;
    const missing = derive(withCapability(key, -1));
    expect(
      missing.components.find((c) => c.capabilityKey === key)!.valueBp,
    ).toBe(0);
  });

  it("reads the player's functional readiness for that very action", () => {
    expect(derive().functionalReadinessBp).toBe(
      functionalReadiness(world, QB, ACTION),
    );
    const tired = derive(withReadiness(5000, 2000));
    expect(tired.functionalReadinessBp).toBe(4000);
    const fresh = derive(withReadiness(10000, 0));
    expect(fresh.functionalReadinessBp).toBe(10000);
    expect(fresh.executionBp).toBeGreaterThanOrEqual(tired.executionBp);
  });

  it('marks a player below the readiness minimum as unable to attempt the action', () => {
    const min = action.participation.minFunctionalReadinessBp;
    expect(derive(withReadiness(min, 0)).canAttempt).toBe(true);
    expect(derive(withReadiness(min - 1, 0)).canAttempt).toBe(false);
  });

  it('scales execution down below the familiarity floor and never makes the player ineligible', () => {
    const floor = action.participation.familiarityFloorBp;
    const below = derive(withFamiliarity(floor - 1));
    const at = derive(withFamiliarity(floor));
    const none = derive(withFamiliarity(null));
    expect(below.familiarityBp).toBe(floor - 1);
    expect(below.familiarityScaleBp).toBe(
      action.participation.belowFloorExecutionScaleBp,
    );
    expect(at.familiarityScaleBp).toBe(10000);
    expect(none.familiarityBp).toBe(0);
    expect(none.familiarityScaleBp).toBe(
      action.participation.belowFloorExecutionScaleBp,
    );
    expect(below.canAttempt).toBe(at.canAttempt);
    expect(at.executionBp).toBeGreaterThan(below.executionBp);
  });

  it('credits half of analogous knowledge in another scheme, never more than exact', () => {
    const other = derive(withFamiliarity(8000, 'base_defense'));
    expect(other.familiarityBp).toBe(4000);
    expect(derive(withFamiliarity(8000)).familiarityBp).toBe(8000);
  });

  it('is pure: no mutation, repeatable, no organization or control-status input', () => {
    const before = JSON.stringify(world);
    const a = derive();
    expect(derive()).toEqual(a);
    expect(JSON.stringify(world)).toBe(before);
    expect(deriveFootballActionInput.length).toBe(6);
    expect(Object.keys(a)).not.toContain('organizationId');
  });

  it('changes with latent truth, which is exactly why selectors must not call it', () => {
    const key = action.capabilityBindings[0]!.capabilityKey;
    expect(derive(withCapability(key, 1000)).capabilityBp).not.toBe(
      derive(withCapability(key, 9000)).capabilityBp,
    );
  });
});

describe('football action inputs fail closed', () => {
  it('on unknown or mismatched vocabulary and players', () => {
    expect(() => derive(world, QB, 'no_such_action')).toThrow(
      /unknown football action/,
    );
    expect(() => derive(world, QB, ACTION, 'no_such_scheme')).toThrow(
      /unknown football scheme/,
    );
    expect(() =>
      derive(world, QB, ACTION, SCHEME, 'no_such_responsibility'),
    ).toThrow(/unknown football responsibility/);
    expect(() => derive(world, QB, ACTION, SCHEME, 'route_tree')).toThrow(
      /does not carry/,
    );
    expect(() => derive(world, entityId('player-nobody'))).toThrow(
      /unknown player/,
    );
    expect(() => derive(world, QB, ACTION, SCHEME, RESP)).not.toThrow();
  });

  it('for a player with no readiness record and for a ruleset without football rules', () => {
    const noReadiness: FootballWorld = {
      ...world,
      development: {
        ...world.development,
        readiness: world.development.readiness.filter((r) => r.playerId !== QB),
      },
    };
    expect(() => derive(noReadiness)).toThrow(FootballActionError);
    expect(() =>
      deriveFootballActionInput(
        world,
        { rulesetId: 'x', rules: {} } as never,
        QB,
        ACTION,
        SCHEME,
        RESP,
      ),
    ).toThrow(MissingFootballRulesError);
  });
});

function withCapabilities(
  w: FootballWorld,
  key: string,
  valueBp: number,
): FootballWorld {
  return {
    ...w,
    roster: {
      ...w.roster,
      players: w.roster.players.map((p) =>
        p.personId === QB
          ? {
              ...p,
              capabilities: [
                ...p.capabilities.filter((c) => c.key !== key),
                { key, valueBp },
              ],
            }
          : p,
      ),
    },
  };
}
