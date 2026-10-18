import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildDefensiveSelectionView,
  buildOffensiveSelectionView,
  entityId,
  recordId,
  selectDefensiveCall,
  selectOffensiveCall,
  type CommittedDefensiveCall,
  type DefensiveSelectionView,
  type FootballWorld,
  type OffensiveSelectionView,
} from '../src/index';
import { E_FIXTURE_1, NF, SP } from './support/packageEHarness';
import {
  RULESET,
  allKeys,
  fixtureOrgs,
  planFor,
  selectionWorld,
  situationFor,
  spreadRolls,
} from './support/footballSelectionHarness';

const world = selectionWorld();
const { home, away } = fixtureOrgs(world);
const homePrefix = home === NF.org ? 'player-nf' : 'player-sp';
const awayPrefix = away === NF.org ? 'player-nf' : 'player-sp';
const state = situationFor(home);

const views = (w: FootballWorld = world) => ({
  offense: buildOffensiveSelectionView(w, RULESET, E_FIXTURE_1, state),
  defense: buildDefensiveSelectionView(w, RULESET, E_FIXTURE_1, state),
});

/** Field names that would only exist to carry the other side's call or latent truth. */
const FORBIDDEN_KEYS = [
  'finalCall',
  'offensiveCall',
  'defensiveCall',
  'committedCall',
  'opponentCall',
  'opponentPlan',
  'lineup',
  'capabilities',
  'capabilityBp',
  'valueBp',
  'functionalReadinessBp',
  'conditioningBp',
  'acuteFatigueBp',
  'episodes',
  'medical',
  'readiness',
  'rng',
  'draws',
  'seed',
];

describe('structural privacy of selection views', () => {
  it('are two distinct types that cannot stand in for each other', () => {
    const { offense, defense } = views();
    // @ts-expect-error a defensive view is not an offensive view
    const asOffense: OffensiveSelectionView = defense;
    // @ts-expect-error an offensive view is not a defensive view
    const asDefense: DefensiveSelectionView = offense;
    void asOffense;
    void asDefense;
    expect(offense.side).not.toBe(defense.side);
    expect('observedDefensiveConcepts' in offense).toBe(true);
    expect('observedDefensiveConcepts' in defense).toBe(false);
    expect('observedOffensiveConcepts' in defense).toBe(true);
    expect('observedOffensiveConcepts' in offense).toBe(false);
  });

  it('carry no final-call, latent-truth, medical or random-state fields', () => {
    const { offense, defense } = views();
    for (const view of [offense, defense]) {
      const keys = allKeys(view);
      FORBIDDEN_KEYS.forEach((k) => expect(keys.has(k)).toBe(false));
    }
  });

  it('name nothing that belongs to the other club', () => {
    const { offense, defense } = views();
    const o = JSON.stringify(offense);
    const d = JSON.stringify(defense);
    expect(o).not.toContain(away);
    expect(o).not.toContain(`gameplan-${away}`);
    expect(o).not.toContain(awayPrefix);
    expect(d).not.toContain(home);
    expect(d).not.toContain(`gameplan-${home}`);
    expect(d).not.toContain(homePrefix);
  });

  it('keep selector input to a view and explicit rolls only', () => {
    expect(selectOffensiveCall.length).toBe(2);
    expect(selectDefensiveCall.length).toBe(2);
  });
});

describe('no leakage after the views are built', () => {
  const rolls = spreadRolls(60);

  it('the offensive call is the same whatever defensive call is later committed', () => {
    const { offense, defense } = views();
    const frozen = JSON.stringify(offense);
    const expected = rolls.map((r) =>
      selectOffensiveCall(offense, { conceptRoll: r, formationRoll: r >>> 5 }),
    );
    // Commit every defensive call the defense could possibly make, then re-select.
    const defensiveCalls: CommittedDefensiveCall[] = rolls.flatMap((r) =>
      [0, 1].map((k) =>
        selectDefensiveCall(defense, {
          conceptRoll: r + k,
          formationRoll: r >>> 3,
        }),
      ),
    );
    expect(
      new Set(defensiveCalls.map((c) => c.conceptKey)).size,
    ).toBeGreaterThan(1);
    const again = rolls.map((r) =>
      selectOffensiveCall(offense, { conceptRoll: r, formationRoll: r >>> 5 }),
    );
    expect(again).toEqual(expected);
    expect(JSON.stringify(offense)).toBe(frozen);
  });

  it('the defensive call is the same whatever offensive call is later committed', () => {
    const { offense, defense } = views();
    const frozen = JSON.stringify(defense);
    const expected = rolls.map((r) =>
      selectDefensiveCall(defense, { conceptRoll: r, formationRoll: r >>> 5 }),
    );
    rolls.forEach((r) =>
      selectOffensiveCall(offense, { conceptRoll: r, formationRoll: r >>> 3 }),
    );
    expect(
      rolls.map((r) =>
        selectDefensiveCall(defense, {
          conceptRoll: r,
          formationRoll: r >>> 5,
        }),
      ),
    ).toEqual(expected);
    expect(JSON.stringify(defense)).toBe(frozen);
  });

  it("changing the opponent's private plan or designations cannot change a view", () => {
    const base = views();
    const awayChanged: FootballWorld = {
      ...world,
      football: {
        ...world.football,
        gamePlans: world.football.gamePlans.map((p) =>
          p.organizationId === away
            ? planFor(away, {
                conceptKeys: ['man_press'],
                personnelPreferenceKeys: ['nickel_defense'],
                strategyPlanRefs: [
                  { planId: recordId('plan-secret'), revision: 9 },
                ],
                authorizedStaffPersonIds: [entityId('person-secret-coach')],
                constraints: { maxBlitzRateBp: 9999, secret: 'blitz-on-third' },
                schemeKey: 'base_defense',
              })
            : p,
        ),
        designations: world.football.designations.filter(
          (d) => !(d.organizationId === away && d.roleKey === 'safety'),
        ),
      },
    };
    const changed = views(awayChanged);
    expect(JSON.stringify(changed.offense)).toBe(JSON.stringify(base.offense));
    const homeChanged: FootballWorld = {
      ...world,
      football: {
        ...world.football,
        gamePlans: world.football.gamePlans.map((p) =>
          p.organizationId === home
            ? planFor(home, {
                conceptKeys: ['inside_run'],
                constraints: { secret: 'run-it' },
              })
            : p,
        ),
        designations: world.football.designations.filter(
          (d) => !(d.organizationId === home && d.roleKey === 'tight_end'),
        ),
      },
    };
    expect(JSON.stringify(views(homeChanged).defense)).toBe(
      JSON.stringify(base.defense),
    );
  });

  it('only the already-played calls the situation lists can inform the next selection', () => {
    const calls = [
      { offenseConceptKey: 'inside_run', defenseConceptKey: 'zone_shell' },
    ];
    const withHistory = buildDefensiveSelectionView(
      world,
      RULESET,
      E_FIXTURE_1,
      situationFor(home, { resolvedCalls: calls }),
    );
    expect(withHistory.observedOffensiveConcepts).toEqual([
      { conceptKey: 'inside_run', count: 1 },
    ]);
    // The defense's own earlier call is not tendency data for the defense either.
    expect(allKeys(withHistory).has('observedDefensiveConcepts')).toBe(false);
  });
});

describe('no latent knowledge reaches selection', () => {
  it('latent capabilities, readiness and medical truth cannot move either view', () => {
    const base = views();
    const scrambled: FootballWorld = {
      ...world,
      roster: {
        ...world.roster,
        players: world.roster.players.map((p) => ({
          ...p,
          // Always a different value, including for a capability that sat at 5000.
          capabilities: p.capabilities.map((c) => ({
            ...c,
            valueBp: (c.valueBp + 1234) % 10001,
          })),
        })),
      },
      development: {
        ...world.development,
        readiness: world.development.readiness.map((r) => ({
          ...r,
          conditioningBp: 1,
          acuteFatigueBp: 9999,
        })),
      },
      medical: { ...world.medical, episodes: [] },
    };
    const changed = views(scrambled);
    expect(JSON.stringify(changed.offense)).toBe(JSON.stringify(base.offense));
    expect(JSON.stringify(changed.defense)).toBe(JSON.stringify(base.defense));
    expect(
      selectOffensiveCall(changed.offense, {
        conceptRoll: 99,
        formationRoll: 12,
      }),
    ).toEqual(
      selectOffensiveCall(base.offense, { conceptRoll: 99, formationRoll: 12 }),
    );
  });

  it('the selection module cannot reach latent truth or the RNG at all', () => {
    const source = readFileSync(
      new URL('../src/footballSelection.ts', import.meta.url),
      'utf8',
    );
    const imports = [...source.matchAll(/from '([^']+)'/g)]
      .map((m) => m[1])
      .sort();
    expect(imports).toEqual([
      './audit',
      './football',
      './footballRules',
      './ids',
      './ruleset',
    ]);
    [
      'world',
      'roster',
      'development',
      'medical',
      'rng',
      'footballActions',
    ].forEach((m) => expect(source).not.toMatch(new RegExp(`from '\\./${m}'`)));
    expect(source).not.toMatch(
      /Math\.random|Date\.now|new Date|performance\.now|crypto|require\(|import\(|import '/,
    );
    // Modules that would drag latent state in at runtime may only be type imports.
    ['./audit', './football'].forEach((m) =>
      expect(source).toMatch(new RegExp(`import type[^;]*from '\\${m}'`)),
    );
  });

  it('builders accept only the football collection, so they cannot even be handed latent state', () => {
    const justFootball = { football: world.football };
    expect(
      JSON.stringify(
        buildOffensiveSelectionView(justFootball, RULESET, E_FIXTURE_1, state),
      ),
    ).toBe(JSON.stringify(views().offense));
    expect(SP.org).not.toBe(NF.org);
  });
});
