import { describe, expect, it } from 'vitest';
import { newPackageDKernel } from './support/packageDHarness';
import type { ExecuteResult } from '../src/index';
import {
  ACQ_TERMS,
  C_TODAY,
  NF,
  SP,
  domainCommitCommand,
  newPackageCKernel,
  request,
  submitDomain,
  testDomainRouter,
} from './support/packageCHarness';
import {
  codeOf,
  messageOf,
  okResult,
  runnerFor,
  snapshotOf,
  type Runner,
} from './support/orgHarness';

const fresh = (options = {}): Runner =>
  runnerFor(newPackageCKernel({ testRouter: testDomainRouter, ...options }));

const lastProposalId = (r: Runner) =>
  r.kernel.world.decisions.proposals.at(-1)!.id;

const submitNf = (r: Runner, category = 'acquisition', extra = {}) =>
  okResult(r.run(submitDomain(NF.org, NF.gm, category, extra)));

const commitNf = (
  r: Runner,
  extra: Record<string, unknown> = {},
  proposalId = lastProposalId(r),
  terms: Record<string, unknown> = ACQ_TERMS,
) =>
  r.run(
    domainCommitCommand([request(NF.org, NF.gm, proposalId, terms, extra)]),
  );

const types = (res: ExecuteResult) =>
  res.ok ? res.events.map((e) => e.type) : [];

describe('Package C proposal categories', () => {
  it('accepts acquisition, contract, roster and major_trade proposals', () => {
    const r = fresh();
    for (const category of [
      'acquisition',
      'contract',
      'roster',
      'major_trade',
    ]) {
      const res = submitNf(r, category);
      expect(types(res)[0]).toBe('ProposalSubmitted');
      expect(r.kernel.world.decisions.proposals.at(-1)!.category).toBe(
        category,
      );
      expect(r.kernel.world.decisions.proposals.at(-1)!.state).toBe(
        'authorized',
      );
    }
  });

  it('keeps the staff-hiring category reserved (game-day activation opened in Package E)', () => {
    const r = fresh();
    for (const category of ['staff_hiring']) {
      const before = snapshotOf(r.kernel);
      const res = r.run(submitDomain(NF.org, NF.gm, category));
      expect(codeOf(res)).toBe('INVALID_PAYLOAD');
      expect(messageOf(res)).toContain('not available in this package');
      expect(snapshotOf(r.kernel)).toEqual(before);
    }
  });
});

describe('authorized domain commit: revalidation at commit time', () => {
  it('rejects a stale proposal revision', () => {
    const r = fresh();
    submitNf(r);
    const id = lastProposalId(r);
    okResult(
      r.run({
        type: 'ReviseProposal',
        actingPersonId: NF.gm,
        proposalId: id,
        expectedRevision: 1,
        terms: { amount: 400, unit: 'synthetic_units' },
      }),
    );
    const before = snapshotOf(r.kernel);
    const res = commitNf(r, {}, id);
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('stale');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('rejects executed terms that differ from the authorized terms', () => {
    const r = fresh();
    submitNf(r);
    const before = snapshotOf(r.kernel);
    const res = commitNf(r, {}, lastProposalId(r), {
      amount: 501,
      unit: 'synthetic_units',
    });
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('differ');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('rejects a different category, organization or terms type than the proposal', () => {
    const r = fresh();
    submitNf(r);
    const id = lastProposalId(r);
    const before = snapshotOf(r.kernel);
    expect(
      messageOf(commitNf(r, { expectedCategory: 'contract' }, id)),
    ).toContain('category');
    expect(
      messageOf(
        r.run(domainCommitCommand([request(SP.org, SP.gm, id, ACQ_TERMS)])),
      ),
    ).toContain('belongs to');
    expect(
      messageOf(
        commitNf(
          r,
          { executedTerms: { termsType: 'other', terms: ACQ_TERMS } },
          id,
        ),
      ),
    ).toContain('termsType');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('rejects a category outside the domain transaction set', () => {
    const r = fresh();
    submitNf(r, 'organizational_plan');
    const before = snapshotOf(r.kernel);
    const res = commitNf(r, { expectedCategory: 'organizational_plan' });
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('not a domain transaction category');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('rejects when execute authority was revoked after authorization', () => {
    const r = fresh();
    submitNf(r);
    const grant = r.kernel.world.authority.grants.find(
      (g) =>
        g.personId === NF.gm &&
        g.category === 'acquisition' &&
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
    const res = commitNf(r);
    expect(codeOf(res)).toBe('INSUFFICIENT_AUTHORITY');
    expect(snapshotOf(r.kernel)).toEqual(before);
    expect(r.kernel.world.decisions.receipts).toHaveLength(0);
    expect(r.kernel.world.decisions.proposals.at(-1)!.state).toBe('authorized');
  });

  it('rejects an expired proposal', () => {
    const r = fresh();
    submitNf(r, 'acquisition', { expiresAt: '2027-02-17' });
    okResult(r.run({ type: 'AdvanceDays', days: 3 }));
    const before = snapshotOf(r.kernel);
    const res = commitNf(r);
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('expired');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('rejects cited knowledge the committing organization cannot see', () => {
    const r = fresh();
    okResult(
      r.run({
        type: 'RecordClaim',
        organizationId: SP.org,
        actingPersonId: SP.scout,
        subject: { kind: 'entity', id: 'player-fa-01' },
        propositionType: 'scouting_note',
        proposition: { note: 'rival private note' },
        sourceFamilyId: 'family-alpha',
        observedAt: C_TODAY,
        visibility: 'organization',
        confidence: 'medium',
        possibleBias: null,
        corroboratesClaimIds: [],
        contradictsClaimIds: [],
      }),
    );
    const hidden = r.kernel.world.information.claims.at(-1)!.id;
    submitNf(r);
    const before = snapshotOf(r.kernel);
    const res = commitNf(r, { evidenceClaimIds: [hidden] });
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('evidenceClaimIds');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('rejects a change a protected constraint forbids', () => {
    const r = fresh();
    okResult(
      r.run({
        type: 'CreateProtectedConstraint',
        organizationId: NF.org,
        actingPersonId: NF.owner,
        subject: { playerId: 'player-fa-01' },
        prohibitedChange: { kind: 'acquire' },
        amendableByPersonIds: [NF.owner],
      }),
    );
    submitNf(r);
    const before = snapshotOf(r.kernel);
    const res = commitNf(r, {
      protectedChange: {
        subject: { playerId: 'player-fa-01' },
        change: { kind: 'acquire' },
      },
    });
    expect(codeOf(res)).toBe('PROTECTED_CONSTRAINT');
    expect(snapshotOf(r.kernel)).toEqual(before);

    // The same transaction touching an unprotected subject is not blocked.
    okResult(
      commitNf(r, {
        protectedChange: {
          subject: { playerId: 'player-fa-02' },
          change: { kind: 'acquire' },
        },
      }),
    );
  });
});

describe('authorized domain commit: mandates', () => {
  const delegateExecute = (r: Runner) =>
    okResult(
      r.run({
        type: 'CreateMandate',
        organizationId: NF.org,
        actingPersonId: NF.owner,
        delegatePersonId: NF.scout,
        category: 'acquisition',
        scope: { scopeKeys: ['free_agent'] },
        hardConstraints: { unit: 'synthetic_units', maxAmount: 100 },
        preferences: {},
        allowedRights: ['execute'],
        fallback: {},
        escalationRules: { onExceedsHardConstraint: 'escalate' },
      }),
    );

  const commitAsScout = (r: Runner, extra: Record<string, unknown>) =>
    r.run(
      domainCommitCommand([
        request(NF.org, NF.scout, lastProposalId(r), ACQ_TERMS, extra),
      ]),
    );

  it('rejects a commit over the mandate hard limit and records nothing', () => {
    const r = fresh();
    delegateExecute(r);
    submitNf(r);
    const before = snapshotOf(r.kernel);
    const res = commitAsScout(r, {
      mandateUsage: {
        unit: 'synthetic_units',
        amount: 500,
        scopeKey: 'free_agent',
      },
    });
    expect(codeOf(res)).toBe('INSUFFICIENT_AUTHORITY');
    expect(messageOf(res)).toContain('escalation required');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('requires a usage declaration when executing under a mandate', () => {
    const r = fresh();
    delegateExecute(r);
    submitNf(r);
    const res = commitAsScout(r, {});
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('mandateUsage');
  });

  it('commits within the mandate and the receipt cites the mandate', () => {
    const r = fresh();
    okResult(
      r.run({
        type: 'CreateMandate',
        organizationId: NF.org,
        actingPersonId: NF.owner,
        delegatePersonId: NF.scout,
        category: 'acquisition',
        scope: { scopeKeys: ['free_agent'] },
        hardConstraints: { unit: 'synthetic_units', maxAmount: 1000 },
        preferences: {},
        allowedRights: ['execute'],
        fallback: {},
        escalationRules: { onExceedsHardConstraint: 'reject' },
      }),
    );
    submitNf(r);
    const res = okResult(
      commitAsScout(r, {
        mandateUsage: {
          unit: 'synthetic_units',
          amount: 500,
          scopeKey: 'free_agent',
        },
      }),
    );
    const receipt = res.world.decisions.receipts[0]!;
    expect(receipt.mandateId).toBe(r.kernel.world.authority.mandates[0]!.id);
    expect(receipt.actorPersonId).toBe(NF.scout);
  });
});

describe('authorized domain commit: receipts', () => {
  it('commits the proposal and appends one immutable receipt atomically', () => {
    const r = fresh();
    submitNf(r);
    const id = lastProposalId(r);
    const res = okResult(commitNf(r));
    expect(types(res)).toEqual([
      'TestDomainApplied',
      'ProposalCommitted',
      'DecisionReceiptRecorded',
    ]);
    const w = res.world;
    expect(w.decisions.proposals.find((p) => p.id === id)!.state).toBe(
      'committed',
    );
    expect(w.decisions.receipts).toHaveLength(1);
    const receipt = w.decisions.receipts[0]!;
    expect(receipt.proposalId).toBe(id);
    expect(receipt.executedTermsHash).toBe(
      w.decisions.proposals.find((p) => p.id === id)!.termsHash,
    );
    expect(receipt.outcomeEventIds).toEqual(res.events.map((e) => e.eventId));
    expect(w.rng.draws).toBe(0);

    // The committed proposal can never commit twice.
    const again = commitNf(r, {}, id);
    expect(codeOf(again)).toBe('INVALID_PAYLOAD');
    expect(messageOf(again)).toContain('committed');
    expect(r.kernel.world.decisions.receipts).toHaveLength(1);
  });

  it('commits both organizations of a trade with two receipts in one resolution', () => {
    const r = fresh();
    submitNf(r, 'major_trade');
    okResult(r.run(submitDomain(SP.org, SP.gm, 'major_trade')));
    const ids = r.kernel.world.decisions.proposals.map((p) => p.id);
    expect(ids).toHaveLength(2);
    const res = okResult(
      r.run(
        domainCommitCommand([
          request(NF.org, NF.gm, ids[0]!, ACQ_TERMS, {
            expectedCategory: 'major_trade',
          }),
          request(SP.org, SP.gm, ids[1]!, ACQ_TERMS, {
            expectedCategory: 'major_trade',
          }),
        ]),
      ),
    );
    expect(types(res)).toEqual([
      'TestDomainApplied',
      'ProposalCommitted',
      'DecisionReceiptRecorded',
      'ProposalCommitted',
      'DecisionReceiptRecorded',
    ]);
    const receipts = res.world.decisions.receipts;
    expect(receipts).toHaveLength(2);
    const allEvents = res.events.map((e) => e.eventId);
    for (const receipt of receipts)
      expect(receipt.outcomeEventIds).toEqual(allEvents);
    expect(receipts.map((x) => x.proposalId).sort()).toEqual([...ids].sort());
    expect(
      res.world.decisions.proposals.every((p) => p.state === 'committed'),
    ).toBe(true);
  });

  it('commits neither side of a trade when one side fails revalidation', () => {
    const r = fresh();
    submitNf(r, 'major_trade');
    okResult(r.run(submitDomain(SP.org, SP.gm, 'major_trade')));
    const ids = r.kernel.world.decisions.proposals.map((p) => p.id);
    const before = snapshotOf(r.kernel);
    const res = r.run(
      domainCommitCommand([
        request(NF.org, NF.gm, ids[0]!, ACQ_TERMS, {
          expectedCategory: 'major_trade',
        }),
        request(
          SP.org,
          SP.gm,
          ids[1]!,
          { amount: 1, unit: 'synthetic_units' },
          { expectedCategory: 'major_trade' },
        ),
      ]),
    );
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);
    expect(r.kernel.world.decisions.receipts).toHaveLength(0);
  });

  it('rejects an empty request list and a proposal listed twice', () => {
    const r = fresh();
    submitNf(r);
    const id = lastProposalId(r);
    const before = snapshotOf(r.kernel);
    expect(codeOf(r.run(domainCommitCommand([])))).toBe('INVALID_PAYLOAD');
    const dup = r.run(
      domainCommitCommand([
        request(NF.org, NF.gm, id, ACQ_TERMS),
        request(NF.org, NF.gm, id, ACQ_TERMS),
      ]),
    );
    expect(codeOf(dup)).toBe('INVALID_PAYLOAD');
    expect(messageOf(dup)).toContain('twice');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });
});

describe('authorized domain commit: fault injection', () => {
  it('a fault before the atomic commit leaves domain, proposal, receipt, RNG and chain unchanged', () => {
    let armed = false;
    const r = fresh({
      beforeCommit: () => {
        if (armed) throw new Error('injected fault');
      },
    });
    submitNf(r);
    const before = snapshotOf(r.kernel);
    const worldBefore = r.kernel.world;
    armed = true;
    const res = commitNf(r);
    expect(codeOf(res)).toBe('INTERNAL_ERROR');
    expect(snapshotOf(r.kernel)).toEqual(before);
    expect(r.kernel.world).toBe(worldBefore);
    expect(r.kernel.world.decisions.receipts).toHaveLength(0);
    expect(r.kernel.world.decisions.proposals.at(-1)!.state).toBe('authorized');

    // After the fault clears, the very same commit succeeds from the unchanged state.
    armed = false;
    okResult(commitNf(r));
    expect(r.kernel.world.decisions.receipts).toHaveLength(1);
  });
});

describe('Package D domain categories use the same authorized commit adapter', () => {
  it.each(['workload_usage', 'medical_clearance', 'scheme'])(
    'accepts and commits authorized %s terms',
    (category) => {
      const r = runnerFor(newPackageDKernel({ testRouter: testDomainRouter }));
      okResult(r.run(submitDomain(NF.org, NF.owner, category)));
      const proposalId = lastProposalId(r);
      okResult(
        r.run(
          domainCommitCommand([
            request(NF.org, NF.owner, proposalId, ACQ_TERMS, {
              expectedCategory: category,
            }),
          ]),
        ),
      );
      expect(r.kernel.world.decisions.receipts.at(-1)!.proposalId).toBe(
        proposalId,
      );
    },
  );
});
