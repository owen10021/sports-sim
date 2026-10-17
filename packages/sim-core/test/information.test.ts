import { describe, expect, it } from 'vitest';
import { WorldKernel, canonicalString } from '../src/index';
import {
  NF,
  SP,
  TODAY,
  codeOf,
  messageOf,
  newOrgKernel,
  okResult,
  runnerFor,
  snapshotOf,
} from './support/orgHarness';

const claim = (
  by: string,
  org: string,
  extra: Record<string, unknown> = {},
) => ({
  type: 'RecordClaim',
  organizationId: org,
  actingPersonId: by,
  subject: { kind: 'entity', id: 'org-southport' },
  propositionType: 'scouting_note',
  proposition: { note: 'disciplined front office' },
  sourceFamilyId: 'family-alpha',
  observedAt: TODAY,
  visibility: 'organization',
  confidence: 'medium',
  possibleBias: null,
  corroboratesClaimIds: [],
  contradictsClaimIds: [],
  ...extra,
});

const share = (
  by: string,
  org: string,
  claimId: string,
  to: string,
  extra: Record<string, unknown> = {},
) => ({
  type: 'ShareClaim',
  organizationId: org,
  actingPersonId: by,
  claimId,
  toOrganizationId: to,
  ...extra,
});

const belief = (
  by: string,
  org: string,
  evidence: string[],
  extra: Record<string, unknown> = {},
) => ({
  type: 'FormBelief',
  organizationId: org,
  actingPersonId: by,
  subject: { kind: 'entity', id: 'org-southport' },
  assessmentType: 'organization_strength',
  assessment: { rating: 'solid' },
  confidence: 'medium',
  evidenceClaimIds: evidence,
  supersedesBeliefId: null,
  ...extra,
});

describe('RecordClaim', () => {
  it('stores an immutable as-of claim with provenance, at one revision, drawing no RNG', () => {
    const r = runnerFor();
    const res = okResult(r.run(claim(NF.scout, NF.org)));
    expect(res.world.information.claims).toEqual([
      {
        id: 'rec-000001',
        subject: { kind: 'entity', id: 'org-southport' },
        propositionType: 'scouting_note',
        proposition: { note: 'disciplined front office' },
        sourcePersonId: NF.scout,
        sourceFamilyId: 'family-alpha',
        observedAt: TODAY,
        acquiredAt: TODAY,
        visibility: 'organization',
        holderOrganizationIds: [NF.org],
        confidence: 'medium',
        possibleBias: null,
        corroboratesClaimIds: [],
        contradictsClaimIds: [],
        sharedFromClaimId: null,
      },
    ]);
    expect(res.events.map((e) => e.type)).toEqual(['ClaimRecorded']);
    expect(res.world.revision).toBe(1);
    expect(res.world.nextIds).toEqual({ event: 2, record: 2 });
    expect(res.world.rng.draws).toBe(0);
  });

  it('the recorder is always the source: a claim cannot be forged in someone else’s name', () => {
    const r = runnerFor();
    const before = snapshotOf(r.kernel);
    expect(
      codeOf(r.run(claim(NF.scout, NF.org, { sourcePersonId: NF.owner }))),
    ).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('rejects malformed claims without changing anything', () => {
    const r = runnerFor();
    const before = snapshotOf(r.kernel);
    const bads: Record<string, unknown>[] = [
      claim(NF.scout, NF.org, { subject: { kind: 'team', id: 'x' } }),
      claim(NF.scout, NF.org, { subject: { kind: 'entity', id: 'nobody' } }),
      claim(NF.scout, NF.org, { visibility: 'secret' }),
      claim(NF.scout, NF.org, { confidence: 'certain' }),
      claim(NF.scout, NF.org, { propositionType: '' }),
      claim(NF.scout, NF.org, { sourceFamilyId: '' }),
      claim(NF.scout, NF.org, { observedAt: '2026-10-17' }),
      claim(NF.scout, NF.org, { observedAt: 'yesterday' }),
      claim(NF.scout, NF.org, { possibleBias: 7 }),
      claim(NF.scout, NF.org, { corroboratesClaimIds: ['rec-999999'] }),
      claim(NF.scout, NF.org, { contradictsClaimIds: 'rec-000001' }),
      claim(NF.scout, 'person-nf-gm'),
      claim('person-nobody', NF.org),
    ];
    for (const bad of bads) expect(codeOf(r.run(bad))).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('needs the advise right, independent of every other right', () => {
    const r = runnerFor();
    okResult(
      r.run({
        type: 'RevokeAuthority',
        actingPersonId: NF.owner,
        grantId: 'grant-nf-scout-plan',
      }),
    );
    okResult(
      r.run({
        type: 'GrantAuthority',
        organizationId: NF.org,
        actingPersonId: NF.owner,
        personId: NF.scout,
        category: 'organizational_plan',
        rights: ['propose', 'communicate'],
        transferable: false,
      }),
    );
    const before = snapshotOf(r.kernel);
    const res = r.run(claim(NF.scout, NF.org));
    expect(codeOf(res)).toBe('INSUFFICIENT_AUTHORITY');
    expect(messageOf(res)).toContain('advise');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('same acting person gets the same result for every actor kind', () => {
    const prints = new Set<string>();
    for (const kind of [
      'human_gm',
      'cpu_org',
      'delegate',
      'commissioner',
      'system',
      'test_harness',
    ] as const) {
      const r = runnerFor();
      okResult(r.run(claim(NF.scout, NF.org), kind));
      prints.add(snapshotOf(r.kernel).fingerprint);
    }
    expect(prints.size).toBe(1);
  });

  it('corroboration and contradiction may only cite claims the recorder can legitimately see', () => {
    const r = runnerFor();
    okResult(r.run(claim(SP.scout, SP.org))); // rec-000001: Southport-private
    const before = snapshotOf(r.kernel);
    const cited = r.run(
      claim(NF.scout, NF.org, { corroboratesClaimIds: ['rec-000001'] }),
    );
    const unknown = r.run(
      claim(NF.scout, NF.org, { corroboratesClaimIds: ['rec-000777'] }),
    );
    expect(codeOf(cited)).toBe('INVALID_PAYLOAD');
    // A hidden claim is indistinguishable from one that does not exist.
    expect(messageOf(cited).replace('rec-000001', 'X')).toBe(
      messageOf(unknown).replace('rec-000777', 'X'),
    );
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('keeps corroboration links and the source family exactly as recorded', () => {
    const r = runnerFor();
    okResult(r.run(claim(NF.scout, NF.org)));
    const res = okResult(
      r.run(
        claim(NF.owner, NF.org, {
          sourceFamilyId: 'family-beta',
          corroboratesClaimIds: ['rec-000001'],
          contradictsClaimIds: [],
        }),
      ),
    );
    const second = res.world.information.claims[1]!;
    expect(second.sourceFamilyId).toBe('family-beta');
    expect(second.corroboratesClaimIds).toEqual(['rec-000001']);
    expect(second.sourcePersonId).toBe(NF.owner);
  });
});

describe('ShareClaim', () => {
  const scoutNote = () => {
    const r = runnerFor();
    okResult(r.run(claim(NF.scout, NF.org)));
    return r;
  };

  it('copies provenance to the receiving organization and never edits the original', () => {
    const r = scoutNote();
    const original = canonicalString(r.kernel.world.information.claims[0]);
    const res = okResult(r.run(share(NF.owner, NF.org, 'rec-000001', SP.org)));
    expect(res.events.map((e) => e.type)).toEqual(['ClaimShared']);
    const [first, copy] = res.world.information.claims;
    expect(canonicalString(first)).toBe(original);
    expect(copy).toMatchObject({
      id: 'rec-000002',
      subject: first!.subject,
      propositionType: first!.propositionType,
      proposition: first!.proposition,
      sourcePersonId: NF.scout,
      sourceFamilyId: 'family-alpha',
      observedAt: first!.observedAt,
      acquiredAt: TODAY,
      visibility: 'organization',
      holderOrganizationIds: [SP.org],
      sharedFromClaimId: 'rec-000001',
    });
    expect(res.world.rng.draws).toBe(0);
  });

  it('requires legitimate access to the claim and the communicate right', () => {
    const r = scoutNote();
    const before = snapshotOf(r.kernel);
    // Southport cannot share (or even see) a Northfield-private claim.
    const outsider = r.run(share(SP.owner, SP.org, 'rec-000001', NF.org));
    const missing = r.run(share(SP.owner, SP.org, 'rec-000555', NF.org));
    expect(codeOf(outsider)).toBe('INVALID_PAYLOAD');
    expect(messageOf(outsider).replace('rec-000001', 'X')).toBe(
      messageOf(missing).replace('rec-000555', 'X'),
    );
    expect(snapshotOf(r.kernel)).toEqual(before);

    // Access without communicate: advise alone is not enough to share.
    okResult(
      r.run({
        type: 'RevokeAuthority',
        actingPersonId: NF.owner,
        grantId: 'grant-nf-scout-plan',
      }),
    );
    okResult(
      r.run({
        type: 'GrantAuthority',
        organizationId: NF.org,
        actingPersonId: NF.owner,
        personId: NF.scout,
        category: 'organizational_plan',
        rights: ['advise'],
        transferable: false,
      }),
    );
    const mid = snapshotOf(r.kernel);
    const res = r.run(share(NF.scout, NF.org, 'rec-000001', SP.org));
    expect(codeOf(res)).toBe('INSUFFICIENT_AUTHORITY');
    expect(messageOf(res)).toContain('communicate');
    expect(snapshotOf(r.kernel)).toEqual(mid);
  });

  it('cannot upgrade restricted visibility, and restricted claims stay behind the authority holder', () => {
    const r = runnerFor();
    okResult(r.run(claim(NF.scout, NF.org, { visibility: 'restricted' })));
    const before = snapshotOf(r.kernel);
    // The GM holds communicate but not organization-level execute, so cannot see it.
    expect(codeOf(r.run(share(NF.gm, NF.org, 'rec-000001', SP.org)))).toBe(
      'INVALID_PAYLOAD',
    );
    // The owner can see it, but widening on the way out is refused.
    for (const widen of ['organization', 'public'])
      expect(
        codeOf(
          r.run(
            share(NF.owner, NF.org, 'rec-000001', SP.org, {
              visibility: widen,
            }),
          ),
        ),
      ).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);
    // The default keeps it restricted.
    const res = okResult(r.run(share(NF.owner, NF.org, 'rec-000001', SP.org)));
    expect(res.world.information.claims[1]!.visibility).toBe('restricted');
  });

  it('does not share the same claim with the same organization twice', () => {
    const r = scoutNote();
    okResult(r.run(share(NF.owner, NF.org, 'rec-000001', SP.org)));
    const before = snapshotOf(r.kernel);
    expect(codeOf(r.run(share(NF.owner, NF.org, 'rec-000001', SP.org)))).toBe(
      'INVALID_PAYLOAD',
    );
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('rejects public claims, self-shares and unknown recipients', () => {
    const r = runnerFor();
    okResult(r.run(claim(NF.scout, NF.org, { visibility: 'public' })));
    okResult(r.run(claim(NF.scout, NF.org)));
    const before = snapshotOf(r.kernel);
    expect(codeOf(r.run(share(NF.owner, NF.org, 'rec-000001', SP.org)))).toBe(
      'INVALID_PAYLOAD',
    );
    expect(codeOf(r.run(share(NF.owner, NF.org, 'rec-000002', NF.org)))).toBe(
      'INVALID_PAYLOAD',
    );
    expect(
      codeOf(r.run(share(NF.owner, NF.org, 'rec-000002', 'org-nowhere'))),
    ).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });
});

describe('FormBelief (DC-17: later evidence adds a linked belief, never an edit)', () => {
  const setup = () => {
    const r = runnerFor();
    okResult(r.run(claim(NF.scout, NF.org))); // rec-000001
    okResult(r.run(belief(NF.gm, NF.org, ['rec-000001']))); // rec-000002
    return r;
  };

  it('records an organization belief bound to its evidence', () => {
    const r = setup();
    expect(r.kernel.world.information.beliefs).toEqual([
      {
        id: 'rec-000002',
        organizationId: NF.org,
        authorPersonId: NF.gm,
        subject: { kind: 'entity', id: 'org-southport' },
        assessmentType: 'organization_strength',
        assessment: { rating: 'solid' },
        confidence: 'medium',
        evidenceClaimIds: ['rec-000001'],
        formedAt: TODAY,
        supersedesBeliefId: null,
      },
    ]);
  });

  it('later contradictory evidence supersedes by link and leaves the original byte-identical', () => {
    const r = setup();
    const originalBytes = canonicalString(
      r.kernel.world.information.beliefs[0],
    );
    const originalClaim = canonicalString(r.kernel.world.information.claims[0]);
    const contra = okResult(
      r.run(
        claim(NF.owner, NF.org, {
          sourceFamilyId: 'family-beta',
          proposition: { note: 'cap trouble' },
          contradictsClaimIds: ['rec-000001'],
        }),
      ),
    ); // rec-000003
    expect(contra.world.information.claims[1]!.contradictsClaimIds).toEqual([
      'rec-000001',
    ]);
    const next = okResult(
      r.run(
        belief(NF.gm, NF.org, ['rec-000003'], {
          assessment: { rating: 'shaky' },
          supersedesBeliefId: 'rec-000002',
        }),
      ),
    );
    expect(next.events.map((e) => e.type)).toEqual(['BeliefFormed']);
    const beliefs = next.world.information.beliefs;
    expect(beliefs).toHaveLength(2);
    expect(canonicalString(beliefs[0])).toBe(originalBytes);
    expect(canonicalString(next.world.information.claims[0])).toBe(
      originalClaim,
    );
    expect(beliefs[1]).toMatchObject({
      id: 'rec-000004',
      supersedesBeliefId: 'rec-000002',
      evidenceClaimIds: ['rec-000003'],
    });
  });

  it('refuses evidence that does not exist or is not legitimately visible', () => {
    const r = setup();
    okResult(r.run(claim(SP.scout, SP.org))); // rec-000003, Southport-private
    const before = snapshotOf(r.kernel);
    for (const evidence of [
      [],
      ['rec-000999'],
      ['rec-000003'],
      ['rec-000001', 'rec-000001'],
    ])
      expect(codeOf(r.run(belief(NF.gm, NF.org, evidence)))).toBe(
        'INVALID_PAYLOAD',
      );
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('supersession must continue the same organization, subject and a still-current belief', () => {
    const r = setup();
    okResult(r.run(claim(SP.scout, SP.org))); // rec-000003, Southport-private
    okResult(r.run(belief(SP.gm, SP.org, ['rec-000003']))); // rec-000004
    const before = snapshotOf(r.kernel);
    const supersede = (extra: Record<string, unknown>) =>
      codeOf(r.run(belief(NF.gm, NF.org, ['rec-000001'], extra)));
    // Another organization's belief is invisible, so it cannot be continued.
    expect(supersede({ supersedesBeliefId: 'rec-000004' })).toBe(
      'INVALID_PAYLOAD',
    );
    expect(supersede({ supersedesBeliefId: 'rec-000999' })).toBe(
      'INVALID_PAYLOAD',
    );
    // A chain stays about one subject.
    expect(
      supersede({
        supersedesBeliefId: 'rec-000002',
        subject: { kind: 'entity', id: 'org-northfield' },
      }),
    ).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);

    okResult(
      r.run(
        belief(NF.gm, NF.org, ['rec-000001'], {
          supersedesBeliefId: 'rec-000002',
        }),
      ),
    );
    // The chain has one head: an already superseded belief cannot be superseded again.
    expect(supersede({ supersedesBeliefId: 'rec-000002' })).toBe(
      'INVALID_PAYLOAD',
    );
  });

  it('a person outside the organization cannot even cite its evidence', () => {
    const r = setup();
    const before = snapshotOf(r.kernel);
    expect(codeOf(r.run(belief(SP.gm, NF.org, ['rec-000001'])))).toBe(
      'INVALID_PAYLOAD',
    );
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('needs the advise right, independent of every other right', () => {
    const r = setup();
    okResult(
      r.run({
        type: 'RevokeAuthority',
        actingPersonId: NF.owner,
        grantId: 'grant-nf-scout-plan',
      }),
    );
    okResult(
      r.run({
        type: 'GrantAuthority',
        organizationId: NF.org,
        actingPersonId: NF.owner,
        personId: NF.scout,
        category: 'organizational_plan',
        rights: ['propose', 'communicate'],
        transferable: false,
      }),
    );
    const before = snapshotOf(r.kernel);
    const res = r.run(belief(NF.scout, NF.org, ['rec-000001']));
    expect(codeOf(res)).toBe('INSUFFICIENT_AUTHORITY');
    expect(messageOf(res)).toContain('advise');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });
});

describe('invariants shared by the information commands', () => {
  const prepare = (r: ReturnType<typeof runnerFor>) => {
    okResult(r.run(claim(NF.scout, NF.org)));
  };
  const commands: Record<string, unknown>[] = [
    claim(NF.owner, NF.org, { sourceFamilyId: 'family-gamma' }),
    share(NF.owner, NF.org, 'rec-000001', SP.org),
    belief(NF.gm, NF.org, ['rec-000001']),
  ];

  it('stale and duplicate commands change nothing and draw no RNG', () => {
    for (const command of commands) {
      const r = runnerFor();
      prepare(r);
      const before = snapshotOf(r.kernel);
      expect(codeOf(r.run(command, 'test_harness', 9))).toBe('STALE_REVISION');
      expect(snapshotOf(r.kernel)).toEqual(before);
      okResult(r.run(command));
      const after = snapshotOf(r.kernel);
      const dup = r.kernel.execute({
        commandId: 'cmd-000003',
        expectedRevision: 1,
        actor: { kind: 'test_harness', id: 'actor-1' },
        command,
      } as never);
      expect(dup.ok).toBe(false);
      expect(snapshotOf(r.kernel)).toEqual(after);
      expect(r.kernel.world.rng.draws).toBe(0);
    }
  });

  it('a fault after resolution commits nothing', () => {
    for (const command of commands) {
      let armed = false;
      const kernel: WorldKernel = newOrgKernel({
        beforeCommit: () => {
          if (armed) throw new Error('injected fault');
        },
      });
      const r = runnerFor(kernel);
      prepare(r);
      const before = snapshotOf(kernel);
      armed = true;
      expect(codeOf(r.run(command))).toBe('INTERNAL_ERROR');
      expect(snapshotOf(kernel)).toEqual(before);
    }
  });

  it('keeps claims and beliefs sorted by id', () => {
    const r = runnerFor();
    prepare(r);
    for (const c of commands) okResult(r.run(c));
    const { claims, beliefs } = r.kernel.world.information;
    const ids = (xs: readonly { id: string }[]) => xs.map((x) => x.id);
    expect(ids(claims)).toEqual([...ids(claims)].sort());
    expect(ids(beliefs)).toEqual([...ids(beliefs)].sort());
  });
});
