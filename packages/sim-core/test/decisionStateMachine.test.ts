import { describe, expect, it } from 'vitest';
import {
  canonicalString,
  hashCanonical,
  type ExecuteResult,
  type FootballWorld,
} from '../src/index';
import {
  commitCommand,
  decisionCommand,
  reviseCommand,
  submitCommand,
  testCommitRouter,
} from './support/decisionHarness';
import {
  NF,
  TODAY,
  codeOf,
  messageOf,
  newOrgKernel,
  okResult,
  runnerFor,
  snapshotOf,
} from './support/orgHarness';

const fresh = () => runnerFor(newOrgKernel({ testRouter: testCommitRouter }));
const types = (res: ExecuteResult) =>
  res.ok ? res.events.map((e) => e.type) : [];
const proposals = (w: FootballWorld) => w.decisions.proposals;
const approvals = (w: FootballWorld) => w.decisions.approvals;

describe('submission and direct authorization', () => {
  it('goes straight from submitted to authorized when the author’s current rights make approval unnecessary', () => {
    const r = fresh();
    const res = okResult(r.run(submitCommand(NF.gm)));
    expect(types(res)).toEqual(['ProposalSubmitted', 'ProposalAuthorized']);
    expect(proposals(res.world)).toEqual([
      {
        id: 'rec-000001',
        revision: 1,
        organizationId: NF.org,
        authorPersonId: NF.gm,
        category: 'organizational_plan',
        subjects: [{ kind: 'entity', id: 'org-northfield' }],
        termsType: 'test_plan',
        terms: { budget: 100, unit: 'synthetic_units' },
        termsHash: hashCanonical({
          category: 'organizational_plan',
          subjects: [{ kind: 'entity', id: 'org-northfield' }],
          termsType: 'test_plan',
          terms: { budget: 100, unit: 'synthetic_units' },
        }),
        relevantWorldRevision: 0,
        requiredApproverPersonIds: [],
        expiresAt: null,
        contingencies: {},
        state: 'authorized',
        createdAt: TODAY,
        supersedesRevision: null,
      },
    ]);
    // No approval ceremony for its own sake.
    expect(approvals(res.world)).toEqual([]);
    expect(res.world.revision).toBe(1);
    expect(res.world.rng.draws).toBe(0);
  });

  it('waits for approval when the author lacks the approve right', () => {
    const r = fresh();
    const res = okResult(r.run(submitCommand(NF.scout)));
    expect(types(res)).toEqual(['ProposalSubmitted']);
    expect(proposals(res.world)[0]!.state).toBe('awaiting_approval');
  });

  it('requires the propose right in the category, independent of every other right', () => {
    const r = fresh();
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
        rights: ['advise', 'communicate', 'execute'],
        transferable: false,
      }),
    );
    const before = snapshotOf(r.kernel);
    const res = r.run(submitCommand(NF.scout));
    expect(codeOf(res)).toBe('INSUFFICIENT_AUTHORITY');
    expect(messageOf(res)).toContain('propose');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('rejects malformed proposals without changing anything', () => {
    const r = fresh();
    const before = snapshotOf(r.kernel);
    const bads: Record<string, unknown>[] = [
      submitCommand(NF.gm, { category: 'free_agency' }),
      submitCommand(NF.gm, { category: 'game_day_activation' }),
      submitCommand(NF.gm, { subjects: [] }),
      submitCommand(NF.gm, { subjects: [{ kind: 'entity', id: 'nobody' }] }),
      submitCommand(NF.gm, { termsType: '' }),
      submitCommand(NF.gm, { terms: 'not an object' }),
      submitCommand(NF.gm, { requiredApproverPersonIds: ['person-nobody'] }),
      submitCommand(NF.gm, {
        requiredApproverPersonIds: [NF.owner, NF.owner],
      }),
      submitCommand(NF.gm, { expiresAt: TODAY }),
      submitCommand(NF.gm, { expiresAt: '2026-10-01' }),
      submitCommand(NF.gm, { expiresAt: 'soon' }),
      submitCommand(NF.gm, { contingencies: 'maybe' }),
      submitCommand('person-nobody'),
    ];
    for (const bad of bads) expect(codeOf(r.run(bad))).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });
});

describe('approval (DC-02 joint approval)', () => {
  it('records an approval bound to the exact revision and terms hash', () => {
    const r = fresh();
    okResult(r.run(submitCommand(NF.scout)));
    const res = okResult(r.run(decisionCommand('ApproveProposal', NF.gm)));
    expect(types(res)).toEqual(['ProposalApproved', 'ProposalAuthorized']);
    expect(approvals(res.world)).toEqual([
      {
        id: 'rec-000002',
        proposalId: 'rec-000001',
        proposalRevision: 1,
        approverPersonId: NF.gm,
        right: 'approve',
        authorityGrantId: 'grant-nf-gm-plan',
        mandateId: null,
        termsHash: proposals(res.world)[0]!.termsHash,
        decidedAt: TODAY,
        active: true,
      },
    ]);
    expect(proposals(res.world)[0]!.state).toBe('authorized');
  });

  it('needs every required approver; one approval of two is not enough', () => {
    const r = fresh();
    okResult(
      r.run(
        submitCommand(NF.scout, {
          requiredApproverPersonIds: [NF.gm, NF.owner],
        }),
      ),
    );
    const first = okResult(r.run(decisionCommand('ApproveProposal', NF.gm)));
    expect(types(first)).toEqual(['ProposalApproved']);
    expect(proposals(first.world)[0]!.state).toBe('awaiting_approval');
    const second = okResult(
      r.run(decisionCommand('ApproveProposal', NF.owner)),
    );
    expect(types(second)).toEqual(['ProposalApproved', 'ProposalAuthorized']);
    expect(proposals(second.world)[0]!.state).toBe('authorized');
  });

  it('refuses duplicate approvals, non-required approvers and approvers without the right', () => {
    const r = fresh();
    okResult(
      r.run(
        submitCommand(NF.scout, {
          requiredApproverPersonIds: [NF.gm, NF.owner],
        }),
      ),
    );
    okResult(r.run(decisionCommand('ApproveProposal', NF.gm)));
    const before = snapshotOf(r.kernel);
    expect(codeOf(r.run(decisionCommand('ApproveProposal', NF.gm)))).toBe(
      'INVALID_PAYLOAD',
    );
    expect(codeOf(r.run(decisionCommand('ApproveProposal', NF.scout)))).toBe(
      'INSUFFICIENT_AUTHORITY',
    );
    expect(snapshotOf(r.kernel)).toEqual(before);

    const r2 = fresh();
    okResult(
      r2.run(submitCommand(NF.scout, { requiredApproverPersonIds: [NF.gm] })),
    );
    const b2 = snapshotOf(r2.kernel);
    expect(codeOf(r2.run(decisionCommand('ApproveProposal', NF.owner)))).toBe(
      'INVALID_PAYLOAD',
    );
    expect(snapshotOf(r2.kernel)).toEqual(b2);
  });

  it('an approver may act through a valid mandate, and the approval records it', () => {
    const r = fresh();
    okResult(r.run(submitCommand(NF.scout))); // rec-000001, awaiting approval
    okResult(
      r.run({
        type: 'CreateMandate',
        organizationId: NF.org,
        actingPersonId: NF.gm,
        delegatePersonId: NF.scout,
        category: 'organizational_plan',
        scope: { scopeKeys: ['plans'] },
        hardConstraints: {},
        preferences: {},
        allowedRights: ['approve'],
        fallback: {},
        escalationRules: {},
      }),
    ); // rec-000002
    const res = okResult(r.run(decisionCommand('ApproveProposal', NF.scout)));
    expect(approvals(res.world)[0]).toMatchObject({
      approverPersonId: NF.scout,
      mandateId: 'rec-000002',
      authorityGrantId: 'grant-nf-gm-plan',
    });
    expect(proposals(res.world)[0]!.state).toBe('authorized');
  });
});

describe('veto and withdrawal', () => {
  it('a veto holder rejects the proposal; others cannot', () => {
    const r = fresh();
    okResult(r.run(submitCommand(NF.scout)));
    const before = snapshotOf(r.kernel);
    expect(codeOf(r.run(decisionCommand('VetoProposal', NF.gm)))).toBe(
      'INSUFFICIENT_AUTHORITY',
    );
    expect(snapshotOf(r.kernel)).toEqual(before);
    const res = okResult(r.run(decisionCommand('VetoProposal', NF.owner)));
    expect(types(res)).toEqual(['ProposalVetoed']);
    expect(proposals(res.world)[0]!.state).toBe('rejected');
    expect(approvals(res.world)[0]).toMatchObject({
      right: 'veto',
      approverPersonId: NF.owner,
      active: true,
    });
    // A terminal proposal accepts no further decisions.
    expect(codeOf(r.run(decisionCommand('ApproveProposal', NF.gm)))).toBe(
      'INVALID_PAYLOAD',
    );
  });

  it('only the author may withdraw, and only before a terminal state', () => {
    const r = fresh();
    okResult(r.run(submitCommand(NF.scout)));
    expect(codeOf(r.run(decisionCommand('WithdrawProposal', NF.gm)))).toBe(
      'INSUFFICIENT_AUTHORITY',
    );
    const res = okResult(r.run(decisionCommand('WithdrawProposal', NF.scout)));
    expect(types(res)).toEqual(['ProposalWithdrawn']);
    expect(proposals(res.world)[0]!.state).toBe('withdrawn');
    expect(codeOf(r.run(decisionCommand('WithdrawProposal', NF.scout)))).toBe(
      'INVALID_PAYLOAD',
    );
  });
});

describe('revisions (DC-03 material revision, DC-07 retry)', () => {
  const approvedByGm = () => {
    const r = fresh();
    okResult(
      r.run(submitCommand(NF.scout, { requiredApproverPersonIds: [NF.gm] })),
    );
    okResult(r.run(decisionCommand('ApproveProposal', NF.gm)));
    return r;
  };

  it('a material revision invalidates incompatible approvals without deleting them', () => {
    const r = approvedByGm();
    expect(proposals(r.kernel.world)[0]!.state).toBe('authorized');
    const oldApproval = canonicalString(approvals(r.kernel.world)[0]);
    const res = okResult(
      r.run(
        reviseCommand(NF.scout, 'rec-000001', 1, {
          terms: { budget: 101, unit: 'synthetic_units' },
        }),
      ),
    );
    expect(types(res)).toEqual(['ProposalRevised', 'ApprovalInvalidated']);
    const [rev1, rev2] = proposals(res.world);
    expect(rev1).toMatchObject({ revision: 1, state: 'withdrawn' });
    expect(rev2).toMatchObject({
      id: 'rec-000001',
      revision: 2,
      supersedesRevision: 1,
      state: 'awaiting_approval',
      terms: { budget: 101, unit: 'synthetic_units' },
    });
    expect(rev2!.termsHash).not.toBe(rev1!.termsHash);
    // The approval is still there, now inactive, and bound to the old revision and hash.
    const kept = approvals(res.world)[0]!;
    expect(kept).toMatchObject({
      proposalRevision: 1,
      termsHash: rev1!.termsHash,
      active: false,
    });
    expect(canonicalString({ ...kept, active: true })).toBe(oldApproval);
    // Authorization needs a fresh approval of the new revision.
    expect(
      codeOf(r.run(decisionCommand('ApproveProposal', NF.gm, 'rec-000001', 1))),
    ).toBe('INVALID_PAYLOAD');
    const again = okResult(
      r.run(decisionCommand('ApproveProposal', NF.gm, 'rec-000001', 2)),
    );
    expect(proposals(again.world)[1]!.state).toBe('authorized');
    expect(approvals(again.world)[1]).toMatchObject({
      proposalRevision: 2,
      termsHash: rev2!.termsHash,
    });
  });

  it('a non-material revision keeps compatible approvals', () => {
    const r = approvedByGm();
    const res = okResult(
      r.run(
        reviseCommand(NF.scout, 'rec-000001', 1, {
          contingencies: { note: 'weather permitting' },
        }),
      ),
    );
    expect(types(res)).toEqual(['ProposalRevised', 'ProposalAuthorized']);
    expect(proposals(res.world)[1]).toMatchObject({
      revision: 2,
      state: 'authorized',
    });
    expect(proposals(res.world)[1]!.termsHash).toBe(
      proposals(res.world)[0]!.termsHash,
    );
    expect(approvals(res.world)[0]!.active).toBe(true);
  });

  it('rejects stale, unchanged and unauthorized revisions', () => {
    const r = approvedByGm();
    const before = snapshotOf(r.kernel);
    expect(
      codeOf(
        r.run(reviseCommand(NF.scout, 'rec-000001', 3, { terms: { a: 1 } })),
      ),
    ).toBe('INVALID_PAYLOAD');
    expect(
      codeOf(
        r.run(
          reviseCommand(NF.scout, 'rec-000001', 1, {
            terms: { budget: 100, unit: 'synthetic_units' },
          }),
        ),
      ),
    ).toBe('INVALID_PAYLOAD');
    expect(codeOf(r.run(reviseCommand(NF.scout, 'rec-000001', 1, {})))).toBe(
      'INVALID_PAYLOAD',
    );
    expect(
      codeOf(r.run(reviseCommand(NF.gm, 'rec-000001', 1, { terms: { a: 1 } }))),
    ).toBe('INSUFFICIENT_AUTHORITY');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('DC-07: a retry after a terminal outcome links a new revision and preserves the old attempt', () => {
    const r = fresh();
    okResult(r.run(submitCommand(NF.scout)));
    okResult(r.run(decisionCommand('VetoProposal', NF.owner)));
    const terminal = canonicalString(proposals(r.kernel.world)[0]);
    const res = okResult(
      r.run(
        reviseCommand(NF.scout, 'rec-000001', 1, {
          terms: { budget: 90, unit: 'synthetic_units' },
        }),
      ),
    );
    const [first, retry] = proposals(res.world);
    expect(canonicalString(first)).toBe(terminal);
    expect(first!.state).toBe('rejected');
    expect(retry).toMatchObject({
      id: 'rec-000001',
      revision: 2,
      supersedesRevision: 1,
      state: 'awaiting_approval',
    });
    // Approvals and vetoes from the failed attempt never carry over.
    expect(approvals(res.world).every((a) => !a.active)).toBe(true);
  });

  it('DC-07: retrying the same command id adds nothing', () => {
    const r = fresh();
    okResult(r.run(submitCommand(NF.scout)));
    okResult(r.run(decisionCommand('ApproveProposal', NF.gm)));
    const after = snapshotOf(r.kernel);
    const dup = r.kernel.execute({
      commandId: 'cmd-000002',
      expectedRevision: 1,
      actor: { kind: 'test_harness', id: 'actor-1' },
      command: decisionCommand('ApproveProposal', NF.gm),
    } as never);
    expect(dup.ok).toBe(false);
    expect(snapshotOf(r.kernel)).toEqual(after);
    expect(approvals(r.kernel.world)).toHaveLength(1);
  });
});

describe('exclusive deadline (DC-09)', () => {
  const advance = (r: ReturnType<typeof fresh>) =>
    okResult(r.run({ type: 'AdvanceDays', days: 1 }));

  it('is alive the day before expiresAt and dead on expiresAt itself', () => {
    const r = fresh();
    okResult(r.run(submitCommand(NF.scout, { expiresAt: '2026-10-18' }))); // today 10-16
    advance(r); // 10-17
    expect(codeOf(r.run(decisionCommand('ExpireProposal', NF.owner)))).toBe(
      'INVALID_PAYLOAD',
    );
    const approved = okResult(r.run(decisionCommand('ApproveProposal', NF.gm)));
    expect(proposals(approved.world)[0]!.state).toBe('authorized');
    advance(r); // 10-18: the deadline day is already too late
    const before = snapshotOf(r.kernel);
    expect(codeOf(r.run(commitCommand(NF.gm, 'rec-000001', 1)))).toBe(
      'INVALID_PAYLOAD',
    );
    expect(snapshotOf(r.kernel)).toEqual(before);
    const expired = okResult(
      r.run(decisionCommand('ExpireProposal', NF.owner)),
    );
    expect(types(expired)).toEqual(['ProposalExpired']);
    expect(proposals(expired.world)[0]!.state).toBe('expired');
  });

  it('cannot be approved on or after the deadline', () => {
    const r = fresh();
    okResult(r.run(submitCommand(NF.scout, { expiresAt: '2026-10-17' })));
    advance(r); // 10-17
    const before = snapshotOf(r.kernel);
    const res = r.run(decisionCommand('ApproveProposal', NF.gm));
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('expired');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('a proposal without a deadline never expires', () => {
    const r = fresh();
    okResult(r.run(submitCommand(NF.scout)));
    expect(codeOf(r.run(decisionCommand('ExpireProposal', NF.owner)))).toBe(
      'INVALID_PAYLOAD',
    );
  });
});

describe('the commit gate and decision receipts', () => {
  const authorizedByGm = () => {
    const r = fresh();
    okResult(r.run(submitCommand(NF.scout))); // rec-000001
    okResult(r.run(decisionCommand('ApproveProposal', NF.gm))); // rec-000002
    return r;
  };

  it('commits an authorized proposal with a receipt that names its grants, approvals and events', () => {
    const r = authorizedByGm();
    const res = okResult(r.run(commitCommand(NF.gm, 'rec-000001', 1)));
    expect(types(res)).toEqual([
      'TestPlanApplied',
      'ProposalCommitted',
      'DecisionReceiptRecorded',
    ]);
    expect(proposals(res.world)[0]!.state).toBe('committed');
    const [receipt] = res.world.decisions.receipts;
    expect(receipt).toMatchObject({
      id: 'rec-000003',
      proposalId: 'rec-000001',
      proposalRevision: 1,
      commandId: 'cmd-000003',
      actorPersonId: NF.gm,
      approvalIds: ['rec-000002'],
      mandateId: null,
      executedTermsHash: proposals(res.world)[0]!.termsHash,
      committedAt: TODAY,
      beliefIds: [],
      evidenceClaimIds: [],
      originalRationale: { note: 'synthetic commit' },
    });
    expect(receipt!.authorityGrantIds).toEqual(['grant-nf-gm-plan']);
    expect(receipt!.outcomeEventIds).toEqual(res.events.map((e) => e.eventId));
    expect(res.world.revision).toBe(3);
    expect(res.world.rng.draws).toBe(0);
  });

  it('DC-04: revoking an approver’s grant after authorization makes the later commit fail', () => {
    const r = authorizedByGm();
    // Before the revocation the commit would be allowed.
    expect(r.kernel.world.decisions.proposals[0]!.state).toBe('authorized');
    okResult(
      r.run({
        type: 'RevokeAuthority',
        actingPersonId: NF.owner,
        grantId: 'grant-nf-gm-plan',
      }),
    );
    const before = snapshotOf(r.kernel);
    const res = r.run(commitCommand(NF.owner, 'rec-000001', 1));
    expect(codeOf(res)).toBe('INSUFFICIENT_AUTHORITY');
    expect(snapshotOf(r.kernel)).toEqual(before);
    expect(r.kernel.world.decisions.receipts).toEqual([]);
  });

  it('committing needs the execute right in the category, independent of approve', () => {
    const r = authorizedByGm();
    const before = snapshotOf(r.kernel);
    const res = r.run(commitCommand(NF.scout, 'rec-000001', 1));
    expect(codeOf(res)).toBe('INSUFFICIENT_AUTHORITY');
    expect(messageOf(res)).toContain('execute');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('refuses unauthorized, stale and already committed proposals', () => {
    const r = fresh();
    okResult(r.run(submitCommand(NF.scout))); // awaiting approval
    const before = snapshotOf(r.kernel);
    expect(codeOf(r.run(commitCommand(NF.gm, 'rec-000001', 1)))).toBe(
      'INVALID_PAYLOAD',
    );
    expect(snapshotOf(r.kernel)).toEqual(before);
    okResult(r.run(decisionCommand('ApproveProposal', NF.gm)));
    expect(codeOf(r.run(commitCommand(NF.gm, 'rec-000001', 9)))).toBe(
      'INVALID_PAYLOAD',
    );
    okResult(r.run(commitCommand(NF.gm, 'rec-000001', 1)));
    expect(codeOf(r.run(commitCommand(NF.gm, 'rec-000001', 1)))).toBe(
      'INVALID_PAYLOAD',
    );
    expect(
      codeOf(
        r.run(reviseCommand(NF.scout, 'rec-000001', 1, { terms: { a: 1 } })),
      ),
    ).toBe('INVALID_PAYLOAD');
  });

  it('DC-17: a receipt keeps the exact belief and evidence ids, and later beliefs never alter it', () => {
    const r = fresh();
    okResult(
      r.run({
        type: 'RecordClaim',
        organizationId: NF.org,
        actingPersonId: NF.scout,
        subject: { kind: 'entity', id: 'org-southport' },
        propositionType: 'scouting_note',
        proposition: { note: 'solid' },
        sourceFamilyId: 'family-a',
        observedAt: TODAY,
        visibility: 'organization',
        confidence: 'medium',
        possibleBias: null,
        corroboratesClaimIds: [],
        contradictsClaimIds: [],
      }),
    ); // rec-000001
    okResult(
      r.run({
        type: 'FormBelief',
        organizationId: NF.org,
        actingPersonId: NF.gm,
        subject: { kind: 'entity', id: 'org-southport' },
        assessmentType: 'organization_strength',
        assessment: { rating: 'solid' },
        confidence: 'medium',
        evidenceClaimIds: ['rec-000001'],
        supersedesBeliefId: null,
      }),
    ); // rec-000002
    okResult(r.run(submitCommand(NF.gm))); // rec-000003 direct-authorized
    const res = okResult(
      r.run(
        commitCommand(NF.gm, 'rec-000003', 1, {
          beliefIds: ['rec-000002'],
          evidenceClaimIds: ['rec-000001'],
        }),
      ),
    );
    const receiptBytes = canonicalString(res.world.decisions.receipts[0]);
    expect(res.world.decisions.receipts[0]).toMatchObject({
      beliefIds: ['rec-000002'],
      evidenceClaimIds: ['rec-000001'],
      approvalIds: [],
      authorityGrantIds: ['grant-nf-gm-plan'],
    });
    okResult(
      r.run({
        type: 'RecordClaim',
        organizationId: NF.org,
        actingPersonId: NF.owner,
        subject: { kind: 'entity', id: 'org-southport' },
        propositionType: 'scouting_note',
        proposition: { note: 'actually weak' },
        sourceFamilyId: 'family-b',
        observedAt: TODAY,
        visibility: 'organization',
        confidence: 'high',
        possibleBias: null,
        corroboratesClaimIds: [],
        contradictsClaimIds: ['rec-000001'],
      }),
    );
    okResult(
      r.run({
        type: 'FormBelief',
        organizationId: NF.org,
        actingPersonId: NF.gm,
        subject: { kind: 'entity', id: 'org-southport' },
        assessmentType: 'organization_strength',
        assessment: { rating: 'weak' },
        confidence: 'high',
        evidenceClaimIds: ['rec-000005'],
        supersedesBeliefId: 'rec-000002',
      }),
    );
    expect(canonicalString(r.kernel.world.decisions.receipts[0])).toBe(
      receiptBytes,
    );
  });

  it('a receipt may not cite beliefs or evidence the committer cannot legitimately see', () => {
    const r = fresh();
    okResult(r.run(submitCommand(NF.gm))); // rec-000001
    const before = snapshotOf(r.kernel);
    expect(
      codeOf(
        r.run(
          commitCommand(NF.gm, 'rec-000001', 1, { beliefIds: ['rec-000099'] }),
        ),
      ),
    ).toBe('INVALID_PAYLOAD');
    expect(
      codeOf(
        r.run(
          commitCommand(NF.gm, 'rec-000001', 1, {
            evidenceClaimIds: ['rec-000099'],
          }),
        ),
      ),
    ).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });
});

describe('no generic escape hatch', () => {
  it('has no command that commits or applies a proposal by itself', () => {
    const r = runnerFor();
    okResult(r.run(submitCommand(NF.gm)));
    const before = snapshotOf(r.kernel);
    for (const type of [
      'CommitProposal',
      'ApplyProposal',
      'ExecuteProposal',
      'AuthorizeProposal',
      'SetWorldField',
    ])
      expect(
        codeOf(
          r.run({ type, actingPersonId: NF.gm, proposalId: 'rec-000001' }),
        ),
      ).toBe('SCHEMA_INVALID');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('the production router has no commit path: the test marker is inert there', () => {
    const r = runnerFor(); // production router, no test seam
    okResult(r.run(submitCommand(NF.gm)));
    okResult(r.run(commitCommand(NF.gm, 'rec-000001', 1), 'human_gm'));
    // The marker is ignored; the command is just an ordinary calendar advance.
    expect(r.kernel.world.simDate).toBe('2026-10-17');
    expect(proposals(r.kernel.world)[0]!.state).toBe('authorized');
    expect(r.kernel.world.decisions.receipts).toEqual([]);
  });
});

describe('invariants shared by every decision command', () => {
  const prepare = (r: ReturnType<typeof fresh>) => {
    okResult(r.run(submitCommand(NF.scout)));
  };
  const commands: Record<string, unknown>[] = [
    submitCommand(NF.scout, { termsType: 'other_plan' }),
    decisionCommand('ApproveProposal', NF.gm),
    decisionCommand('VetoProposal', NF.owner),
    decisionCommand('WithdrawProposal', NF.scout),
    reviseCommand(NF.scout, 'rec-000001', 1, { terms: { a: 1 } }),
  ];

  it('stale and duplicate commands change nothing and draw no RNG', () => {
    for (const command of commands) {
      const r = fresh();
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
      const kernel = newOrgKernel({
        testRouter: testCommitRouter,
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
    // The commit gate is atomic too: proposal, receipt and events land together or not at all.
    let armed = false;
    const kernel = newOrgKernel({
      testRouter: testCommitRouter,
      beforeCommit: () => {
        if (armed) throw new Error('injected fault');
      },
    });
    const r = runnerFor(kernel);
    okResult(r.run(submitCommand(NF.gm)));
    const before = snapshotOf(kernel);
    armed = true;
    expect(codeOf(r.run(commitCommand(NF.gm, 'rec-000001', 1)))).toBe(
      'INTERNAL_ERROR',
    );
    expect(snapshotOf(kernel)).toEqual(before);
    expect(kernel.world.decisions.receipts).toEqual([]);
    expect(kernel.world.decisions.proposals[0]!.state).toBe('authorized');
  });

  it('every actor kind gets the same result for the same acting person', () => {
    const prints = new Set<string>();
    for (const kind of [
      'human_gm',
      'cpu_org',
      'delegate',
      'commissioner',
      'system',
      'test_harness',
    ] as const) {
      const r = fresh();
      okResult(r.run(submitCommand(NF.scout), kind));
      okResult(r.run(decisionCommand('ApproveProposal', NF.gm), kind));
      prints.add(snapshotOf(r.kernel).fingerprint);
    }
    expect(prints.size).toBe(1);
  });

  it('keeps proposals sorted by id then revision', () => {
    const r = fresh();
    okResult(r.run(submitCommand(NF.scout)));
    okResult(r.run(submitCommand(NF.scout, { termsType: 'second' })));
    okResult(
      r.run(reviseCommand(NF.scout, 'rec-000001', 1, { terms: { a: 1 } })),
    );
    const keys = r.kernel.world.decisions.proposals.map(
      (p) => `${p.id}/${p.revision}`,
    );
    expect(keys).toEqual(['rec-000001/1', 'rec-000001/2', 'rec-000002/1']);
  });
});
