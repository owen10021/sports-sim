import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_C_RULESET,
  UnknownTransactionSeasonError,
  bonusProration,
  capChargeBySeason,
  capPosition,
  capViolationsAfter,
  cashBySeason,
  contractTermsProblems,
  entityId,
  moneyAmount,
  organizationCommitments,
  recordId,
  releaseImpact,
  requireTransactionRules,
  tradeImpact,
  type ContractAgreement,
  type ContractTermsV1,
  type ContractsState,
  type TransactionRulesV1,
} from '../src/index';

const m = moneyAmount;
const TX = requireTransactionRules(SYNTHETIC_PACKAGE_C_RULESET);
const RULES = TX.contracts;
const NF = entityId('org-northfield');
const SP = entityId('org-southport');

/**
 * Hand-calculated reference contract A (3 years from 2027, 100,000 bonus):
 *   proration: floor(100000/3) = 33333, remainder 1 -> [33334, 33333, 33333]
 *   cap charge: 2027 200000+10000+33334 = 243334
 *               2028 220000+10000+33333 = 263333
 *               2029 240000+0+33333     = 273333
 *   cash:       2027 210000+100000 = 310000, 2028 230000, 2029 240000
 */
const A: ContractTermsV1 = {
  startSeason: 2027,
  signingBonus: m(100_000),
  years: [
    {
      season: 2027,
      baseSalary: m(200_000),
      rosterBonus: m(10_000),
      guaranteedBase: m(200_000),
    },
    {
      season: 2028,
      baseSalary: m(220_000),
      rosterBonus: m(10_000),
      guaranteedBase: m(110_000),
    },
    {
      season: 2029,
      baseSalary: m(240_000),
      rosterBonus: m(0),
      guaranteedBase: m(0),
    },
  ],
};

const withTx = (over: Partial<TransactionRulesV1['contracts']>) => ({
  ...RULES,
  ...over,
});

const agreement = (
  id: string,
  org: typeof NF,
  terms: ContractTermsV1,
  status: ContractAgreement['status'] = 'active',
): ContractAgreement => ({
  id: recordId(id),
  playerId: entityId(`player-${id}`),
  organizationId: org,
  terms,
  signedAt: '2027-01-01',
  sourceOfferId: null,
  sourceProposalId: null,
  supersedesAgreementId: null,
  status,
});

const state = (
  agreements: ContractAgreement[],
  terminations: ContractsState['terminations'] = [],
): ContractsState => ({ agreements, terminations });

describe('signing bonus proration', () => {
  it('spreads the bonus with the remainder going to the earliest seasons', () => {
    expect(bonusProration(RULES, A)).toEqual([33_334, 33_333, 33_333]);
    expect(bonusProration(RULES, A).reduce((a, b) => a + b, 0)).toBe(100_000);
  });

  it('caps the window at the ruleset maximum and pads later years with zero', () => {
    const six: ContractTermsV1 = {
      ...A,
      signingBonus: m(100_003),
      years: [...A.years, ...A.years, ...A.years].slice(0, 6).map((y, i) => ({
        ...y,
        season: 2027 + i,
      })),
    };
    // window = min(6, 5) = 5: 20000 each, remainder 3 -> first three seasons get one more.
    expect(bonusProration(RULES, six)).toEqual([
      20_001, 20_001, 20_001, 20_000, 20_000, 0,
    ]);
  });
});

describe('cap charges and cash', () => {
  it('computes the cap charge per season', () => {
    expect(capChargeBySeason(RULES, A)).toEqual([
      { season: 2027, amount: 243_334 },
      { season: 2028, amount: 263_333 },
      { season: 2029, amount: 273_333 },
    ]);
  });

  it('pays the signing bonus as cash in the start season', () => {
    expect(cashBySeason(A)).toEqual([
      { season: 2027, amount: 310_000 },
      { season: 2028, amount: 230_000 },
      { season: 2029, amount: 240_000 },
    ]);
  });

  it('cap charges over all years exceed cash only by timing, never in total', () => {
    const cap = capChargeBySeason(RULES, A).reduce((a, x) => a + x.amount, 0);
    const cash = cashBySeason(A).reduce((a, x) => a + x.amount, 0);
    expect(cap).toBe(cash);
  });
});

describe('legal terms', () => {
  it('accepts the reference contract', () => {
    expect(contractTermsProblems(TX, A)).toEqual([]);
  });

  it('enforces the maximum and minimum term', () => {
    const six: ContractTermsV1 = {
      ...A,
      years: Array.from({ length: 6 }, (_, i) => ({
        ...A.years[0]!,
        season: 2027 + i,
      })),
    };
    expect(contractTermsProblems(TX, six).join(' ')).toContain('length 6');
    expect(contractTermsProblems(TX, { ...A, years: [] }).join(' ')).toContain(
      'length 0',
    );
    const five = { ...six, years: six.years.slice(0, 5) };
    expect(contractTermsProblems(TX, five)).toEqual([]);
  });

  it('enforces the minimum base salary exactly at the boundary', () => {
    const at = {
      ...A,
      years: [{ ...A.years[0]!, baseSalary: m(10_000), guaranteedBase: m(0) }],
    };
    expect(contractTermsProblems(TX, at)).toEqual([]);
    const below = {
      ...A,
      years: [{ ...A.years[0]!, baseSalary: m(9_999), guaranteedBase: m(0) }],
    };
    expect(contractTermsProblems(TX, below).join(' ')).toContain('minimum');
  });

  it('rejects guaranteed money above base salary and non-contiguous seasons', () => {
    const over = {
      ...A,
      years: [{ ...A.years[0]!, guaranteedBase: m(200_001) }],
    };
    expect(contractTermsProblems(TX, over).join(' ')).toContain('guaranteed');
    const gap = {
      ...A,
      years: [A.years[0]!, { ...A.years[1]!, season: 2029 }],
    };
    expect(contractTermsProblems(TX, gap).join(' ')).toContain('contiguous');
  });
});

describe('release consequences', () => {
  it('keeps prorated bonus and guaranteed base when released in season 2028', () => {
    // 2028: 33333 + 110000 guaranteed = 143333; 2029: 33333 + 0 = 33333. 2027 is history.
    expect(releaseImpact(RULES, A, 2028)).toEqual({
      deadCapBySeason: [
        { season: 2028, amount: 143_333 },
        { season: 2029, amount: 33_333 },
      ],
      guaranteedCashDue: 110_000,
    });
  });

  it('keeps every remaining season when released before the contract starts paying', () => {
    // 2027: 33334 + 200000 = 233334; 2028: 33333 + 110000 = 143333; 2029: 33333.
    expect(releaseImpact(RULES, A, 2027)).toEqual({
      deadCapBySeason: [
        { season: 2027, amount: 233_334 },
        { season: 2028, amount: 143_333 },
        { season: 2029, amount: 33_333 },
      ],
      guaranteedCashDue: 310_000,
    });
  });

  it('honors the ruleset flag for guaranteed base in future seasons', () => {
    const guaranteed2029 = {
      ...A,
      years: [
        A.years[0]!,
        A.years[1]!,
        { ...A.years[2]!, guaranteedBase: m(50_000) },
      ],
    };
    // flag true: 2029 dead = 33333 + 50000 = 83333, cash due 110000 + 50000.
    expect(releaseImpact(RULES, guaranteed2029, 2028)).toEqual({
      deadCapBySeason: [
        { season: 2028, amount: 143_333 },
        { season: 2029, amount: 83_333 },
      ],
      guaranteedCashDue: 160_000,
    });
    // flag false: only the release season's guarantee is owed.
    expect(
      releaseImpact(
        withTx({ guaranteedFutureBaseOnRelease: false }),
        guaranteed2029,
        2028,
      ),
    ).toEqual({
      deadCapBySeason: [
        { season: 2028, amount: 143_333 },
        { season: 2029, amount: 33_333 },
      ],
      guaranteedCashDue: 110_000,
    });
  });

  it('never creates or erases money: dead cap plus vanished money equals the contract', () => {
    const impact = releaseImpact(RULES, A, 2027);
    const dead = impact.deadCapBySeason.reduce((a, x) => a + x.amount, 0);
    const bonusAndGuaranteed =
      100_000 + A.years.reduce((a, y) => a + y.guaranteedBase, 0);
    expect(dead).toBe(bonusAndGuaranteed);
  });
});

describe('trade consequences', () => {
  it('leaves prorated bonus with the sender when the ruleset says so', () => {
    expect(tradeImpact(RULES, A, 2028)).toEqual({
      receiverCapBySeason: [
        { season: 2028, amount: 230_000 },
        { season: 2029, amount: 240_000 },
      ],
      senderDeadCapBySeason: [
        { season: 2028, amount: 33_333 },
        { season: 2029, amount: 33_333 },
      ],
    });
  });

  it('moves the whole charge to the receiver otherwise', () => {
    expect(
      tradeImpact(
        withTx({ signingBonusStaysWithOriginalClubOnTrade: false }),
        A,
        2028,
      ),
    ).toEqual({
      receiverCapBySeason: [
        { season: 2028, amount: 263_333 },
        { season: 2029, amount: 273_333 },
      ],
      senderDeadCapBySeason: [],
    });
  });

  it('conserves the cap charge between the two clubs', () => {
    const t = tradeImpact(RULES, A, 2027);
    const total = [...t.receiverCapBySeason, ...t.senderDeadCapBySeason].reduce(
      (a, x) => a + x.amount,
      0,
    );
    expect(total).toBe(
      capChargeBySeason(RULES, A).reduce((a, x) => a + x.amount, 0),
    );
  });
});

describe('organization commitments and the cap', () => {
  it('sums active agreements and surviving dead cap, ignoring other clubs and ended contracts', () => {
    const s = state(
      [
        agreement('a', NF, A),
        agreement('b', NF, A, 'terminated'),
        agreement('c', SP, A),
      ],
      [
        {
          id: recordId('t1'),
          agreementId: recordId('b'),
          organizationId: NF,
          playerId: entityId('player-b'),
          terminatedAt: '2027-06-01',
          reason: 'release',
          deadCapBySeason: [{ season: 2028, amount: m(1_000) }],
          guaranteedCashDue: m(0),
        },
      ],
    );
    expect(organizationCommitments(RULES, s, NF, 2027)).toBe(243_334);
    expect(organizationCommitments(RULES, s, NF, 2028)).toBe(263_333 + 1_000);
    expect(organizationCommitments(RULES, s, SP, 2029)).toBe(273_333);
  });

  it('reports signed cap space for a season the ruleset covers', () => {
    const s = state([agreement('a', NF, A)]);
    expect(capPosition(TX, s, NF, 2027)).toEqual({
      season: 2027,
      cap: 2_000_000,
      committed: 243_334,
      space: 1_756_666,
    });
    expect(() => capPosition(TX, s, NF, 2040)).toThrow(
      UnknownTransactionSeasonError,
    );
  });

  it('passes exactly at the cap and rejects one unit over', () => {
    // existing commitments 1,756,666 + contract A's 2027 charge 243,334 = 2,000,000.
    const existing = agreement('e', NF, {
      startSeason: 2027,
      signingBonus: m(0),
      years: [
        {
          season: 2027,
          baseSalary: m(1_756_666),
          rosterBonus: m(0),
          guaranteedBase: m(0),
        },
      ],
    });
    const s = state([existing]);
    const exact = capChargeBySeason(RULES, A);
    expect(capViolationsAfter(TX, s, NF, exact)).toEqual([]);
    const oneOver = [{ season: 2027, amount: m(243_335) }];
    expect(capViolationsAfter(TX, s, NF, oneOver)).toEqual([
      { season: 2027, cap: 2_000_000, committed: 2_000_001, over: 1 },
    ]);
  });

  it('counts dead cap against the cap check', () => {
    const s = state(
      [],
      [
        {
          id: recordId('t1'),
          agreementId: recordId('x'),
          organizationId: NF,
          playerId: entityId('player-x'),
          terminatedAt: '2027-06-01',
          reason: 'release',
          deadCapBySeason: [{ season: 2027, amount: m(1_999_999) }],
          guaranteedCashDue: m(0),
        },
      ],
    );
    expect(
      capViolationsAfter(TX, s, NF, [{ season: 2027, amount: m(1) }]),
    ).toEqual([]);
    expect(
      capViolationsAfter(TX, s, NF, [{ season: 2027, amount: m(2) }]),
    ).toHaveLength(1);
  });
});
