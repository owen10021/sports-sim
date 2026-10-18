import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ManifestFormatError,
  PACKAGE_D_SEED,
  PACKAGE_E_SEED,
  PACKAGE_E_SEED_JSON,
  SYNTHETIC_PACKAGE_D_RULESET,
  SYNTHETIC_PACKAGE_E_RULESET,
  canonicalString,
  createWorld,
  emptyFootballState,
  parsePackageESubstrate,
  rulesetRefOf,
  sealSeed,
  validateForWorldCreation,
  validateSeedManifest,
  worldId,
  worldModelProblems,
  type PackageESubstrateSeed,
  type WorldSeedBody,
  type WorldSeedManifest,
} from '../src/index';

const root = join(__dirname, '..', '..', '..');
const fixtureJson = (): Record<string, unknown> =>
  JSON.parse(
    readFileSync(
      join(root, 'fixtures', 'seeds', 'synthetic-package-e-world-v1.json'),
      'utf8',
    ),
  ) as Record<string, unknown>;
const ids = { newWorldId: () => worldId('world-package-e-test') };
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

type Body = Record<string, unknown> & {
  initialEntities: Record<string, unknown>[];
  packageCSubstrate: {
    players: { personId: string; capabilities: { key: string }[] }[];
  };
  packageDSubstrate: { roleKnowledge: Record<string, unknown>[] };
  packageESubstrate: { fixtures: Record<string, unknown>[] };
};

/** A freshly sealed seed from the E fixture body with arbitrary parts edited. */
const reseal = (edit: (b: Body) => void): WorldSeedManifest => {
  const { contentHash: _hash, ...rest } = PACKAGE_E_SEED;
  void _hash;
  const body = clone(rest) as unknown as Body;
  edit(body);
  return sealSeed(body as unknown as WorldSeedBody);
};

const codes = (
  seed: unknown,
  ruleset: unknown = SYNTHETIC_PACKAGE_E_RULESET,
): string[] => {
  const v = validateForWorldCreation(seed, ruleset);
  return v.ok ? [] : v.issues.map((i) => i.code);
};

describe('the Package E synthetic world seed', () => {
  it('embeds the frozen fixture exactly and pins its content hash', () => {
    expect(canonicalString(PACKAGE_E_SEED_JSON)).toBe(
      canonicalString(fixtureJson()),
    );
    expect(PACKAGE_E_SEED.contentHash).toBe(
      validateSeedManifest(fixtureJson()).contentHash,
    );
    expect(PACKAGE_E_SEED.contentHash).toBe(
      'e7b44631f51a3439311df97ebc9bd2e6dd4b8b08d16f841d52f212ac88e3b891',
    );
  });

  it('is accepted for world creation with the synthetic Package E ruleset only', () => {
    expect(
      validateForWorldCreation(PACKAGE_E_SEED, SYNTHETIC_PACKAGE_E_RULESET),
    ).toEqual({ ok: true });
    const wrong = validateForWorldCreation(
      PACKAGE_E_SEED,
      SYNTHETIC_PACKAGE_D_RULESET,
    );
    expect(wrong.ok).toBe(false);
    if (!wrong.ok)
      expect(wrong.issues.map((i) => i.code)).toContain(
        'SEED_RULESET_MISMATCH',
      );
  });

  it('is labelled synthetic', () => {
    for (const entry of PACKAGE_E_SEED.provenance) {
      expect(entry.sourceKind).toBe('synthetic');
      expect(entry.validationStatus).toBe('synthetic');
      expect((entry.note ?? '').toLowerCase()).toContain('not validated nfl');
    }
  });

  it('seeds fixtures only: no designations, plans, games, plays or causal links', () => {
    const w = createWorld(PACKAGE_E_SEED, SYNTHETIC_PACKAGE_E_RULESET, ids);
    expect(w.football.fixtures).toHaveLength(2);
    expect(w.football.fixtures[0]).toEqual({
      id: 'fixture-2027-w01-southport-at-northfield',
      fixtureDate: '2027-09-12',
      homeOrganizationId: 'org-northfield',
      awayOrganizationId: 'org-southport',
      rulesProfileKey: 'synthetic_football_v1',
      status: 'scheduled',
      finalGameId: null,
    });
    expect(w.football.designations).toEqual([]);
    expect(w.football.gamePlans).toEqual([]);
    expect(w.football.games).toEqual([]);
    expect(w.football.plays).toEqual([]);
    expect(w.football.causalLinks).toEqual([]);
    expect(worldModelProblems(w)).toEqual([]);
  });

  it('leaves older seeds with empty football state and unchanged hashes', () => {
    expect(PACKAGE_D_SEED.packageESubstrate).toBeUndefined();
    expect(PACKAGE_D_SEED.contentHash).toBe(
      'bc1e02d894a0079273d81d382075db6ada93801976d0ed735f0933bfb22dcfd5',
    );
    const w = createWorld(PACKAGE_D_SEED, SYNTHETIC_PACKAGE_D_RULESET, ids);
    expect(w.football).toEqual(emptyFootballState());
  });

  it('is deterministic across world creations', () => {
    const a = createWorld(PACKAGE_E_SEED, SYNTHETIC_PACKAGE_E_RULESET, ids);
    const b = createWorld(PACKAGE_E_SEED, SYNTHETIC_PACKAGE_E_RULESET, ids);
    expect(canonicalString(a)).toBe(canonicalString(b));
  });
});

describe('the synthetic ecology can field complete 11-on-11 units', () => {
  const rules = SYNTHETIC_PACKAGE_E_RULESET.rules.football!;
  const players = PACKAGE_E_SEED.packageCSubstrate!.players;
  const memberships = PACKAGE_E_SEED.packageCSubstrate!.memberships;

  /** Greedy distinct-player assignment, most constrained slots first. */
  const canFill = (
    clubId: string,
    slots: readonly { slotKey: string; eligibleRoles: readonly string[] }[],
  ): boolean => {
    const pool = memberships
      .filter((m) => m.organizationId === clubId && m.status === 'active')
      .map((m) => players.find((p) => p.personId === m.playerId)!)
      .map((p) => ({ id: p.personId, role: p.primaryRole }));
    const used = new Set<string>();
    const ordered = [...slots].sort(
      (a, b) => a.eligibleRoles.length - b.eligibleRoles.length,
    );
    for (const slot of ordered) {
      const pick = pool.find(
        (p) => !used.has(p.id) && slot.eligibleRoles.includes(p.role),
      );
      if (pick === undefined) return false;
      used.add(pick.id);
    }
    return true;
  };

  it('has every formation fillable by both fixture clubs', () => {
    for (const club of ['org-northfield', 'org-southport'])
      for (const formation of rules.formations)
        expect(
          canFill(club, formation.slots),
          `${club} cannot field ${formation.formationKey}`,
        ).toBe(true);
  });

  it('keeps each fixture club within the enlarged active roster limit', () => {
    const limit =
      SYNTHETIC_PACKAGE_E_RULESET.rules.transactions!.seasonRules.find(
        (s) => s.season === 2027,
      )!.activeRosterLimit;
    for (const club of ['org-northfield', 'org-southport'])
      expect(
        memberships.filter(
          (m) => m.organizationId === club && m.status === 'active',
        ).length,
      ).toBeLessThanOrEqual(limit);
  });

  it('gives every action capability key to at least one seeded player', () => {
    const have = new Set(
      players.flatMap((p) => p.capabilities.map((c) => c.key)),
    );
    for (const action of rules.actions)
      for (const b of action.capabilityBindings)
        expect(have.has(b.capabilityKey)).toBe(true);
  });

  it('carries no summary rating, ceiling or destiny field anywhere in the new players', () => {
    const text = canonicalString(PACKAGE_E_SEED).toLowerCase();
    for (const banned of [
      '"overall',
      '"ovr',
      '"potential',
      '"ceiling',
      '"tier',
    ])
      expect(text).not.toContain(banned);
  });
});

describe('Package E seed validation fails closed', () => {
  it('rejects unsupported fields and malformed fixture blocks', () => {
    expect(() => parsePackageESubstrate({ fixtures: [], games: [] })).toThrow(
      ManifestFormatError,
    );
    expect(() => parsePackageESubstrate({})).toThrow(ManifestFormatError);
    expect(() => parsePackageESubstrate({ fixtures: {} })).toThrow(
      ManifestFormatError,
    );
    const fixture = (PACKAGE_E_SEED.packageESubstrate as PackageESubstrateSeed)
      .fixtures[0]!;
    expect(() =>
      parsePackageESubstrate({ fixtures: [{ ...fixture, outcome: 'win' }] }),
    ).toThrow(ManifestFormatError);
    expect(() =>
      parsePackageESubstrate({
        fixtures: [{ ...fixture, fixtureDate: '2027-02-30' }],
      }),
    ).toThrow(ManifestFormatError);
  });

  it('rejects fixtures with unknown, wrong-kind or identical organizations', () => {
    expect(
      codes(
        reseal((b) => {
          b.packageESubstrate.fixtures[0]!.homeOrganizationId = 'org-nowhere';
        }),
      ),
    ).toContain('SEED_E_UNKNOWN_ENTITY');
    expect(
      codes(
        reseal((b) => {
          b.packageESubstrate.fixtures[0]!.awayOrganizationId = 'player-nf-e01';
        }),
      ),
    ).toContain('SEED_E_WRONG_ENTITY_KIND');
    expect(
      codes(
        reseal((b) => {
          b.packageESubstrate.fixtures[0]!.awayOrganizationId =
            'org-northfield';
        }),
      ),
    ).toContain('SEED_E_SAME_ORGANIZATION');
  });

  it('rejects duplicate, reserved-shape, early-dated and wrong-profile fixtures', () => {
    expect(
      codes(
        reseal((b) => {
          b.packageESubstrate.fixtures[1]!.id = b.packageESubstrate.fixtures[0]!
            .id as string;
        }),
      ),
    ).toContain('SEED_E_DUPLICATE_FIXTURE');
    expect(
      codes(
        reseal((b) => {
          b.packageESubstrate.fixtures[0]!.id = 'rec-000001';
        }),
      ),
    ).toContain('SEED_E_RESERVED_RECORD_ID');
    expect(
      codes(
        reseal((b) => {
          b.packageESubstrate.fixtures[0]!.fixtureDate = '2027-01-01';
        }),
      ),
    ).toContain('SEED_E_FIXTURE_BEFORE_START');
    expect(
      codes(
        reseal((b) => {
          b.packageESubstrate.fixtures[0]!.rulesProfileKey = 'other_profile';
        }),
      ),
    ).toContain('SEED_E_UNKNOWN_RULES_PROFILE');
  });

  it('rejects a Package E block under a ruleset with no football rules', () => {
    const seed = reseal((b) => {
      b.ruleset = rulesetRefOf(SYNTHETIC_PACKAGE_D_RULESET) as never;
    });
    expect(codes(seed, SYNTHETIC_PACKAGE_D_RULESET)).toContain(
      'SEED_E_MISSING_FOOTBALL_RULES',
    );
  });

  it('rejects action bindings that no seeded player capability supports', () => {
    const seed = reseal((b) => {
      for (const p of b.packageCSubstrate.players)
        p.capabilities = p.capabilities.filter((c) => c.key !== 'vision');
      const d = b.packageDSubstrate as unknown as {
        playerProfiles: { capabilityResponses: { capabilityKey: string }[] }[];
      };
      for (const prof of d.playerProfiles)
        prof.capabilityResponses = prof.capabilityResponses.filter(
          (r) => r.capabilityKey !== 'vision',
        );
    });
    expect(codes(seed)).toContain('SEED_E_ACTION_UNKNOWN_CAPABILITY');
  });

  it('rejects role knowledge that does not resolve through the football rules', () => {
    expect(
      codes(
        reseal((b) => {
          b.packageDSubstrate.roleKnowledge[0]!.schemeKey = 'invented_scheme';
        }),
      ),
    ).toContain('SEED_E_ROLE_UNKNOWN_SCHEME');
    expect(
      codes(
        reseal((b) => {
          b.packageDSubstrate.roleKnowledge[0]!.responsibilityKey =
            'invented_duty';
        }),
      ),
    ).toContain('SEED_E_ROLE_UNKNOWN_RESPONSIBILITY');
    expect(
      codes(
        reseal((b) => {
          b.packageDSubstrate.roleKnowledge[0]!.transferFamilyKey =
            'wrong_family';
        }),
      ),
    ).toContain('SEED_E_ROLE_TRANSFER_FAMILY_MISMATCH');
  });
});
