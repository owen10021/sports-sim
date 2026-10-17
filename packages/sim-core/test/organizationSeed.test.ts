import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ManifestFormatError,
  ManifestTamperError,
  SYNTHETIC_RULESET,
  SYNTHETIC_SEED,
  WorldCreationError,
  WorldKernel,
  canonicalString,
  createWorld,
  fingerprintWorld,
  rulesetRefOf,
  sealSeed,
  sealSnapshot,
  validateForWorldCreation,
  validateSeedManifest,
  verifySnapshot,
  worldId,
  type OrganizationSubstrateSeed,
  type WorldSeedBody,
  type WorldSeedManifest,
} from '../src/index';
import { harnessActor } from './helpers';

const fixturePath = join(
  __dirname,
  '..',
  '..',
  '..',
  'fixtures',
  'seeds',
  'synthetic-org-substrate-v1.json',
);
const fixtureJson = (): Record<string, unknown> =>
  JSON.parse(readFileSync(fixturePath, 'utf8')) as Record<string, unknown>;
const fixtureSeed = (): WorldSeedManifest =>
  validateSeedManifest(fixtureJson());
const ids = { newWorldId: () => worldId('world-org-1') };

/** A fresh sealed seed built from the fixture body with the substrate replaced/edited. */
const reseal = (
  edit: (s: OrganizationSubstrateSeed) => OrganizationSubstrateSeed,
  entities?: WorldSeedBody['initialEntities'],
): WorldSeedManifest => {
  const base = fixtureSeed();
  const { contentHash: _hash, ...body } = base;
  void _hash;
  return sealSeed({
    ...body,
    ...(entities === undefined ? {} : { initialEntities: entities }),
    organizationSubstrate: edit(
      JSON.parse(
        JSON.stringify(base.organizationSubstrate),
      ) as OrganizationSubstrateSeed,
    ),
  });
};

const codes = (seed: unknown): string[] => {
  const v = validateForWorldCreation(seed, SYNTHETIC_RULESET);
  return v.ok ? [] : v.issues.map((i) => i.code);
};

describe('Package A seeds stay valid and unchanged', () => {
  it('a seed without organizationSubstrate keeps its content hash and creates empty domain state', () => {
    expect(SYNTHETIC_SEED.contentHash).toBe(
      '95b75c540916552ad18c05fd50e158b218254ac909edf8a84d82e26ecc4bf98f',
    );
    expect('organizationSubstrate' in SYNTHETIC_SEED).toBe(false);
    const w = createWorld(SYNTHETIC_SEED, SYNTHETIC_RULESET, ids);
    expect(w.people).toEqual({ persons: [], roleEpisodes: [] });
    expect(w.organizations).toEqual({ organizations: [] });
    expect(w.authority.grants).toEqual([]);
  });
});

describe('synthetic organization substrate seed (fixture)', () => {
  it('is a valid sealed seed for the synthetic ruleset', () => {
    const seed = fixtureSeed();
    expect(validateForWorldCreation(seed, SYNTHETIC_RULESET)).toEqual({
      ok: true,
    });
    expect(seed.ruleset).toEqual(rulesetRefOf(SYNTHETIC_RULESET));
  });

  it('creates two organizations, each with owner, general manager and scout roles and explicit grants', () => {
    const w = createWorld(fixtureSeed(), SYNTHETIC_RULESET, ids);
    expect(w.organizations.organizations).toHaveLength(2);
    expect(w.organizations.organizations.every((o) => o.active)).toBe(true);
    expect(w.people.persons).toHaveLength(6);
    for (const org of w.organizations.organizations) {
      const roles = w.people.roleEpisodes
        .filter((r) => r.organizationId === org.entityId)
        .map((r) => r.role)
        .sort();
      expect(roles).toEqual(['general_manager', 'owner', 'scout']);
    }
    expect(w.authority.grants.length).toBeGreaterThanOrEqual(6);
    for (const g of w.authority.grants) {
      expect(g.rights.length).toBeGreaterThan(0);
    }
  });

  it('references the generic entity registry instead of duplicating names', () => {
    const w = createWorld(fixtureSeed(), SYNTHETIC_RULESET, ids);
    const kinds = new Map(w.entities.map((e) => [e.id as string, e.kind]));
    for (const p of w.people.persons)
      expect(kinds.get(p.entityId)).toBe('person');
    for (const o of w.organizations.organizations)
      expect(kinds.get(o.entityId)).toBe('organization');
    for (const r of w.people.roleEpisodes) {
      expect(kinds.get(r.personId)).toBe('person');
      expect(kinds.get(r.organizationId)).toBe('organization');
    }
    expect(JSON.stringify(w.people)).not.toContain('"name"');
  });

  it('sorts every collection by stable id', () => {
    const w = createWorld(fixtureSeed(), SYNTHETIC_RULESET, ids);
    const sorted = <T>(xs: readonly T[], key: (x: T) => string) =>
      expect(xs.map(key)).toEqual([...xs.map(key)].sort());
    sorted(w.people.persons, (p) => p.entityId);
    sorted(w.organizations.organizations, (o) => o.entityId);
    sorted(w.people.roleEpisodes, (r) => r.id);
    sorted(w.authority.grants, (g) => g.id);
    sorted(w.entities, (e) => e.id);
  });

  it('is deterministic and independent of seed array order', () => {
    const a = createWorld(fixtureSeed(), SYNTHETIC_RULESET, ids);
    const b = createWorld(fixtureSeed(), SYNTHETIC_RULESET, ids);
    expect(canonicalString(a)).toBe(canonicalString(b));
    expect(fingerprintWorld(a)).toBe(fingerprintWorld(b));
    const shuffled = reseal((s) => ({
      roleEpisodes: [...s.roleEpisodes].reverse(),
      authorityGrants: [...s.authorityGrants].reverse(),
    }));
    const c = createWorld(shuffled, SYNTHETIC_RULESET, ids);
    expect(canonicalString(c.people)).toBe(canonicalString(a.people));
    expect(canonicalString(c.authority)).toBe(canonicalString(a.authority));
  });

  it('normalizes right order and a world with the substrate runs and snapshots normally', () => {
    const w = createWorld(fixtureSeed(), SYNTHETIC_RULESET, ids);
    expect(w.nextIds).toEqual({ event: 1, record: 1 });
    const kernel = WorldKernel.fromGenesis(w, SYNTHETIC_RULESET);
    const res = kernel.execute({
      commandId: 'cmd-1',
      expectedRevision: 0,
      actor: harnessActor(),
      command: { type: 'AdvanceDays', days: 2 },
    } as never);
    expect(res.ok).toBe(true);
    const snap = sealSnapshot({
      world: kernel.world,
      chainHead: kernel.chainHead,
      eventCount: kernel.eventCount,
      knownCommandIds: kernel.knownCommandIds,
    });
    expect(verifySnapshot(snap)).toEqual({ ok: true });
  });

  it('is covered by the seed content hash', () => {
    const raw = fixtureJson();
    const tampered = JSON.parse(JSON.stringify(raw)) as {
      organizationSubstrate: { authorityGrants: { rights: string[] }[] };
    };
    tampered.organizationSubstrate.authorityGrants[0]!.rights = ['veto'];
    expect(() => validateSeedManifest(tampered)).toThrow(ManifestTamperError);
    const a = fixtureSeed().contentHash;
    const b = reseal((s) => ({ ...s, authorityGrants: [] })).contentHash;
    expect(a).not.toBe(b);
  });
});

describe('seed validation: structure (rejected when sealing)', () => {
  const grant = (over: Record<string, unknown>) =>
    reseal((s) => ({
      ...s,
      authorityGrants: [
        { ...s.authorityGrants[0]!, ...over } as never,
        ...s.authorityGrants.slice(1),
      ],
    }));
  const role = (over: Record<string, unknown>) =>
    reseal((s) => ({
      ...s,
      roleEpisodes: [
        { ...s.roleEpisodes[0]!, ...over } as never,
        ...s.roleEpisodes.slice(1),
      ],
    }));

  it('rejects rights outside the enum, empty or duplicated rights', () => {
    expect(() => grant({ rights: ['propose', 'delete'] })).toThrow(
      ManifestFormatError,
    );
    expect(() => grant({ rights: [] })).toThrow(ManifestFormatError);
    expect(() => grant({ rights: ['approve', 'approve'] })).toThrow(
      ManifestFormatError,
    );
  });

  it('rejects unknown roles and categories, bad ids and non-boolean flags', () => {
    expect(() => role({ role: 'janitor' })).toThrow(ManifestFormatError);
    expect(() => grant({ category: 'free_agency_bidding' })).toThrow(
      ManifestFormatError,
    );
    expect(() => role({ id: 'has space' })).toThrow(ManifestFormatError);
    expect(() => grant({ transferable: 'yes' })).toThrow(ManifestFormatError);
    expect(() => grant({ revision: 0 })).toThrow(ManifestFormatError);
  });

  it('rejects invalid dates and end-before-start intervals', () => {
    expect(() => role({ startDate: '2026-13-01' })).toThrow(
      ManifestFormatError,
    );
    expect(() => role({ endDate: 'sometime' })).toThrow(ManifestFormatError);
    expect(() =>
      role({ startDate: '2025-05-01', endDate: '2025-04-30' }),
    ).toThrow(ManifestFormatError);
    expect(() => grant({ effectiveFrom: '2026-02-30' })).toThrow(
      ManifestFormatError,
    );
    expect(() =>
      grant({ effectiveFrom: '2026-10-16', effectiveUntil: '2026-10-15' }),
    ).toThrow(ManifestFormatError);
  });

  it('rejects unexpected fields and non-array collections', () => {
    expect(() => grant({ surprise: true })).toThrow(ManifestFormatError);
    expect(() =>
      reseal(() => ({ roleEpisodes: {}, authorityGrants: [] }) as never),
    ).toThrow(ManifestFormatError);
    expect(() => reseal(() => ({ roleEpisodes: [] }) as never)).toThrow(
      ManifestFormatError,
    );
  });
});

describe('seed validation: references and consistency (rejected at world creation)', () => {
  it('rejects a role whose person is an organization or whose organization is a person', () => {
    const wrongPerson = reseal((s) => ({
      ...s,
      roleEpisodes: [
        { ...s.roleEpisodes[0]!, personId: s.roleEpisodes[0]!.organizationId },
        ...s.roleEpisodes.slice(1),
      ],
    }));
    expect(codes(wrongPerson)).toContain('SEED_SUBSTRATE_WRONG_ENTITY_KIND');
    const wrongOrg = reseal((s) => ({
      ...s,
      roleEpisodes: [
        { ...s.roleEpisodes[0]!, organizationId: s.roleEpisodes[0]!.personId },
        ...s.roleEpisodes.slice(1),
      ],
    }));
    expect(codes(wrongOrg)).toContain('SEED_SUBSTRATE_WRONG_ENTITY_KIND');
    expect(() => createWorld(wrongOrg, SYNTHETIC_RULESET, ids)).toThrow(
      WorldCreationError,
    );
  });

  it('rejects missing person, organization and source-person references', () => {
    const missingPerson = reseal((s) => ({
      ...s,
      roleEpisodes: [
        { ...s.roleEpisodes[0]!, personId: 'person-nobody' },
        ...s.roleEpisodes.slice(1),
      ],
    }));
    expect(codes(missingPerson)).toContain('SEED_SUBSTRATE_UNKNOWN_ENTITY');
    const missingOrg = reseal((s) => ({
      ...s,
      authorityGrants: [
        { ...s.authorityGrants[0]!, organizationId: 'org-nowhere' },
        ...s.authorityGrants.slice(1),
      ],
    }));
    expect(codes(missingOrg)).toContain('SEED_SUBSTRATE_UNKNOWN_ENTITY');
    const missingSource = reseal((s) => ({
      ...s,
      authorityGrants: [
        { ...s.authorityGrants[0]!, sourcePersonId: 'person-nobody' },
        ...s.authorityGrants.slice(1),
      ],
    }));
    expect(codes(missingSource)).toContain('SEED_SUBSTRATE_UNKNOWN_ENTITY');
  });

  it('rejects duplicate record ids within and across roles and grants', () => {
    const dupRole = reseal((s) => ({
      ...s,
      roleEpisodes: [
        s.roleEpisodes[0]!,
        { ...s.roleEpisodes[1]!, id: s.roleEpisodes[0]!.id },
        ...s.roleEpisodes.slice(2),
      ],
    }));
    expect(codes(dupRole)).toContain('SEED_SUBSTRATE_DUPLICATE_ID');
    const dupGrant = reseal((s) => ({
      ...s,
      authorityGrants: [
        s.authorityGrants[0]!,
        { ...s.authorityGrants[1]!, id: s.authorityGrants[0]!.id },
        ...s.authorityGrants.slice(2),
      ],
    }));
    expect(codes(dupGrant)).toContain('SEED_SUBSTRATE_DUPLICATE_ID');
    const cross = reseal((s) => ({
      ...s,
      authorityGrants: [
        { ...s.authorityGrants[0]!, id: s.roleEpisodes[0]!.id },
        ...s.authorityGrants.slice(1),
      ],
    }));
    expect(codes(cross)).toContain('SEED_SUBSTRATE_DUPLICATE_ID');
  });

  it('rejects overlapping duplicate role episodes but allows consecutive ones', () => {
    const overlap = reseal((s) => {
      const first = s.roleEpisodes[0]!;
      return {
        ...s,
        roleEpisodes: [
          { ...first, endDate: '2025-06-30', startDate: '2025-01-01' },
          {
            ...first,
            id: 'role-dup-overlap',
            startDate: '2025-06-30',
            endDate: null,
          },
          ...s.roleEpisodes.slice(1),
        ],
      };
    });
    expect(codes(overlap)).toContain('SEED_SUBSTRATE_OVERLAPPING_ROLE');
    const consecutive = reseal((s) => {
      const first = s.roleEpisodes[0]!;
      return {
        ...s,
        roleEpisodes: [
          { ...first, startDate: '2025-01-01', endDate: '2025-06-30' },
          {
            ...first,
            id: 'role-dup-next',
            startDate: '2025-07-01',
            endDate: null,
          },
          ...s.roleEpisodes.slice(1),
        ],
      };
    });
    expect(codes(consecutive)).toEqual([]);
    const sameDaySamePerson = reseal((s) => {
      const first = s.roleEpisodes[0]!;
      return {
        ...s,
        roleEpisodes: [
          first,
          { ...first, id: 'role-dup-exact' },
          ...s.roleEpisodes.slice(1),
        ],
      };
    });
    expect(codes(sameDaySamePerson)).toContain(
      'SEED_SUBSTRATE_OVERLAPPING_ROLE',
    );
  });

  it('allows one person to hold different roles at the same time', () => {
    const dual = reseal((s) => {
      const first = s.roleEpisodes[0]!;
      return {
        ...s,
        roleEpisodes: [
          first,
          {
            ...first,
            id: 'role-dual',
            role: first.role === 'scout' ? 'owner' : 'scout',
          },
          ...s.roleEpisodes.slice(1),
        ],
      };
    });
    expect(codes(dual)).toEqual([]);
  });

  it('reports every problem at once instead of stopping at the first', () => {
    const many = reseal((s) => ({
      roleEpisodes: [
        { ...s.roleEpisodes[0]!, personId: 'person-nobody' },
        { ...s.roleEpisodes[1]!, id: s.roleEpisodes[0]!.id },
        ...s.roleEpisodes.slice(2),
      ],
      authorityGrants: s.authorityGrants,
    }));
    const found = codes(many);
    expect(found).toContain('SEED_SUBSTRATE_UNKNOWN_ENTITY');
    expect(found).toContain('SEED_SUBSTRATE_DUPLICATE_ID');
  });
});
