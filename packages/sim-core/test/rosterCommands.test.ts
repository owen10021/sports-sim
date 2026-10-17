import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_C_RULESET,
  requireTransactionRules,
  rosterInvariantFindings,
  type ExecuteResult,
} from '../src/index';
import { NF, SP, newPackageCKernel } from './support/packageCHarness';
import {
  codeOf,
  messageOf,
  okResult,
  runnerFor,
  snapshotOf,
  type Runner,
} from './support/orgHarness';

const fresh = (options = {}): Runner => runnerFor(newPackageCKernel(options));

const TERMS_TYPE = 'roster_status_v1';

const submitStatus = (
  r: Runner,
  org: string,
  by: string,
  playerId: string,
  action: string,
  extra: Record<string, unknown> = {},
) =>
  okResult(
    r.run({
      type: 'SubmitProposal',
      organizationId: org,
      actingPersonId: by,
      category: 'roster',
      subjects: [{ kind: 'entity', id: playerId }],
      termsType: TERMS_TYPE,
      terms: { playerId, action },
      requiredApproverPersonIds: [],
      expiresAt: null,
      contingencies: {},
      ...extra,
    }),
  );

const lastProposalId = (r: Runner) =>
  r.kernel.world.decisions.proposals.at(-1)!.id;

const commit = (
  r: Runner,
  by: string,
  proposalId = lastProposalId(r),
  extra: Record<string, unknown> = {},
  expectedRevision = 1,
) =>
  r.run({
    type: 'CommitRosterStatusProposal',
    actingPersonId: by,
    proposalId,
    expectedRevision,
    beliefIds: [],
    evidenceClaimIds: [],
    rationale: { note: 'adjust the roster' },
    ...extra,
  });

const move = (
  r: Runner,
  playerId: string,
  action: string,
  org = NF.org,
  by = NF.gm,
) => {
  submitStatus(r, org, by, playerId, action);
  return commit(r, by);
};

const types = (res: ExecuteResult) =>
  res.ok ? res.events.map((e) => e.type) : [];

const statusOf = (r: Runner, playerId: string) =>
  r.kernel.world.roster.memberships.find(
    (m) => m.playerId === playerId && m.effectiveUntil === null,
  )?.status;

describe('CommitRosterStatusProposal', () => {
  it('moves a player between statuses, closing the old membership and opening a new one', () => {
    const r = fresh();
    const rightsBefore = r.kernel.world.roster.rights;
    const res = okResult(move(r, 'player-nf-01', 'active_to_reserve'));
    expect(types(res)).toEqual([
      'RosterStatusChanged',
      'ProposalCommitted',
      'DecisionReceiptRecorded',
    ]);
    const mems = res.world.roster.memberships.filter(
      (m) => m.playerId === 'player-nf-01',
    );
    expect(mems).toHaveLength(2);
    const old = mems.find((m) => m.status === 'active')!;
    const next = mems.find((m) => m.status === 'reserve')!;
    expect(old.effectiveUntil).toBe('2027-02-14');
    expect(next.effectiveFrom).toBe('2027-02-15');
    expect(next.effectiveUntil).toBe(null);
    expect(next.sourceRecordId).toBe(res.world.decisions.proposals[0]!.id);
    expect(res.world.roster.rights).toEqual(rightsBefore);
    expect(res.world.rng.draws).toBe(0);
    expect(res.world.decisions.receipts).toHaveLength(1);
  });

  it('supports every allowed transition', () => {
    const r = fresh();
    okResult(move(r, 'player-nf-04', 'reserve_to_active'));
    expect(statusOf(r, 'player-nf-04')).toBe('active');
    okResult(move(r, 'player-nf-05', 'practice_squad_to_active'));
    expect(statusOf(r, 'player-nf-05')).toBe('active');
    okResult(
      move(r, 'player-sp-05', 'practice_squad_to_reserve', SP.org, SP.gm),
    );
    expect(statusOf(r, 'player-sp-05')).toBe('reserve');
  });

  it('never demotes an active or reserve player straight to the practice squad', () => {
    const r = fresh();
    submitStatus(r, NF.org, NF.gm, 'player-nf-01', 'active_to_practice_squad');
    const before = snapshotOf(r.kernel);
    const res = commit(r, NF.gm);
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('action');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('enforces capacity exactly at the boundary', () => {
    const r = fresh();
    // Reserve limit is 4 and Northfield already carries 1.
    for (const p of ['player-nf-01', 'player-nf-02', 'player-nf-03'])
      okResult(move(r, p, 'active_to_reserve'));
    expect(
      r.kernel.world.roster.memberships.filter(
        (m) =>
          m.organizationId === NF.org &&
          m.status === 'reserve' &&
          m.effectiveUntil === null,
      ),
    ).toHaveLength(4);
    submitStatus(r, NF.org, NF.gm, 'player-nf-05', 'practice_squad_to_reserve');
    const before = snapshotOf(r.kernel);
    const res = commit(r, NF.gm);
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('capacity');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('refuses a second status change for a membership that began today', () => {
    const r = fresh();
    okResult(move(r, 'player-nf-01', 'active_to_reserve'));
    submitStatus(r, NF.org, NF.gm, 'player-nf-01', 'reserve_to_active');
    const before = snapshotOf(r.kernel);
    const res = commit(r, NF.gm);
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('began today');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('rejects a player the organization does not hold on its roster', () => {
    const r = fresh();
    for (const [org, by, player, action, expected] of [
      [SP.org, SP.gm, 'player-nf-01', 'active_to_reserve', 'roster'],
      [NF.org, NF.gm, 'player-fa-01', 'active_to_reserve', 'roster'],
      [NF.org, NF.gm, 'player-eb-draftee', 'active_to_reserve', 'roster'],
      [NF.org, NF.gm, 'player-nf-01', 'reserve_to_active', 'status'],
    ] as const) {
      submitStatus(r, org, by, player, action);
      const before = snapshotOf(r.kernel);
      const res = commit(r, by);
      expect(codeOf(res)).toBe('INVALID_PAYLOAD');
      expect(messageOf(res)).toContain(expected);
      expect(snapshotOf(r.kernel)).toEqual(before);
    }
  });

  it('only commits an authorized roster_status_v1 proposal in the roster category', () => {
    const r = fresh();
    okResult(
      r.run({
        type: 'SubmitProposal',
        organizationId: NF.org,
        actingPersonId: NF.gm,
        category: 'roster',
        subjects: [{ kind: 'entity', id: 'player-nf-01' }],
        termsType: 'other_terms',
        terms: { playerId: 'player-nf-01', action: 'active_to_reserve' },
        requiredApproverPersonIds: [],
        expiresAt: null,
        contingencies: {},
      }),
    );
    const res = commit(r, NF.gm);
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain(TERMS_TYPE);

    // Awaiting approval does not commit either.
    submitStatus(r, NF.org, NF.gm, 'player-nf-01', 'active_to_reserve', {
      requiredApproverPersonIds: [NF.owner],
    });
    const awaiting = commit(r, NF.gm);
    expect(codeOf(awaiting)).toBe('INVALID_PAYLOAD');
  });

  it('rejects a stale revision', () => {
    const r = fresh();
    submitStatus(r, NF.org, NF.gm, 'player-nf-01', 'active_to_reserve');
    const id = lastProposalId(r);
    okResult(
      r.run({
        type: 'ReviseProposal',
        actingPersonId: NF.gm,
        proposalId: id,
        expectedRevision: 1,
        terms: {
          playerId: 'player-nf-01',
          action: 'active_to_reserve',
          note: 'x',
        },
      }),
    );
    const before = snapshotOf(r.kernel);
    const res = commit(r, NF.gm, id, {}, 1);
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('stale');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('rejects when execute authority was revoked after authorization', () => {
    const r = fresh();
    submitStatus(r, NF.org, NF.gm, 'player-nf-01', 'active_to_reserve');
    const grant = r.kernel.world.authority.grants.find(
      (g) =>
        g.personId === NF.gm &&
        g.category === 'roster' &&
        g.rights.includes('execute'),
    )!;
    okResult(
      r.run({
        type: 'RevokeAuthority',
        actingPersonId: NF.owner,
        grantId: grant.id,
      }),
    );
    const before = snapshotOf(r.kernel);
    expect(codeOf(commit(r, NF.gm))).toBe('INSUFFICIENT_AUTHORITY');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('honors a protected-player constraint', () => {
    const r = fresh();
    okResult(
      r.run({
        type: 'CreateProtectedConstraint',
        organizationId: NF.org,
        actingPersonId: NF.owner,
        subject: { playerId: 'player-nf-01' },
        prohibitedChange: {
          kind: 'roster_status',
          action: 'active_to_reserve',
        },
        amendableByPersonIds: [NF.owner],
      }),
    );
    submitStatus(r, NF.org, NF.gm, 'player-nf-01', 'active_to_reserve');
    const before = snapshotOf(r.kernel);
    expect(codeOf(commit(r, NF.gm))).toBe('PROTECTED_CONSTRAINT');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('an identical retry after commit changes nothing', () => {
    const r = fresh();
    submitStatus(r, NF.org, NF.gm, 'player-nf-01', 'active_to_reserve');
    const id = lastProposalId(r);
    okResult(commit(r, NF.gm, id));
    const after = snapshotOf(r.kernel);
    const retry = commit(r, NF.gm, id);
    expect(codeOf(retry)).toBe('INVALID_PAYLOAD');
    expect(messageOf(retry)).toContain('committed');
    expect(snapshotOf(r.kernel)).toEqual(after);
    expect(
      r.kernel.world.roster.memberships.filter(
        (m) => m.playerId === 'player-nf-01',
      ),
    ).toHaveLength(2);
  });

  it('cannot manufacture or transfer rights', () => {
    const r = fresh();
    const rights = r.kernel.world.roster.rights;
    okResult(move(r, 'player-nf-04', 'reserve_to_active'));
    okResult(move(r, 'player-nf-05', 'practice_squad_to_active'));
    expect(r.kernel.world.roster.rights).toBe(rights);
    // No status action can touch a player an organization holds only draft or exclusive rights to.
    for (const player of ['player-eb-draftee', 'player-wl-exclusive']) {
      const org = player.includes('eb') ? 'org-eastbrook' : 'org-westlake';
      const by = player.includes('eb') ? 'person-eb-gm' : 'person-wl-gm';
      submitStatus(r, org, by, player, 'practice_squad_to_active');
      expect(codeOf(commit(r, by))).toBe('INVALID_PAYLOAD');
    }
    expect(r.kernel.world.roster.rights).toBe(rights);
  });

  it('a fault before the atomic commit leaves everything unchanged', () => {
    let armed = false;
    const r = fresh({
      beforeCommit: () => {
        if (armed) throw new Error('injected fault');
      },
    });
    submitStatus(r, NF.org, NF.gm, 'player-nf-01', 'active_to_reserve');
    const before = snapshotOf(r.kernel);
    const worldBefore = r.kernel.world;
    armed = true;
    expect(codeOf(commit(r, NF.gm))).toBe('INTERNAL_ERROR');
    expect(snapshotOf(r.kernel)).toEqual(before);
    expect(r.kernel.world).toBe(worldBefore);
    armed = false;
    okResult(commit(r, NF.gm));
    expect(statusOf(r, 'player-nf-01')).toBe('reserve');
  });

  it('keeps the roster invariant clean after every accepted transition', () => {
    const r = fresh();
    okResult(move(r, 'player-nf-01', 'active_to_reserve'));
    okResult(move(r, 'player-nf-05', 'practice_squad_to_active'));
    okResult(move(r, 'player-sp-04', 'reserve_to_active', SP.org, SP.gm));
    const w = r.kernel.world;
    expect(w.roster.rights).toEqual(newPackageCKernel().world.roster.rights);
    expect(
      rosterInvariantFindings(
        w.roster,
        requireTransactionRules(SYNTHETIC_PACKAGE_C_RULESET),
        w.simDate,
      ),
    ).toEqual([]);
  });
});
