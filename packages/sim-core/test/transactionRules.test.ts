import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ManifestFormatError,
  ManifestTamperError,
  MissingTransactionRulesError,
  MoneyError,
  SCHEMA_VERSION,
  SYNTHETIC_PACKAGE_C_RULESET,
  SYNTHETIC_RULESET,
  UnknownTransactionSeasonError,
  addMoney,
  isMoneyAmount,
  moneyAmount,
  prorateSigningBonus,
  requireTransactionRules,
  sealRuleset,
  subtractMoney,
  sumMoney,
  transactionSeasonRules,
  validateRulesetManifest,
  type ContractRules,
  type LeagueRulesetBody,
  type MoneyAmount,
  type TransactionRulesV1,
} from '../src/index';
import { syntheticProvenance } from './helpers';

const root = join(__dirname, '..', '..', '..');

const validTx = (): Record<string, unknown> =>
  JSON.parse(
    JSON.stringify(SYNTHETIC_PACKAGE_C_RULESET.rules.transactions),
  ) as Record<string, unknown>;

const seal = (tx: unknown) =>
  sealRuleset({
    schemaVersion: SCHEMA_VERSION,
    rulesetId: 'tx-test',
    rulesetVersion: 1,
    displayName: 'tx test',
    provenance: [syntheticProvenance()],
    rules: { maxAdvanceDaysPerCommand: 30, transactions: tx },
  } as unknown as LeagueRulesetBody);

const rejects = (mutate: (tx: Record<string, any>) => void): void => {
  const tx = validTx();
  mutate(tx);
  expect(() => seal(tx)).toThrow(ManifestFormatError);
};

describe('compatibility: Package A/B rulesets without transactions', () => {
  it('keeps the accepted synthetic ruleset byte- and hash-stable', () => {
    expect(SYNTHETIC_RULESET.contentHash).toBe(
      '0776311417c64397f948efe719cbf0ad6648b2011e5c227a62158ee6cb3712ae',
    );
    expect('transactions' in SYNTHETIC_RULESET.rules).toBe(false);
    expect(validateRulesetManifest(SYNTHETIC_RULESET).contentHash).toBe(
      SYNTHETIC_RULESET.contentHash,
    );
  });

  it('fails closed for Package C actions when transactions are absent', () => {
    expect(() => requireTransactionRules(SYNTHETIC_RULESET)).toThrow(
      MissingTransactionRulesError,
    );
  });
});

describe('the synthetic Package C profile', () => {
  it('is sealed, declares transactions, and round-trips through validation', () => {
    const tx = requireTransactionRules(SYNTHETIC_PACKAGE_C_RULESET);
    expect(tx.moneyUnit).toBe('synthetic-unit');
    expect(tx.market.resolutionPolicy).toBe('checkpoint');
    const reparsed = validateRulesetManifest(
      JSON.parse(JSON.stringify(SYNTHETIC_PACKAGE_C_RULESET)),
    );
    expect(reparsed).toEqual(SYNTHETIC_PACKAGE_C_RULESET);
  });

  it('is explicitly synthetic in its provenance', () => {
    const p = SYNTHETIC_PACKAGE_C_RULESET.provenance;
    expect(p.length).toBeGreaterThan(0);
    for (const entry of p) {
      expect(entry.sourceKind).toBe('synthetic');
      expect((entry.note ?? '').toLowerCase()).toContain('not');
      expect((entry.note ?? '').toLowerCase()).toContain('nfl');
    }
  });

  it('matches the committed fixture file exactly and pins its content hash', () => {
    const file = JSON.parse(
      readFileSync(
        join(root, 'fixtures', 'rulesets', 'synthetic-package-c-rules-v1.json'),
        'utf8',
      ),
    ) as unknown;
    expect(file).toEqual(
      JSON.parse(JSON.stringify(SYNTHETIC_PACKAGE_C_RULESET)),
    );
    expect(SYNTHETIC_PACKAGE_C_RULESET.contentHash).toBe(
      '2f1affed310f6764f746395924f68d6648e8e2ccf211a6e410f9e8f3f8c75f23',
    );
  });

  it('detects tampering with any transaction field', () => {
    const copy = JSON.parse(JSON.stringify(SYNTHETIC_PACKAGE_C_RULESET));
    copy.rules.transactions.seasonRules[0].salaryCap += 1;
    expect(() => validateRulesetManifest(copy)).toThrow(ManifestTamperError);
  });

  it('has integer money only and a complete rookie scale', () => {
    const tx = requireTransactionRules(SYNTHETIC_PACKAGE_C_RULESET);
    for (const s of tx.seasonRules)
      expect(isMoneyAmount(s.salaryCap)).toBe(true);
    expect(tx.draft.rookieContractByRound.map((r) => r.round)).toEqual(
      Array.from({ length: tx.draft.rounds }, (_, i) => i + 1),
    );
    for (const r of tx.draft.rookieContractByRound) {
      expect(r.baseSalaryBySeason).toHaveLength(r.years);
      expect(r.years).toBeGreaterThanOrEqual(tx.contracts.minYears);
      expect(r.years).toBeLessThanOrEqual(tx.contracts.maxYears);
    }
  });
});

describe('transaction rules validation (fail closed)', () => {
  it('rejects duplicate, unordered and missing seasons', () => {
    rejects((tx) => tx.seasonRules.push({ ...tx.seasonRules[0] }));
    rejects((tx) => tx.seasonRules.reverse());
    rejects((tx) => {
      tx.seasonRules = [];
    });
  });

  it('rejects invalid logical dates and impossible date order', () => {
    rejects((tx) => {
      tx.seasonRules[0].freeAgencyOpen = '2027-07-16';
      tx.seasonRules[0].freeAgencyClose = '2027-03-10';
    });
    rejects((tx) => {
      tx.seasonRules[0].draftDate = '2027-02-30';
    });
    rejects((tx) => {
      tx.seasonRules[0].tradeDeadline = 'not-a-date';
    });
  });

  it('rejects negative, fractional, non-number and unsafe money', () => {
    for (const bad of [-1, 1.5, '100', null, Number.NaN, 2 ** 53]) {
      rejects((tx) => {
        tx.seasonRules[0].salaryCap = bad;
      });
    }
    rejects((tx) => {
      tx.contracts.minimumBaseSalary = -5;
    });
    rejects((tx) => {
      tx.draft.rookieContractByRound[0].signingBonus = 0.5;
    });
  });

  it('rejects impossible roster limits and term bounds', () => {
    rejects((tx) => {
      tx.seasonRules[0].activeRosterLimit = 0;
    });
    rejects((tx) => {
      tx.seasonRules[0].practiceSquadLimit = -1;
    });
    rejects((tx) => {
      tx.contracts.minYears = 6;
      tx.contracts.maxYears = 5;
    });
    rejects((tx) => {
      tx.contracts.maxYears = 0;
    });
    rejects((tx) => {
      tx.contracts.signingBonusProrationMaxYears = 0;
    });
  });

  it('rejects an impossible waiver window and unsupported policy enums', () => {
    rejects((tx) => {
      tx.waivers.claimWindowDays = 0;
    });
    rejects((tx) => {
      tx.waivers.releasedPlayerWaiverPolicy = 'some';
    });
    rejects((tx) => {
      tx.market.resolutionPolicy = 'immediate';
    });
    rejects((tx) => {
      tx.moneyUnit = 'usd';
    });
    rejects((tx) => {
      tx.contracts.guaranteedFutureBaseOnRelease = 'yes';
    });
  });

  it('rejects duplicate, missing, out-of-range or unordered rookie rounds', () => {
    rejects((tx) =>
      tx.draft.rookieContractByRound.push({
        ...tx.draft.rookieContractByRound[0],
      }),
    );
    rejects((tx) => tx.draft.rookieContractByRound.pop());
    rejects((tx) => {
      tx.draft.rookieContractByRound[0].round = 9;
    });
    rejects((tx) => tx.draft.rookieContractByRound.reverse());
  });

  it('rejects rookie terms that contradict the contract rules', () => {
    rejects((tx) => {
      tx.draft.rookieContractByRound[0].years = 9;
      tx.draft.rookieContractByRound[0].baseSalaryBySeason = Array(9).fill(
        tx.contracts.minimumBaseSalary,
      );
    });
    rejects((tx) => {
      tx.draft.rookieContractByRound[0].baseSalaryBySeason.pop();
    });
    rejects((tx) => {
      tx.draft.rookieContractByRound[0].baseSalaryBySeason[0] =
        tx.contracts.minimumBaseSalary - 1;
    });
  });

  it('rejects missing and unexpected fields', () => {
    rejects((tx) => {
      delete tx.waivers;
    });
    rejects((tx) => {
      tx.surprise = true;
    });
    rejects((tx) => {
      delete tx.contracts.minYears;
    });
    rejects((tx) => {
      tx.market.extra = 1;
    });
  });

  it('rejects transactions that are not an object', () => {
    for (const bad of [null, 5, 'x', []])
      expect(() => seal(bad)).toThrow(ManifestFormatError);
  });
});

describe('pure helpers', () => {
  const tx: TransactionRulesV1 = requireTransactionRules(
    SYNTHETIC_PACKAGE_C_RULESET,
  );

  it('looks up season rules and fails closed for an undeclared season', () => {
    const first = tx.seasonRules[0]!;
    expect(transactionSeasonRules(tx, first.season)).toBe(first);
    expect(() => transactionSeasonRules(tx, 1999)).toThrow(
      UnknownTransactionSeasonError,
    );
  });

  it('money is exact integer arithmetic that never goes negative or unsafe', () => {
    expect(moneyAmount(0)).toBe(0);
    for (const bad of [-1, 1.5, Number.NaN, 2 ** 53, '1', undefined])
      expect(() => moneyAmount(bad)).toThrow(MoneyError);
    expect(addMoney(moneyAmount(2), moneyAmount(3))).toBe(5);
    expect(() =>
      addMoney(moneyAmount(Number.MAX_SAFE_INTEGER), moneyAmount(1)),
    ).toThrow(MoneyError);
    expect(subtractMoney(moneyAmount(5), moneyAmount(5))).toBe(0);
    expect(() => subtractMoney(moneyAmount(1), moneyAmount(2))).toThrow(
      MoneyError,
    );
    expect(sumMoney([moneyAmount(1), moneyAmount(2), moneyAmount(3)])).toBe(6);
    expect(sumMoney([])).toBe(0);
  });

  it('prorates a signing bonus with the remainder assigned in season order', () => {
    const c = tx.contracts;
    expect(prorateSigningBonus(c, moneyAmount(100), 3)).toEqual([34, 33, 33]);
    expect(prorateSigningBonus(c, moneyAmount(10), 3)).toEqual([4, 3, 3]);
    expect(prorateSigningBonus(c, moneyAmount(2), 5)).toEqual([1, 1, 0, 0, 0]);
    expect(prorateSigningBonus(c, moneyAmount(0), 4)).toEqual([0, 0, 0, 0]);
    expect(prorateSigningBonus(c, moneyAmount(7), 1)).toEqual([7]);
  });

  it('never prorates beyond the ruleset window and always sums back to the bonus', () => {
    const narrow: ContractRules = {
      ...tx.contracts,
      signingBonusProrationMaxYears: 3,
    };
    expect(prorateSigningBonus(narrow, moneyAmount(10), 5)).toEqual([
      4, 3, 3, 0, 0,
    ]);
    for (let years = 1; years <= 5; years += 1)
      for (let bonus = 0; bonus <= 40; bonus += 1) {
        const parts = prorateSigningBonus(narrow, bonus as MoneyAmount, years);
        expect(parts).toHaveLength(years);
        expect(sumMoney(parts)).toBe(bonus);
        for (const p of parts) expect(Number.isSafeInteger(p)).toBe(true);
      }
    expect(() => prorateSigningBonus(tx.contracts, moneyAmount(1), 0)).toThrow(
      MoneyError,
    );
    expect(() =>
      prorateSigningBonus(tx.contracts, moneyAmount(1), 1.5),
    ).toThrow(MoneyError);
  });
});
