import { describe, expect, it } from 'vitest';
import rulesetFixture from '../../../fixtures/rulesets/synthetic-minimal-v1.json';
import seedFixture from '../../../fixtures/seeds/synthetic-empty-v1.json';
import {
  ManifestTamperError,
  SCHEMA_VERSION,
  UnsupportedSchemaVersionError,
  rulesetRefOf,
  sealRuleset,
  sealSeed,
  seedRefOf,
  validateForWorldCreation,
  validateRulesetManifest,
  validateSeedManifest,
  type LeagueRulesetBody,
  type SourceProvenance,
  type ValidationStatus,
  type WorldSeedBody,
} from '../src/index';

const provenance = (validationStatus: ValidationStatus = 'synthetic'): SourceProvenance => ({
  sourceId: 'synthetic-fixture',
  sourceKind: 'synthetic',
  retrievedAt: '2026-10-16T00:00:00Z',
  effectiveAsOf: '2026-10-16',
  validationStatus,
  note: 'test fixture',
});

const rulesetBody = (over: Partial<LeagueRulesetBody> = {}): LeagueRulesetBody => ({
  schemaVersion: SCHEMA_VERSION,
  rulesetId: 'synthetic-minimal',
  rulesetVersion: 1,
  displayName: 'Synthetic Minimal',
  provenance: [provenance()],
  rules: { maxAdvanceDaysPerCommand: 30 },
  ...over,
});

const seedBodyFor = (
  rulesetRef: WorldSeedBody['ruleset'],
  over: Partial<WorldSeedBody> = {},
): WorldSeedBody => ({
  schemaVersion: SCHEMA_VERSION,
  seedId: 'synthetic-empty',
  seedVersion: 1,
  ruleset: rulesetRef,
  rngSeed32: 12345,
  startDate: '2026-10-16',
  provenance: [provenance()],
  initialEntities: [],
  ...over,
});

describe('ruleset + seed provenance contracts', () => {
  it('accepts a synthetic seed whose ruleset identity/version/hash match exactly', () => {
    const ruleset = sealRuleset(rulesetBody());
    const seed = sealSeed(seedBodyFor(rulesetRefOf(ruleset)));
    expect(validateForWorldCreation(seed, ruleset)).toEqual({ ok: true });
    expect(validateRulesetManifest(ruleset)).toEqual(ruleset);
    expect(validateSeedManifest(seed)).toEqual(seed);
    expect(seed.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(seedRefOf(seed).contentHash).toBe(seed.contentHash);
  });

  it('accepts verified provenance but rejects unverified or conflicted sources', () => {
    const ok = sealRuleset(rulesetBody({ provenance: [provenance('verified')] }));
    expect(validateForWorldCreation(sealSeed(seedBodyFor(rulesetRefOf(ok))), ok)).toEqual({ ok: true });

    for (const bad of ['unverified', 'conflicted'] as const) {
      const ruleset = sealRuleset(rulesetBody({ provenance: [provenance(bad)] }));
      const result = validateForWorldCreation(sealSeed(seedBodyFor(rulesetRefOf(ruleset))), ruleset);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.issues.map((i) => i.code)).toContain('PROVENANCE_NOT_ACCEPTABLE');
    }
    const seedBad = sealSeed(
      seedBodyFor(rulesetRefOf(sealRuleset(rulesetBody())), { provenance: [provenance('unverified')] }),
    );
    const res = validateForWorldCreation(seedBad, sealRuleset(rulesetBody()));
    expect(res.ok).toBe(false);
  });

  it('detects a tampered ruleset body (hash no longer matches)', () => {
    const ruleset = sealRuleset(rulesetBody());
    const tampered = { ...ruleset, rules: { maxAdvanceDaysPerCommand: 31 } };
    expect(() => validateRulesetManifest(tampered)).toThrow(ManifestTamperError);
    const seed = sealSeed(seedBodyFor(rulesetRefOf(ruleset)));
    const res = validateForWorldCreation(seed, tampered);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.issues.map((i) => i.code)).toContain('RULESET_HASH_MISMATCH');
  });

  it('detects a tampered seed body', () => {
    const ruleset = sealRuleset(rulesetBody());
    const seed = sealSeed(seedBodyFor(rulesetRefOf(ruleset)));
    const tampered = { ...seed, rngSeed32: 54321 };
    expect(() => validateSeedManifest(tampered)).toThrow(ManifestTamperError);
    const res = validateForWorldCreation(tampered, ruleset);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.issues.map((i) => i.code)).toContain('SEED_HASH_MISMATCH');
  });

  it('rejects a seed that points at a different ruleset id, version or hash', () => {
    const ruleset = sealRuleset(rulesetBody());
    const ref = rulesetRefOf(ruleset);
    const cases: Array<[string, WorldSeedBody['ruleset']]> = [
      ['id', { ...ref, rulesetId: 'other' }],
      ['version', { ...ref, rulesetVersion: 2 }],
      ['hash', { ...ref, contentHash: 'f'.repeat(64) }],
    ];
    for (const [, badRef] of cases) {
      const res = validateForWorldCreation(sealSeed(seedBodyFor(badRef)), ruleset);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.issues.map((i) => i.code)).toContain('SEED_RULESET_MISMATCH');
    }
  });

  it('fails explicitly on a future schema version instead of guessing', () => {
    const future = { ...sealRuleset(rulesetBody()), schemaVersion: 2 };
    expect(() => validateRulesetManifest(future)).toThrow(UnsupportedSchemaVersionError);
    expect(() => validateRulesetManifest(future)).toThrow(/2/);
    const ruleset = sealRuleset(rulesetBody());
    const futureSeed = { ...sealSeed(seedBodyFor(rulesetRefOf(ruleset))), schemaVersion: 2 };
    expect(() => validateSeedManifest(futureSeed)).toThrow(UnsupportedSchemaVersionError);
  });

  it('hashes a canonical body that excludes the embedded content hash and ignores key order', () => {
    const a = sealRuleset(rulesetBody());
    const b = sealRuleset({
      rules: { maxAdvanceDaysPerCommand: 30 },
      provenance: [provenance()],
      displayName: 'Synthetic Minimal',
      rulesetVersion: 1,
      rulesetId: 'synthetic-minimal',
      schemaVersion: SCHEMA_VERSION,
    });
    expect(a.contentHash).toBe(b.contentHash);
    expect(sealRuleset(rulesetBody({ displayName: 'Changed' })).contentHash).not.toBe(a.contentHash);
  });

  it('shipped synthetic fixtures validate and form a matching pair', () => {
    const ruleset = validateRulesetManifest(rulesetFixture);
    const seed = validateSeedManifest(seedFixture);
    expect(validateForWorldCreation(seed, ruleset)).toEqual({ ok: true });
    expect(ruleset.provenance.every((p) => p.sourceKind === 'synthetic')).toBe(true);
  });
});
