import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ManifestFormatError,
  ManifestTamperError,
  MissingDevelopmentRulesError,
  SYNTHETIC_PACKAGE_C_RULESET,
  SYNTHETIC_PACKAGE_D_RULESET,
  SYNTHETIC_RULESET,
  familyOfCapability,
  looksLikeSummaryRating,
  parseDevelopmentRulesV1,
  requireDevelopmentRules,
  sealRuleset,
  validateRulesetManifest,
  type LeagueRulesetBody,
} from '../src/index';

const root = join(__dirname, '..', '..', '..');
const readRuleset = (name: string): Record<string, unknown> =>
  JSON.parse(
    readFileSync(join(root, 'fixtures', 'rulesets', name), 'utf8'),
  ) as Record<string, unknown>;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const bodyOf = (
  m: Record<string, unknown>,
): LeagueRulesetBody & Record<string, unknown> => {
  const { contentHash: _hash, ...body } = m;
  void _hash;
  return body as never;
};

const devOf = (): Record<string, unknown> =>
  clone(SYNTHETIC_PACKAGE_D_RULESET.rules.development) as never;

describe('older rulesets are unaffected by the optional development block', () => {
  it('re-seals Package A, B and C rulesets byte-identically', () => {
    for (const name of [
      'synthetic-minimal-v1.json',
      'synthetic-package-c-rules-v1.json',
    ]) {
      const file = readRuleset(name);
      const resealed = sealRuleset(bodyOf(file));
      expect(resealed.contentHash).toBe(file.contentHash);
      expect(JSON.parse(JSON.stringify(resealed))).toEqual(file);
      expect(validateRulesetManifest(file).contentHash).toBe(file.contentHash);
    }
    expect('development' in SYNTHETIC_RULESET.rules).toBe(false);
    expect('development' in SYNTHETIC_PACKAGE_C_RULESET.rules).toBe(false);
  });

  it('keeps the accepted Package C ruleset hash', () => {
    expect(SYNTHETIC_PACKAGE_C_RULESET.contentHash).toBe(
      '2f1affed310f6764f746395924f68d6648e8e2ccf211a6e410f9e8f3f8c75f23',
    );
  });

  it('fails closed when a ruleset has no development rules', () => {
    expect(() => requireDevelopmentRules(SYNTHETIC_PACKAGE_C_RULESET)).toThrow(
      MissingDevelopmentRulesError,
    );
    expect(() => requireDevelopmentRules(SYNTHETIC_RULESET)).toThrow(
      MissingDevelopmentRulesError,
    );
  });
});

describe('the synthetic Package D ruleset', () => {
  it('matches the committed fixture file exactly and pins its content hash', () => {
    const file = readRuleset('synthetic-package-d-rules-v1.json');
    expect(file).toEqual(
      JSON.parse(JSON.stringify(SYNTHETIC_PACKAGE_D_RULESET)),
    );
    expect(SYNTHETIC_PACKAGE_D_RULESET.contentHash).toBe(
      '727aa3d3bc708a0d4596669df891ae1ef7d292cfaa66595c6d9a4844a7f8ca31',
    );
    expect(validateRulesetManifest(file).contentHash).toBe(file.contentHash);
  });

  it('is labelled synthetic and not an empirical claim', () => {
    for (const entry of SYNTHETIC_PACKAGE_D_RULESET.provenance) {
      expect(entry.sourceKind).toBe('synthetic');
      expect(entry.validationStatus).toBe('synthetic');
      const note = (entry.note ?? '').toLowerCase();
      expect(note).toContain('not validated');
      expect(note).toContain('nfl');
    }
  });

  it('keeps the Package C transaction rules unchanged and adds development rules', () => {
    expect(SYNTHETIC_PACKAGE_D_RULESET.rules.transactions).toEqual(
      SYNTHETIC_PACKAGE_C_RULESET.rules.transactions,
    );
    const dev = requireDevelopmentRules(SYNTHETIC_PACKAGE_D_RULESET);
    expect(dev.modelVersion).toBe(1);
    expect(dev.opportunityPools.length).toBe(32);
    expect(dev.capabilityFamilies.length).toBe(4);
  });

  it('assigns each capability key to exactly one family', () => {
    const dev = requireDevelopmentRules(SYNTHETIC_PACKAGE_D_RULESET);
    const keys = dev.capabilityFamilies.flatMap((f) => f.capabilityKeys);
    expect(new Set(keys).size).toBe(keys.length);
    expect(familyOfCapability(dev, 'burst')?.familyKey).toBe(
      'explosive_athleticism',
    );
    expect(familyOfCapability(dev, 'processing')?.familyKey).toBe(
      'processing_recognition',
    );
    expect(familyOfCapability(dev, 'not_a_capability')).toBeUndefined();
  });

  it('ages differ by family: no universal cliff', () => {
    const dev = requireDevelopmentRules(SYNTHETIC_PACKAGE_D_RULESET);
    const onsets = dev.capabilityFamilies.map((f) => f.declineOnsetAgeDays);
    expect(new Set(onsets).size).toBe(onsets.length);
    for (const f of dev.capabilityFamilies)
      expect(f.maturationMidpointAgeDays).toBeLessThan(f.declineOnsetAgeDays);
  });

  it('contains no summary rating, ceiling, XP, tier or multiplier field', () => {
    const text = JSON.stringify(SYNTHETIC_PACKAGE_D_RULESET.rules.development);
    for (const k of Object.keys(JSON.parse(text))) {
      expect(looksLikeSummaryRating(k)).toBe(false);
    }
    expect(text.toLowerCase()).not.toMatch(
      /"(overall|ovr|potential|ceiling|xp|tier|multiplier)/,
    );
  });

  it('detects tampering with any development field', () => {
    const copy = clone(SYNTHETIC_PACKAGE_D_RULESET) as never as {
      rules: { development: { roleLearningScaleBp: number } };
    };
    copy.rules.development.roleLearningScaleBp += 1;
    expect(() => validateRulesetManifest(copy)).toThrow(ManifestTamperError);
  });
});

describe('development rules parsing fails closed', () => {
  const parse = (mut: (d: Record<string, unknown>) => void): unknown => {
    const d = devOf();
    mut(d);
    return parseDevelopmentRulesV1(d, 'dev');
  };
  const rejects = (mut: (d: Record<string, unknown>) => void): void =>
    expect(() => parse(mut)).toThrow(ManifestFormatError);

  it('accepts the unmodified block', () => {
    expect(parse(() => undefined)).toEqual(
      SYNTHETIC_PACKAGE_D_RULESET.rules.development,
    );
  });

  it('rejects unsupported model versions and unknown or missing keys', () => {
    rejects((d) => (d.modelVersion = 2));
    rejects((d) => (d.modelVersion = 0));
    rejects((d) => (d.surprise = 1));
    rejects((d) => delete d.checkpointCadenceDays);
    rejects((d) => delete d.capabilityFamilies);
  });

  it('rejects out-of-range or non-integer numbers', () => {
    rejects((d) => (d.checkpointCadenceDays = 0));
    rejects((d) => (d.checkpointCadenceDays = 400));
    rejects((d) => (d.checkpointCadenceDays = 7.5));
    rejects((d) => (d.roleLearningScaleBp = 10001));
    rejects((d) => (d.conditioningScaleBp = -1));
    rejects((d) => (d.medicalRecoveryScaleBp = '1500'));
    rejects((d) => (d.maxPlayerLoadUnitsPerCheckpoint = 0));
  });

  it('rejects malformed opportunity pools', () => {
    rejects((d) => (d.opportunityPools = []));
    rejects((d) => {
      const pools = d.opportunityPools as Record<string, unknown>[];
      pools[0]!.resourceKey = 'free_xp';
    });
    rejects((d) => {
      const pools = d.opportunityPools as Record<string, unknown>[];
      pools.push(clone(pools[0]!));
    });
    rejects((d) => {
      const pools = d.opportunityPools as Record<string, unknown>[];
      pools[0]!.capacityUnits = 0;
    });
    rejects((d) => {
      const pools = d.opportunityPools as Record<string, unknown>[];
      pools[0]!.extra = 1;
    });
  });

  it('rejects malformed or overlapping capability families', () => {
    rejects((d) => (d.capabilityFamilies = []));
    rejects((d) => {
      const f = d.capabilityFamilies as Record<string, unknown>[];
      f[0]!.capabilityKeys = [];
    });
    rejects((d) => {
      const f = d.capabilityFamilies as Record<string, unknown>[];
      f[1]!.capabilityKeys = [...(f[1]!.capabilityKeys as string[]), 'burst'];
    });
    rejects((d) => {
      const f = d.capabilityFamilies as Record<string, unknown>[];
      f[1]!.familyKey = f[0]!.familyKey;
    });
    rejects((d) => {
      const f = d.capabilityFamilies as Record<string, unknown>[];
      f[0]!.declineOnsetAgeDays = f[0]!.maturationMidpointAgeDays;
    });
  });

  it('rejects summary-rating, ceiling, tier, XP and multiplier names', () => {
    for (const bad of [
      'overall',
      'ovr',
      'potential',
      'ceiling',
      'xp',
      'developmentTier',
      'coachMultiplier',
      'finalRating',
    ]) {
      rejects((d) => {
        const f = d.capabilityFamilies as Record<string, unknown>[];
        f[0]!.familyKey = bad;
      });
      rejects((d) => {
        const f = d.capabilityFamilies as Record<string, unknown>[];
        f[0]!.capabilityKeys = [bad];
      });
      rejects((d) => {
        const pools = d.opportunityPools as Record<string, unknown>[];
        pools[0]!.scopeKey = bad;
      });
    }
    expect(looksLikeSummaryRating('expertise')).toBe(false);
    expect(looksLikeSummaryRating('XP')).toBe(true);
  });

  it('is rejected inside a ruleset body with a bad development block', () => {
    const body = bodyOf(clone(SYNTHETIC_PACKAGE_D_RULESET) as never);
    const bad = clone(body) as never as {
      rules: { development: Record<string, unknown> };
    };
    bad.rules.development.modelVersion = 99;
    expect(() => sealRuleset(bad as never)).toThrow(ManifestFormatError);
  });
});
