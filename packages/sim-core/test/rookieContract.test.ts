import { describe, expect, it } from 'vitest';
import {
  activeRightsFor,
  buildPlayerMarketDecisionView,
  entityId,
  moneyAmount,
  requireTransactionRules,
  rookieScaleTerms,
  SYNTHETIC_PACKAGE_C_RULESET,
} from '../src/index';
import {
  GM_OF,
  lastOffer,
  openedDraft,
  pickFor,
  rookieOffer,
  runWholeDraft,
  sessionOf,
} from './support/draftHarness';
import {
  commitSigning,
  resolveMarket,
  sendOffer,
  SECURE,
} from './support/freeAgencyHarness';
import { newPackageCKernel } from './support/packageCHarness';
import {
  codeOf,
  messageOf,
  okResult,
  runnerFor,
  snapshotOf,
} from './support/orgHarness';

const TX = requireTransactionRules(SYNTHETIC_PACKAGE_C_RULESET);
const fresh = () => runnerFor(newPackageCKernel());

/** Drafts one player and returns who took him and in which round. */
const draftOne = (r: ReturnType<typeof fresh>, playerId: string) => {
  const pick = (() => {
    const s = sessionOf(r);
    return r.kernel.world.draft.picks.find(
      (p) => p.id === s.orderedPickIds[s.currentIndex],
    )!;
  })();
  okResult(pickFor(r, playerId));
  const org = pick.ownerOrganizationId as string;
  return { org, gm: GM_OF[org]!, round: pick.round };
};

describe('rookie contracts by round', () => {
  it('signs a first-round pick through the shared offer path at exactly the rookie scale', () => {
    const r = fresh();
    openedDraft(r);
    const { org, gm, round } = draftOne(r, 'player-pr-01');
    expect(round).toBe(1);
    const { res } = rookieOffer(r, org, gm, 'player-pr-01', round);
    okResult(res);
    okResult(resolveMarket(r));
    const offer = lastOffer(r, 'player-pr-01');
    expect(offer.status).toBe('accepted_pending_commit');
    okResult(commitSigning(r, gm, offer));

    const w = r.kernel.world;
    const agreement = w.contracts.agreements.find(
      (a) => a.playerId === 'player-pr-01',
    )!;
    expect(agreement.terms).toEqual(
      rookieScaleTerms(TX.draft.rookieContractByRound[0]!, 2027),
    );
    const rights = activeRightsFor(
      w.roster,
      entityId('player-pr-01'),
      w.simDate,
    );
    expect(rights).toHaveLength(1);
    expect(rights[0]).toMatchObject({
      kind: 'contract',
      holderOrganizationId: org,
    });
    expect(
      w.roster.rights.find(
        (x) => x.kind === 'draft' && x.playerId === 'player-pr-01',
      )!.effectiveUntil,
    ).not.toBeNull();
    expect(
      w.roster.memberships.some(
        (m) => m.playerId === 'player-pr-01' && m.organizationId === org,
      ),
    ).toBe(true);
  });

  it('uses the round-specific scale: a second-round pick signs the round 2 contract', () => {
    const r = fresh();
    openedDraft(r);
    const players = r.kernel.world.draft.classes[0]!.eligiblePlayerIds;
    for (let i = 0; i < 4; i += 1) okResult(pickFor(r, players[i]!));
    const { org, gm, round } = draftOne(r, players[4]!);
    expect(round).toBe(2);
    okResult(rookieOffer(r, org, gm, players[4]!, 2).res);
    okResult(resolveMarket(r));
    okResult(commitSigning(r, gm, lastOffer(r, players[4]!)));
    const agreement = r.kernel.world.contracts.agreements.find(
      (a) => a.playerId === players[4],
    )!;
    expect(agreement.terms).toEqual(
      rookieScaleTerms(TX.draft.rookieContractByRound[1]!, 2027),
    );
    expect(agreement.terms).not.toEqual(
      rookieScaleTerms(TX.draft.rookieContractByRound[0]!, 2027),
    );
  });

  it('refuses negotiated terms for a draft right, and the wrong round’s scale', () => {
    const r = fresh();
    openedDraft(r);
    const { org, gm } = draftOne(r, 'player-pr-01');
    const before = snapshotOf(r.kernel);
    const richer = rookieScaleTerms(TX.draft.rookieContractByRound[0]!, 2027);
    const bumped = {
      ...richer,
      signingBonus: moneyAmount(richer.signingBonus + 1),
    };
    const a = rookieOffer(r, org, gm, 'player-pr-01', 1, { terms: bumped });
    expect(codeOf(a.res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(a.res)).toContain('rookie contract');
    const b = rookieOffer(r, org, gm, 'player-pr-01', 2);
    expect(messageOf(b.res)).toContain('rookie contract');
    expect(r.kernel.world.market.contractOffers).toHaveLength(0);
    expect(snapshotOf(r.kernel).fingerprint).not.toBe('');
    expect(before.events).toBeLessThanOrEqual(snapshotOf(r.kernel).events);
  });

  it('refuses another club: only the draft-rights holder can sign the player', () => {
    const r = fresh();
    openedDraft(r);
    const { org } = draftOne(r, 'player-pr-01');
    const other = Object.keys(GM_OF).find((o) => o !== org)!;
    const { res } = rookieOffer(r, other, GM_OF[other]!, 'player-pr-01', 1);
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('under');
  });

  it('is not subject to the player’s market preferences: the scale offer is accepted', () => {
    const r = fresh();
    openedDraft(r);
    const { org, gm } = draftOne(r, 'player-pr-01');
    okResult(rookieOffer(r, org, gm, 'player-pr-01', 1).res);
    const view = buildPlayerMarketDecisionView(
      r.kernel.world,
      entityId('player-pr-01'),
    );
    expect(view.offers).toHaveLength(1);
    expect(view.offers[0]!.rookieSlot).toBe(true);
  });
});

describe('undrafted free agents use the shared path', () => {
  it('a prospect cannot be signed before the draft completes', () => {
    const r = fresh();
    openedDraft(r);
    const { res } = sendOffer(
      r,
      'org-eastbrook',
      'person-eb-gm',
      'player-pr-14',
      {
        terms: SECURE,
        agent: null,
      },
    );
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('draft prospect');
  });

  it('after the final selection an undrafted player signs through offer, resolve and commit', () => {
    const r = fresh();
    openedDraft(r);
    runWholeDraft(r);
    const w0 = r.kernel.world;
    const drafted = new Set(w0.draft.selections.map((s) => s.playerId));
    const udfa = w0.draft.classes[0]!.eligiblePlayerIds.find(
      (p) => !drafted.has(p),
    )!;
    const { res } = sendOffer(r, 'org-eastbrook', 'person-eb-gm', udfa, {
      terms: SECURE,
      role: 'starter',
    });
    okResult(res);
    okResult(resolveMarket(r));
    const offer = lastOffer(r, udfa);
    expect(offer.status).toBe('accepted_pending_commit');
    okResult(commitSigning(r, 'person-eb-gm', offer));
    const w = r.kernel.world;
    expect(activeRightsFor(w.roster, udfa, w.simDate)[0]).toMatchObject({
      kind: 'contract',
      holderOrganizationId: 'org-eastbrook',
    });
    expect(
      w.contracts.agreements.some(
        (a) => a.playerId === udfa && a.sourceOfferId === offer.id,
      ),
    ).toBe(true);
    expect(sessionOf(r).status).toBe('complete');
  });
});
