import { describe, expect, it } from 'vitest';
import {
  DOMAIN_STATE_KEYS,
  PACKAGE_C_DOMAIN_STATE_KEYS,
  PACKAGE_D_DOMAIN_STATE_KEYS,
  PACKAGE_E_DOMAIN_STATE_KEYS,
  WORLD_MODEL_VERSION,
  InvalidWorldModelError,
  UnsupportedWorldModelVersionError,
  createWorld,
  fingerprintLegacyPackageDWorld,
  fingerprintWorld,
  isLegacyPackageDWorld,
  migrateLegacyPackageDWorld,
  requireCurrentWorld,
  worldModelProblems,
  type FootballWorld,
  type LegacyPackageDWorld,
} from '../src/index';
import { fixedIdSource, makeRuleset, makeSeed } from './helpers';

const build = (): FootballWorld => {
  const ruleset = makeRuleset();
  return createWorld(makeSeed(ruleset), ruleset, fixedIdSource());
};
const clone = (v: unknown): any => JSON.parse(JSON.stringify(v));
const E_COLLECTIONS = [
  'fixtures',
  'designations',
  'gamePlans',
  'games',
  'plays',
  'causalLinks',
] as const;
const asModel4 = (w: FootballWorld): LegacyPackageDWorld => {
  const copy = clone(w);
  copy.worldModelVersion = 4;
  delete copy.football;
  return copy as LegacyPackageDWorld;
};

describe('current world model (v5)', () => {
  it('declares model 5 and appends exactly the football domain', () => {
    const w = build();
    expect(WORLD_MODEL_VERSION).toBe(5);
    expect(w.worldModelVersion).toBe(5);
    expect(Object.keys(DOMAIN_STATE_KEYS)).toEqual([
      ...Object.keys(PACKAGE_C_DOMAIN_STATE_KEYS),
      ...Object.keys(PACKAGE_D_DOMAIN_STATE_KEYS),
      ...Object.keys(PACKAGE_E_DOMAIN_STATE_KEYS),
    ]);
    expect(PACKAGE_E_DOMAIN_STATE_KEYS.football).toEqual(E_COLLECTIONS);
    expect(DOMAIN_STATE_KEYS.football).toEqual(E_COLLECTIONS);
  });

  it('creates empty deeply frozen football state and fingerprints with current semantics', () => {
    const a = build();
    const b = build();
    expect(a.football).toEqual({
      fixtures: [],
      designations: [],
      gamePlans: [],
      games: [],
      plays: [],
      causalLinks: [],
    });
    expect(Object.isFrozen(a.football)).toBe(true);
    for (const key of E_COLLECTIONS)
      expect(Object.isFrozen(a.football[key])).toBe(true);
    expect(worldModelProblems(a)).toEqual([]);
    expect(fingerprintWorld(a)).toBe(fingerprintWorld(b));
    expect(fingerprintLegacyPackageDWorld(asModel4(a))).not.toBe(
      fingerprintWorld(a),
    );
  });

  it('recognizes model 4 only as legacy D and migrates by adding empty football only', () => {
    const current = build();
    const legacy = asModel4(current);
    expect(isLegacyPackageDWorld(legacy)).toBe(true);
    expect(worldModelProblems(legacy).length).toBeGreaterThan(0);
    const migrated = migrateLegacyPackageDWorld(legacy);
    expect(migrated.worldModelVersion).toBe(5);
    expect(migrated.football).toEqual({
      fixtures: [],
      designations: [],
      gamePlans: [],
      games: [],
      plays: [],
      causalLinks: [],
    });
    const migratedSansE = clone(migrated);
    delete migratedSansE.football;
    migratedSansE.worldModelVersion = 4;
    expect(migratedSansE).toEqual(clone(legacy));
    expect(migrated.rng).toEqual(legacy.rng);
    expect(migrated.revision).toBe(legacy.revision);
    expect(migrated.nextIds).toEqual(legacy.nextIds);
  });

  it('migration is deterministic, event-free by construction, and requireCurrentWorld uses it', () => {
    const legacy = asModel4(build());
    expect(migrateLegacyPackageDWorld(legacy)).toEqual(
      migrateLegacyPackageDWorld(legacy),
    );
    expect(requireCurrentWorld(legacy)).toEqual(
      migrateLegacyPackageDWorld(legacy),
    );
  });

  it('fails closed on incomplete model 4, malformed football, and future model 6', () => {
    const legacy = clone(asModel4(build()));
    delete legacy.medical;
    expect(isLegacyPackageDWorld(legacy)).toBe(false);
    expect(() => requireCurrentWorld(legacy)).toThrow(InvalidWorldModelError);

    const current = clone(build());
    current.football.plays = {};
    expect(worldModelProblems(current).length).toBeGreaterThan(0);
    expect(() => requireCurrentWorld(current)).toThrow(InvalidWorldModelError);

    const future = clone(build());
    future.worldModelVersion = 6;
    expect(() => requireCurrentWorld(future)).toThrow(
      UnsupportedWorldModelVersionError,
    );
  });
});
