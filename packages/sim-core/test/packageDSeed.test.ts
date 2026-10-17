import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DOMAIN_STATE_KEYS,
  ManifestFormatError,
  PACKAGE_C_SEED,
  PACKAGE_D_SEED,
  PACKAGE_D_SEED_JSON,
  SYNTHETIC_PACKAGE_C_RULESET,
  SYNTHETIC_PACKAGE_D_RULESET,
  canonicalString,
  createWorld,
  parsePackageDSubstrate,
  rulesetRefOf,
  sealRuleset,
  sealSeed,
  validateForWorldCreation,
  validateSeedManifest,
  worldId,
  worldModelProblems,
  type PackageDSubstrateSeed,
  type WorldSeedBody,
  type WorldSeedManifest,
} from '../src/index';

const root = join(__dirname, '..', '..', '..');
const fixtureJson = (): Record<string, unknown> =>
  JSON.parse(
    readFileSync(
      join(root, 'fixtures', 'seeds', 'synthetic-package-d-world-v1.json'),
      'utf8',
    ),
  ) as Record<string, unknown>;
const ids = { newWorldId: () => worldId('world-package-d-test') };
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

type Sub = PackageDSubstrateSeed;
type Edit = (s: {
  playerProfiles: Record<string, unknown>[];
  teachingProfiles: Record<string, unknown>[];
  roleKnowledge: Record<string, unknown>[];
  readiness: Record<string, unknown>[];
  medicalEpisodes?: Record<string, unknown>[];
}) => void;

/** A freshly sealed seed from the D fixture body with the Package D block edited. */
const reseal = (edit: Edit): WorldSeedManifest => {
  const { contentHash: _hash, ...body } = PACKAGE_D_SEED;
  void _hash;
  const sub = clone(
    PACKAGE_D_SEED.packageDSubstrate!,
  ) as never as Parameters<Edit>[0];
  edit(sub);
  return sealSeed({
    ...body,
    packageDSubstrate: sub as unknown as Sub,
  } as WorldSeedBody);
};

const codes = (seed: unknown): string[] => {
  const v = validateForWorldCreation(seed, SYNTHETIC_PACKAGE_D_RULESET);
  return v.ok ? [] : v.issues.map((i) => i.code);
};

describe('older seeds are unaffected by the optional Package D block', () => {
  it('keeps the Package C seed hash and yields empty Package D state', () => {
    expect(PACKAGE_C_SEED.contentHash).toBe(
      '5411c810e442eafdc886698d4840600ea367a124041680e06668d8c17ede1b4a',
    );
    expect('packageDSubstrate' in PACKAGE_C_SEED).toBe(false);
    const w = createWorld(PACKAGE_C_SEED, SYNTHETIC_PACKAGE_C_RULESET, ids);
    for (const d of ['development', 'medical'] as const)
      for (const c of DOMAIN_STATE_KEYS[d])
        expect(
          (w as unknown as Record<string, Record<string, unknown>>)[d]![c],
        ).toEqual([]);
  });
});

describe('the Package D synthetic world seed', () => {
  it('embeds the frozen fixture exactly', () => {
    expect(canonicalString(PACKAGE_D_SEED_JSON)).toBe(
      canonicalString(fixtureJson()),
    );
    expect(PACKAGE_D_SEED.contentHash).toBe(
      validateSeedManifest(fixtureJson()).contentHash,
    );
    expect(PACKAGE_D_SEED.contentHash).toBe(
      'bc1e02d894a0079273d81d382075db6ada93801976d0ed735f0933bfb22dcfd5',
    );
  });

  it('is accepted for world creation with the synthetic Package D ruleset only', () => {
    expect(
      validateForWorldCreation(PACKAGE_D_SEED, SYNTHETIC_PACKAGE_D_RULESET),
    ).toEqual({ ok: true });
    const wrong = validateForWorldCreation(
      PACKAGE_D_SEED,
      SYNTHETIC_PACKAGE_C_RULESET,
    );
    expect(wrong.ok).toBe(false);
    const wrongCodes = wrong.ok ? [] : wrong.issues.map((i) => i.code);
    expect(wrongCodes).toContain('SEED_RULESET_MISMATCH');
    expect(wrongCodes).toContain('SEED_D_MISSING_DEVELOPMENT_RULES');
  });

  it('declares its synthetic provenance and makes no empirical claim', () => {
    for (const entry of PACKAGE_D_SEED.provenance) {
      expect(entry.sourceKind).toBe('synthetic');
      expect((entry.note ?? '').toLowerCase()).toContain('not validated');
    }
  });

  it('builds a world whose D state mirrors the substrate and stays model-valid', () => {
    const w = createWorld(PACKAGE_D_SEED, SYNTHETIC_PACKAGE_D_RULESET, ids);
    expect(worldModelProblems(w)).toEqual([]);
    const players = w.roster.players;
    expect(w.development.playerProfiles.length).toBe(players.length);
    expect(w.development.readiness.length).toBe(players.length);
    const profileIds = w.development.playerProfiles.map((p) => p.personId);
    expect([...profileIds].sort()).toEqual(profileIds);
    for (const p of w.development.playerProfiles) {
      const player = players.find((x) => x.personId === p.personId)!;
      expect(p.capabilityResponses.map((r) => r.capabilityKey).sort()).toEqual(
        player.capabilities.map((c) => c.key).sort(),
      );
    }
    expect(w.development.opportunityWindows).toEqual([]);
    expect(w.development.events).toEqual([]);
    expect(w.medical.episodes).toEqual([]);
    for (const r of w.development.readiness)
      expect(r.updatedAt).toBe(w.simDate);
    expect(Object.isFrozen(w.development)).toBe(true);
  });

  it('keeps one capability ledger: the roster is exactly the Package C roster', () => {
    const c = createWorld(PACKAGE_C_SEED, SYNTHETIC_PACKAGE_C_RULESET, ids);
    const d = createWorld(PACKAGE_D_SEED, SYNTHETIC_PACKAGE_D_RULESET, ids);
    expect(canonicalString(d.roster)).toBe(canonicalString(c.roster));
    const text = canonicalString(d.development);
    expect(text).not.toContain('valueBp');
    expect(text).not.toContain('"capabilities"');
  });

  it('is deterministic', () => {
    const a = createWorld(PACKAGE_D_SEED, SYNTHETIC_PACKAGE_D_RULESET, ids);
    const b = createWorld(PACKAGE_D_SEED, SYNTHETIC_PACKAGE_D_RULESET, ids);
    expect(canonicalString(a)).toBe(canonicalString(b));
  });
});

describe('Package D seed boundary (fail closed)', () => {
  it('rejects profiles for unknown players or non-players', () => {
    expect(
      codes(
        reseal((s) => {
          s.playerProfiles[0]!.personId = 'player-ghost';
        }),
      ),
    ).toContain('SEED_D_UNKNOWN_PLAYER');
    expect(
      codes(
        reseal((s) => {
          s.playerProfiles[0]!.personId = 'person-nf-gm';
        }),
      ),
    ).toContain('SEED_D_UNKNOWN_PLAYER');
    expect(
      codes(
        reseal((s) => {
          s.readiness[0]!.playerId = 'org-northfield';
        }),
      ),
    ).toContain('SEED_D_UNKNOWN_PLAYER');
    expect(
      codes(
        reseal((s) => {
          s.roleKnowledge[0]!.playerId = 'player-ghost';
        }),
      ),
    ).toContain('SEED_D_UNKNOWN_PLAYER');
  });

  it('rejects capability responses the player does not have', () => {
    expect(
      codes(
        reseal((s) => {
          const r = s.playerProfiles[0]!.capabilityResponses as Record<
            string,
            unknown
          >[];
          r[0]!.capabilityKey = 'pass_rush_not_on_this_player';
        }),
      ),
    ).toContain('SEED_D_UNKNOWN_CAPABILITY_RESPONSE');
  });

  it('rejects a response on a capability no ruleset family covers', () => {
    const { contentHash: _r, ...ruleBody } = SYNTHETIC_PACKAGE_D_RULESET;
    void _r;
    const dev = ruleBody.rules.development!;
    const sealed = sealRuleset({
      ...ruleBody,
      rules: {
        ...ruleBody.rules,
        development: {
          ...dev,
          capabilityFamilies: dev.capabilityFamilies.map((f, i) =>
            i === 0 ? { ...f, capabilityKeys: ['agility'] } : f,
          ),
        },
      },
    });
    const { contentHash: _s, ...seedBody } = PACKAGE_D_SEED;
    void _s;
    const seed = sealSeed({ ...seedBody, ruleset: rulesetRefOf(sealed) });
    const v = validateForWorldCreation(seed, sealed);
    expect(v.ok).toBe(false);
    const c = v.ok ? [] : v.issues.map((i) => i.code);
    expect(c).toContain('SEED_D_CAPABILITY_WITHOUT_FAMILY');
  });

  it('rejects duplicate profile, teaching, role-knowledge and readiness records', () => {
    expect(
      codes(
        reseal((s) => {
          s.playerProfiles.push(clone(s.playerProfiles[0]!));
        }),
      ),
    ).toContain('SEED_D_DUPLICATE_PROFILE');
    expect(
      codes(
        reseal((s) => {
          s.roleKnowledge.push(clone(s.roleKnowledge[0]!));
        }),
      ),
    ).toContain('SEED_D_DUPLICATE_ROLE_KNOWLEDGE');
    expect(
      codes(
        reseal((s) => {
          s.readiness.push(clone(s.readiness[0]!));
        }),
      ),
    ).toContain('SEED_D_DUPLICATE_READINESS');
    expect(
      codes(
        reseal((s) => {
          const t = {
            personId: 'person-nf-gm',
            bandwidthUnits: 10,
            expertise: [{ responsibilityKey: 'run_reads', teachingBp: 5000 }],
          };
          s.teachingProfiles.push(t, clone(t));
        }),
      ),
    ).toContain('SEED_D_DUPLICATE_TEACHING_PROFILE');
  });

  it('rejects duplicate responsibility keys and duplicate capability keys structurally', () => {
    expect(() =>
      reseal((s) => {
        s.teachingProfiles.push({
          personId: 'person-nf-gm',
          bandwidthUnits: 10,
          expertise: [
            { responsibilityKey: 'run_reads', teachingBp: 5000 },
            { responsibilityKey: 'run_reads', teachingBp: 6000 },
          ],
        });
      }),
    ).toThrow(ManifestFormatError);
    expect(() =>
      reseal((s) => {
        const r = s.playerProfiles[0]!.capabilityResponses as Record<
          string,
          unknown
        >[];
        r.push(clone(r[0]!));
      }),
    ).toThrow(ManifestFormatError);
  });

  it('rejects out-of-range or non-integer basis points', () => {
    for (const [field, value] of [
      ['processingBp', 10001],
      ['adaptabilityBp', -1],
      ['recoveryBp', 5000.5],
      ['durabilityBp', '5000'],
    ] as const)
      expect(() =>
        reseal((s) => {
          s.playerProfiles[0]![field] = value;
        }),
      ).toThrow(ManifestFormatError);
    expect(() =>
      reseal((s) => {
        const r = s.playerProfiles[0]!.capabilityResponses as Record<
          string,
          unknown
        >[];
        r[0]!.malleabilityBp = 10001;
      }),
    ).toThrow(ManifestFormatError);
    expect(() =>
      reseal((s) => {
        s.readiness[0]!.conditioningBp = 20000;
      }),
    ).toThrow(ManifestFormatError);
    expect(() =>
      reseal((s) => {
        s.roleKnowledge[0]!.familiarityBp = -5;
      }),
    ).toThrow(ManifestFormatError);
  });

  it('rejects hidden-destiny, rating, tier, XP and multiplier fields anywhere in the block', () => {
    for (const field of [
      'overall',
      'ovr',
      'potential',
      'ceiling',
      'finalRating',
      'developmentTier',
      'xp',
      'coachMultiplier',
      'destination',
    ]) {
      expect(() =>
        reseal((s) => {
          s.playerProfiles[0]![field] = 7000;
        }),
      ).toThrow(/forbidden/);
      expect(() =>
        reseal((s) => {
          s.teachingProfiles.push({
            personId: 'person-nf-gm',
            bandwidthUnits: 5,
            expertise: [],
            [field]: 7000,
          });
        }),
      ).toThrow(/forbidden/);
      expect(() =>
        reseal((s) => {
          s.readiness[0]![field] = 1;
        }),
      ).toThrow(/forbidden/);
      expect(() =>
        reseal((s) => {
          (s as Record<string, unknown>)[field] = [];
        }),
      ).toThrow(/forbidden/);
    }
  });

  it('rejects a capability key or scheme that looks like a summary rating', () => {
    expect(() =>
      reseal((s) => {
        const r = s.playerProfiles[0]!.capabilityResponses as Record<
          string,
          unknown
        >[];
        r[0]!.capabilityKey = 'overall';
      }),
    ).toThrow(ManifestFormatError);
    expect(() =>
      reseal((s) => {
        s.roleKnowledge[0]!.schemeKey = 'developmentTier';
      }),
    ).toThrow(ManifestFormatError);
  });

  it('rejects teaching profiles for unknown entities and for organizations', () => {
    expect(
      codes(
        reseal((s) => {
          s.teachingProfiles.push({
            personId: 'person-nobody',
            bandwidthUnits: 10,
            expertise: [],
          });
        }),
      ),
    ).toContain('SEED_D_UNKNOWN_ENTITY');
    expect(
      codes(
        reseal((s) => {
          s.teachingProfiles.push({
            personId: 'org-northfield',
            bandwidthUnits: 10,
            expertise: [],
          });
        }),
      ),
    ).toContain('SEED_D_WRONG_ENTITY_KIND');
  });

  it('requires finite positive teaching bandwidth, with no universal coach score field', () => {
    expect(() =>
      reseal((s) => {
        s.teachingProfiles.push({
          personId: 'person-nf-gm',
          bandwidthUnits: 0,
          expertise: [],
        });
      }),
    ).toThrow(ManifestFormatError);
    expect(() =>
      reseal((s) => {
        s.teachingProfiles.push({
          personId: 'person-nf-gm',
          bandwidthUnits: 5,
          expertise: [],
          teachingScore: 9000,
        });
      }),
    ).toThrow(ManifestFormatError);
  });

  it('accepts a valid teaching profile and seeds it in canonical order', () => {
    const seed = reseal((s) => {
      s.teachingProfiles.push(
        {
          personId: 'person-sp-gm',
          bandwidthUnits: 20,
          expertise: [
            { responsibilityKey: 'run_reads', teachingBp: 7000 },
            { responsibilityKey: 'coverage_rules', teachingBp: 3000 },
          ],
        },
        {
          personId: 'person-nf-gm',
          bandwidthUnits: 10,
          expertise: [{ responsibilityKey: 'route_tree', teachingBp: 6000 }],
        },
      );
    });
    expect(codes(seed)).toEqual([]);
    const w = createWorld(seed, SYNTHETIC_PACKAGE_D_RULESET, ids);
    expect(w.development.teachingProfiles.map((t) => t.personId)).toEqual([
      'person-nf-gm',
      'person-sp-gm',
    ]);
    expect(
      w.development.teachingProfiles[1]!.expertise.map(
        (e) => e.responsibilityKey,
      ),
    ).toEqual(['coverage_rules', 'run_reads']);
  });

  it('seeds synthetic-test medical episodes only, rejecting reserved ids', () => {
    const episode = {
      id: 'episode-test-knee',
      playerId: 'player-sp-02',
      conditionKey: 'knee_sprain',
      onsetAt: '2027-02-10',
      affectedActionKeys: ['cut', 'plant'],
      initialStructuralSeverityBp: 6000,
      recoveryResponsivenessBp: 5000,
      baselineReinjuryRiskBp: 2500,
    };
    const ok = reseal((s) => {
      s.medicalEpisodes = [episode];
    });
    expect(codes(ok)).toEqual([]);
    const w = createWorld(ok, SYNTHETIC_PACKAGE_D_RULESET, ids);
    expect(w.medical.episodes).toHaveLength(1);
    expect(w.medical.episodes[0]!.sourceKind).toBe('synthetic_test');
    expect(w.medical.episodes[0]!.status).toBe('open');
    expect(w.medical.progress).toEqual([]);
    expect(
      codes(
        reseal((s) => {
          s.medicalEpisodes = [{ ...episode, id: 'rec-000001' }];
        }),
      ),
    ).toContain('SEED_D_RESERVED_RECORD_ID');
    expect(
      codes(
        reseal((s) => {
          s.medicalEpisodes = [episode, clone(episode)];
        }),
      ),
    ).toContain('SEED_D_DUPLICATE_MEDICAL_EPISODE');
    expect(
      codes(
        reseal((s) => {
          s.medicalEpisodes = [{ ...episode, playerId: 'player-ghost' }];
        }),
      ),
    ).toContain('SEED_D_UNKNOWN_PLAYER');
  });

  it('parses and re-parses the substrate to the same value', () => {
    const sub = PACKAGE_D_SEED.packageDSubstrate!;
    expect(parsePackageDSubstrate(clone(sub))).toEqual(sub);
  });

  it('a Package D block with no Package C players has no valid references', () => {
    const { contentHash: _h, ...body } = PACKAGE_D_SEED;
    void _h;
    const { packageCSubstrate: _c, ...noC } = body as never as Record<
      string,
      unknown
    >;
    void _c;
    const seed = sealSeed(noC as never as WorldSeedBody);
    expect(codes(seed)).toContain('SEED_D_UNKNOWN_PLAYER');
  });
});
