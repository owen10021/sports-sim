import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MemoryCareerStore,
  SYNTHETIC_RULESET,
  WorldKernel,
  commandId,
  createWorld,
  delegatedRightsAt,
  effectiveRightsAt,
  entityId,
  fingerprintWorld,
  isProtectedAt,
  loadCareer,
  replayFrom,
  activeRightsAt,
  sealSnapshot,
  validateMandateAt,
  validateSeedManifest,
  verifyCareerReplay,
  worldId,
  worldRevision,
  type ActorKind,
  type CommandEnvelope,
  type ExecuteResult,
  type FootballWorld,
  type CommitRecord,
} from '../src/index';

const seedJson = JSON.parse(
  readFileSync(
    join(
      __dirname,
      '..',
      '..',
      '..',
      'fixtures',
      'seeds',
      'synthetic-org-substrate-v1.json',
    ),
    'utf8',
  ),
) as unknown;
const SEED = validateSeedManifest(seedJson);

const NF = {
  org: entityId('org-northfield'),
  owner: entityId('person-nf-owner'),
  gm: entityId('person-nf-gm'),
  scout: entityId('person-nf-scout'),
};
const SP = {
  org: entityId('org-southport'),
  owner: entityId('person-sp-owner'),
};
const TODAY = '2026-10-16';
const YESTERDAY = '2026-10-15';

const newKernel = (): WorldKernel =>
  WorldKernel.fromGenesis(
    createWorld(SEED, SYNTHETIC_RULESET, {
      newWorldId: () => worldId('world-auth-1'),
    }),
    SYNTHETIC_RULESET,
  );

interface Runner {
  readonly kernel: WorldKernel;
  run(
    command: Record<string, unknown>,
    kind?: ActorKind,
    expectedRevision?: number,
  ): ExecuteResult;
  readonly commits: CommitRecord[];
}

const runner = (kernel: WorldKernel = newKernel()): Runner => {
  let n = 0;
  const commits: CommitRecord[] = [];
  return {
    kernel,
    commits,
    run: (command, kind = 'test_harness', expectedRevision) => {
      n += 1;
      const envelope = {
        commandId: commandId(`cmd-${String(n).padStart(6, '0')}`),
        expectedRevision: worldRevision(
          expectedRevision ?? Number(kernel.world.revision),
        ),
        actor: { kind, id: entityId('actor-1') },
        command,
      } as unknown as CommandEnvelope;
      const res = kernel.execute(envelope);
      if (res.ok) {
        commits.push({
          snapshot: sealSnapshot({
            world: kernel.world,
            chainHead: kernel.chainHead,
            eventCount: kernel.eventCount,
            knownCommandIds: kernel.knownCommandIds,
          }),
          commands: [{ envelope, resultRevision: Number(res.world.revision) }],
          events: res.events,
        });
      }
      return res;
    },
  };
};

const ok = (res: ExecuteResult) => {
  if (!res.ok) throw new Error(`expected success: ${res.rejection.message}`);
  return res;
};
const code = (res: ExecuteResult): string =>
  res.ok ? 'OK' : res.rejection.code;

const snap = (k: WorldKernel) => ({
  fingerprint: fingerprintWorld(k.world),
  draws: k.world.rng.draws,
  head: k.chainHead,
  events: k.eventCount,
  revision: k.world.revision,
  known: k.knownCommandIds,
});

const startRole = (
  by: string,
  person: string,
  role = 'personnel_executive',
  extra: Record<string, unknown> = {},
) => ({
  type: 'StartRoleEpisode',
  organizationId: NF.org,
  actingPersonId: by,
  personId: person,
  role,
  title: 'Synthetic Title',
  ...extra,
});
const grant = (
  by: string,
  person: string,
  category: string,
  rights: string[],
  extra: Record<string, unknown> = {},
) => ({
  type: 'GrantAuthority',
  organizationId: NF.org,
  actingPersonId: by,
  personId: person,
  category,
  rights,
  transferable: false,
  ...extra,
});
const mandate = (
  by: string,
  delegate: string,
  rights: string[],
  extra: Record<string, unknown> = {},
) => ({
  type: 'CreateMandate',
  organizationId: NF.org,
  actingPersonId: by,
  delegatePersonId: delegate,
  category: 'organizational_plan',
  scope: { scopeKeys: ['strategy'] },
  hardConstraints: { unit: 'synthetic_units', maxAmount: 100 },
  preferences: {},
  allowedRights: rights,
  fallback: {},
  escalationRules: { onExceedsHardConstraint: 'escalate' },
  ...extra,
});

describe('role-bound rights are derived from grants, roles and logical dates', () => {
  it('reports each person rights in canonical order, per category', () => {
    const w = newKernel().world;
    const owner = activeRightsAt(
      w,
      NF.org,
      NF.owner,
      'organizational_authority',
      TODAY,
    );
    expect(owner.rights).toEqual([
      'propose',
      'advise',
      'approve',
      'veto',
      'execute',
      'communicate',
    ]);
    expect(owner.transferableRights).toEqual(owner.rights);
    expect(
      activeRightsAt(w, NF.org, NF.gm, 'organizational_authority', TODAY)
        .rights,
    ).toEqual([]);
    const scout = activeRightsAt(
      w,
      NF.org,
      NF.scout,
      'organizational_plan',
      TODAY,
    );
    expect(scout.rights).toEqual(['propose', 'advise', 'communicate']);
    expect(scout.transferableRights).toEqual([]);
  });

  it('honours effective intervals and requires an active role in that organization', () => {
    const w = newKernel().world;
    expect(
      activeRightsAt(w, NF.org, NF.owner, 'organizational_authority', YESTERDAY)
        .rights,
    ).toEqual([]);
    expect(
      activeRightsAt(w, NF.org, SP.owner, 'organizational_authority', TODAY)
        .rights,
    ).toEqual([]);
  });

  it('rights never imply one another: one grant gives only the rights it names', () => {
    const w = newKernel().world;
    const scout = activeRightsAt(
      w,
      NF.org,
      NF.scout,
      'organizational_plan',
      TODAY,
    );
    expect(scout.rights).not.toContain('approve');
    expect(scout.rights).not.toContain('execute');
  });
});

describe('StartRoleEpisode / EndRoleEpisode', () => {
  it('mints a record id, records the episode and emits one event at one revision, drawing no RNG', () => {
    const r = runner();
    const res = ok(r.run(startRole(NF.owner, NF.scout)));
    const w = res.world;
    const created = w.people.roleEpisodes.find((e) => e.id === 'rec-000001');
    expect(created).toEqual({
      id: 'rec-000001',
      personId: NF.scout,
      organizationId: NF.org,
      role: 'personnel_executive',
      title: 'Synthetic Title',
      startDate: TODAY,
      endDate: null,
    });
    expect(w.nextIds).toEqual({ event: 2, record: 2 });
    expect(w.revision).toBe(1);
    expect(w.rng.draws).toBe(0);
    expect(res.events.map((e) => e.type)).toEqual(['RoleEpisodeStarted']);
    const sorted = w.people.roleEpisodes.map((e) => e.id);
    expect(sorted).toEqual([...sorted].sort());
  });

  it('rejects overlapping duplicates, unknown people, retroactive starts and bad roles without changing anything', () => {
    const r = runner();
    const before = snap(r.kernel);
    expect(code(r.run(startRole(NF.owner, NF.owner, 'owner')))).toBe(
      'INVALID_PAYLOAD',
    );
    expect(code(r.run(startRole(NF.owner, 'person-nobody')))).toBe(
      'INVALID_PAYLOAD',
    );
    expect(
      code(
        r.run(
          startRole(NF.owner, NF.scout, 'scout', { startDate: '2026-10-01' }),
        ),
      ),
    ).toBe('INVALID_PAYLOAD');
    expect(code(r.run(startRole(NF.owner, NF.scout, 'janitor')))).toBe(
      'INVALID_PAYLOAD',
    );
    expect(
      code(
        r.run({ ...startRole(NF.owner, NF.scout), organizationId: NF.scout }),
      ),
    ).toBe('INVALID_PAYLOAD');
    expect(snap(r.kernel)).toEqual(before);
  });

  it('ending a role is immediate, keeps the record, and ends role-bound grants and mandates in the same revision (DC-13)', () => {
    const r = runner();
    ok(r.run(mandate(NF.owner, NF.gm, ['approve', 'veto'])));
    ok(r.run(mandate(NF.gm, NF.scout, ['approve'])));
    const res = ok(
      r.run({
        type: 'EndRoleEpisode',
        actingPersonId: NF.owner,
        episodeId: 'role-nf-gm',
      }),
    );
    const w = res.world;
    const episode = w.people.roleEpisodes.find((e) => e.id === 'role-nf-gm')!;
    expect(episode.endDate).toBe(YESTERDAY);
    // History preserved: the grant record is still there, but ended as of yesterday.
    const gmGrant = w.authority.grants.find(
      (g) => g.id === 'grant-nf-gm-plan',
    )!;
    expect(gmGrant.effectiveUntil).toBe(YESTERDAY);
    expect(gmGrant.revision).toBe(2);
    expect(w.authority.mandates.every((m) => !m.active)).toBe(true);
    expect(w.authority.mandates.every((m) => m.revision === 2)).toBe(true);
    expect(res.events.map((e) => e.type)).toEqual([
      'RoleEpisodeEnded',
      'AuthorityRevoked',
      'MandateRevoked',
      'MandateRevoked',
    ]);
    expect(new Set(res.events.map((e) => e.revision))).toEqual(
      new Set([worldRevision(3)]),
    );
    expect(w.revision).toBe(3);
    expect(w.nextIds.event).toBe(1 + 2 + 4);
    expect(w.rng.draws).toBe(0);
    for (const c of [
      'organizational_plan',
      'organizational_authority',
    ] as const)
      expect(effectiveRightsAt(w, NF.org, NF.gm, c, TODAY).rights).toEqual([]);
    // The returning person does not get the old authority back.
    const back = ok(r.run(startRole(NF.owner, NF.gm, 'general_manager')));
    expect(
      effectiveRightsAt(back.world, NF.org, NF.gm, 'organizational_plan', TODAY)
        .rights,
    ).toEqual([]);
  });

  it('keeps authority while another role is still held after one ends', () => {
    const r = runner();
    ok(r.run(startRole(NF.owner, NF.gm, 'personnel_executive')));
    const res = ok(
      r.run({
        type: 'EndRoleEpisode',
        actingPersonId: NF.owner,
        episodeId: 'role-nf-gm',
      }),
    );
    expect(res.events.map((e) => e.type)).toEqual(['RoleEpisodeEnded']);
    expect(
      activeRightsAt(res.world, NF.org, NF.gm, 'organizational_plan', TODAY)
        .rights.length,
    ).toBeGreaterThan(0);
  });

  it('a scheduled end date takes effect when the date passes, by derivation', () => {
    const r = runner();
    const res = ok(
      r.run({
        type: 'EndRoleEpisode',
        actingPersonId: NF.owner,
        episodeId: 'role-nf-gm',
        lastDay: '2026-10-20',
      }),
    );
    // The departing GM's role-bound grant is cut at the same last day.
    expect(res.events.map((e) => e.type)).toEqual([
      'RoleEpisodeEnded',
      'AuthorityRevoked',
    ]);
    const w = res.world;
    expect(
      activeRightsAt(w, NF.org, NF.gm, 'organizational_plan', '2026-10-20')
        .rights.length,
    ).toBeGreaterThan(0);
    expect(
      activeRightsAt(w, NF.org, NF.gm, 'organizational_plan', '2026-10-21')
        .rights,
    ).toEqual([]);
  });

  it('rejects ending an unknown or already ended episode', () => {
    const r = runner();
    expect(
      code(
        r.run({
          type: 'EndRoleEpisode',
          actingPersonId: NF.owner,
          episodeId: 'nope',
        }),
      ),
    ).toBe('INVALID_PAYLOAD');
    ok(
      r.run({
        type: 'EndRoleEpisode',
        actingPersonId: NF.owner,
        episodeId: 'role-nf-gm',
      }),
    );
    expect(
      code(
        r.run({
          type: 'EndRoleEpisode',
          actingPersonId: NF.owner,
          episodeId: 'role-nf-gm',
        }),
      ),
    ).toBe('INVALID_PAYLOAD');
  });
});

describe('partial rights never suffice (DC-01)', () => {
  it('a scout with advise/propose cannot execute an organization mutation, and nothing changes', () => {
    const r = runner();
    ok(
      r.run(
        grant(NF.owner, NF.scout, 'organizational_authority', [
          'advise',
          'propose',
        ]),
      ),
    );
    const before = snap(r.kernel);
    const res = r.run(startRole(NF.scout, NF.gm, 'personnel_executive'));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.rejection.code).toBe('INSUFFICIENT_AUTHORITY');
    expect(res.rejection.message).toContain('execute');
    expect(
      code(r.run(grant(NF.scout, NF.gm, 'organizational_plan', ['propose']))),
    ).toBe('INSUFFICIENT_AUTHORITY');
    expect(snap(r.kernel)).toEqual(before);
    expect(r.kernel.world.rng.draws).toBe(0);
  });

  it('the same rights from a different actor kind change nothing', () => {
    const kinds: ActorKind[] = [
      'human_gm',
      'cpu_org',
      'delegate',
      'commissioner',
      'system',
      'test_harness',
    ];
    const okPrints = new Set<string>();
    for (const kind of kinds) {
      const good = runner();
      okPrints.add(
        fingerprintWorld(
          ok(good.run(startRole(NF.owner, NF.scout), kind)).world,
        ),
      );
      const bad = runner();
      expect(code(bad.run(startRole(NF.scout, NF.gm), kind))).toBe(
        'INSUFFICIENT_AUTHORITY',
      );
    }
    expect(okPrints.size).toBe(1);
  });
});

describe('GrantAuthority / RevokeAuthority', () => {
  it('records a new grant sourced from the grantor, with revision 1', () => {
    const r = runner();
    const res = ok(
      r.run(
        grant(NF.owner, NF.scout, 'organizational_authority', [
          'propose',
          'advise',
        ]),
      ),
    );
    const g = res.world.authority.grants.find((x) => x.id === 'rec-000001')!;
    expect(g).toEqual({
      id: 'rec-000001',
      personId: NF.scout,
      organizationId: NF.org,
      category: 'organizational_authority',
      rights: ['propose', 'advise'],
      transferable: false,
      effectiveFrom: TODAY,
      effectiveUntil: null,
      sourcePersonId: NF.owner,
      revision: 1,
    });
    expect(res.events.map((e) => e.type)).toEqual(['AuthorityGranted']);
  });

  it('cannot manufacture authority: only transferable rights the grantor holds can be granted', () => {
    const r = runner();
    // The GM has no organizational_authority at all.
    expect(
      code(r.run(grant(NF.gm, NF.scout, 'organizational_plan', ['propose']))),
    ).toBe('INSUFFICIENT_AUTHORITY');
    ok(r.run(grant(NF.owner, NF.gm, 'organizational_authority', ['execute'])));
    // Now the GM may alter authority, but only with rights the GM holds transferably.
    ok(r.run(grant(NF.gm, NF.scout, 'organizational_plan', ['approve'])));
    expect(
      code(r.run(grant(NF.gm, NF.scout, 'organizational_plan', ['veto']))),
    ).toBe('INSUFFICIENT_AUTHORITY');
    // Non-transferable holdings cannot be passed on.
    ok(
      r.run(grant(NF.owner, NF.scout, 'organizational_authority', ['execute'])),
    );
    expect(
      code(r.run(grant(NF.scout, NF.gm, 'organizational_plan', ['advise']))),
    ).toBe('INSUFFICIENT_AUTHORITY');
  });

  it('rejects malformed grants without changing anything', () => {
    const r = runner();
    const before = snap(r.kernel);
    for (const bad of [
      grant(NF.owner, NF.scout, 'organizational_plan', []),
      grant(NF.owner, NF.scout, 'organizational_plan', ['delete']),
      grant(NF.owner, NF.scout, 'organizational_plan', ['propose', 'propose']),
      grant(NF.owner, NF.scout, 'free_agency', ['propose']),
      grant(NF.owner, 'person-nobody', 'organizational_plan', ['propose']),
      grant(NF.owner, NF.scout, 'organizational_plan', ['propose'], {
        effectiveFrom: '2026-10-01',
      }),
      grant(NF.owner, NF.scout, 'organizational_plan', ['propose'], {
        effectiveFrom: '2026-12-01',
        effectiveUntil: '2026-11-01',
      }),
      grant(NF.owner, NF.scout, 'organizational_plan', ['propose'], {
        transferable: 'yes',
      }),
    ])
      expect(code(r.run(bad))).toBe('INVALID_PAYLOAD');
    expect(snap(r.kernel)).toEqual(before);
  });

  it('revocation takes effect immediately and bumps the revision (DC-04)', () => {
    const r = runner();
    ok(r.run(grant(NF.owner, NF.gm, 'organizational_authority', ['execute'])));
    const contextBefore = effectiveRightsAt(
      r.kernel.world,
      NF.org,
      NF.gm,
      'organizational_authority',
      TODAY,
    );
    expect(contextBefore.rights).toEqual(['execute']);
    const res = ok(
      r.run({
        type: 'RevokeAuthority',
        actingPersonId: NF.owner,
        grantId: 'rec-000001',
      }),
    );
    const g = res.world.authority.grants.find((x) => x.id === 'rec-000001')!;
    expect(g.effectiveUntil).toBe(YESTERDAY);
    expect(g.revision).toBe(2);
    expect(res.events.map((e) => e.type)).toEqual(['AuthorityRevoked']);
    // A context captured earlier is only data: current authority is re-read and now empty.
    expect(contextBefore.rights).toEqual(['execute']);
    expect(
      effectiveRightsAt(
        res.world,
        NF.org,
        NF.gm,
        'organizational_authority',
        TODAY,
      ).rights,
    ).toEqual([]);
    const before = snap(r.kernel);
    expect(
      code(r.run(grant(NF.gm, NF.scout, 'organizational_plan', ['propose']))),
    ).toBe('INSUFFICIENT_AUTHORITY');
    expect(snap(r.kernel)).toEqual(before);
  });

  it('rejects revoking an unknown or already ended grant, and revoking without authority', () => {
    const r = runner();
    expect(
      code(
        r.run({
          type: 'RevokeAuthority',
          actingPersonId: NF.owner,
          grantId: 'nope',
        }),
      ),
    ).toBe('INVALID_PAYLOAD');
    expect(
      code(
        r.run({
          type: 'RevokeAuthority',
          actingPersonId: NF.scout,
          grantId: 'grant-nf-gm-plan',
        }),
      ),
    ).toBe('INSUFFICIENT_AUTHORITY');
    ok(
      r.run({
        type: 'RevokeAuthority',
        actingPersonId: NF.owner,
        grantId: 'grant-nf-gm-plan',
      }),
    );
    expect(
      code(
        r.run({
          type: 'RevokeAuthority',
          actingPersonId: NF.owner,
          grantId: 'grant-nf-gm-plan',
        }),
      ),
    ).toBe('INVALID_PAYLOAD');
  });
});

describe('mandates narrow authority and never manufacture it', () => {
  it('creates a mandate whose effective rights are limited to what the delegator can transfer', () => {
    const r = runner();
    const res = ok(r.run(mandate(NF.owner, NF.gm, ['approve', 'veto'])));
    const m = res.world.authority.mandates[0]!;
    expect(m).toMatchObject({
      id: 'rec-000001',
      organizationId: NF.org,
      delegatorPersonId: NF.owner,
      delegatePersonId: NF.gm,
      category: 'organizational_plan',
      allowedRights: ['approve', 'veto'],
      revision: 1,
      active: true,
      effectiveFrom: TODAY,
      effectiveUntil: null,
    });
    expect(res.events.map((e) => e.type)).toEqual(['MandateCreated']);
    expect(
      delegatedRightsAt(res.world, NF.org, NF.gm, 'organizational_plan', TODAY)
        .rights,
    ).toEqual(['approve', 'veto']);
    expect(
      activeRightsAt(res.world, NF.org, NF.gm, 'organizational_plan', TODAY)
        .rights,
    ).not.toContain('veto');
    expect(
      effectiveRightsAt(res.world, NF.org, NF.gm, 'organizational_plan', TODAY)
        .rights,
    ).toContain('veto');
  });

  it('rejects rights the delegator lacks, holds non-transferably, or only holds through another mandate (no subdelegation)', () => {
    const r = runner();
    expect(code(r.run(mandate(NF.gm, NF.scout, ['veto'])))).toBe(
      'INSUFFICIENT_AUTHORITY',
    );
    expect(code(r.run(mandate(NF.scout, NF.gm, ['advise'])))).toBe(
      'INSUFFICIENT_AUTHORITY',
    );
    ok(r.run(mandate(NF.owner, NF.scout, ['veto'])));
    // The scout now effectively holds veto, but only via a mandate: it cannot be passed on.
    expect(
      effectiveRightsAt(
        r.kernel.world,
        NF.org,
        NF.scout,
        'organizational_plan',
        TODAY,
      ).rights,
    ).toContain('veto');
    expect(code(r.run(mandate(NF.scout, NF.gm, ['veto'])))).toBe(
      'INSUFFICIENT_AUTHORITY',
    );
  });

  it('requires a delegate who holds a role, and rejects malformed mandates', () => {
    const r = runner();
    const before = snap(r.kernel);
    expect(code(r.run(mandate(NF.owner, SP.owner, ['advise'])))).toBe(
      'INVALID_PAYLOAD',
    );
    expect(code(r.run(mandate(NF.owner, NF.owner, ['advise'])))).toBe(
      'INVALID_PAYLOAD',
    );
    expect(code(r.run(mandate(NF.owner, NF.gm, [])))).toBe('INVALID_PAYLOAD');
    expect(
      code(
        r.run(
          mandate(NF.owner, NF.gm, ['advise'], { category: 'free_agency' }),
        ),
      ),
    ).toBe('INVALID_PAYLOAD');
    expect(
      code(r.run(mandate(NF.owner, NF.gm, ['advise'], { scope: 'strategy' }))),
    ).toBe('INVALID_PAYLOAD');
    expect(snap(r.kernel)).toEqual(before);
  });

  it('RevokeMandate is allowed to the delegator or an organization authority holder, and takes effect now', () => {
    const r = runner();
    ok(r.run(mandate(NF.owner, NF.gm, ['approve'])));
    expect(
      code(
        r.run({
          type: 'RevokeMandate',
          actingPersonId: NF.scout,
          mandateId: 'rec-000001',
        }),
      ),
    ).toBe('INSUFFICIENT_AUTHORITY');
    const res = ok(
      r.run({
        type: 'RevokeMandate',
        actingPersonId: NF.owner,
        mandateId: 'rec-000001',
      }),
    );
    expect(res.world.authority.mandates[0]).toMatchObject({
      active: false,
      revision: 2,
    });
    expect(res.events.map((e) => e.type)).toEqual(['MandateRevoked']);
    expect(
      delegatedRightsAt(res.world, NF.org, NF.gm, 'organizational_plan', TODAY)
        .rights,
    ).toEqual([]);
    expect(
      code(
        r.run({
          type: 'RevokeMandate',
          actingPersonId: NF.owner,
          mandateId: 'rec-000001',
        }),
      ),
    ).toBe('INVALID_PAYLOAD');
  });

  it('a mandate stops being effective when the delegator loses the transferable right (DC-04 shape)', () => {
    const r = runner();
    ok(r.run(mandate(NF.gm, NF.scout, ['approve'])));
    const mId = 'rec-000001';
    expect(validateMandateAt(r.kernel.world, mId, TODAY)).toMatchObject({
      ok: true,
      rights: ['approve'],
    });
    ok(
      r.run({
        type: 'RevokeAuthority',
        actingPersonId: NF.owner,
        grantId: 'grant-nf-gm-plan',
      }),
    );
    const verdict = validateMandateAt(r.kernel.world, mId, TODAY);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.outcome).toBe('invalid');
    expect(verdict.reasons.join(' ')).toContain('delegator');
    expect(
      delegatedRightsAt(
        r.kernel.world,
        NF.org,
        NF.scout,
        'organizational_plan',
        TODAY,
      ).rights,
    ).toEqual([]);
  });

  it('enforces a hard limit exactly: 100 units pass, 101 escalate, other units or scopes reject (DC-05)', () => {
    const r = runner();
    ok(r.run(mandate(NF.owner, NF.gm, ['approve'])));
    const w = r.kernel.world;
    const at = (
      amount: number,
      unit = 'synthetic_units',
      scopeKey = 'strategy',
    ) => validateMandateAt(w, 'rec-000001', TODAY, { unit, amount, scopeKey });
    expect(at(100)).toMatchObject({ ok: true });
    expect(at(0)).toMatchObject({ ok: true });
    expect(at(101)).toMatchObject({ ok: false, outcome: 'escalate' });
    expect(at(100, 'other_units')).toMatchObject({
      ok: false,
      outcome: 'reject',
    });
    expect(at(100, 'synthetic_units', 'roster')).toMatchObject({
      ok: false,
      outcome: 'reject',
    });
    expect(at(-1)).toMatchObject({ ok: false, outcome: 'reject' });
    expect(at(1.5)).toMatchObject({ ok: false, outcome: 'reject' });
    const plain = runner();
    ok(
      plain.run(mandate(NF.owner, NF.gm, ['approve'], { escalationRules: {} })),
    );
    expect(
      validateMandateAt(plain.kernel.world, 'rec-000001', TODAY, {
        unit: 'synthetic_units',
        amount: 101,
        scopeKey: 'strategy',
      }),
    ).toMatchObject({ ok: false, outcome: 'reject' });
  });

  it('is not effective before it starts or after it ends', () => {
    const r = runner();
    ok(
      r.run(
        mandate(NF.owner, NF.gm, ['approve'], {
          effectiveFrom: '2026-10-20',
          effectiveUntil: '2026-10-25',
        }),
      ),
    );
    const w = r.kernel.world;
    expect(validateMandateAt(w, 'rec-000001', '2026-10-19')).toMatchObject({
      ok: false,
      outcome: 'invalid',
    });
    expect(validateMandateAt(w, 'rec-000001', '2026-10-20')).toMatchObject({
      ok: true,
    });
    expect(validateMandateAt(w, 'rec-000001', '2026-10-25')).toMatchObject({
      ok: true,
    });
    expect(validateMandateAt(w, 'rec-000001', '2026-10-26')).toMatchObject({
      ok: false,
      outcome: 'invalid',
    });
    expect(validateMandateAt(w, 'nope', TODAY)).toMatchObject({
      ok: false,
      outcome: 'invalid',
    });
  });
});

describe('protected constraints (DC-06)', () => {
  const protect = (by = NF.owner, extra: Record<string, unknown> = {}) => ({
    type: 'CreateProtectedConstraint',
    organizationId: NF.org,
    actingPersonId: by,
    subject: { kind: 'authority_grant', id: 'grant-nf-gm-plan' },
    prohibitedChange: { action: 'revoke' },
    amendableByPersonIds: [NF.owner],
    ...extra,
  });

  it('blocks a protected change even for someone with full rights, until amended by an authorized person', () => {
    const r = runner();
    const created = ok(r.run(protect()));
    expect(created.world.authority.protectedConstraints[0]).toMatchObject({
      id: 'rec-000001',
      organizationId: NF.org,
      active: true,
      revision: 1,
      amendableByPersonIds: [NF.owner],
      effectiveFrom: TODAY,
      effectiveUntil: null,
      originRecordId: null,
    });
    expect(created.events.map((e) => e.type)).toEqual([
      'ProtectedConstraintCreated',
    ]);
    expect(
      isProtectedAt(
        created.world,
        NF.org,
        { kind: 'authority_grant', id: 'grant-nf-gm-plan' },
        { action: 'revoke' },
        TODAY,
      ).length,
    ).toBe(1);
    expect(
      isProtectedAt(
        created.world,
        NF.org,
        { kind: 'authority_grant', id: 'grant-nf-gm-plan' },
        { action: 'extend' },
        TODAY,
      ),
    ).toEqual([]);

    const before = snap(r.kernel);
    const blocked = r.run({
      type: 'RevokeAuthority',
      actingPersonId: NF.owner,
      grantId: 'grant-nf-gm-plan',
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok)
      expect(blocked.rejection.code).toBe('PROTECTED_CONSTRAINT');
    expect(snap(r.kernel)).toEqual(before);

    expect(
      code(
        r.run({
          type: 'AmendProtectedConstraint',
          actingPersonId: NF.gm,
          constraintId: 'rec-000001',
          active: false,
        }),
      ),
    ).toBe('INSUFFICIENT_AUTHORITY');
    expect(snap(r.kernel)).toEqual(before);

    const amended = ok(
      r.run({
        type: 'AmendProtectedConstraint',
        actingPersonId: NF.owner,
        constraintId: 'rec-000001',
        active: false,
      }),
    );
    expect(amended.world.authority.protectedConstraints[0]).toMatchObject({
      active: false,
      revision: 2,
    });
    expect(amended.events.map((e) => e.type)).toEqual([
      'ProtectedConstraintAmended',
    ]);
    ok(
      r.run({
        type: 'RevokeAuthority',
        actingPersonId: NF.owner,
        grantId: 'grant-nf-gm-plan',
      }),
    );
  });

  it('protects role endings and mandate revocations too, and honours its own interval', () => {
    const r = runner();
    ok(
      r.run(
        protect(NF.owner, {
          subject: { kind: 'role_episode', id: 'role-nf-gm' },
          prohibitedChange: { action: 'end' },
        }),
      ),
    );
    expect(
      code(
        r.run({
          type: 'EndRoleEpisode',
          actingPersonId: NF.owner,
          episodeId: 'role-nf-gm',
        }),
      ),
    ).toBe('PROTECTED_CONSTRAINT');
    ok(
      r.run({
        type: 'AmendProtectedConstraint',
        actingPersonId: NF.owner,
        constraintId: 'rec-000001',
        effectiveUntil: YESTERDAY,
      }),
    );
    ok(
      r.run({
        type: 'EndRoleEpisode',
        actingPersonId: NF.owner,
        episodeId: 'role-nf-gm',
      }),
    );
  });

  it('rejects creating or amending without the right or with a no-op, and unknown constraints', () => {
    const r = runner();
    expect(code(r.run(protect(NF.scout)))).toBe('INSUFFICIENT_AUTHORITY');
    expect(
      code(
        r.run(protect(NF.owner, { amendableByPersonIds: ['person-nobody'] })),
      ),
    ).toBe('INVALID_PAYLOAD');
    ok(r.run(protect()));
    expect(
      code(
        r.run({
          type: 'AmendProtectedConstraint',
          actingPersonId: NF.owner,
          constraintId: 'rec-000001',
        }),
      ),
    ).toBe('INVALID_PAYLOAD');
    expect(
      code(
        r.run({
          type: 'AmendProtectedConstraint',
          actingPersonId: NF.owner,
          constraintId: 'nope',
          active: false,
        }),
      ),
    ).toBe('INVALID_PAYLOAD');
  });

  it('an amender whose role ended can no longer amend', () => {
    const r = runner();
    ok(r.run(protect(NF.owner, { amendableByPersonIds: [NF.owner, NF.gm] })));
    ok(
      r.run({
        type: 'EndRoleEpisode',
        actingPersonId: NF.owner,
        episodeId: 'role-nf-gm',
      }),
    );
    expect(
      code(
        r.run({
          type: 'AmendProtectedConstraint',
          actingPersonId: NF.gm,
          constraintId: 'rec-000001',
          active: false,
        }),
      ),
    ).toBe('INSUFFICIENT_AUTHORITY');
  });
});

describe('invariants shared by every Package B authority command', () => {
  const commands: Record<string, unknown>[] = [
    startRole(NF.owner, NF.scout),
    {
      type: 'EndRoleEpisode',
      actingPersonId: NF.owner,
      episodeId: 'role-nf-gm',
    },
    grant(NF.owner, NF.scout, 'organizational_plan', ['approve']),
    {
      type: 'RevokeAuthority',
      actingPersonId: NF.owner,
      grantId: 'grant-nf-gm-plan',
    },
    mandate(NF.owner, NF.gm, ['approve']),
    {
      type: 'CreateProtectedConstraint',
      organizationId: NF.org,
      actingPersonId: NF.owner,
      subject: { kind: 'role_episode', id: 'role-nf-gm' },
      prohibitedChange: { action: 'end' },
      amendableByPersonIds: [NF.owner],
    },
  ];

  it('stale and duplicate commands change nothing and draw no RNG', () => {
    for (const command of commands) {
      const r = runner();
      const before = snap(r.kernel);
      expect(code(r.run(command, 'test_harness', 5))).toBe('STALE_REVISION');
      expect(snap(r.kernel)).toEqual(before);
      ok(r.run(command));
      const after = snap(r.kernel);
      const res = r.kernel.execute({
        commandId: commandId('cmd-000002'),
        expectedRevision: worldRevision(1),
        actor: { kind: 'test_harness', id: entityId('actor-1') },
        command,
      } as unknown as CommandEnvelope);
      expect(res.ok).toBe(false);
      expect(snap(r.kernel)).toEqual(after);
      expect(r.kernel.world.rng.draws).toBe(0);
    }
  });

  it('a fault after resolution commits nothing', () => {
    for (const command of commands) {
      let armed = false;
      const kernel = WorldKernel.fromGenesis(
        createWorld(SEED, SYNTHETIC_RULESET, {
          newWorldId: () => worldId('world-auth-1'),
        }),
        SYNTHETIC_RULESET,
        {
          beforeCommit: () => {
            if (armed) throw new Error('injected fault');
          },
        },
      );
      const r = runner(kernel);
      const before = snap(kernel);
      armed = true;
      expect(code(r.run(command))).toBe('INTERNAL_ERROR');
      expect(snap(kernel)).toEqual(before);
    }
  });

  it('every command bumps the revision exactly once and keeps collections sorted by id', () => {
    const r = runner();
    let revision = 0;
    for (const command of [
      startRole(NF.owner, NF.scout),
      grant(NF.owner, NF.scout, 'organizational_plan', ['approve']),
      mandate(NF.owner, NF.gm, ['approve']),
    ]) {
      const res = ok(r.run(command));
      revision += 1;
      expect(res.world.revision).toBe(revision);
      expect(res.events.every((e) => e.revision === revision)).toBe(true);
    }
    const w = r.kernel.world as FootballWorld;
    for (const ids of [
      w.people.roleEpisodes.map((x) => x.id),
      w.authority.grants.map((x) => x.id),
      w.authority.mandates.map((x) => x.id),
    ])
      expect(ids).toEqual([...ids].sort());
    expect(w.nextIds.record).toBe(4);
  });
});

describe('persistence, replay and recovery', () => {
  it('a multi-step authority history saves, reloads and replays to the exact state', async () => {
    const r = runner();
    const store = new MemoryCareerStore();
    await store.initialize();
    const genesisSnapshot = sealSnapshot({
      world: r.kernel.world,
      chainHead: r.kernel.chainHead,
      eventCount: 0,
      knownCommandIds: [],
    });
    await store.saveCommit({
      snapshot: genesisSnapshot,
      commands: [],
      events: [],
    });
    ok(
      r.run(grant(NF.owner, NF.scout, 'organizational_authority', ['advise'])),
    );
    ok(r.run(mandate(NF.gm, NF.scout, ['approve'])));
    ok(
      r.run({
        type: 'CreateProtectedConstraint',
        organizationId: NF.org,
        actingPersonId: NF.owner,
        subject: { kind: 'mandate', id: 'rec-000002' },
        prohibitedChange: { action: 'revoke' },
        amendableByPersonIds: [NF.owner],
      }),
    );
    ok(
      r.run({
        type: 'EndRoleEpisode',
        actingPersonId: NF.owner,
        episodeId: 'role-nf-gm',
      }),
    );
    for (const commit of r.commits) await store.saveCommit(commit);

    const loaded = await loadCareer(store, {
      ruleset: SYNTHETIC_RULESET,
      seed: SEED,
    });
    expect(loaded.status).toBe('loaded');
    if (loaded.status !== 'loaded') return;
    expect(fingerprintWorld(loaded.kernel.world)).toBe(
      fingerprintWorld(r.kernel.world),
    );
    const replay = await verifyCareerReplay(store, SYNTHETIC_RULESET);
    expect(replay.ok).toBe(true);
    expect(replay.fingerprint).toBe(fingerprintWorld(r.kernel.world));
    expect(replay.chainHead).toBe(r.kernel.chainHead);

    const again = replayFrom(
      genesisSnapshot,
      SYNTHETIC_RULESET,
      r.commits.flatMap((c) => c.commands),
      r.commits.flatMap((c) => c.events),
    );
    expect(fingerprintWorld(again.kernel.world)).toBe(
      fingerprintWorld(r.kernel.world),
    );
    expect(again.kernel.chainHead).toBe(r.kernel.chainHead);
  });
});
