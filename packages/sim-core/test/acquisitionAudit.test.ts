import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_C_RULESET,
  auditAcquisitionWorld,
  moneyAmount,
  recordId,
  requireTransactionRules,
  entityId,
  type AcquisitionFindingCode,
  type DraftBoardRevision,
  type FootballWorld,
  type Reservation,
  type WaiverRecord,
} from '../src/index';
import {
  GM_OF,
  lastOffer,
  openedDraft,
  pickFor,
  rookieOffer,
} from './support/draftHarness';
import {
  FLAT,
  commitSigning,
  resolveMarket,
  sendOffer,
} from './support/freeAgencyHarness';
import { newPackageCKernel } from './support/packageCHarness';
import { okResult, runnerFor, type Runner } from './support/orgHarness';

const TX = requireTransactionRules(SYNTHETIC_PACKAGE_C_RULESET);
const audit = (w: FootballWorld) => auditAcquisitionWorld(w, TX);
const codes = (w: FootballWorld): AcquisitionFindingCode[] =>
  audit(w).map((f) => f.code);

/** Draft under way, one rookie signed, one free-agent offer pending. */
const richRunner = (): Runner => {
  const r = runnerFor(newPackageCKernel());
  openedDraft(r);
  const first = r.kernel.world.draft.picks.find(
    (p) => p.id === r.kernel.world.draft.sessions[0]!.orderedPickIds[0],
  )!;
  const org = first.ownerOrganizationId as string;
  okResult(pickFor(r, 'player-pr-01'));
  okResult(pickFor(r, 'player-pr-02'));
  okResult(rookieOffer(r, org, GM_OF[org]!, 'player-pr-01', 1).res);
  okResult(resolveMarket(r));
  okResult(commitSigning(r, GM_OF[org]!, lastOffer(r, 'player-pr-01')));
  okResult(
    sendOffer(r, 'org-eastbrook', 'person-eb-gm', 'player-fa-01', {
      terms: FLAT,
    }).res,
  );
  return r;
};

describe('a healthy world audits clean', () => {
  it('the seed world has no findings', () => {
    const r = runnerFor(newPackageCKernel());
    expect(audit(r.kernel.world)).toEqual([]);
  });

  it('a world mid-draft with a rookie signing and a live offer has no findings', () => {
    const r = richRunner();
    expect(audit(r.kernel.world)).toEqual([]);
  });

  it('is read-only and deterministic', () => {
    const r = richRunner();
    const before = JSON.stringify(r.kernel.world);
    const a = audit(r.kernel.world);
    const b = audit(r.kernel.world);
    expect(a).toEqual(b);
    expect(JSON.stringify(r.kernel.world)).toBe(before);
  });
});

describe('the audit names each kind of incoherence', () => {
  const w = () => richRunner().kernel.world;

  it('duplicate rights and a contract without its right', () => {
    const base = w();
    const rookie = base.contracts.agreements.find(
      (a) => a.playerId === 'player-pr-01',
    )!;
    const rightOf = base.roster.rights.find(
      (x) => x.kind === 'contract' && x.playerId === 'player-pr-01',
    )!;
    expect(
      codes({
        ...base,
        roster: {
          ...base.roster,
          rights: [
            ...base.roster.rights,
            { ...rightOf, id: recordId('rec-900001') },
          ],
        },
      }),
    ).toContain('DUPLICATE_ACTIVE_RIGHTS');
    expect(
      codes({
        ...base,
        roster: {
          ...base.roster,
          rights: base.roster.rights.map((x) =>
            x.id === rightOf.id ? { ...x, effectiveUntil: '2020-01-01' } : x,
          ),
        },
      }),
    ).toContain('CONTRACT_WITHOUT_RIGHT');
    expect(
      codes({
        ...base,
        contracts: {
          ...base.contracts,
          agreements: base.contracts.agreements.map((a) =>
            a.id === rookie.id ? { ...a, status: 'superseded' as const } : a,
          ),
        },
      }),
    ).toContain('CONTRACT_RIGHT_WITHOUT_CONTRACT');
  });

  it('pick and selection conservation', () => {
    const base = w();
    const sel = base.draft.selections[0]!;
    const pickOf = (id: string) => base.draft.picks.find((p) => p.id === id)!;
    expect(
      codes({
        ...base,
        draft: {
          ...base.draft,
          picks: [...base.draft.picks, pickOf(sel.pickId)],
        },
      }),
    ).toContain('DUPLICATE_PICK');
    expect(
      codes({
        ...base,
        draft: {
          ...base.draft,
          picks: base.draft.picks.map((p) =>
            p.id === sel.pickId ? { ...p, status: 'available' as const } : p,
          ),
        },
      }),
    ).toContain('SELECTION_PICK_NOT_USED');
    expect(
      codes({
        ...base,
        draft: {
          ...base.draft,
          picks: base.draft.picks.map((p) =>
            p.id === sel.pickId
              ? {
                  ...p,
                  ownerOrganizationId:
                    entityId('org-westlake') === p.ownerOrganizationId
                      ? entityId('org-eastbrook')
                      : entityId('org-westlake'),
                }
              : p,
          ),
        },
      }),
    ).toContain('SELECTION_OWNER_MISMATCH');
    expect(
      codes({
        ...base,
        draft: {
          ...base.draft,
          selections: [
            ...base.draft.selections,
            { ...sel, id: recordId('rec-900002') },
          ],
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        'DUPLICATE_PICK_SELECTION',
        'DUPLICATE_PLAYER_SELECTION',
      ]),
    );
    expect(
      codes({
        ...base,
        draft: {
          ...base.draft,
          picks: base.draft.picks.map((p) =>
            p.id === 'pick-2027-r3-s4' ? { ...p, status: 'used' as const } : p,
          ),
        },
      }),
    ).toContain('PICK_USED_WITHOUT_SELECTION');
    expect(
      codes({
        ...base,
        roster: {
          ...base.roster,
          rights: base.roster.rights.filter((x) => x.sourceRecordId !== sel.id),
        },
      }),
    ).toContain('SELECTION_WITHOUT_RIGHT');
  });

  it('cap and reservation overcommitment, orphan and stale offer reservations', () => {
    const base = w();
    const agreement = base.contracts.agreements.find(
      (a) => a.playerId === 'player-pr-01',
    )!;
    const huge = moneyAmount(5_000_000);
    expect(
      codes({
        ...base,
        contracts: {
          ...base.contracts,
          agreements: base.contracts.agreements.map((a) =>
            a.id === agreement.id
              ? { ...a, terms: { ...a.terms, signingBonus: huge } }
              : a,
          ),
        },
      }),
    ).toContain('CAP_EXCEEDED');
    const fat: Reservation = {
      id: recordId('rec-900003'),
      organizationId: agreement.organizationId,
      sourceKind: 'waiver_claim',
      sourceRecordId: recordId('rec-900099'),
      capBySeason: [{ season: 2027, amount: huge }],
      rosterSlotStatus: 'active',
      contingencyGroupId: null,
      createdAt: base.simDate,
      status: 'active',
    };
    const over = codes({
      ...base,
      market: {
        ...base.market,
        reservations: [...base.market.reservations, fat],
      },
    });
    expect(over).toEqual(
      expect.arrayContaining([
        'RESERVATION_CAP_OVERCOMMIT',
        'ORPHAN_RESERVATION',
      ]),
    );
    const live = base.market.contractOffers.find(
      (o) => o.status === 'communicated',
    )!;
    expect(
      codes({
        ...base,
        market: {
          ...base.market,
          reservations: base.market.reservations.map((x) =>
            x.id === live.reservationId
              ? { ...x, status: 'released' as const }
              : x,
          ),
        },
      }),
    ).toContain('LIVE_OFFER_WITHOUT_RESERVATION');
    const committed = base.market.contractOffers.find(
      (o) => o.status === 'committed',
    )!;
    expect(
      codes({
        ...base,
        market: {
          ...base.market,
          reservations: base.market.reservations.map((x) =>
            x.id === committed.reservationId
              ? { ...x, status: 'active' as const }
              : x,
          ),
        },
      }),
    ).toContain('COMMITTED_OFFER_STILL_RESERVED');
    expect(
      codes({
        ...base,
        contracts: {
          ...base.contracts,
          agreements: base.contracts.agreements.filter(
            (a) => a.sourceOfferId !== committed.id,
          ),
        },
      }),
    ).toContain('COMMITTED_OFFER_WITHOUT_AGREEMENT');
  });

  it('waivers, board references and receipts', () => {
    const base = w();
    const waiver: WaiverRecord = {
      id: recordId('rec-900004'),
      playerId: entityId('player-fa-02'),
      waivingOrganizationId: entityId('org-eastbrook'),
      contractAgreementId: recordId('rec-900098'),
      openedAt: base.simDate,
      claimDeadline: base.simDate,
      status: 'open',
      winnerOrganizationId: null,
      resolvedAt: null,
    };
    expect(
      codes({
        ...base,
        roster: { ...base.roster, waivers: [...base.roster.waivers, waiver] },
      }),
    ).toContain('WAIVER_CONTRACT_RIGHT_MISMATCH');

    const board: DraftBoardRevision = {
      id: recordId('rec-900005'),
      organizationId: entityId('org-eastbrook'),
      draftClassId: base.draft.classes[0]!.id,
      revision: 1,
      tiers: [
        {
          tier: 1,
          entries: [
            {
              playerId: entityId('player-pr-03'),
              beliefIds: [recordId('rec-900097')],
              roleProjection: null,
              withinTierOrder: null,
              needPriority: 'normal',
              planIds: [],
              noteClaimIds: [recordId('rec-900096')],
            },
          ],
        },
      ],
      createdAt: base.simDate,
      supersedesBoardRevisionId: null,
      organizationProposalId: recordId('rec-900095'),
      createdByPersonId: entityId('person-eb-gm'),
    };
    const found = audit({ ...base, draft: { ...base.draft, boards: [board] } });
    expect(
      found.filter((f) => f.code === 'INACCESSIBLE_BOARD_REFERENCE'),
    ).toHaveLength(2);
    expect(found.map((f) => f.code)).toContain('MISSING_RECEIPT');

    expect(
      codes({ ...base, decisions: { ...base.decisions, receipts: [] } }),
    ).toContain('MISSING_RECEIPT');
    expect(
      codes({
        ...base,
        decisions: {
          ...base.decisions,
          receipts: base.decisions.receipts.map((x, i) =>
            i === 0 ? { ...x, outcomeEventIds: [] } : x,
          ),
        },
      }),
    ).toContain('RECEIPT_WITHOUT_OUTCOME');
  });

  it('findings are sorted and carry severity and subjects', () => {
    const base = w();
    const found = audit({
      ...base,
      decisions: { ...base.decisions, receipts: [] },
    });
    expect(found.length).toBeGreaterThan(1);
    expect(
      found.every((f) => f.severity === 'error' && f.detail.length > 0),
    ).toBe(true);
    const sorted = [...found].sort((a, b) =>
      a.code < b.code ? -1 : a.code > b.code ? 1 : 0,
    );
    expect(found.map((f) => f.code)).toEqual(sorted.map((f) => f.code));
  });
});
