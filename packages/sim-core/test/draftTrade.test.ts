import { describe, expect, it } from 'vitest';
import {
  entityId,
  recordId,
  type AcquisitionAssetRef,
  type ExecuteResult,
  type TradePackageV1,
} from '../src/index';
import {
  advanceTo,
  clockPick,
  DRAFT_DAY,
  GM_OF,
  makeSelection,
  openedDraft,
  pickFor,
  selectionProposal,
  sessionOf,
} from './support/draftHarness';
import {
  NF,
  newPackageCKernel,
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

const EB = { org: entityId('org-eastbrook'), gm: 'person-eb-gm' };
const pick = (id: string): AcquisitionAssetRef => ({
  kind: 'draft_pick',
  pickId: recordId(id),
});
const pkg = (a: string[], b: string[]): TradePackageV1 => ({
  organizationAId: entityId(NF.org),
  organizationBId: EB.org,
  assetsFromA: a.map(pick),
  assetsFromB: b.map(pick),
  validity: { expiresAt: null },
  contingencies: {},
});
const side = (by: string) => ({
  actingPersonId: by,
  expectedRevision: 1,
  beliefIds: [],
  evidenceClaimIds: [],
  rationale: { note: 'trade' },
});

/** Both clubs authorize, Northfield posts, Eastbrook accepts. Returns the commit. */
const arrange = (r: Runner, p: TradePackageV1): (() => ExecuteResult) => {
  const mine = submitTradeProposal(r, NF.org, NF.gm, EB.org, p);
  okResult(
    r.run({
      type: 'PostTradeOffer',
      actingPersonId: NF.gm,
      proposalId: mine,
      expectedRevision: 1,
    }),
  );
  const offerId = r.kernel.world.market.tradeOffers.at(-1)!.id;
  const theirs = submitTradeProposal(r, EB.org, EB.gm, NF.org, p);
  okResult(
    r.run({
      type: 'AnswerTradeOffer',
      actingPersonId: EB.gm,
      offerId,
      offerRevision: 1,
      answer: 'accept',
    }),
  );
  return () =>
    r.run({
      type: 'CommitTradeAgreement',
      actingPersonId: NF.gm,
      offerId,
      offerRevision: 1,
      counterpartyProposalId: theirs,
      proposerSide: side(NF.gm),
      counterpartySide: side(EB.gm),
    });
};

const ownerOf = (r: Runner, id: string) =>
  r.kernel.world.draft.picks.find((p) => p.id === id)!.ownerOrganizationId;

const NF_PICK = 'pick-2027-r1-s4';
const EB_PICK = 'pick-2027-r2-s2';

describe('live pick trades', () => {
  it('after the trade only the new owner can select with the traded pick', () => {
    const r = runnerFor(newPackageCKernel());
    advanceTo(r, '2027-04-01');
    const commit = arrange(r, pkg([NF_PICK], [EB_PICK]));
    advanceTo(r, DRAFT_DAY);
    okResult(
      r.run({
        type: 'OpenDraft',
        draftClassId: r.kernel.world.draft.classes[0]!.id,
      }),
    );
    okResult(commit());
    expect(ownerOf(r, NF_PICK)).toBe(EB.org);
    // Run to the traded pick (slot 4 of round 1) with the rightful owners.
    const players = r.kernel.world.draft.classes[0]!.eligiblePlayerIds;
    let i = 0;
    while (clockPick(r).id !== NF_PICK) okResult(pickFor(r, players[i++]!));
    expect(clockPick(r).ownerOrganizationId).toBe(EB.org);

    const target = players[i]!;
    const old = selectionProposal(r, NF.org, NF.gm, target, NF_PICK);
    const before = snapshotOf(r.kernel);
    const refused = makeSelection(r, NF.gm, old);
    expect(codeOf(refused)).toBe('INVALID_PAYLOAD');
    expect(messageOf(refused)).toContain('only the current owner selects');
    expect(snapshotOf(r.kernel)).toEqual(before);

    const fresh = selectionProposal(r, EB.org, EB.gm, target, NF_PICK);
    okResult(makeSelection(r, EB.gm, fresh));
    expect(r.kernel.world.draft.selections.at(-1)).toMatchObject({
      organizationId: EB.org,
      pickId: NF_PICK,
      playerId: target,
    });
  });

  it('keeps pick order when a pick changes hands: the clock follows the pick, not the club', () => {
    const r = runnerFor(newPackageCKernel());
    advanceTo(r, DRAFT_DAY);
    okResult(
      r.run({
        type: 'OpenDraft',
        draftClassId: r.kernel.world.draft.classes[0]!.id,
      }),
    );
    const order = [...sessionOf(r).orderedPickIds];
    okResult(arrange(r, pkg([NF_PICK], [EB_PICK]))());
    expect(sessionOf(r).orderedPickIds).toEqual(order);
    expect(sessionOf(r).currentIndex).toBe(0);
  });

  it('never pre-authors reality: a trade for a pick used first is stale at commit', () => {
    const r = runnerFor(newPackageCKernel());
    advanceTo(r, '2027-04-01');
    const commit = arrange(r, pkg([NF_PICK], [EB_PICK]));
    advanceTo(r, DRAFT_DAY);
    okResult(
      r.run({
        type: 'OpenDraft',
        draftClassId: r.kernel.world.draft.classes[0]!.id,
      }),
    );
    const players = r.kernel.world.draft.classes[0]!.eligiblePlayerIds;
    let i = 0;
    while (clockPick(r).id !== NF_PICK) okResult(pickFor(r, players[i++]!));
    okResult(pickFor(r, players[i++]!));
    expect(
      r.kernel.world.draft.picks.find((p) => p.id === NF_PICK)!.status,
    ).toBe('used');
    const before = snapshotOf(r.kernel);
    const res = commit();
    expect(res.ok).toBe(false);
    expect(snapshotOf(r.kernel)).toEqual(before);
    expect(ownerOf(r, NF_PICK)).toBe(NF.org);
  });

  it('a used pick cannot be offered in a new trade', () => {
    const r = runnerFor(newPackageCKernel());
    openedDraft(r);
    const first = clockPick(r);
    okResult(pickFor(r, 'player-pr-01'));
    const owner = first.ownerOrganizationId as string;
    const other = owner === NF.org ? EB.org : NF.org;
    const code = other === NF.org ? 'nf' : 'eb';
    const p: TradePackageV1 = {
      organizationAId: entityId(owner),
      organizationBId: entityId(other),
      assetsFromA: [pick(first.id)],
      assetsFromB: [pick(`pick-2028-r3-${code}`)],
      validity: { expiresAt: null },
      contingencies: {},
    };
    const proposal = submitTradeProposal(r, owner, GM_OF[owner]!, other, p);
    const res = r.run({
      type: 'PostTradeOffer',
      actingPersonId: GM_OF[owner]!,
      proposalId: proposal,
      expectedRevision: 1,
    });
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('already been used');
    expect(res.ok).toBe(false);
  });
});
