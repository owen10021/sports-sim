import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DOMAIN_STATE_KEYS,
  GOLDEN_EXPECTED,
  InvalidWorldModelError,
  PACKAGE_B_DOMAIN_STATE_KEYS,
  PACKAGE_B_EXPECTED,
  PACKAGE_C_DOMAIN_STATE_KEYS,
  PACKAGE_C_EXPECTED,
  PACKAGE_D_DOMAIN_STATE_KEYS,
  PACKAGE_D_EXPECTED,
  UnsupportedWorldModelVersionError,
  WORLD_MODEL_VERSION,
  WorldKernel,
  canonicalString,
  createWorld,
  currentModelFingerprintOf,
  fingerprintLegacyPackageCWorld,
  fingerprintWorld,
  isLegacyPackageAWorld,
  isLegacyPackageBWorld,
  isLegacyPackageCWorld,
  migrateLegacyPackageAWorld,
  migrateLegacyPackageBWorld,
  migrateLegacyPackageCWorld,
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

const D_DOMAINS = ['development', 'medical'] as const;

/** What Package C (world model 3) would have produced: no Package D domains. */
const asModel3 = (w: FootballWorld): Record<string, unknown> => {
  const copy = clone(w);
  copy.worldModelVersion = 3;
  for (const d of D_DOMAINS) delete copy[d];
  delete copy.football;
  return copy;
};

/** What Package B (world model 2) would have produced: no Package C or D domains. */
const asModel2 = (w: FootballWorld): Record<string, unknown> => {
  const copy = clone(w);
  copy.worldModelVersion = 2;
  for (const key of Object.keys(DOMAIN_STATE_KEYS))
    if (!(key in PACKAGE_B_DOMAIN_STATE_KEYS)) delete copy[key];
  return copy;
};

describe('current world model (v4)', () => {
  it('declares world model version 4', () => {
    expect(WORLD_MODEL_VERSION).toBe(5);
    expect(build().worldModelVersion).toBe(5);
  });

  it('keeps Package B and C domains first and adds development then medical', () => {
    expect(Object.keys(PACKAGE_D_DOMAIN_STATE_KEYS)).toEqual(D_DOMAINS);
    expect(Object.keys(PACKAGE_C_DOMAIN_STATE_KEYS)).toEqual([
      'people',
      'organizations',
      'authority',
      'information',
      'relationships',
      'plans',
      'decisions',
      'roster',
      'contracts',
      'market',
      'scouting',
      'draft',
    ]);
    expect(DOMAIN_STATE_KEYS.development).toEqual([
      'playerProfiles',
      'teachingProfiles',
      'roleKnowledge',
      'readiness',
      'opportunityWindows',
      'opportunityAllocations',
      'checkpoints',
      'events',
    ]);
    expect(DOMAIN_STATE_KEYS.medical).toEqual([
      'episodes',
      'progress',
      'reports',
      'preferences',
      'recommendations',
      'clearances',
    ]);
  });

  it('creates a world with empty, deeply frozen Package D state', () => {
    const w = build();
    for (const d of D_DOMAINS) {
      const state = (w as unknown as Record<string, Record<string, unknown>>)[
        d
      ]!;
      expect(Object.isFrozen(state)).toBe(true);
      for (const c of DOMAIN_STATE_KEYS[d]) {
        expect(state[c]).toEqual([]);
        expect(Object.isFrozen(state[c])).toBe(true);
      }
    }
    expect(worldModelProblems(w)).toEqual([]);
  });

  it('holds no second capability ledger or summary rating anywhere in the D domains', () => {
    const w = build();
    const text = canonicalString({
      development: w.development,
      medical: w.medical,
    });
    for (const forbidden of [
      'overall',
      'ovr',
      'potential',
      'ceiling',
      'xp',
      'capabilities',
    ])
      expect(text.toLowerCase()).not.toContain(`"${forbidden}"`);
    for (const d of D_DOMAINS)
      for (const c of DOMAIN_STATE_KEYS[d])
        expect(c.toLowerCase()).not.toMatch(
          /overall|ovr|potential|ceiling|xp|capabilit/,
        );
  });

  it('is deterministic and fingerprints model 4 under its own version', () => {
    const a = build();
    const b = build();
    expect(canonicalString(a)).toBe(canonicalString(b));
    expect(fingerprintWorld(a)).toBe(fingerprintWorld(b));
    expect(fingerprintLegacyPackageCWorld(asModel3(a) as never)).not.toBe(
      fingerprintWorld(a),
    );
  });
});

describe('world model validation (fail closed)', () => {
  it('rejects a v4-marked world that is missing a Package D domain', () => {
    for (const d of D_DOMAINS) {
      const w = clone(build());
      delete w[d];
      expect(worldModelProblems(w).length).toBeGreaterThan(0);
      expect(() => requireCurrentWorld(w)).toThrow(InvalidWorldModelError);
    }
  });

  it('rejects a v4 world with a missing, extra or non-array Package D collection', () => {
    const missing = clone(build());
    delete (missing.development as Record<string, unknown>).events;
    expect(worldModelProblems(missing).length).toBeGreaterThan(0);
    const extra = clone(build());
    (extra.medical as Record<string, unknown>).surprise = [];
    expect(worldModelProblems(extra).length).toBeGreaterThan(0);
    const notArray = clone(build());
    (notArray.development as Record<string, unknown>).readiness = {};
    expect(worldModelProblems(notArray).length).toBeGreaterThan(0);
  });

  it('does not accept a model-3 world as current (it must be migrated)', () => {
    const m3 = asModel3(build());
    expect(worldModelProblems(m3).length).toBeGreaterThan(0);
    expect(() =>
      WorldKernel.fromGenesis(m3 as unknown as FootballWorld, makeRuleset()),
    ).toThrow(InvalidWorldModelError);
  });

  it('refuses a future world model version instead of guessing', () => {
    const w = clone(build());
    w.worldModelVersion = 6;
    expect(() => requireCurrentWorld(w)).toThrow(
      UnsupportedWorldModelVersionError,
    );
  });

  it('rejects wrong version markers', () => {
    const w = clone(build());
    for (const bad of [0, -1, '4', null, 4.5]) {
      w.worldModelVersion = bad;
      expect(worldModelProblems(w).length).toBeGreaterThan(0);
      expect(() => requireCurrentWorld(w)).toThrow(InvalidWorldModelError);
    }
  });

  it('keeps model detection mutually exclusive', () => {
    const w = build();
    expect(isLegacyPackageAWorld(w)).toBe(false);
    expect(isLegacyPackageBWorld(w)).toBe(false);
    expect(isLegacyPackageCWorld(w)).toBe(false);
    const m3 = asModel3(w);
    expect(isLegacyPackageCWorld(m3)).toBe(true);
    expect(isLegacyPackageBWorld(m3)).toBe(false);
    expect(isLegacyPackageAWorld(m3)).toBe(false);
    const m2 = asModel2(w);
    expect(isLegacyPackageBWorld(m2)).toBe(true);
    expect(isLegacyPackageCWorld(m2)).toBe(false);
    expect(isLegacyPackageCWorld(null)).toBe(false);
    const partialM3 = clone(m3);
    delete partialM3.draft;
    expect(isLegacyPackageCWorld(partialM3)).toBe(false);
    expect(() => requireCurrentWorld(partialM3)).toThrow(
      InvalidWorldModelError,
    );
    const m3WithD = clone(w);
    m3WithD.worldModelVersion = 3;
    expect(isLegacyPackageCWorld(m3WithD)).toBe(false);
  });
});

describe('migration functions', () => {
  it('migrateLegacyPackageCWorld adds only empty Package D state', () => {
    const current = build();
    const m3 = asModel3(current);
    const before = canonicalString(m3);
    const migrated = migrateLegacyPackageCWorld(m3 as never);
    expect(canonicalString(m3)).toBe(before);
    expect(canonicalString(migrated)).toBe(canonicalString(current));
    expect(worldModelProblems(migrated)).toEqual([]);
    expect(Object.isFrozen(migrated)).toBe(true);
    expect(currentModelFingerprintOf(m3 as never)).toBe(
      fingerprintWorld(current),
    );
  });

  it('refuses anything that is not a genuine model-3 world', () => {
    expect(() => migrateLegacyPackageCWorld(build() as never)).toThrow(
      InvalidWorldModelError,
    );
    expect(() => migrateLegacyPackageCWorld(null as never)).toThrow();
    const partial = asModel3(build());
    delete partial.scouting;
    expect(() => migrateLegacyPackageCWorld(partial as never)).toThrow();
  });

  it('chains Package B -> C -> D to the same world a direct build produces', () => {
    const current = build();
    const m2 = asModel2(current);
    const migrated = migrateLegacyPackageBWorld(m2 as never);
    expect(canonicalString(migrated)).toBe(canonicalString(current));
    expect(migrated.worldModelVersion).toBe(5);
    expect(requireCurrentWorld(m2)).toEqual(migrated);
  });

  it('chains Package A -> B -> C -> D to the same world a direct build produces', () => {
    const current = build();
    const legacyA = clone(current);
    delete legacyA.worldModelVersion;
    for (const key of Object.keys(DOMAIN_STATE_KEYS)) delete legacyA[key];
    legacyA.nextIds = { event: current.nextIds.event };
    expect(isLegacyPackageAWorld(legacyA)).toBe(true);
    const migrated = migrateLegacyPackageAWorld(legacyA as never);
    expect(canonicalString(migrated)).toBe(canonicalString(current));
    expect(migrated.worldModelVersion).toBe(5);
    expect(requireCurrentWorld(legacyA)).toEqual(migrated);
  });
});

describe('snapshot boundary', () => {
  it('verifies a sealed model-3 snapshot with model-3 fingerprint semantics and a sealed v4 one', () => {
    const current = build();
    const m4 = sealSnapshot({
      world: current,
      chainHead: '0'.repeat(64),
      eventCount: 0,
      knownCommandIds: [],
    });
    expect(verifySnapshot(m4)).toEqual({ ok: true });
    expect(m4.worldFingerprint).toBe(fingerprintWorld(current));
    const future = { ...m4, world: { ...m4.world, worldModelVersion: 6 } };
    expect(() => verifySnapshot(future)).toThrow(
      UnsupportedWorldModelVersionError,
    );
    const broken = { ...m4, world: { ...asModel3(current), draft: {} } };
    expect(verifySnapshot(broken).ok).toBe(false);
  });
});

describe('golden versioning on the model bump (history immutable, current model new)', () => {
  const goldenDir = join(__dirname, '..', '..', '..', 'fixtures', 'golden');
  const sha = (name: string) =>
    createHash('sha256')
      .update(readFileSync(join(goldenDir, name)))
      .digest('hex');
  const read = (name: string) =>
    JSON.parse(readFileSync(join(goldenDir, name), 'utf8')) as unknown;

  /** Remove every world-fingerprint-bearing key and the scenario id. */
  const withoutFingerprints = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(withoutFingerprints);
    if (typeof v === 'object' && v !== null)
      return Object.fromEntries(
        Object.entries(v)
          .filter(([k]) => k !== 'scenario' && !/ingerprint/.test(k))
          .map(([k, x]) => [k, withoutFingerprints(x)]),
      );
    return v;
  };

  it('keeps every accepted golden file byte-identical', () => {
    expect(sha('package-a-golden-v1.json')).toBe(
      'a05d5b76eb58b38ae01ff47cdfbde507dbe21c64e4c29aa1cf7858d1ae067688',
    );
    expect(sha('package-a-golden-v2.json')).toBe(
      'dce380e59dadcc5f8392face1a039dafb4de44638f013803f019529d15e84fc8',
    );
    expect(sha('package-a-golden-v3.json')).toBe(
      '11d3bc540d7959f8cfae44840543d9778027cc3b4e6f5dd8628202bccbdb1756',
    );
    expect(sha('package-b-golden-v1.json')).toBe(
      'ad188795e4ceb40ee4f28a5bcbfbb747d53cc542d59d8d8872d67f338f1e4184',
    );
    expect(sha('package-b-golden-v2.json')).toBe(
      '13439b5977f3a95234ee4e6ebe7064067db0286c5b900824995ee0e977a95bd7',
    );
    expect(sha('package-c-golden-v1.json')).toBe(
      '9c09a12441496ff9ff6898a47a2c1d3be12698cfc1fa4994b8e36c3509f6c6be',
    );
  });

  it('new current-model files are the active expected constants', () => {
    expect(GOLDEN_EXPECTED.scenario).toBe('package-a-golden-v5');
    expect(PACKAGE_B_EXPECTED.scenario).toBe('package-b-golden-v4');
    expect(PACKAGE_C_EXPECTED.scenario).toBe('package-c-golden-v3');
    expect(PACKAGE_D_EXPECTED.scenario).toBe('package-d-golden-v2');
    expect(read('package-a-golden-v5.json')).toEqual(
      JSON.parse(JSON.stringify(GOLDEN_EXPECTED)),
    );
    expect(read('package-b-golden-v4.json')).toEqual(
      JSON.parse(JSON.stringify(PACKAGE_B_EXPECTED)),
    );
    expect(read('package-c-golden-v3.json')).toEqual(
      JSON.parse(JSON.stringify(PACKAGE_C_EXPECTED)),
    );
    expect(read('package-d-golden-v2.json')).toEqual(
      JSON.parse(JSON.stringify(PACKAGE_D_EXPECTED)),
    );
  });

  it('each new version differs from its predecessor only in world fingerprints', () => {
    const pairs: [string, string, { fingerprint: string }][] = [
      ['package-a-golden-v4.json', 'package-a-golden-v5.json', GOLDEN_EXPECTED],
      [
        'package-b-golden-v3.json',
        'package-b-golden-v4.json',
        PACKAGE_B_EXPECTED,
      ],
      [
        'package-c-golden-v2.json',
        'package-c-golden-v3.json',
        PACKAGE_C_EXPECTED,
      ],
      [
        'package-d-golden-v1.json',
        'package-d-golden-v2.json',
        PACKAGE_D_EXPECTED,
      ],
    ];
    for (const [oldName, newName, current] of pairs) {
      const accepted = read(oldName) as { fingerprint: string };
      expect(current.fingerprint).not.toBe(accepted.fingerprint);
      expect(canonicalString(withoutFingerprints(read(newName)))).toBe(
        canonicalString(withoutFingerprints(accepted)),
      );
    }
  });
});
