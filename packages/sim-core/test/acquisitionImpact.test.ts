import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_C_RULESET,
  activeRightsFor,
  applyTradePackage,
  capPosition,
  entityId,
  previewAcquisitionImpact,
  recordId,
  requireTransactionRules,
  rosterCapacity,
  tradeCapacityProblems,
  type AcquisitionAssetRef,
  type FootballWorld,
  type TradePackageV1,
} from '../src/index';
import {
  NF,
  SP,
  newCapKernel,
  newPackageCKernel,
  rulesOf,
} from './support/packageCHarness';

const TX = requireTransactionRules(SYNTHETIC_PACKAGE_C_RULESET);
const TODAY = '2027-02-15';
const SEASONS = [2027, 2028, 2029, 2030] as const;

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
): TradePackageV1 => ({
  organizationAId: entityId(NF.org),
  organizationBId: entityId(SP.org),
  assetsFromA: a,
  assetsFromB: b,
  validity: { expiresAt: null },
  contingencies: {},
});

describe('previewAcquisitionImpact', () => {
  it('states a one-way trade in dollars, slots and picks (hand calculation)', () => {
    const w = world();
    const p = pkg([rights(w, 'player-nf-01'), pick('pick-2027-r1-s4')], []);
    const nf = previewAcquisitionImpact(w, TX, p, TODAY, entityId(NF.org));
    const sp = previewAcquisitionImpact(w, TX, p, TODAY, entityId(SP.org));
    // The 2027 charge is 245,000 (185,000 base + 10,000 roster bonus + 50,000 bonus
    // proration). Northfield sheds it and keeps the 50,000 proration as dead cap; Southport
    // takes on base plus roster bonus only.
    expect(nf.capDeltaBySeason.find((d) => d.season === 2027)!.delta).toBe(
      -195_000,
    );
    expect(sp.capDeltaBySeason.find((d) => d.season === 2027)!.delta).toBe(
      195_000,
    );
    expect([nf.activeSlotsBefore, nf.activeSlotsAfter]).toEqual([3, 2]);
    expect([sp.activeSlotsBefore, sp.activeSlotsAfter]).toEqual([3, 4]);
    expect(nf.draftPickIdsLost).toEqual(['pick-2027-r1-s4']);
    expect(sp.draftPickIdsGained).toEqual(['pick-2027-r1-s4']);
    expect(nf.incomingAssets).toEqual([]);
    expect(sp.outgoingAssets).toEqual([]);
  });

  it('contains no value, preference or capability fields', () => {
    const w = world();
    const p = previewAcquisitionImpact(
      w,
      TX,
      pkg([rights(w, 'player-nf-01')], []),
      TODAY,
      entityId(NF.org),
    );
    expect(Object.keys(p).sort()).toEqual(
      [
        'activeSlotsAfter',
        'activeSlotsBefore',
        'capDeltaBySeason',
        'draftPickIdsGained',
        'draftPickIdsLost',
        'incomingAssets',
        'organizationId',
        'outgoingAssets',
        'practiceSquadSlotsAfter',
        'practiceSquadSlotsBefore',
        'reservationIdsAffected',
        'reserveSlotsAfter',
        'reserveSlotsBefore',
      ].sort(),
    );
  });

  it.each([
    [
      'active for reserve plus picks',
      ['player-nf-01'],
      ['player-sp-04'],
      ['pick-2027-r1-s4'],
      ['pick-2027-r1-s3'],
    ],
    ['practice squad for active', ['player-nf-05'], ['player-sp-02'], [], []],
    [
      'two for none',
      ['player-nf-02', 'player-nf-03'],
      [],
      [],
      ['pick-2028-r2-sp'],
    ],
    [
      'picks only',
      [],
      [],
      ['pick-2027-r2-s1', 'pick-2028-r1-nf'],
      ['pick-2027-r2-s3'],
    ],
  ])(
    'equals the committed post-state: %s',
    (_name, aPlayers, bPlayers, aPicks, bPicks) => {
      const w = world();
      const p = pkg(
        [...aPlayers.map((x) => rights(w, x)), ...aPicks.map(pick)],
        [...bPlayers.map((x) => rights(w, x)), ...bPicks.map(pick)],
      );
      const after = applyTradePackage(w, TX, p, TODAY);
      for (const org of [NF.org, SP.org]) {
        const id = entityId(org);
        const preview = previewAcquisitionImpact(w, TX, p, TODAY, id);
        for (const season of SEASONS) {
          const actual =
            capPosition(TX, after.contracts, id, season).committed -
            capPosition(TX, w.contracts, id, season).committed;
          expect(
            preview.capDeltaBySeason.find((d) => d.season === season)?.delta ??
              0,
          ).toBe(actual);
        }
        const cap = rosterCapacity(after.roster, TX, id, TODAY);
        expect(preview.activeSlotsAfter).toBe(cap.active.count);
        expect(preview.reserveSlotsAfter).toBe(cap.reserve.count);
        expect(preview.practiceSquadSlotsAfter).toBe(cap.practice_squad.count);
        const owned = (x: FootballWorld) =>
          x.draft.picks
            .filter((q) => q.ownerOrganizationId === id)
            .map((q) => q.id)
            .sort();
        const gained = owned(after).filter((q) => !owned(w).includes(q));
        const lost = owned(w).filter((q) => !owned(after).includes(q));
        expect(preview.draftPickIdsGained).toEqual(gained);
        expect(preview.draftPickIdsLost).toEqual(lost);
      }
    },
  );
});

describe('tradeCapacityProblems', () => {
  const p = (w: FootballWorld) => pkg([rights(w, 'player-nf-01')], []);

  it('passes when the receiver lands exactly on the cap and fails one over', () => {
    const w0 = world();
    const spNow = capPosition(TX, w0.contracts, SP.org, 2027).committed;
    const exactK = newCapKernel((s, cur) =>
      s === 2027 ? spNow + 195_000 : cur,
    );
    const exact = exactK.world;
    const overK = newCapKernel((s, cur) =>
      s === 2027 ? spNow + 194_999 : cur,
    );
    const over = overK.world;
    expect(
      tradeCapacityProblems(exact, rulesOf(exactK), p(exact), TODAY),
    ).toEqual([]);
    const problems = tradeCapacityProblems(
      over,
      rulesOf(overK),
      p(over),
      TODAY,
    );
    expect(problems.map((x) => x.organizationId)).toEqual([SP.org]);
    expect(problems[0]!.message).toContain('cap');
  });

  it('fails when the receiver has no room on the active list', () => {
    const w = world();
    // Southport has 3 of 10 active; giving it 8 would overflow. Move eight Northfield picks' worth
    // of players is not possible, so shrink the limit through the capacity call instead.
    const full: FootballWorld = {
      ...w,
      roster: {
        ...w.roster,
        memberships: [
          ...w.roster.memberships,
          ...Array.from({ length: 7 }, (_, i) => ({
            id: recordId(`rec-90000${i}`),
            playerId: entityId(`player-fa-0${(i % 5) + 1}`),
            organizationId: entityId(SP.org),
            status: 'active' as const,
            effectiveFrom: '2027-01-01',
            effectiveUntil: null,
            sourceRecordId: recordId('rec-900100'),
          })),
        ],
      },
    };
    const problems = tradeCapacityProblems(full, TX, p(full), TODAY);
    expect(
      problems.some(
        (x) =>
          x.organizationId === SP.org && x.message.includes('roster capacity'),
      ),
    ).toBe(true);
  });

  it('counts room already held for a pending commitment', () => {
    const w = world();
    const reserved: FootballWorld = {
      ...w,
      market: {
        ...w.market,
        reservations: [
          {
            id: recordId('rec-900200'),
            organizationId: entityId(SP.org),
            sourceKind: 'trade_offer',
            sourceRecordId: recordId('rec-900201'),
            capBySeason: [{ season: 2027, amount: 1_900_000 as never }],
            rosterSlotStatus: 'active',
            contingencyGroupId: null,
            createdAt: TODAY,
            status: 'active',
          },
        ],
      },
    };
    const problems = tradeCapacityProblems(reserved, TX, p(reserved), TODAY);
    expect(problems.some((x) => x.message.includes('reserved 1900000'))).toBe(
      true,
    );
    const preview = previewAcquisitionImpact(
      reserved,
      TX,
      p(reserved),
      TODAY,
      entityId(SP.org),
    );
    expect(preview.reservationIdsAffected).toEqual(['rec-900200']);
  });
});
