import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ManifestFormatError,
  ORG_SUBSTRATE_SEED,
  PACKAGE_C_SEED,
  PACKAGE_C_SEED_JSON,
  SYNTHETIC_PACKAGE_C_RULESET,
  SYNTHETIC_RULESET,
  SYNTHETIC_SEED,
  canonicalString,
  createWorld,
  fingerprintWorld,
  sealSeed,
  validateForWorldCreation,
  validateSeedManifest,
  worldId,
  worldModelProblems,
  type PackageCSubstrateSeed,
  type WorldSeedBody,
  type WorldSeedManifest,
} from '../src/index';

const fixturePath = join(
  __dirname,
  '..',
  '..',
  '..',
  'fixtures',
  'seeds',
  'synthetic-package-c-world-v1.json',
);
const fixtureJson = (): Record<string, unknown> =>
  JSON.parse(readFileSync(fixturePath, 'utf8')) as Record<string, unknown>;
const fixtureSeed = (): WorldSeedManifest =>
  validateSeedManifest(fixtureJson());
const ids = { newWorldId: () => worldId('world-package-c-test') };

type Sub = PackageCSubstrateSeed;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** A fresh sealed seed from the fixture body with the Package C block edited. */
const reseal = (
  edit: (s: Sub) => Sub | void,
  entities?: WorldSeedBody['initialEntities'],
): WorldSeedManifest => {
  const base = fixtureSeed();
  const { contentHash: _hash, ...body } = base;
  void _hash;
  const sub = clone(base.packageCSubstrate!) as Sub;
  const edited = edit(sub) ?? sub;
  return sealSeed({
    ...body,
    ...(entities === undefined ? {} : { initialEntities: entities }),
    packageCSubstrate: edited,
  } as WorldSeedBody);
};

const codes = (seed: unknown): string[] => {
  const v = validateForWorldCreation(seed, SYNTHETIC_PACKAGE_C_RULESET);
  return v.ok ? [] : v.issues.map((i) => i.code);
};

const sub = (): Sub => fixtureSeed().packageCSubstrate!;

describe('older seeds are unaffected', () => {
  it('keeps the Package A and Package B seed hashes and yields empty Package C state', () => {
    expect(SYNTHETIC_SEED.contentHash).toBe(
      '95b75c540916552ad18c05fd50e158b218254ac909edf8a84d82e26ecc4bf98f',
    );
    expect(ORG_SUBSTRATE_SEED.contentHash).toBe(
      '6dd9a1e3df23be4aa7de5c352dd93c295fa38b5420ed4e14ae3e40766f821f56',
    );
    expect('packageCSubstrate' in SYNTHETIC_SEED).toBe(false);
    const w = createWorld(ORG_SUBSTRATE_SEED, SYNTHETIC_RULESET, ids);
    expect(w.roster.players).toEqual([]);
    expect(w.roster.waiverPriority).toEqual([]);
    expect(w.draft.picks).toEqual([]);
    expect(w.market.agentClients).toEqual([]);
  });
});

describe('the Package C synthetic world seed', () => {
  it('embeds the frozen fixture exactly', () => {
    expect(canonicalString(PACKAGE_C_SEED_JSON)).toBe(
      canonicalString(fixtureJson()),
    );
    expect(PACKAGE_C_SEED.contentHash).toBe(fixtureSeed().contentHash);
  });

  it('is accepted for world creation with the synthetic Package C ruleset', () => {
    expect(
      validateForWorldCreation(PACKAGE_C_SEED, SYNTHETIC_PACKAGE_C_RULESET),
    ).toEqual({ ok: true });
  });

  it('targets the Package C ruleset and nothing else', () => {
    expect(
      validateForWorldCreation(PACKAGE_C_SEED, SYNTHETIC_RULESET),
    ).toMatchObject({ ok: false });
    expect(codes(PACKAGE_C_SEED)).toEqual([]);
    const wrong = validateForWorldCreation(PACKAGE_C_SEED, SYNTHETIC_RULESET);
    expect(wrong.ok ? [] : wrong.issues.map((i) => i.code)).toContain(
      'SEED_RULESET_MISMATCH',
    );
  });

  it('a Package C block against a ruleset without transaction rules fails closed', () => {
    const base = fixtureSeed();
    const { contentHash: _h, ...body } = base;
    void _h;
    const pointedAtA = sealSeed({
      ...body,
      ruleset: {
        rulesetId: SYNTHETIC_RULESET.rulesetId,
        rulesetVersion: SYNTHETIC_RULESET.rulesetVersion,
        contentHash: SYNTHETIC_RULESET.contentHash,
      },
    } as WorldSeedBody);
    const v = validateForWorldCreation(pointedAtA, SYNTHETIC_RULESET);
    expect(v.ok ? [] : v.issues.map((i) => i.code)).toContain(
      'SEED_C_REQUIRES_TRANSACTION_RULES',
    );
  });

  it('has the four-organization shape the acquisition scenario needs', () => {
    const s = fixtureSeed();
    const orgs = s.initialEntities.filter((e) => e.kind === 'organization');
    expect(orgs).toHaveLength(4);
    const c = s.packageCSubstrate!;
    expect(c.waiverPriority).toHaveLength(4);
    expect(c.players.length).toBeGreaterThanOrEqual(24);
    expect(c.agentClients.length).toBeGreaterThanOrEqual(4);
    expect(c.evaluatorProfiles.length).toBeGreaterThanOrEqual(4);
    expect(c.draftClasses.length).toBeGreaterThanOrEqual(1);
    // veterans on rosters, unrestricted free agents with no organization right, prospects
    const rightsHolders = new Set(c.rights.map((r) => r.playerId));
    const drafted = new Set(c.draftClasses.flatMap((d) => d.eligiblePlayerIds));
    const freeAgents = c.players.filter(
      (p) => !rightsHolders.has(p.personId) && !drafted.has(p.personId),
    );
    expect(c.memberships.length).toBeGreaterThanOrEqual(12);
    expect(freeAgents.length).toBeGreaterThanOrEqual(4);
    expect(drafted.size).toBeGreaterThanOrEqual(8);
    // each organization holds both current-season and future picks
    for (const org of orgs) {
      const mine = c.draftPicks.filter((p) => p.ownerOrganizationId === org.id);
      expect(new Set(mine.map((p) => p.season)).size).toBeGreaterThanOrEqual(2);
      expect(mine.some((p) => p.slot !== null)).toBe(true);
      expect(mine.some((p) => p.slot === null)).toBe(true);
    }
    // statuses exercise every roster state
    const statuses = new Set(c.memberships.map((m) => m.status));
    expect([...statuses].sort()).toEqual([
      'active',
      'practice_squad',
      'reserve',
    ]);
  });
});

describe('createWorld populates Package C state from the seed', () => {
  const world = () =>
    createWorld(PACKAGE_C_SEED, SYNTHETIC_PACKAGE_C_RULESET, ids);

  it('copies seeded records in canonical order and leaves contracts/market/scouting dynamics empty', () => {
    const w = world();
    const c = sub();
    expect(worldModelProblems(w)).toEqual([]);
    expect(w.roster.players.map((p) => p.personId)).toEqual(
      c.players.map((p) => p.personId).sort(),
    );
    expect(w.roster.rights).toHaveLength(c.rights.length);
    expect(w.roster.memberships).toHaveLength(c.memberships.length);
    expect(w.roster.waiverPriority).toEqual(c.waiverPriority);
    expect(w.roster.waivers).toEqual([]);
    expect(w.roster.waiverClaims).toEqual([]);
    expect(w.market.agentClients).toHaveLength(c.agentClients.length);
    expect(w.market.playerPreferences).toHaveLength(c.playerPreferences.length);
    expect(w.market.inquiries).toEqual([]);
    expect(w.market.tradeOffers).toEqual([]);
    expect(w.market.contractOffers).toEqual([]);
    expect(w.market.reservations).toEqual([]);
    expect(w.market.responses).toEqual([]);
    expect(w.scouting.evaluatorProfiles).toHaveLength(
      c.evaluatorProfiles.length,
    );
    expect(w.scouting.questions).toEqual([]);
    expect(w.draft.classes).toHaveLength(c.draftClasses.length);
    expect(w.draft.picks).toHaveLength(c.draftPicks.length);
    expect(w.draft.boards).toEqual([]);
    expect(w.contracts.agreements).toHaveLength(c.contracts.length);
    expect(w.contracts.agreements.every((a) => a.status === 'active')).toBe(
      true,
    );
    expect(w.contracts.terminations).toEqual([]);
  });

  it('is deterministic, deeply frozen, and consumes no randomness', () => {
    const a = world();
    const b = world();
    expect(fingerprintWorld(a)).toBe(fingerprintWorld(b));
    expect(canonicalString(a)).toBe(canonicalString(b));
    expect(Object.isFrozen(a.roster.players[0])).toBe(true);
    expect(Object.isFrozen(a.roster.players[0]!.capabilities)).toBe(true);
    expect(a.rng.draws).toBe(0);
    expect(a.nextIds).toEqual({ event: 1, record: 1 });
  });

  it('players carry specific capability dimensions and no overall, potential or value field', () => {
    const w = world();
    for (const p of w.roster.players) {
      expect(Object.keys(p).sort()).toEqual([
        'birthDate',
        'capabilities',
        'personId',
        'primaryRole',
        'roleTags',
      ]);
      for (const cap of p.capabilities) {
        expect(Object.keys(cap).sort()).toEqual(['key', 'valueBp']);
        expect(Number.isInteger(cap.valueBp)).toBe(true);
        expect(cap.valueBp).toBeGreaterThanOrEqual(0);
        expect(cap.valueBp).toBeLessThanOrEqual(10000);
      }
    }
    const text = canonicalString(w.roster.players).toLowerCase();
    for (const banned of [
      'overall',
      'ovr',
      'potential',
      'ceiling',
      'tradevalue',
    ])
      expect(text).not.toContain(banned);
  });
});

describe('seed validation: structure (fail closed)', () => {
  const rejects = (edit: (s: Sub) => Sub | void) =>
    expect(() => reseal(edit)).toThrow(ManifestFormatError);

  it('rejects malformed capabilities', () => {
    for (const bad of [-1, 10001, 1.5, '5000', null])
      rejects((s) => {
        (
          s.players[0]!.capabilities as unknown as { valueBp: unknown }[]
        )[0]!.valueBp = bad;
      });
    rejects((s) => {
      const caps = s.players[0]!.capabilities as {
        key: string;
        valueBp: number;
      }[];
      caps.push({ ...caps[0]! });
    });
    rejects((s) => {
      (s.players[0]!.capabilities as unknown[]).push({
        key: 'x',
        valueBp: 1,
        extra: 1,
      });
    });
  });

  it('rejects overall/potential-like capability keys and extra player fields', () => {
    for (const key of [
      'overall',
      'ovr',
      'potential',
      'ceiling',
      'star_grade',
      'trade_value',
      'destination_rating',
    ])
      rejects((s) => {
        (s.players[0]!.capabilities as { key: string; valueBp: number }[]).push(
          {
            key,
            valueBp: 5000,
          },
        );
      });
    for (const field of [
      'overall',
      'potential',
      'ceiling',
      'tradeValue',
      'grade',
    ])
      rejects((s) => {
        (s.players[0] as unknown as Record<string, unknown>)[field] = 80;
      });
  });

  it('rejects unknown enums and malformed dates', () => {
    rejects((s) => {
      (s.rights[0] as { kind: string }).kind = 'lease';
    });
    rejects((s) => {
      (s.memberships[0] as { status: string }).status = 'bench';
    });
    rejects((s) => {
      (s.playerPreferences[0] as { security: string }).security = 'extreme';
    });
    rejects((s) => {
      (s.evaluatorProfiles[0] as { riskTolerance: string }).riskTolerance =
        'wild';
    });
    rejects((s) => {
      (s.players[0] as { birthDate: string }).birthDate = '1999-02-30';
    });
    rejects((s) => {
      const r = s.rights[0] as {
        effectiveFrom: string;
        effectiveUntil: string | null;
      };
      r.effectiveFrom = '2028-01-01';
      r.effectiveUntil = '2027-01-01';
    });
    rejects((s) => {
      (s.draftPicks[0] as { round: number }).round = 0;
    });
  });

  it('rejects missing and unexpected block fields', () => {
    rejects((s) => {
      delete (s as unknown as Record<string, unknown>).waiverPriority;
    });
    rejects((s) => {
      (s as unknown as Record<string, unknown>).surprise = [];
    });
  });
});

describe('seed validation: cross references (fail closed)', () => {
  const has = (
    edit: (s: Sub) => Sub | void,
    code: string,
    entities?: WorldSeedBody['initialEntities'],
  ) => expect(codes(reseal(edit, entities))).toContain(code);

  const someOrg = () =>
    fixtureSeed().initialEntities.find((e) => e.kind === 'organization')!.id;
  const somePerson = () =>
    fixtureSeed().initialEntities.find(
      (e) =>
        e.kind === 'person' && !sub().players.some((p) => p.personId === e.id),
    )!.id;

  it('rejects unknown and wrong-kind entity references', () => {
    has((s) => {
      (s.players[0] as { personId: string }).personId = 'person-ghost';
    }, 'SEED_C_UNKNOWN_ENTITY');
    has((s) => {
      (s.players[0] as { personId: string }).personId = someOrg();
    }, 'SEED_C_WRONG_ENTITY_KIND');
    has((s) => {
      (s.rights[0] as { holderOrganizationId: string }).holderOrganizationId =
        somePerson();
    }, 'SEED_C_WRONG_ENTITY_KIND');
    has((s) => {
      (s.draftPicks[0] as { ownerOrganizationId: string }).ownerOrganizationId =
        somePerson();
    }, 'SEED_C_WRONG_ENTITY_KIND');
    has((s) => {
      (s.memberships[0] as { organizationId: string }).organizationId =
        'org-ghost';
    }, 'SEED_C_UNKNOWN_ENTITY');
  });

  it('rejects duplicate players, rights, memberships, picks and classes', () => {
    has((s) => {
      (s.players as unknown[]).push(clone(s.players[0]));
    }, 'SEED_C_DUPLICATE_ID');
    has((s) => {
      (s.rights as unknown[]).push(clone(s.rights[0]));
    }, 'SEED_C_DUPLICATE_ID');
    has((s) => {
      (s.memberships as unknown[]).push(clone(s.memberships[0]));
    }, 'SEED_C_DUPLICATE_ID');
    has((s) => {
      (s.draftPicks as unknown[]).push(clone(s.draftPicks[0]));
    }, 'SEED_C_DUPLICATE_ID');
    has((s) => {
      (s.draftClasses as unknown[]).push(clone(s.draftClasses[0]));
    }, 'SEED_C_DUPLICATE_ID');
  });

  it('rejects a second pick for the same season, round and original organization', () => {
    has((s) => {
      const dup = clone(s.draftPicks[0]) as { id: string };
      dup.id = 'pick-duplicate-claim';
      (s.draftPicks as unknown[]).push(dup);
    }, 'SEED_C_DUPLICATE_PICK');
  });

  it('rejects two picks sharing a slot, used picks, and picks outside the ruleset', () => {
    has((s) => {
      const withSlot = s.draftPicks.filter((p) => p.slot !== null);
      const a = withSlot[0]!;
      const b = withSlot.find(
        (p) => p.id !== a.id && p.season === a.season && p.round === a.round,
      )!;
      (b as { slot: number | null }).slot = a.slot;
    }, 'SEED_C_DUPLICATE_PICK');
    has((s) => {
      (s.draftPicks[0] as { status: string }).status = 'used';
    }, 'SEED_C_USED_PICK');
    has((s) => {
      (s.draftPicks[0] as { round: number }).round = 99;
    }, 'SEED_C_PICK_OUT_OF_RULES');
    has((s) => {
      (s.draftPicks[0] as { season: number }).season = 1999;
    }, 'SEED_C_PICK_OUT_OF_RULES');
  });

  it('rejects contracts that disagree with rights, memberships, terms or the cap', () => {
    has((s) => {
      (s.contracts as unknown[]).push(clone(s.contracts[0]));
    }, 'SEED_C_DUPLICATE_ID');
    has((s) => {
      (s.contracts[0] as { playerId: string }).playerId = 'player-fa-01';
    }, 'SEED_C_RIGHT_WITHOUT_CONTRACT');
    has((s) => {
      (s.contracts as unknown[]).pop();
    }, 'SEED_C_RIGHT_WITHOUT_CONTRACT');
    has((s) => {
      (s.contracts as unknown[]).pop();
    }, 'SEED_C_MEMBERSHIP_WITHOUT_CONTRACT');
    has((s) => {
      (s.contracts[0]!.years[0] as { baseSalary: number }).baseSalary = 1;
    }, 'SEED_C_CONTRACT_TERMS');
    has((s) => {
      (s.contracts[0]!.years[0] as { guaranteedBase: number }).guaranteedBase =
        99_999_999;
    }, 'SEED_C_CONTRACT_TERMS');
    has((s) => {
      const extra = clone(s.contracts[0]) as { id: string };
      extra.id = 'contract-extra';
      (s.contracts as unknown[]).push(extra);
    }, 'SEED_C_DUPLICATE_CONTRACT');
    has((s) => {
      (s.contracts[0] as { signingBonus: number }).signingBonus = 3_000_000;
    }, 'SEED_C_CAP_EXCEEDED');
  });

  it('rejects overlapping rights for one player (duplicate ownership)', () => {
    has((s) => {
      const r = s.rights[0]!;
      const other = s.memberships.find(
        (m) => m.organizationId !== r.holderOrganizationId,
      )!;
      (s.rights as unknown[]).push({
        ...clone(r),
        id: 'right-second-owner',
        holderOrganizationId: other.organizationId,
      });
    }, 'SEED_C_RIGHTS_OVERLAP');
  });

  it('rejects memberships without a compatible right, and overlapping memberships', () => {
    has((s) => {
      const m = s.memberships[0]!;
      const otherOrg = s.waiverPriority.find((o) => o !== m.organizationId)!;
      (m as { organizationId: string }).organizationId = otherOrg;
    }, 'SEED_C_MEMBERSHIP_WITHOUT_RIGHT');
    has((s) => {
      const free = s.players.find(
        (p) => !s.rights.some((r) => r.playerId === p.personId),
      )!;
      (s.memberships as unknown[]).push({
        id: 'mem-no-right',
        playerId: free.personId,
        organizationId: s.waiverPriority[0],
        status: 'active',
        effectiveFrom: '2027-01-01',
        effectiveUntil: null,
        sourceRecordId: 'seed-no-right',
      });
    }, 'SEED_C_MEMBERSHIP_WITHOUT_RIGHT');
    has((s) => {
      const m = s.memberships[0]!;
      (s.memberships as unknown[]).push({ ...clone(m), id: 'mem-overlap' });
    }, 'SEED_C_MEMBERSHIP_OVERLAP');
  });

  it('rejects invalid agents and client links', () => {
    has((s) => {
      (s.agentClients[0] as { playerPersonId: string }).playerPersonId =
        somePerson();
    }, 'SEED_C_INVALID_AGENT');
    has((s) => {
      (s.agentClients[0] as { agentPersonId: string }).agentPersonId =
        s.players[0]!.personId;
    }, 'SEED_C_INVALID_AGENT');
    has((s) => {
      (s.agentClients[0] as { agentPersonId: string }).agentPersonId =
        'person-ghost';
    }, 'SEED_C_UNKNOWN_ENTITY');
  });

  it('rejects preferences, draft classes and evaluators that reference the wrong people', () => {
    has((s) => {
      (s.playerPreferences[0] as { playerPersonId: string }).playerPersonId =
        somePerson();
    }, 'SEED_C_UNKNOWN_PLAYER');
    has((s) => {
      (s.draftClasses[0]!.eligiblePlayerIds as string[]).push('person-ghost');
    }, 'SEED_C_UNKNOWN_PLAYER');
    has((s) => {
      (s.evaluatorProfiles[0] as { personId: string }).personId =
        s.players[0]!.personId;
    }, 'SEED_C_EVALUATOR_NOT_SCOUT');
  });

  it('rejects an incomplete, duplicate or foreign waiver priority', () => {
    has((s) => {
      (s.waiverPriority as string[]).pop();
    }, 'SEED_C_WAIVER_PRIORITY_INVALID');
    has((s) => {
      (s.waiverPriority as string[])[1] = s.waiverPriority[0]!;
    }, 'SEED_C_WAIVER_PRIORITY_INVALID');
    has((s) => {
      (s.waiverPriority as string[])[0] = 'org-ghost';
    }, 'SEED_C_WAIVER_PRIORITY_INVALID');
  });

  it('createWorld refuses a seed that fails these checks', () => {
    const bad = reseal((s) => {
      (s.waiverPriority as string[]).pop();
    });
    expect(() => createWorld(bad, SYNTHETIC_PACKAGE_C_RULESET, ids)).toThrow();
  });
});
