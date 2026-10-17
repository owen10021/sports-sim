import { describe, expect, it } from 'vitest';
import {
  DOMAIN_STATE_KEYS,
  InvalidWorldModelError,
  PACKAGE_B_DOMAIN_STATE_KEYS,
  UnsupportedWorldModelVersionError,
  WORLD_MODEL_VERSION,
  WorldKernel,
  canonicalString,
  createWorld,
  currentModelFingerprintOf,
  fingerprintLegacyPackageBWorld,
  fingerprintWorld,
  isLegacyPackageAWorld,
  isLegacyPackageBWorld,
  migrateLegacyPackageAWorld,
  migrateLegacyPackageBWorld,
  requireCurrentWorld,
  sealSnapshot,
  verifySnapshot,
  worldModelProblems,
  type FootballWorld,
} from '../src/index';
import { fixedIdSource, makeRuleset, makeSeed } from './helpers';

const build = (): FootballWorld => {
  const ruleset = makeRuleset();
  return createWorld(makeSeed(ruleset), ruleset, fixedIdSource());
};

const clone = (w: unknown): Record<string, unknown> =>
  JSON.parse(JSON.stringify(w)) as Record<string, unknown>;

/** What Package B (world model 2) would have produced: no Package C domains. */
const asModel2 = (w: FootballWorld): Record<string, unknown> => {
  const copy = clone(w);
  copy.worldModelVersion = 2;
  for (const key of Object.keys(DOMAIN_STATE_KEYS))
    if (!(key in PACKAGE_B_DOMAIN_STATE_KEYS)) delete copy[key];
  return copy;
};

const C_DOMAINS = ['roster', 'contracts', 'market', 'scouting', 'draft'];

describe('current world model (v3)', () => {
  it('declares world model version 3', () => {
    expect(WORLD_MODEL_VERSION).toBe(3);
    expect(build().worldModelVersion).toBe(3);
  });

  it('keeps Package B domains first and adds the five Package C domains in canonical order', () => {
    expect(Object.keys(DOMAIN_STATE_KEYS)).toEqual([
      'people',
      'organizations',
      'authority',
      'information',
      'relationships',
      'plans',
      'decisions',
      ...C_DOMAINS,
    ]);
    expect(DOMAIN_STATE_KEYS.roster).toEqual([
      'players',
      'rights',
      'memberships',
      'waivers',
      'waiverClaims',
      'waiverPriority',
    ]);
    expect(DOMAIN_STATE_KEYS.contracts).toEqual(['agreements', 'terminations']);
    expect(DOMAIN_STATE_KEYS.market).toEqual([
      'agentClients',
      'playerPreferences',
      'inquiries',
      'tradeOffers',
      'contractOffers',
      'reservations',
      'responses',
    ]);
    expect(DOMAIN_STATE_KEYS.scouting).toEqual([
      'evaluatorProfiles',
      'questions',
      'assignments',
      'reports',
    ]);
    expect(DOMAIN_STATE_KEYS.draft).toEqual([
      'classes',
      'picks',
      'boards',
      'sessions',
      'selections',
    ]);
  });

  it('creates a world with empty, deeply frozen Package C state', () => {
    const w = build();
    for (const d of C_DOMAINS) {
      const state = (w as unknown as Record<string, Record<string, unknown>>)[
        d
      ]!;
      expect(Object.isFrozen(state)).toBe(true);
      for (const c of DOMAIN_STATE_KEYS[d as keyof typeof DOMAIN_STATE_KEYS]) {
        expect(state[c]).toEqual([]);
        expect(Object.isFrozen(state[c])).toBe(true);
      }
    }
    expect(worldModelProblems(w)).toEqual([]);
  });

  it('is deterministic and fingerprints model 3 under its own version', () => {
    const a = build();
    const b = build();
    expect(canonicalString(a)).toBe(canonicalString(b));
    expect(fingerprintWorld(a)).toBe(fingerprintWorld(b));
    expect(fingerprintLegacyPackageBWorld(asModel2(a) as never)).not.toBe(
      fingerprintWorld(a),
    );
  });
});

describe('world model validation (fail closed)', () => {
  it('rejects a v3-marked world that is missing a Package C domain', () => {
    for (const d of C_DOMAINS) {
      const w = clone(build());
      delete w[d];
      expect(worldModelProblems(w).length).toBeGreaterThan(0);
      expect(() => requireCurrentWorld(w)).toThrow(InvalidWorldModelError);
    }
  });

  it('rejects a v3 world with a missing, extra or non-array Package C collection', () => {
    const missing = clone(build());
    delete (missing.roster as Record<string, unknown>).waiverPriority;
    expect(worldModelProblems(missing).length).toBeGreaterThan(0);
    const extra = clone(build());
    (extra.draft as Record<string, unknown>).surprise = [];
    expect(worldModelProblems(extra).length).toBeGreaterThan(0);
    const notArray = clone(build());
    (notArray.market as Record<string, unknown>).tradeOffers = {};
    expect(worldModelProblems(notArray).length).toBeGreaterThan(0);
  });

  it('does not accept a model-2 world as current (it must be migrated)', () => {
    const m2 = asModel2(build());
    expect(worldModelProblems(m2).length).toBeGreaterThan(0);
    expect(() =>
      WorldKernel.fromGenesis(m2 as unknown as FootballWorld, makeRuleset()),
    ).toThrow(InvalidWorldModelError);
  });

  it('refuses a future world model version instead of guessing', () => {
    const w = clone(build());
    w.worldModelVersion = 4;
    expect(() => requireCurrentWorld(w)).toThrow(
      UnsupportedWorldModelVersionError,
    );
  });

  it('rejects wrong version markers', () => {
    const w = clone(build());
    for (const bad of [0, -1, '3', null, 3.5]) {
      w.worldModelVersion = bad;
      expect(worldModelProblems(w).length).toBeGreaterThan(0);
      expect(() => requireCurrentWorld(w)).toThrow(InvalidWorldModelError);
    }
  });

  it('keeps model detection mutually exclusive', () => {
    const w = build();
    expect(isLegacyPackageAWorld(w)).toBe(false);
    expect(isLegacyPackageBWorld(w)).toBe(false);
    const m2 = asModel2(w);
    expect(isLegacyPackageBWorld(m2)).toBe(true);
    expect(isLegacyPackageAWorld(m2)).toBe(false);
    expect(isLegacyPackageBWorld(null)).toBe(false);
    const partialM2 = clone(m2);
    delete partialM2.plans;
    expect(isLegacyPackageBWorld(partialM2)).toBe(false);
    expect(() => requireCurrentWorld(partialM2)).toThrow(
      InvalidWorldModelError,
    );
    const m2WithC = clone(w);
    m2WithC.worldModelVersion = 2;
    expect(isLegacyPackageBWorld(m2WithC)).toBe(false);
  });
});

describe('migration functions', () => {
  it('migrateLegacyPackageBWorld adds only empty Package C state', () => {
    const current = build();
    const m2 = asModel2(current);
    const before = canonicalString(m2);
    const migrated = migrateLegacyPackageBWorld(m2 as never);
    expect(canonicalString(m2)).toBe(before);
    expect(canonicalString(migrated)).toBe(canonicalString(current));
    expect(worldModelProblems(migrated)).toEqual([]);
    expect(Object.isFrozen(migrated)).toBe(true);
    expect(currentModelFingerprintOf(m2 as never)).toBe(
      fingerprintWorld(current),
    );
  });

  it('refuses anything that is not a genuine model-2 world', () => {
    expect(() => migrateLegacyPackageBWorld(build() as never)).toThrow(
      InvalidWorldModelError,
    );
    expect(() => migrateLegacyPackageBWorld(null as never)).toThrow();
    const partial = asModel2(build());
    delete partial.decisions;
    expect(() => migrateLegacyPackageBWorld(partial as never)).toThrow();
  });

  it('chains Package A -> B -> C to the same world a direct build produces', () => {
    const current = build();
    const legacyA = clone(current);
    delete legacyA.worldModelVersion;
    for (const key of Object.keys(DOMAIN_STATE_KEYS)) delete legacyA[key];
    legacyA.nextIds = { event: current.nextIds.event };
    expect(isLegacyPackageAWorld(legacyA)).toBe(true);
    const migrated = migrateLegacyPackageAWorld(legacyA as never);
    expect(canonicalString(migrated)).toBe(canonicalString(current));
    expect(migrated.worldModelVersion).toBe(3);
    expect(requireCurrentWorld(legacyA)).toEqual(migrated);
  });
});

describe('snapshot boundary', () => {
  it('verifies a sealed model-2 snapshot with model-2 fingerprint semantics and a sealed v3 one', () => {
    const current = build();
    const m3 = sealSnapshot({
      world: current,
      chainHead: '0'.repeat(64),
      eventCount: 0,
      knownCommandIds: [],
    });
    expect(verifySnapshot(m3)).toEqual({ ok: true });
    expect(m3.worldFingerprint).toBe(fingerprintWorld(current));
    const future = { ...m3, world: { ...m3.world, worldModelVersion: 4 } };
    expect(() => verifySnapshot(future)).toThrow(
      UnsupportedWorldModelVersionError,
    );
    const broken = { ...m3, world: { ...asModel2(current), roster: {} } };
    expect(verifySnapshot(broken).ok).toBe(false);
  });
});
