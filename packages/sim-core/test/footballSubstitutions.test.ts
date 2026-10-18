import { describe, expect, it } from 'vitest';
import {
  DeterministicRng,
  buildOffensiveSelectionView,
  designationProblems,
  isEligibleReceiverRole,
  legalSubstitution,
  lineupProblems,
  requireFootballRules,
  resolvePlay,
  selectOffensiveCall,
  type FootballWorld,
} from '../src/index';
import { E_FIXTURE_1, nf, sp } from './support/packageEHarness';
import {
  RULESET,
  fixtureOrgs,
  gameStateFor,
  playInput,
  selectionWorld,
  situationFor,
} from './support/footballSelectionHarness';

const rules = requireFootballRules(RULESET);
const world = selectionWorld();
const { home, away } = fixtureOrgs(world);

const offenseCall = () =>
  selectOffensiveCall(
    buildOffensiveSelectionView(
      world,
      RULESET,
      E_FIXTURE_1,
      situationFor(home),
    ),
    { conceptRoll: 0, formationRoll: 0 },
  );

const check = (lineup = offenseCall().lineup) => ({
  rules,
  fixtureId: world.football.fixtures[0]!.id,
  organizationId: home,
  unitKey: 'offense' as const,
  formationKey: offenseCall().formationKey,
  lineup,
  designations: world.football.designations,
});

describe('substitution and formation eligibility', () => {
  it('accepts a complete active designated lineup and rejects duplicate, wrong-unit and wrong-role players', () => {
    const call = offenseCall();
    expect(legalSubstitution(check(call.lineup))).toBe(true);

    const duplicate = [...call.lineup];
    duplicate[1] = { ...duplicate[1]!, playerId: duplicate[0]!.playerId };
    expect(legalSubstitution(check(duplicate))).toBe(false);
    expect(lineupProblems(check(duplicate)).join(';')).toContain(
      'lined up twice',
    );

    const wrongUnit = [...call.lineup];
    wrongUnit[0] = {
      ...wrongUnit[0]!,
      playerId: world.football.designations.find(
        (d) => d.organizationId === home && d.unitKey === 'defense',
      )!.playerId,
    };
    expect(lineupProblems(check(wrongUnit)).join(';')).toContain(
      'not an active offense designee',
    );

    const wrongRole = [...call.lineup];
    const wrIndex = wrongRole.findIndex((s) => s.slotKey.startsWith('wr'));
    wrongRole[wrIndex] = {
      ...wrongRole[wrIndex]!,
      playerId: world.football.designations.find(
        (d) =>
          d.organizationId === home &&
          d.unitKey === 'offense' &&
          d.roleKey === 'offensive_line',
      )!.playerId,
    };
    expect(lineupProblems(check(wrongRole)).join(';')).toContain(
      'not eligible',
    );
  });

  it('counts unique active players across units against the game-day cap', () => {
    expect(
      designationProblems({
        rules,
        orgs: { homeOrganizationId: home, awayOrganizationId: away },
        fixtureId: world.football.fixtures[0]!.id,
        designations: world.football.designations,
      }),
    ).toEqual([]);

    const tight = {
      ...rules,
      substitution: { ...rules.substitution, maxActiveGameDayPlayers: 10 },
    };
    expect(
      designationProblems({
        rules: tight,
        orgs: { homeOrganizationId: home, awayOrganizationId: away },
        fixtureId: world.football.fixtures[0]!.id,
        designations: world.football.designations,
      }).join(';'),
    ).toContain('over the limit');
  });

  it('uses the ruleset eligible-receiver role list', () => {
    expect(isEligibleReceiverRole(rules, 'wide_receiver')).toBe(true);
    expect(isEligibleReceiverRole(rules, 'tight_end')).toBe(true);
    expect(isEligibleReceiverRole(rules, 'running_back')).toBe(true);
    expect(isEligibleReceiverRole(rules, 'offensive_line')).toBe(false);
    expect(isEligibleReceiverRole(rules, 'quarterback')).toBe(false);
  });
});

describe('resolver roster legality happens before football RNG', () => {
  const expectPreDrawRosterFailure = (
    badWorld: FootballWorld,
    message: RegExp,
  ) => {
    const rng = DeterministicRng.fromSeed(7001);
    const before = rng.snapshot();
    expect(() =>
      resolvePlay(playInput(badWorld, gameStateFor(home)), rng),
    ).toThrow(message);
    expect(rng.snapshot()).toEqual(before);
  };

  it('rejects a player who became reserve-only after the designation was committed', () => {
    const reserved: FootballWorld = {
      ...world,
      roster: {
        ...world.roster,
        memberships: world.roster.memberships.map((m) =>
          m.organizationId === home ? { ...m, status: 'reserve' as const } : m,
        ),
      },
    };
    expectPreDrawRosterFailure(reserved, /not on the active roster/i);
  });

  it("rejects a lineup designation that points at another club's rostered player", () => {
    const homeQb = world.football.designations.find(
      (d) =>
        d.organizationId === home &&
        d.unitKey === 'offense' &&
        d.roleKey === 'quarterback' &&
        d.depthOrder === 1,
    )!;
    const wrongOrg: FootballWorld = {
      ...world,
      football: {
        ...world.football,
        designations: world.football.designations.map((d) =>
          d.id === homeQb.id ? { ...d, playerId: sp(1) as never } : d,
        ),
      },
    };
    expectPreDrawRosterFailure(wrongOrg, /not on .* active roster/i);
  });

  it('keeps the synthetic fixture ids stable for the roster checks', () => {
    expect(nf(1)).toBe('player-nf-e01');
    expect(E_FIXTURE_1).toContain('fixture-2027');
  });
});
