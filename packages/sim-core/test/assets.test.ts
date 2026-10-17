import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_C_RULESET,
  activeRightsFor,
  applyTradePackage,
  assetOwner,
  entityId,
  recordId,
  requireTransactionRules,
  rosterInvariantFindings,
  tradePackageProblems,
  type AcquisitionAssetRef,
  type FootballWorld,
  type TradePackageV1,
} from '../src/index';
import {
  NF,
  SP,
  newPackageCKernel,
  newVariantKernel,
  rulesOf,
} from './support/packageCHarness';

const TX = requireTransactionRules(SYNTHETIC_PACKAGE_C_RULESET);
const TODAY = '2027-02-15';

const world = (): FootballWorld => newPackageCKernel().world;

const rights = (w: FootballWorld, playerId: string): AcquisitionAssetRef => {
  const r = activeRightsFor(w.roster, entityId(playerId), TODAY)[0]!;
  return { kind: 'player_rights', playerId: r.playerId, rightsId: r.id };
};
const pick = (pickId: string): AcquisitionAssetRef => ({
  kind: 'draft_pick',
  pickId: recordId(pickId),
});
const pkg = (
  a: readonly AcquisitionAssetRef[],
  b: readonly AcquisitionAssetRef[],
  over: Partial<TradePackageV1> = {},
): TradePackageV1 => ({
  organizationAId: entityId(NF.org),
  organizationBId: entityId(SP.org),
  assetsFromA: a,
  assetsFromB: b,
  validity: { expiresAt: null },
  contingencies: {},
  ...over,
});
const codes = (w: FootballWorld, p: TradePackageV1) =>
  tradePackageProblems(w, TX, p, TODAY).map((x) => x.code);

describe('assetOwner', () => {
  it('derives the owner of a rights record and of a pick', () => {
    const w = world();
    expect(assetOwner(w, rights(w, 'player-nf-01'), TODAY)).toBe(NF.org);
    expect(assetOwner(w, pick('pick-2027-r2-s1'), TODAY)).toBe(NF.org);
    expect(assetOwner(w, pick('pick-2027-r1-s3'), TODAY)).toBe(SP.org);
  });

  it('names no owner for a closed right', () => {
    const w = world();
    const asset = rights(w, 'player-nf-01');
    const moved = applyTradePackage(w, TX, pkg([asset], []), TODAY);
    expect(assetOwner(moved, asset, '2027-02-15')).toBeUndefined();
  });
});

describe('tradePackageProblems', () => {
  it('accepts a legal two-sided package', () => {
    const w = world();
    expect(
      codes(
        w,
        pkg(
          [rights(w, 'player-nf-01'), pick('pick-2027-r1-s4')],
          [pick('pick-2027-r1-s3')],
        ),
      ),
    ).toEqual([]);
  });

  it('rejects self-trades and empty packages', () => {
    const w = world();
    expect(
      codes(
        w,
        pkg([pick('pick-2027-r1-s4')], [], {
          organizationBId: entityId(NF.org),
        }),
      ),
    ).toContain('SELF_TRADE');
    expect(codes(w, pkg([], []))).toEqual(['EMPTY_PACKAGE']);
  });

  it('rejects the same asset twice, on one side or on both', () => {
    const w = world();
    const a = pick('pick-2027-r1-s4');
    expect(codes(w, pkg([a, a], []))).toContain('DUPLICATE_ASSET');
    expect(codes(w, pkg([a], [a]))).toContain('DUPLICATE_ASSET');
  });

  it('rejects assets the named side does not own, including a stale reference', () => {
    const w = world();
    expect(codes(w, pkg([pick('pick-2027-r1-s3')], []))).toEqual([
      'WRONG_OWNER',
    ]);
    expect(codes(w, pkg([], [rights(w, 'player-nf-01')]))).toEqual([
      'WRONG_OWNER',
    ]);
    // After the trade the old reference is stale: the right it named has closed.
    const asset = rights(w, 'player-nf-01');
    const after = applyTradePackage(w, TX, pkg([asset], []), TODAY);
    expect(codes(after, pkg([asset], []))).toEqual(['WRONG_OWNER']);
  });

  it('rejects unknown assets', () => {
    const w = world();
    expect(codes(w, pkg([pick('pick-9999-r9')], []))).toEqual([
      'UNKNOWN_ASSET',
    ]);
  });

  it('rejects a used pick', () => {
    const w = world();
    const used: FootballWorld = {
      ...w,
      draft: {
        ...w.draft,
        picks: w.draft.picks.map((p) =>
          p.id === 'pick-2027-r1-s4' ? { ...p, status: 'used' as const } : p,
        ),
      },
    };
    expect(codes(used, pkg([pick('pick-2027-r1-s4')], []))).toEqual([
      'USED_PICK',
    ]);
  });

  it('treats a pick beyond the ruleset horizon as illegal, not as worth zero', () => {
    // Horizon 2 from 2027 allows 2029; horizon 1 makes 2029 picks illegal.
    const k = newVariantKernel((tx) => ({
      ...tx,
      market: {
        ...(tx.market as Record<string, unknown>),
        futurePickTradeHorizonSeasons: 1,
      },
    }));
    const w = k.world;
    const tx = rulesOf(k);
    const ok = tradePackageProblems(
      w,
      tx,
      pkg([pick('pick-2028-r1-nf')], []),
      TODAY,
    );
    const far = tradePackageProblems(
      w,
      tx,
      pkg([pick('pick-2029-r1-nf')], []),
      TODAY,
    );
    expect(ok).toEqual([]);
    expect(far.map((x) => x.code)).toEqual(['PICK_BEYOND_HORIZON']);
    expect(codes(world(), pkg([pick('pick-2029-r1-nf')], []))).toEqual([]);
  });

  it('keeps a player on waivers out of trades', () => {
    const w = world();
    const waived: FootballWorld = {
      ...w,
      roster: {
        ...w.roster,
        waivers: [
          {
            id: recordId('rec-000900'),
            playerId: entityId('player-nf-01'),
            waivingOrganizationId: entityId(NF.org),
            contractAgreementId: recordId('contract-seed-player-nf-01'),
            openedAt: TODAY,
            claimDeadline: '2027-02-16',
            status: 'open',
            winnerOrganizationId: null,
            resolvedAt: null,
          },
        ],
      },
    };
    expect(codes(waived, pkg([rights(w, 'player-nf-01')], []))).toEqual([
      'PLAYER_ON_WAIVERS',
    ]);
  });
});

describe('applyTradePackage conservation', () => {
  const trade = (w: FootballWorld) =>
    pkg(
      [rights(w, 'player-nf-01'), pick('pick-2027-r1-s4')],
      [rights(w, 'player-sp-04'), pick('pick-2027-r1-s3')],
    );

  it('moves every asset to exactly one new owner and creates or destroys nothing', () => {
    const w = world();
    const after = applyTradePackage(w, TX, trade(w), TODAY);
    expect(after.draft.picks).toHaveLength(w.draft.picks.length);
    const owner = (id: string, x: FootballWorld) =>
      x.draft.picks.find((p) => p.id === id)!.ownerOrganizationId;
    expect(owner('pick-2027-r1-s4', after)).toBe(SP.org);
    expect(owner('pick-2027-r1-s3', after)).toBe(NF.org);
    // Untouched picks keep their owners.
    for (const p of w.draft.picks)
      if (p.id !== 'pick-2027-r1-s4' && p.id !== 'pick-2027-r1-s3')
        expect(owner(p.id, after)).toBe(p.ownerOrganizationId);
    for (const player of ['player-nf-01', 'player-sp-04']) {
      const active = activeRightsFor(after.roster, entityId(player), TODAY);
      expect(active).toHaveLength(1);
    }
    expect(
      activeRightsFor(after.roster, entityId('player-nf-01'), TODAY)[0]!
        .holderOrganizationId,
    ).toBe(SP.org);
    expect(
      activeRightsFor(after.roster, entityId('player-sp-04'), TODAY)[0]!
        .holderOrganizationId,
    ).toBe(NF.org);
    expect(rosterInvariantFindings(after.roster, TX, TODAY)).toEqual([]);
  });

  it('moves the contract with the player and records the retained bonus as dead cap', () => {
    const w = world();
    const after = applyTradePackage(
      w,
      TX,
      pkg([rights(w, 'player-nf-01')], []),
      TODAY,
    );
    const old = after.contracts.agreements.find(
      (a) => a.id === 'contract-seed-player-nf-01',
    )!;
    expect(old.status).toBe('superseded');
    const next = after.contracts.agreements.find(
      (a) => a.supersedesAgreementId === old.id,
    )!;
    expect(next).toMatchObject({
      organizationId: SP.org,
      status: 'active',
      terms: {
        startSeason: 2027,
        years: old.terms.years.filter((y) => y.season >= 2027),
        signingBonus: 0,
      },
    });
    // Hand calculation: the 150,000 bonus prorates 50,000 a year; the sender keeps 2027 and 2028.
    expect(after.contracts.terminations).toEqual([
      expect.objectContaining({
        organizationId: NF.org,
        reason: 'trade_retained_bonus',
        deadCapBySeason: [
          { season: 2027, amount: 50_000 },
          { season: 2028, amount: 50_000 },
        ],
        guaranteedCashDue: 0,
      }),
    ]);
  });

  it('is a pure function of its inputs', () => {
    const w = world();
    const before = JSON.stringify(w);
    expect(JSON.stringify(applyTradePackage(w, TX, trade(w), TODAY))).toBe(
      JSON.stringify(applyTradePackage(w, TX, trade(w), TODAY)),
    );
    expect(JSON.stringify(w)).toBe(before);
  });
});
