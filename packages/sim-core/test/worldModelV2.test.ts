import { describe, expect, it } from 'vitest';
import {
  DOMAIN_STATE_KEYS,
  InvalidWorldModelError,
  UnsupportedWorldModelVersionError,
  WORLD_MODEL_VERSION,
  WorldKernel,
  canonicalString,
  createWorld,
  currentModelFingerprintOf,
  fingerprintLegacyPackageAWorld,
  fingerprintWorld,
  isLegacyPackageAWorld,
  recordId,
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

/** The same world with every Package B field removed: what Package A would have produced. */
const asLegacy = (w: FootballWorld): Record<string, unknown> => {
  const copy: Record<string, unknown> = JSON.parse(JSON.stringify(w));
  delete copy.worldModelVersion;
  for (const key of Object.keys(DOMAIN_STATE_KEYS)) delete copy[key];
  copy.nextIds = { event: w.nextIds.event };
  return copy;
};

describe('current world model (v3, Package B domains)', () => {
  it('declares world model version 3, independent of the persistence schema version', () => {
    expect(WORLD_MODEL_VERSION).toBe(3);
    const w = build();
    expect(w.worldModelVersion).toBe(3);
    expect(w.schemaVersion).toBe(1);
  });

  it('creates a world with empty, canonically ordered domain state and a record counter', () => {
    const w = build();
    expect(w.nextIds).toEqual({ event: 1, record: 1 });
    expect(Object.keys(DOMAIN_STATE_KEYS)).toEqual([
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
    for (const [domain, collections] of Object.entries(DOMAIN_STATE_KEYS)) {
      const state = (w as unknown as Record<string, Record<string, unknown>>)[
        domain
      ] as Record<string, unknown>;
      expect(Object.keys(state).sort()).toEqual([...collections].sort());
      for (const c of collections) expect(state[c]).toEqual([]);
    }
    expect(worldModelProblems(w)).toEqual([]);
  });

  it('is deeply frozen and deterministic', () => {
    const a = build();
    const b = build();
    expect(Object.isFrozen(a.people)).toBe(true);
    expect(Object.isFrozen(a.decisions.receipts)).toBe(true);
    expect(canonicalString(a)).toBe(canonicalString(b));
    expect(fingerprintWorld(a)).toBe(fingerprintWorld(b));
  });

  it('fingerprints the current model under its own domain, distinct from the legacy one', () => {
    const w = build();
    const legacy = asLegacy(w);
    expect(fingerprintLegacyPackageAWorld(legacy as never)).not.toBe(
      fingerprintWorld(w),
    );
  });

  it('mints record ids with the shared id rules', () => {
    expect(recordId('rec-000001')).toBe('rec-000001');
    expect(() => recordId('')).toThrow(TypeError);
    expect(() => recordId('has space')).toThrow(TypeError);
  });
});

describe('world model validation (fail closed)', () => {
  it('rejects a structurally incomplete old world as current', () => {
    const half = {
      ...asLegacy(build()),
      people: { persons: [], roleEpisodes: [] },
    };
    expect(isLegacyPackageAWorld(half)).toBe(false);
    expect(worldModelProblems(half).length).toBeGreaterThan(0);
    expect(() => requireCurrentWorld(half)).toThrow(InvalidWorldModelError);
  });

  it('rejects a v2 world with a missing or extra domain collection', () => {
    const w = build();
    const missing = JSON.parse(JSON.stringify(w)) as Record<string, unknown>;
    delete missing.plans;
    expect(worldModelProblems(missing).length).toBeGreaterThan(0);
    const extra = JSON.parse(JSON.stringify(w)) as Record<string, unknown>;
    (extra.people as Record<string, unknown>).surprise = [];
    expect(worldModelProblems(extra).length).toBeGreaterThan(0);
    const noRecord = JSON.parse(JSON.stringify(w)) as Record<string, unknown>;
    noRecord.nextIds = { event: 1 };
    expect(worldModelProblems(noRecord).length).toBeGreaterThan(0);
  });

  it('rejects an explicit but wrong world model version marker', () => {
    const w = JSON.parse(JSON.stringify(build())) as Record<string, unknown>;
    for (const bad of [1, 0, -1, '2', null, 2.5]) {
      w.worldModelVersion = bad;
      expect(worldModelProblems(w).length).toBeGreaterThan(0);
      expect(() => requireCurrentWorld(w)).toThrow(InvalidWorldModelError);
    }
  });

  it('refuses a future world model version instead of guessing', () => {
    const w = JSON.parse(JSON.stringify(build())) as Record<string, unknown>;
    w.worldModelVersion = 4;
    expect(() => requireCurrentWorld(w)).toThrow(
      UnsupportedWorldModelVersionError,
    );
    const err = (() => {
      try {
        requireCurrentWorld(w);
      } catch (e) {
        return e as UnsupportedWorldModelVersionError;
      }
      return null;
    })();
    expect(err?.found).toBe(4);
  });

  it('keeps legacy and current detection mutually exclusive', () => {
    const w = build();
    expect(isLegacyPackageAWorld(w)).toBe(false);
    expect(isLegacyPackageAWorld(asLegacy(w))).toBe(true);
    expect(isLegacyPackageAWorld(null)).toBe(false);
    expect(isLegacyPackageAWorld('world')).toBe(false);
  });

  it('currentModelFingerprintOf equals fingerprintWorld for a current world', () => {
    const w = build();
    expect(currentModelFingerprintOf(w)).toBe(fingerprintWorld(w));
  });
});

describe('kernel and snapshot boundaries', () => {
  it('fromGenesis refuses a legacy-shaped or future world', () => {
    const ruleset = makeRuleset();
    const legacy = asLegacy(build());
    expect(() =>
      WorldKernel.fromGenesis(legacy as unknown as FootballWorld, ruleset),
    ).toThrow(InvalidWorldModelError);
    const future = {
      ...build(),
      worldModelVersion: 4,
    } as unknown as FootballWorld;
    expect(() => WorldKernel.fromGenesis(future, ruleset)).toThrow(
      UnsupportedWorldModelVersionError,
    );
  });

  it('seals and verifies current snapshots, and throws on a future world model', () => {
    const w = build();
    const snap = sealSnapshot({
      world: w,
      chainHead: '0'.repeat(64),
      eventCount: 0,
      knownCommandIds: [],
    });
    expect(verifySnapshot(snap)).toEqual({ ok: true });
    expect(snap.worldFingerprint).toBe(fingerprintWorld(w));
    const future = { ...snap, world: { ...snap.world, worldModelVersion: 4 } };
    expect(() => verifySnapshot(future)).toThrow(
      UnsupportedWorldModelVersionError,
    );
  });

  it('reports (not throws) a snapshot whose world is neither legacy nor current', () => {
    const w = build();
    const snap = sealSnapshot({
      world: w,
      chainHead: '0'.repeat(64),
      eventCount: 0,
      knownCommandIds: [],
    });
    const broken = { ...snap, world: { ...asLegacy(w), people: {} } };
    const verdict = verifySnapshot(broken);
    expect(verdict.ok).toBe(false);
  });
});
