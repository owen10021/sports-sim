import { describe, expect, it } from 'vitest';
import {
  DeterministicRng,
  WorldCreationError,
  createWorld,
  entityId,
  fingerprintWorld,
  rulesetRefOf,
  seedRefOf,
  worldId,
  worldRevision,
  type FootballWorld,
} from '../src/index';
import { fixedIdSource, makeRuleset, makeSeed } from './helpers';

const build = (): FootballWorld => {
  const ruleset = makeRuleset();
  return createWorld(makeSeed(ruleset), ruleset, fixedIdSource());
};

describe('createWorld', () => {
  it('creates a valid world from a matching synthetic seed + ruleset', () => {
    const ruleset = makeRuleset();
    const seed = makeSeed(ruleset, {
      initialEntities: [
        { id: 'org-b', kind: 'organization', name: 'Beta' },
        { id: 'person-a', kind: 'person', name: 'Alpha' },
      ],
    });
    const world = createWorld(seed, ruleset, fixedIdSource());
    expect(world.schemaVersion).toBe(1);
    expect(world.worldId).toBe(worldId('world-test-1'));
    expect(world.simDate).toBe('2026-10-16');
    expect(world.revision).toBe(worldRevision(0));
    expect(world.ruleset).toEqual(rulesetRefOf(ruleset));
    expect(world.seed).toEqual(seedRefOf(seed));
    expect(world.rng).toEqual(DeterministicRng.fromSeed(12345).snapshot());
    expect(world.entities.map((e) => e.id)).toEqual([
      entityId('org-b'),
      entityId('person-a'),
    ]);
    expect(world.nextIds.event).toBe(1);
  });

  it('sorts entities by id so seed ordering cannot change the world', () => {
    const ruleset = makeRuleset();
    const a = createWorld(
      makeSeed(ruleset, {
        initialEntities: [
          { id: 'x2', kind: 'person', name: 'Two' },
          { id: 'x1', kind: 'person', name: 'One' },
        ],
      }),
      ruleset,
      fixedIdSource(),
    );
    expect(a.entities.map((e) => e.id)).toEqual([
      entityId('x1'),
      entityId('x2'),
    ]);
  });

  it('returns a deeply frozen (immutable) world', () => {
    const w = build();
    expect(Object.isFrozen(w)).toBe(true);
    expect(Object.isFrozen(w.rng)).toBe(true);
    expect(Object.isFrozen(w.nextIds)).toBe(true);
    expect(Object.isFrozen(w.entities)).toBe(true);
  });

  it('rejects invalid packages: tampered, mismatched, unverified, or duplicate entity ids', () => {
    const ruleset = makeRuleset();
    const seed = makeSeed(ruleset);
    expect(() =>
      createWorld(
        seed,
        { ...ruleset, rules: { maxAdvanceDaysPerCommand: 99 } },
        fixedIdSource(),
      ),
    ).toThrow(WorldCreationError);
    const other = makeRuleset({ rulesetVersion: 2 });
    expect(() => createWorld(seed, other, fixedIdSource())).toThrow(
      WorldCreationError,
    );
    const unverified = makeRuleset({
      provenance: [
        { ...ruleset.provenance[0]!, validationStatus: 'unverified' },
      ],
    });
    expect(() =>
      createWorld(makeSeed(unverified), unverified, fixedIdSource()),
    ).toThrow(WorldCreationError);
    const dup = makeSeed(ruleset, {
      initialEntities: [
        { id: 'dup', kind: 'person', name: 'A' },
        { id: 'dup', kind: 'person', name: 'B' },
      ],
    });
    expect(() => createWorld(dup, ruleset, fixedIdSource())).toThrow(
      WorldCreationError,
    );
  });
});

describe('fingerprintWorld', () => {
  it('is a 64-char lowercase hex digest, equal for identical inputs', () => {
    const a = fingerprintWorld(build());
    const b = fingerprintWorld(build());
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(b);
  });

  it('changes when any authoritative field changes', () => {
    const w = build();
    const base = fingerprintWorld(w);
    const variants: FootballWorld[] = [
      { ...w, revision: worldRevision(1) },
      { ...w, simDate: '2026-10-17' },
      { ...w, worldId: worldId('world-other') },
      { ...w, rng: { ...w.rng, draws: w.rng.draws + 1 } },
      { ...w, rng: { ...w.rng, s0: (w.rng.s0 + 1) >>> 0 } },
      { ...w, nextIds: { ...w.nextIds, event: w.nextIds.event + 1 } },
      { ...w, nextIds: { ...w.nextIds, record: w.nextIds.record + 1 } },
      {
        ...w,
        people: {
          ...w.people,
          persons: [{ entityId: entityId('p1'), active: true }],
        },
      },
      { ...w, ruleset: { ...w.ruleset, contentHash: 'a'.repeat(64) } },
      { ...w, seed: { ...w.seed, contentHash: 'b'.repeat(64) } },
      { ...w, entities: [{ id: entityId('p1'), kind: 'person', name: 'New' }] },
    ];
    const prints = variants.map(fingerprintWorld);
    for (const p of prints) expect(p).not.toBe(base);
    expect(new Set(prints).size).toBe(prints.length);
  });

  it('does not depend on object key insertion order', () => {
    const w = build();
    const reordered = {
      football: w.football,
      medical: w.medical,
      development: w.development,
      draft: w.draft,
      scouting: w.scouting,
      market: w.market,
      contracts: w.contracts,
      roster: w.roster,
      decisions: w.decisions,
      plans: w.plans,
      relationships: w.relationships,
      information: w.information,
      authority: w.authority,
      organizations: w.organizations,
      people: w.people,
      worldModelVersion: w.worldModelVersion,
      entities: w.entities,
      nextIds: { record: w.nextIds.record, event: w.nextIds.event },
      rng: {
        draws: w.rng.draws,
        s3: w.rng.s3,
        s2: w.rng.s2,
        s1: w.rng.s1,
        s0: w.rng.s0,
        algorithm: w.rng.algorithm,
      },
      revision: w.revision,
      simDate: w.simDate,
      seed: w.seed,
      ruleset: w.ruleset,
      worldId: w.worldId,
      schemaVersion: w.schemaVersion,
    } as FootballWorld;
    expect(fingerprintWorld(reordered)).toBe(fingerprintWorld(w));
  });
});
