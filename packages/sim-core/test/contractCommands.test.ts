import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_C_RULESET,
  capPosition,
  currentRightsHolder,
  currentRosterMembership,
  entityId,
  requireTransactionRules,
  rosterInvariantFindings,
  type ExecuteResult,
} from '../src/index';
import {
  NF,
  SP,
  newNoWaiverKernel,
  newPackageCKernel,
} from './support/packageCHarness';
import {
  codeOf,
  messageOf,
  okResult,
  runnerFor,
  snapshotOf,
  type Runner,
} from './support/orgHarness';

const TX = requireTransactionRules(SYNTHETIC_PACKAGE_C_RULESET);
const TERMS_TYPE = 'release_player_v1';

const fresh = (options = {}): Runner => runnerFor(newNoWaiverKernel(options));

const submitRelease = (
  r: Runner,
  org: string,
  by: string,
  playerId: string,
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
      terms: { playerId },
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
  expectedRevision = 1,
): ExecuteResult =>
  r.run({
    type: 'CommitReleaseProposal',
    actingPersonId: by,
    proposalId,
    expectedRevision,
    beliefIds: [],
    evidenceClaimIds: [],
    rationale: { note: 'release the player' },
  });

const release = (r: Runner, playerId: string, org = NF.org, by = NF.gm) => {
  submitRelease(r, org, by, playerId);
  return commit(r, by);
};

const types = (res: ExecuteResult) =>
  res.ok ? res.events.map((e) => e.type) : [];

const TODAY = '2027-02-15';

describe('seeded contracts', () => {
  it('give every rostered player an active contract and keep every club under the cap', () => {
    const w = newPackageCKernel().world;
    expect(w.contracts.agreements).toHaveLength(18);
    for (const org of [NF.org, SP.org])
      for (const season of [2026, 2027, 2028, 2029, 2030])
        expect(capPosition(TX, w.contracts, org, season).space).toBeGreaterThan(
          0,
        );
    // Hand-calculated Northfield 2027 commitments: 245000+250000+275000+290000+25000.
    expect(capPosition(TX, w.contracts, NF.org, 2027).committed).toBe(
      1_085_000,
    );
    expect(capPosition(TX, w.contracts, NF.org, 2028).committed).toBe(800_000);
  });
});

describe('CommitReleaseProposal under a waive-all ruleset', () => {
  it('refuses to shortcut a release into free agency', () => {
    const r = runnerFor(newPackageCKernel());
    submitRelease(r, NF.org, NF.gm, 'player-nf-01');
    const before = snapshotOf(r.kernel);
    const res = commit(r, NF.gm);
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('waivers');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });
});

describe('CommitReleaseProposal', () => {
  it('terminates the contract, records the surviving obligations and frees the player atomically', () => {
    const r = fresh();
    const res = okResult(release(r, 'player-nf-01'));
    expect(types(res)).toEqual([
      'ContractTerminated',
      'PlayerReleased',
      'ProposalCommitted',
      'DecisionReceiptRecorded',
    ]);
    const w = res.world;
    // Hand calculation, 2027 release of a 2026-2028 deal (bonus 150000 -> 50000 a year;
    // 2027 base 185000 half guaranteed = 92500; 2028 guarantee 0):
    //   dead cap 2027 = 50000 + 92500 = 142500; 2028 = 50000; cash due = 92500.
    expect(w.contracts.terminations).toEqual([
      {
        id: 'rec-000002',
        agreementId: 'contract-seed-player-nf-01',
        organizationId: NF.org,
        playerId: 'player-nf-01',
        terminatedAt: TODAY,
        reason: 'release',
        deadCapBySeason: [
          { season: 2027, amount: 142_500 },
          { season: 2028, amount: 50_000 },
        ],
        guaranteedCashDue: 92_500,
      },
    ]);
    expect(
      w.contracts.agreements.find((a) => a.id === 'contract-seed-player-nf-01')!
        .status,
    ).toBe('terminated');
    const player = entityId('player-nf-01');
    expect(currentRosterMembership(w.roster, player, TODAY)).toBe(undefined);
    expect(currentRightsHolder(w.roster, player, TODAY)).toBe(undefined);
    // History is preserved: the old records are closed, not deleted.
    expect(
      w.roster.memberships.find((m) => m.playerId === player)!.effectiveUntil,
    ).toBe('2027-02-14');
    expect(
      w.roster.rights.find((x) => x.playerId === player)!.effectiveUntil,
    ).toBe('2027-02-14');
    expect(rosterInvariantFindings(w.roster, TX, TODAY)).toEqual([]);
    expect(w.rng.draws).toBe(0);
    expect(w.decisions.receipts).toHaveLength(1);
  });

  it('keeps future and dead obligations on the books after the release', () => {
    const r = fresh();
    okResult(release(r, 'player-nf-01'));
    const w = r.kernel.world;
    // 2027: 1,085,000 - released charge 245,000 + dead 142,500 = 982,500.
    expect(capPosition(TX, w.contracts, NF.org, 2027).committed).toBe(982_500);
    // 2028: 800,000 - released charge 255,000 + dead 50,000 = 595,000.
    expect(capPosition(TX, w.contracts, NF.org, 2028).committed).toBe(595_000);
    // A release never erases money: committed never drops below the dead cap it created.
    expect(capPosition(TX, w.contracts, NF.org, 2029).committed).toBe(0);
  });

  it('owes nothing beyond the unguaranteed minimum for a practice-squad contract', () => {
    const r = fresh();
    const res = okResult(release(r, 'player-nf-05'));
    expect(res.world.contracts.terminations[0]).toMatchObject({
      deadCapBySeason: [],
      guaranteedCashDue: 0,
    });
  });

  it('rejects a player the organization does not hold', () => {
    const r = fresh();
    for (const [org, by, player] of [
      [SP.org, SP.gm, 'player-nf-01'],
      [NF.org, NF.gm, 'player-fa-01'],
      [NF.org, NF.gm, 'player-eb-draftee'],
    ] as const) {
      submitRelease(r, org, by, player);
      const before = snapshotOf(r.kernel);
      const res = commit(r, by);
      expect(codeOf(res)).toBe('INVALID_PAYLOAD');
      expect(messageOf(res)).toContain('roster');
      expect(snapshotOf(r.kernel)).toEqual(before);
    }
  });

  it('only commits an authorized release_player_v1 proposal in the roster category', () => {
    const r = fresh();
    okResult(
      r.run({
        type: 'SubmitProposal',
        organizationId: NF.org,
        actingPersonId: NF.gm,
        category: 'roster',
        subjects: [{ kind: 'entity', id: 'player-nf-01' }],
        termsType: 'other_terms',
        terms: { playerId: 'player-nf-01' },
        requiredApproverPersonIds: [],
        expiresAt: null,
        contingencies: {},
      }),
    );
    expect(messageOf(commit(r, NF.gm))).toContain(TERMS_TYPE);
    submitRelease(r, NF.org, NF.gm, 'player-nf-01', {
      requiredApproverPersonIds: [NF.owner],
    });
    const res = commit(r, NF.gm);
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('awaiting_approval');
  });

  it('rejects a stale revision', () => {
    const r = fresh();
    submitRelease(r, NF.org, NF.gm, 'player-nf-01');
    const id = lastProposalId(r);
    okResult(
      r.run({
        type: 'ReviseProposal',
        actingPersonId: NF.gm,
        proposalId: id,
        expectedRevision: 1,
        terms: { playerId: 'player-nf-01', note: 'x' },
      }),
    );
    const before = snapshotOf(r.kernel);
    const res = commit(r, NF.gm, id, 1);
    expect(messageOf(res)).toContain('stale');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('rejects when execute authority was revoked after authorization', () => {
    const r = fresh();
    submitRelease(r, NF.org, NF.gm, 'player-nf-01');
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
        prohibitedChange: { kind: 'release' },
        amendableByPersonIds: [NF.owner],
      }),
    );
    submitRelease(r, NF.org, NF.gm, 'player-nf-01');
    const before = snapshotOf(r.kernel);
    expect(codeOf(commit(r, NF.gm))).toBe('PROTECTED_CONSTRAINT');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('an identical retry after commit releases nobody twice', () => {
    const r = fresh();
    submitRelease(r, NF.org, NF.gm, 'player-nf-01');
    const id = lastProposalId(r);
    okResult(commit(r, NF.gm, id));
    const after = snapshotOf(r.kernel);
    const retry = commit(r, NF.gm, id);
    expect(messageOf(retry)).toContain('committed');
    expect(snapshotOf(r.kernel)).toEqual(after);
    expect(r.kernel.world.contracts.terminations).toHaveLength(1);
  });

  it('a fault before the atomic commit leaves contracts, roster and receipts untouched', () => {
    let armed = false;
    const r = fresh({
      beforeCommit: () => {
        if (armed) throw new Error('injected fault');
      },
    });
    submitRelease(r, NF.org, NF.gm, 'player-nf-01');
    const before = snapshotOf(r.kernel);
    const worldBefore = r.kernel.world;
    armed = true;
    expect(codeOf(commit(r, NF.gm))).toBe('INTERNAL_ERROR');
    expect(snapshotOf(r.kernel)).toEqual(before);
    expect(r.kernel.world).toBe(worldBefore);
    armed = false;
    okResult(commit(r, NF.gm));
    expect(r.kernel.world.contracts.terminations).toHaveLength(1);
  });
});
