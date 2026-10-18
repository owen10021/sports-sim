import { describe, expect, it } from 'vitest';
import {
  DeterministicRng,
  requireFootballRules,
  resolvePlay,
  type EntityId,
  type FootballWorld,
  type PlayStateInput,
  type ResolvedPlayDraft,
} from '../src/index';
import {
  RULESET,
  fixtureOrgs,
  gameStateFor,
  planFor,
  playInput,
  selectionWorld,
} from './support/footballSelectionHarness';

/**
 * Mechanism tests: across a fixed batch of seeds, moving a quantity the resolver is
 * supposed to read must move the expected outcome statistic in the designed direction,
 * while the distributions still overlap (nothing is guaranteed on any single trial).
 */
const base = selectionWorld();
const { home, away } = fixtureOrgs(base);
const rules = requireFootballRules(RULESET);
const TRIALS = 400;

const homePlayers = new Set<string>(
  base.football.designations
    .filter((d) => d.organizationId === home)
    .map((d) => d.playerId),
);
const awayPlayers = new Set<string>(
  base.football.designations
    .filter((d) => d.organizationId === away)
    .map((d) => d.playerId),
);

/** Offense runs one concept against one defensive concept, so only the quantity under test moves. */
const forced = (
  offenseConcept: string,
  defenseConcept: string,
  world: FootballWorld = base,
): FootballWorld => ({
  ...world,
  football: {
    ...world.football,
    gamePlans: [
      planFor(home, { conceptKeys: [offenseConcept, defenseConcept] }),
      planFor(away, { conceptKeys: [offenseConcept, defenseConcept] }),
    ],
  },
});

const trials = (input: PlayStateInput): ResolvedPlayDraft[] =>
  Array.from(
    { length: TRIALS },
    (_, i) => resolvePlay(input, DeterministicRng.fromSeed(i + 1)).resolved,
  );

const mean = (xs: readonly number[]): number =>
  xs.reduce((a, b) => a + b, 0) / xs.length;

const rate = (
  rs: readonly ResolvedPlayDraft[],
  pick: (r: ResolvedPlayDraft) => boolean,
) => rs.filter(pick).length / rs.length;

const state = gameStateFor(home);

const mapCapabilities = (
  world: FootballWorld,
  players: ReadonlySet<string>,
  change: (key: string, valueBp: number) => number,
): FootballWorld => ({
  ...world,
  roster: {
    ...world.roster,
    players: world.roster.players.map((p) =>
      players.has(p.personId)
        ? {
            ...p,
            capabilities: p.capabilities.map((c) => ({
              ...c,
              valueBp: Math.max(0, Math.min(10000, change(c.key, c.valueBp))),
            })),
          }
        : p,
    ),
  },
});

const withReadiness = (
  world: FootballWorld,
  players: ReadonlySet<string>,
  conditioningBp: number,
  acuteFatigueBp: number,
): FootballWorld => ({
  ...world,
  development: {
    ...world.development,
    readiness: world.development.readiness.map((r) =>
      players.has(r.playerId) ? { ...r, conditioningBp, acuteFatigueBp } : r,
    ),
  },
});

const withFamiliarity = (
  world: FootballWorld,
  players: ReadonlySet<string>,
  familiarityBp: number,
): FootballWorld => ({
  ...world,
  development: {
    ...world.development,
    roleKnowledge: [
      ...world.development.roleKnowledge.filter(
        (k) => !players.has(k.playerId),
      ),
      ...[...players].flatMap((playerId) =>
        rules.responsibilities.flatMap((r) =>
          ['base_offense', 'base_defense'].map((schemeKey) => ({
            playerId: playerId as EntityId,
            schemeKey,
            responsibilityKey: r.responsibilityKey,
            transferFamilyKey: r.transferFamilyKey,
            familiarityBp,
            lastMeaningfulRepAt: null,
          })),
        ),
      ),
    ],
  },
});

const uniform = (world: FootballWorld, value: number): FootballWorld =>
  mapCapabilities(
    mapCapabilities(world, homePlayers, () => value),
    awayPlayers,
    () => value,
  );

describe('rushing mechanism (inside run into a zone shell)', () => {
  const world = withFamiliarity(
    withFamiliarity(
      withReadiness(
        withReadiness(
          forced('inside_run', 'zone_shell'),
          homePlayers,
          10000,
          0,
        ),
        awayPlayers,
        10000,
        0,
      ),
      homePlayers,
      10000,
    ),
    awayPlayers,
    10000,
  );
  const yards = (w: FootballWorld, ruleset = RULESET) =>
    trials(playInput(w, state, ruleset)).map((r) => r.yardsGained);

  it('rises when the exact capabilities of the used actions rise', () => {
    const low = yards(mapCapabilities(world, homePlayers, () => 2500));
    const high = yards(mapCapabilities(world, homePlayers, () => 8500));
    expect(mean(high)).toBeGreaterThan(mean(low) + 0.5);
    expect(Math.max(...low)).toBeGreaterThan(Math.min(...high));
  });

  it('falls when the defense gets better at the same actions', () => {
    const weak = yards(mapCapabilities(world, awayPlayers, () => 2500));
    const tough = yards(mapCapabilities(world, awayPlayers, () => 8500));
    expect(mean(weak)).toBeGreaterThanOrEqual(mean(tough));
  });

  it('rises with exact responsibility familiarity and falls below the floor', () => {
    const unfamiliar = yards(withFamiliarity(world, homePlayers, 0));
    const familiar = yards(withFamiliarity(world, homePlayers, 10000));
    expect(mean(familiar)).toBeGreaterThan(mean(unfamiliar));
    expect(Math.max(...unfamiliar)).toBeGreaterThan(Math.min(...familiar));
  });

  it('rises with functional readiness', () => {
    const gassed = yards(withReadiness(world, homePlayers, 4000, 3000));
    const fresh = yards(withReadiness(world, homePlayers, 10000, 0));
    expect(mean(fresh)).toBeGreaterThan(mean(gassed));
  });

  it('follows the ruleset tactical matchup edge and nothing else', () => {
    const withEdge = (edgeBp: number) => ({
      ...RULESET,
      rules: {
        ...RULESET.rules,
        football: {
          ...rules,
          matchupEdges: rules.matchupEdges.map((e) =>
            e.offenseConceptKey === 'inside_run' &&
            e.defenseConceptKey === 'zone_shell'
              ? { ...e, edgeBp }
              : e,
          ),
        },
      },
    });
    const bad = yards(world, withEdge(-3000));
    const good = yards(world, withEdge(3000));
    expect(mean(good)).toBeGreaterThan(mean(bad) + 0.5);
    expect(Math.max(...bad)).toBeGreaterThan(Math.min(...good));
  });
});

describe('passing mechanism (quick pass into a zone shell)', () => {
  const world = withFamiliarity(
    withFamiliarity(
      withReadiness(
        withReadiness(
          forced('quick_pass', 'zone_shell'),
          homePlayers,
          10000,
          0,
        ),
        awayPlayers,
        10000,
        0,
      ),
      homePlayers,
      10000,
    ),
    awayPlayers,
    10000,
  );
  const completion = (w: FootballWorld) =>
    rate(trials(playInput(w, state)), (r) => r.resultKind === 'completion');
  const sacks = (w: FootballWorld) =>
    rate(trials(playInput(w, state)), (r) => r.resultKind === 'sack');
  const interceptions = (w: FootballWorld) =>
    rate(trials(playInput(w, state)), (r) => r.resultKind === 'interception');

  it('completes more passes when the offense is better and fewer when coverage is better', () => {
    const poor = completion(mapCapabilities(world, homePlayers, () => 2000));
    const good = completion(mapCapabilities(world, homePlayers, () => 9000));
    expect(good).toBeGreaterThan(poor + 0.05);
    const loose = completion(mapCapabilities(world, awayPlayers, () => 2000));
    const tight = completion(mapCapabilities(world, awayPlayers, () => 9000));
    expect(loose).toBeGreaterThan(tight);
  });

  it('sacks more often against worse protection and a better rush', () => {
    const protectedQb = sacks(
      mapCapabilities(
        mapCapabilities(world, homePlayers, () => 9500),
        awayPlayers,
        () => 2000,
      ),
    );
    const pressured = sacks(
      mapCapabilities(
        mapCapabilities(world, homePlayers, () => 2000),
        awayPlayers,
        () => 9500,
      ),
    );
    expect(pressured).toBeGreaterThan(protectedQb);
  });

  it('throws more interceptions into better coverage', () => {
    const safe = interceptions(mapCapabilities(world, awayPlayers, () => 1000));
    const risky = interceptions(
      mapCapabilities(world, awayPlayers, () => 10000),
    );
    expect(risky).toBeGreaterThanOrEqual(safe);
  });
});

describe('no oracle', () => {
  it('uses no team-level strength: identical players on both sides give a fair contest', () => {
    const even = uniform(forced('inside_run', 'zone_shell'), 6000);
    const swapped = (w: FootballWorld, h: EntityId) =>
      trials(playInput(w, gameStateFor(h))).map((r) => r.yardsGained);
    const m1 = mean(swapped(even, home));
    const m2 = mean(swapped(even, away));
    expect(Math.abs(m1 - m2)).toBeLessThan(1.2);
  });
});
