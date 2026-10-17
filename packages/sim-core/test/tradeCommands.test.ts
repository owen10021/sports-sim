import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_C_RULESET,
  activeRightsFor,
  capPosition,
  entityId,
  recordId,
  requireTransactionRules,
  rosterInvariantFindings,
  type AcquisitionAssetRef,
  type ExecuteResult,
  type TradePackageV1,
} from '../src/index';
import {
  NF,
  newCapKernel,
  newKernelWith,
  newPackageCKernel,
  newVariantKernel,
  submitTradeProposal,
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
const EB = {
  org: entityId('org-eastbrook'),
  gm: 'person-eb-gm',
  owner: 'person-eb-owner',
};
const SP = { org: entityId('org-southport'), gm: 'person-sp-gm' };
const TODAY = '2027-02-15';

const rights = (r: Runner, playerId: string): AcquisitionAssetRef => {
  const right = activeRightsFor(
    r.kernel.world.roster,
    entityId(playerId),
    TODAY,
  )[0]!;
  return {
    kind: 'player_rights',
    playerId: right.playerId,
    rightsId: right.id,
  };
};
const pick = (id: string): AcquisitionAssetRef => ({
  kind: 'draft_pick',
  pickId: recordId(id),
});
const pkg = (
  a: AcquisitionAssetRef[],
  b: AcquisitionAssetRef[],
  orgB = EB.org,
): TradePackageV1 => ({
  organizationAId: entityId(NF.org),
  organizationBId: entityId(orgB),
  assetsFromA: a,
  assetsFromB: b,
  validity: { expiresAt: null },
  contingencies: {},
});

const side = (by: string, expectedRevision = 1) => ({
  actingPersonId: by,
  expectedRevision,
  beliefIds: [],
  evidenceClaimIds: [],
  rationale: { note: 'trade' },
});

type Flow = {
  offerId: string;
  proposerProposal: string;
  counterpartyProposal: string;
};

/** Both sides authorize, Northfield posts, Eastbrook accepts. Everything but the commit. */
const arrange = (
  r: Runner,
  p: TradePackageV1,
  opts: {
    counterpartyApprovers?: string[];
    answer?: 'accept' | 'decline';
  } = {},
): Flow => {
  const org = p.organizationBId;
  const gm = org === EB.org ? EB.gm : SP.gm;
  const proposerProposal = submitTradeProposal(r, NF.org, NF.gm, org, p);
  okResult(
    r.run({
      type: 'PostTradeOffer',
      actingPersonId: NF.gm,
      proposalId: proposerProposal,
      expectedRevision: 1,
    }),
  );
  const offerId = r.kernel.world.market.tradeOffers.at(-1)!.id;
  const counterpartyProposal = submitTradeProposal(
    r,
    org,
    gm,
    NF.org,
    p,
    opts.counterpartyApprovers === undefined
      ? {}
      : { requiredApproverPersonIds: opts.counterpartyApprovers },
  );
  okResult(
    r.run({
      type: 'AnswerTradeOffer',
      actingPersonId: gm,
      offerId,
      offerRevision: 1,
      answer: opts.answer ?? 'accept',
    }),
  );
  return { offerId, proposerProposal, counterpartyProposal };
};

const commit = (
  r: Runner,
  f: Flow,
  p: TradePackageV1,
  overrides: Record<string, unknown> = {},
): ExecuteResult =>
  r.run({
    type: 'CommitTradeAgreement',
    actingPersonId: NF.gm,
    offerId: f.offerId,
    offerRevision: 1,
    counterpartyProposalId: f.counterpartyProposal,
    proposerSide: side(NF.gm),
    counterpartySide: side(p.organizationBId === EB.org ? EB.gm : SP.gm),
    ...overrides,
  });

const fresh = () => runnerFor(newPackageCKernel());
const standard = (r: Runner) =>
  pkg(
    [rights(r, 'player-nf-01'), pick('pick-2027-r1-s4')],
    [rights(r, 'player-eb-04'), pick('pick-2027-r2-s2')],
  );
const holder = (r: Runner, playerId: string) =>
  activeRightsFor(
    r.kernel.world.roster,
    entityId(playerId),
    r.kernel.world.simDate,
  )[0]?.holderOrganizationId;
const pickOwner = (r: Runner, id: string) =>
  r.kernel.world.draft.picks.find((x) => x.id === id)!.ownerOrganizationId;

describe('posting and answering offers', () => {
  it('posts a legal package against the proposer’s own authorized proposal', () => {
    const r = fresh();
    const p = standard(r);
    const id = submitTradeProposal(r, NF.org, NF.gm, EB.org, p);
    const res = okResult(
      r.run({
        type: 'PostTradeOffer',
        actingPersonId: NF.gm,
        proposalId: id,
        expectedRevision: 1,
      }),
    );
    expect(res.events.map((e) => e.type)).toEqual(['TradeOfferPosted']);
    expect(r.kernel.world.market.tradeOffers[0]).toMatchObject({
      revision: 1,
      status: 'open',
      proposerOrganizationId: NF.org,
      counterpartyOrganizationId: EB.org,
      supersedesRevision: null,
    });
  });

  it('refuses an illegal package, a stale proposal revision and a non-trade proposal', () => {
    const r = fresh();
    const wrongOwner = pkg([pick('pick-2027-r1-s3')], []);
    const id = submitTradeProposal(r, NF.org, NF.gm, EB.org, wrongOwner);
    const before = snapshotOf(r.kernel);
    const illegal = r.run({
      type: 'PostTradeOffer',
      actingPersonId: NF.gm,
      proposalId: id,
      expectedRevision: 1,
    });
    expect(codeOf(illegal)).toBe('INVALID_PAYLOAD');
    expect(messageOf(illegal)).toContain('illegal package');
    expect(
      codeOf(
        r.run({
          type: 'PostTradeOffer',
          actingPersonId: NF.gm,
          proposalId: id,
          expectedRevision: 9,
        }),
      ),
    ).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('revises an open offer into a new revision and marks the old one countered', () => {
    const r = fresh();
    const p1 = pkg([pick('pick-2027-r1-s4')], []);
    const a = submitTradeProposal(r, NF.org, NF.gm, EB.org, p1);
    okResult(
      r.run({
        type: 'PostTradeOffer',
        actingPersonId: NF.gm,
        proposalId: a,
        expectedRevision: 1,
      }),
    );
    const offerId = r.kernel.world.market.tradeOffers[0]!.id;
    const p2 = pkg([pick('pick-2027-r1-s4')], [pick('pick-2027-r2-s2')]);
    const b = submitTradeProposal(r, EB.org, EB.gm, NF.org, p2);
    okResult(
      r.run({
        type: 'PostTradeOffer',
        actingPersonId: EB.gm,
        proposalId: b,
        expectedRevision: 1,
        supersedesOfferId: offerId,
      }),
    );
    const offers = r.kernel.world.market.tradeOffers.filter(
      (o) => o.id === offerId,
    );
    expect(offers.map((o) => [o.revision, o.status])).toEqual([
      [1, 'countered'],
      [2, 'open'],
    ]);
    expect(offers[1]).toMatchObject({
      proposerOrganizationId: EB.org,
      supersedesRevision: 1,
    });
  });

  it('lets only the counterparty answer, and only with communicate authority', () => {
    const r = fresh();
    const p = standard(r);
    const id = submitTradeProposal(r, NF.org, NF.gm, EB.org, p);
    okResult(
      r.run({
        type: 'PostTradeOffer',
        actingPersonId: NF.gm,
        proposalId: id,
        expectedRevision: 1,
      }),
    );
    const offerId = r.kernel.world.market.tradeOffers[0]!.id;
    const answer = (by: string) =>
      r.run({
        type: 'AnswerTradeOffer',
        actingPersonId: by,
        offerId,
        offerRevision: 1,
        answer: 'accept',
      });
    expect(codeOf(answer(NF.gm))).toBe('INSUFFICIENT_AUTHORITY');
    okResult(answer(EB.gm));
    expect(r.kernel.world.market.tradeOffers[0]!.status).toBe('accepted');
  });
});

describe('CommitTradeAgreement', () => {
  it('moves every asset, contract and slot atomically with a receipt for each club', () => {
    const r = fresh();
    const p = standard(r);
    const before = r.kernel.world;
    const f = arrange(r, p);
    const res = okResult(commit(r, f, p));
    expect(res.events.map((e) => e.type)).toEqual([
      'TradeExecuted',
      'ProposalCommitted',
      'DecisionReceiptRecorded',
      'ProposalCommitted',
      'DecisionReceiptRecorded',
    ]);
    const w = r.kernel.world;
    expect(holder(r, 'player-nf-01')).toBe(EB.org);
    expect(holder(r, 'player-eb-04')).toBe(NF.org);
    expect(pickOwner(r, 'pick-2027-r1-s4')).toBe(EB.org);
    expect(pickOwner(r, 'pick-2027-r2-s2')).toBe(NF.org);
    expect(w.market.tradeOffers[0]).toMatchObject({
      status: 'executed',
      counterpartyProposalId: f.counterpartyProposal,
    });
    expect(w.decisions.receipts.map((x) => x.actorPersonId).sort()).toEqual(
      [EB.gm, NF.gm].sort(),
    );
    expect(
      w.decisions.receipts.every(
        (x) =>
          x.proposalId === f.proposerProposal ||
          x.proposalId === f.counterpartyProposal,
      ),
    ).toBe(true);
    // Conservation and coherence.
    expect(w.draft.picks).toHaveLength(before.draft.picks.length);
    expect(rosterInvariantFindings(w.roster, TX, TODAY)).toEqual([]);
    // Hand calculation, 2027 (see assets tests): Northfield sheds nf-01's 245,000 and keeps a
    // 50,000 bonus remainder, and takes on eb-04's 290,000 less its 30,000 retained by Eastbrook.
    expect(capPosition(TX, w.contracts, entityId(NF.org), 2027).committed).toBe(
      1_085_000 - 245_000 + 50_000 + 260_000,
    );
    expect(capPosition(TX, w.contracts, EB.org, 2027).committed).toBe(
      1_060_000 - 290_000 + 30_000 + 195_000,
    );
  });

  it('executes once: repeating the same accepted request does nothing', () => {
    const r = fresh();
    const p = standard(r);
    const f = arrange(r, p);
    okResult(commit(r, f, p));
    const before = snapshotOf(r.kernel);
    const again = commit(r, f, p);
    expect(codeOf(again)).toBe('INVALID_PAYLOAD');
    expect(messageOf(again)).toContain('already been executed');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('requires the offer to be accepted at its latest revision', () => {
    const r = fresh();
    const p = standard(r);
    const id = submitTradeProposal(r, NF.org, NF.gm, EB.org, p);
    okResult(
      r.run({
        type: 'PostTradeOffer',
        actingPersonId: NF.gm,
        proposalId: id,
        expectedRevision: 1,
      }),
    );
    const offerId = r.kernel.world.market.tradeOffers[0]!.id;
    const counter = submitTradeProposal(r, EB.org, EB.gm, NF.org, p);
    const f = { offerId, proposerProposal: id, counterpartyProposal: counter };
    expect(messageOf(commit(r, f, p))).toContain('not accepted');
    okResult(
      r.run({
        type: 'AnswerTradeOffer',
        actingPersonId: EB.gm,
        offerId,
        offerRevision: 1,
        answer: 'accept',
      }),
    );
    expect(messageOf(commit(r, f, p, { offerRevision: 3 }))).toContain('stale');
  });

  it('needs the counterparty’s own proposal for the exact offered terms', () => {
    const r = fresh();
    const p = standard(r);
    const f = arrange(r, p);
    const other = submitTradeProposal(
      r,
      EB.org,
      EB.gm,
      NF.org,
      pkg([pick('pick-2027-r1-s4')], []),
    );
    const before = snapshotOf(r.kernel);
    expect(
      messageOf(commit(r, f, p, { counterpartyProposalId: other })),
    ).toContain('does not authorize');
    expect(
      messageOf(
        commit(r, f, p, { counterpartyProposalId: f.proposerProposal }),
      ),
    ).toContain('another organization');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('needs both clubs’ approvals: an unapproved counterparty proposal blocks the whole trade', () => {
    const r = fresh();
    const p = standard(r);
    const f = arrange(r, p, { counterpartyApprovers: [EB.owner] });
    const before = snapshotOf(r.kernel);
    const blocked = commit(r, f, p);
    expect(blocked.ok).toBe(false);
    expect(snapshotOf(r.kernel)).toEqual(before);
    expect(holder(r, 'player-nf-01')).toBe(NF.org);
    expect(r.kernel.world.decisions.receipts).toHaveLength(0);
    okResult(
      r.run({
        type: 'ApproveProposal',
        actingPersonId: EB.owner,
        proposalId: f.counterpartyProposal,
        expectedRevision: 1,
      }),
    );
    okResult(commit(r, f, p));
    expect(holder(r, 'player-nf-01')).toBe(EB.org);
  });

  it('rejects the whole trade when either side’s authority was revoked after authorization', () => {
    for (const [org, person] of [
      [NF.org, NF.gm],
      [EB.org, EB.gm],
    ] as const) {
      const r = fresh();
      const p = standard(r);
      const f = arrange(r, p);
      const grant = r.kernel.world.authority.grants.find(
        (g) =>
          g.personId === person &&
          g.category === 'acquisition' &&
          g.rights.includes('execute'),
      )!;
      okResult(
        r.run({
          type: 'RevokeAuthority',
          actingPersonId: org === NF.org ? NF.owner : EB.owner,
          grantId: grant.id,
        }),
      );
      const before = snapshotOf(r.kernel);
      expect(codeOf(commit(r, f, p))).toBe('INSUFFICIENT_AUTHORITY');
      expect(snapshotOf(r.kernel)).toEqual(before);
      expect(holder(r, 'player-nf-01')).toBe(NF.org);
    }
  });

  it('rejects a stale asset: a pick traded away elsewhere cannot be traded again', () => {
    const r = fresh();
    const p = standard(r);
    const f = arrange(r, p);
    const rival = pkg([pick('pick-2027-r1-s4')], [], SP.org);
    const g = arrange(r, rival);
    okResult(commit(r, g, rival, { counterpartySide: side(SP.gm) }));
    const before = snapshotOf(r.kernel);
    const res = commit(r, f, p);
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('stale package');
    expect(snapshotOf(r.kernel)).toEqual(before);
    expect(pickOwner(r, 'pick-2027-r1-s4')).toBe(SP.org);
  });

  it('refuses a contract that changed hands since the offer', () => {
    const r = fresh();
    const p = standard(r);
    const f = arrange(r, p);
    const rival = pkg([rights(r, 'player-nf-01')], [], SP.org);
    const g = arrange(r, rival);
    okResult(commit(r, g, rival, { counterpartySide: side(SP.gm) }));
    expect(messageOf(commit(r, f, p))).toContain('stale package');
  });

  it('refuses after the ruleset trade deadline', () => {
    const r = fresh();
    const p = standard(r);
    const f = arrange(r, p);
    for (let i = 0; i < 9; i += 1)
      okResult(r.run({ type: 'AdvanceDays', days: 30 }));
    const res = commit(r, f, p);
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('trade deadline');
  });

  it('refuses an offer past its expiry', () => {
    const r = fresh();
    const p: TradePackageV1 = {
      ...standard(r),
      validity: { expiresAt: '2027-02-17' },
    };
    const f = arrange(r, p);
    okResult(r.run({ type: 'AdvanceDays', days: 3 }));
    expect(messageOf(commit(r, f, p))).toContain('expired');
  });

  it('refuses a trade the receiving club cannot fit under its cap', () => {
    const k = newCapKernel((s, cur) => (s === 2027 ? 1_085_000 : cur));
    const r = runnerFor(k);
    const p = pkg([rights(r, 'player-nf-03')], []);
    const f = arrange(r, p);
    const before = snapshotOf(r.kernel);
    const res = commit(r, f, p);
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('cap');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('refuses a trade the receiving club cannot fit on its roster', () => {
    const k = newVariantKernel((tx) => ({
      ...tx,
      seasonRules: tx.seasonRules.map((s) => ({ ...s, activeRosterLimit: 3 })),
    }));
    const r = runnerFor(k);
    const p = pkg([rights(r, 'player-nf-01')], []);
    const f = arrange(r, p);
    expect(messageOf(commit(r, f, p))).toContain('roster capacity');
  });

  it('honours a protected constraint against trading a player', () => {
    const k = newKernelWith((w) => ({
      ...w,
      authority: {
        ...w.authority,
        protectedConstraints: [
          ...w.authority.protectedConstraints,
          {
            id: recordId('rec-protect-1'),
            organizationId: entityId(NF.org),
            subject: { playerId: 'player-nf-01' },
            prohibitedChange: { kind: 'trade' },
            originRecordId: null,
            effectiveFrom: '2027-01-01',
            effectiveUntil: null,
            amendableByPersonIds: [entityId(NF.owner)],
            revision: 1,
            active: true,
          },
        ],
      },
    }));
    const r = runnerFor(k);
    const p = pkg([rights(r, 'player-nf-01')], []);
    const f = arrange(r, p);
    const res = commit(r, f, p);
    expect(codeOf(res)).toBe('PROTECTED_CONSTRAINT');
    expect(holder(r, 'player-nf-01')).toBe(NF.org);
  });

  it('a fault before the atomic commit leaves assets, contracts, receipts and the chain unchanged', () => {
    let armed = false;
    const r = runnerFor(
      newPackageCKernel({
        beforeCommit: () => {
          if (armed) throw new Error('injected fault');
        },
      }),
    );
    const p = standard(r);
    const f = arrange(r, p);
    const before = snapshotOf(r.kernel);
    const worldBefore = r.kernel.world;
    armed = true;
    expect(codeOf(commit(r, f, p))).toBe('INTERNAL_ERROR');
    expect(snapshotOf(r.kernel)).toEqual(before);
    expect(r.kernel.world).toBe(worldBefore);
    armed = false;
    okResult(commit(r, f, p));
    expect(holder(r, 'player-nf-01')).toBe(EB.org);
  });

  it('is deterministic: the same history gives the same world', () => {
    const play = () => {
      const r = fresh();
      const p = standard(r);
      okResult(commit(r, arrange(r, p), p));
      return snapshotOf(r.kernel);
    };
    expect(play()).toEqual(play());
  });
});
