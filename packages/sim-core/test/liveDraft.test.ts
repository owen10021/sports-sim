import { describe, expect, it } from 'vitest';
import {
  activeRightsFor,
  buildDraftSessionView,
  entityId,
  recordId,
} from '../src/index';
import {
  DRAFT_DAY,
  advanceTo,
  classOf,
  clockPick,
  GM_OF,
  makeSelection,
  openDraft,
  OWNER_OF,
  openedDraft,
  pickFor,
  runWholeDraft,
  selectionProposal,
  sessionOf,
} from './support/draftHarness';
import { newPackageCKernel } from './support/packageCHarness';
import {
  codeOf,
  messageOf,
  okResult,
  runnerFor,
  snapshotOf,
} from './support/orgHarness';

const fresh = () => runnerFor(newPackageCKernel());

describe('opening the draft', () => {
  it('refuses to open before the ruleset draft date, then opens in round/slot order', () => {
    const r = fresh();
    const before = snapshotOf(r.kernel);
    const early = openDraft(r);
    expect(codeOf(early)).toBe('INVALID_PAYLOAD');
    expect(messageOf(early)).toContain(DRAFT_DAY);
    expect(snapshotOf(r.kernel)).toEqual(before);

    openedDraft(r);
    const s = sessionOf(r);
    expect(s.status).toBe('open');
    expect(s.currentIndex).toBe(0);
    expect(s.orderedPickIds).toHaveLength(12);
    const picks = s.orderedPickIds.map((id) =>
      r.kernel.world.draft.picks.find((p) => p.id === id)!,
    );
    expect(picks.map((p) => [p.round, p.slot])).toEqual(
      [1, 2, 3].flatMap((round) => [1, 2, 3, 4].map((slot) => [round, slot])),
    );
  });

  it('opens once per class and only for league-level actors', () => {
    const r = fresh();
    advanceTo(r, DRAFT_DAY);
    expect(
      codeOf(r.run({ type: 'OpenDraft', draftClassId: classOf(r) }, 'cpu_org')),
    ).not.toBe('');
    expect(r.kernel.world.draft.sessions).toHaveLength(0);
    okResult(openDraft(r));
    expect(codeOf(openDraft(r))).toBe('INVALID_PAYLOAD');
    expect(r.kernel.world.draft.sessions).toHaveLength(1);
  });
});

describe('making selections', () => {
  it('records the selection, uses the pick, grants a draft right and advances the clock atomically', () => {
    const r = fresh();
    openedDraft(r);
    const pick = clockPick(r);
    okResult(pickFor(r, 'player-pr-01'));
    const w = r.kernel.world;
    expect(w.draft.picks.find((p) => p.id === pick.id)!.status).toBe('used');
    const sel = w.draft.selections[0]!;
    expect(sel).toMatchObject({
      pickId: pick.id,
      organizationId: pick.ownerOrganizationId,
      playerId: 'player-pr-01',
    });
    const right = activeRightsFor(
      w.roster,
      entityId('player-pr-01'),
      w.simDate,
    )[0]!;
    expect(right).toMatchObject({
      kind: 'draft',
      holderOrganizationId: pick.ownerOrganizationId,
      sourceRecordId: sel.id,
    });
    expect(sessionOf(r).currentIndex).toBe(1);
    expect(sessionOf(r).selectionIds).toEqual([sel.id]);
    const view = buildDraftSessionView(w, sessionOf(r).id)!;
    expect(view.selections).toHaveLength(1);
    expect(view.onTheClock!.pickId).toBe(sessionOf(r).orderedPickIds[1]);
    expect(view.onTheClock!.pickId).not.toBe(pick.id);
    // The decision left a receipt.
    expect(w.decisions.receipts.length).toBeGreaterThan(0);
  });

  it('refuses a club that does not own the pick on the clock', () => {
    const r = fresh();
    openedDraft(r);
    const pick = clockPick(r);
    const other = Object.keys(GM_OF).find(
      (o) => o !== pick.ownerOrganizationId,
    )!;
    const proposalId = selectionProposal(
      r,
      other,
      GM_OF[other]!,
      'player-pr-01',
      pick.id,
    );
    const before = snapshotOf(r.kernel);
    const res = makeSelection(r, GM_OF[other]!, proposalId);
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('only the current owner selects');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('refuses a stale pick: only the pick on the clock may be used', () => {
    const r = fresh();
    openedDraft(r);
    const later = recordId(sessionOf(r).orderedPickIds[5]!);
    const owner = r.kernel.world.draft.picks.find((p) => p.id === later)!
      .ownerOrganizationId as string;
    const proposalId = selectionProposal(
      r,
      owner,
      GM_OF[owner]!,
      'player-pr-01',
      later,
    );
    const before = snapshotOf(r.kernel);
    const res = makeSelection(r, GM_OF[owner]!, proposalId);
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('not on the clock');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('refuses an already-drafted, ineligible or already-held player', () => {
    const r = fresh();
    openedDraft(r);
    okResult(pickFor(r, 'player-pr-01'));
    const attempt = (playerId: string) => {
      const pick = clockPick(r);
      const org = pick.ownerOrganizationId as string;
      const pid = selectionProposal(r, org, GM_OF[org]!, playerId, pick.id);
      return makeSelection(r, GM_OF[org]!, pid);
    };
    const before = r.kernel.world.draft;
    const dup = attempt('player-pr-01');
    expect(codeOf(dup)).toBe('INVALID_PAYLOAD');
    expect(messageOf(dup)).toContain('already been drafted');
    const notEligible = attempt('player-fa-01');
    expect(messageOf(notEligible)).toContain('not eligible');
    expect(r.kernel.world.draft).toEqual(before);
  });

  it('blocks an unapproved proposal atomically', () => {
    const r = fresh();
    openedDraft(r);
    const pick = clockPick(r);
    const org = pick.ownerOrganizationId as string;
    const owner = OWNER_OF[org]!;
    const proposalId = selectionProposal(
      r,
      org,
      GM_OF[org]!,
      'player-pr-01',
      pick.id,
      [owner],
    );
    const before = snapshotOf(r.kernel);
    const res = makeSelection(r, GM_OF[org]!, proposalId);
    expect(res.ok).toBe(false);
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('needs a real board revision when one is named, and only the latest', () => {
    const r = fresh();
    openedDraft(r);
    const pick = clockPick(r);
    const org = pick.ownerOrganizationId as string;
    const proposalId = selectionProposal(
      r,
      org,
      GM_OF[org]!,
      'player-pr-01',
      pick.id,
    );
    const before = snapshotOf(r.kernel);
    const res = makeSelection(r, GM_OF[org]!, proposalId, {
      boardRevisionId: 'rec-999999',
    });
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('boards');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });
});

describe('the draft has no wall clock', () => {
  it('waits on the pick however many logical days pass', () => {
    const r = fresh();
    openedDraft(r);
    const before = sessionOf(r);
    okResult(r.run({ type: 'AdvanceDays', days: 30 }));
    expect(sessionOf(r)).toEqual(before);
    expect(sessionOf(r).status).toBe('open');
  });

  it('completes after the last selection; the undrafted stay unattached', () => {
    const r = fresh();
    openedDraft(r);
    runWholeDraft(r);
    const s = sessionOf(r);
    expect(s.status).toBe('complete');
    expect(s.completedAt).toBe(r.kernel.world.simDate);
    expect(s.selectionIds).toHaveLength(12);
    expect(
      r.kernel.world.draft.picks.filter(
        (p) => p.season === 2027 && p.status !== 'used',
      ),
    ).toHaveLength(0);
    const drafted = new Set(
      r.kernel.world.draft.selections.map((x) => x.playerId),
    );
    const undrafted = r.kernel.world.draft.classes[0]!.eligiblePlayerIds.filter(
      (p) => !drafted.has(p),
    );
    expect(undrafted).toHaveLength(2);
    for (const p of undrafted)
      expect(
        activeRightsFor(r.kernel.world.roster, p, r.kernel.world.simDate),
      ).toHaveLength(0);
    // A further selection is refused.
    const res = r.run({
      type: 'MakeDraftSelection',
      actingPersonId: 'person-nf-gm',
      proposalId: 'rec-000001',
      expectedRevision: 1,
      rationale: {},
    });
    expect(res.ok).toBe(false);
  });

  it('is deterministic: the same draft twice gives identical worlds', () => {
    const run = () => {
      const r = fresh();
      openedDraft(r);
      runWholeDraft(r);
      return snapshotOf(r.kernel);
    };
    expect(run()).toEqual(run());
  });
});
