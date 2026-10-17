import type {
  ContractAgreement,
  ContractTermsV1,
  ContractsState,
  SeasonAmount,
} from './contracts';
import {
  ZERO_MONEY,
  addMoney,
  moneyAmount,
  prorateSigningBonus,
  sumMoney,
  transactionSeasonRules,
  type ContractRules,
  type MoneyAmount,
  type TransactionRulesV1,
} from './economy';
import type { EntityId } from './ids';

/**
 * Integer-only contract and cap arithmetic. Everything here is a pure function of contract
 * records and the active ruleset; nothing is cached, so a cap figure can never disagree with
 * the contracts it summarizes.
 *
 * Treatment (ruleset-owned, see `ContractRules`):
 *  - cap charge of a season = base salary + roster bonus + that season's prorated signing
 *    bonus; the bonus is spread by `prorateSigningBonus` with the remainder going to the
 *    earliest seasons one unit at a time;
 *  - cash of a season = base salary + roster bonus, plus the whole signing bonus in the
 *    start season (it is paid at signing);
 *  - release in season R: nothing is accelerated, so each remaining prorated bonus stays in
 *    its scheduled season as dead cap. Guaranteed base counts in R always, and in later
 *    seasons only when `guaranteedFutureBaseOnRelease`. Roster bonuses and unguaranteed base
 *    vanish;
 *  - trade in season T: guaranteed money travels with the contract; the prorated bonus of
 *    seasons >= T stays with the sending club as dead cap when
 *    `signingBonusStaysWithOriginalClubOnTrade`, otherwise it travels too.
 */

const nonZero = (xs: readonly SeasonAmount[]): readonly SeasonAmount[] =>
  xs.filter((x) => x.amount > 0);

/** Problems that make contract terms illegal under the ruleset; `[]` means legal. */
export const contractTermsProblems = (
  tx: TransactionRulesV1,
  terms: ContractTermsV1,
): readonly string[] => {
  const problems: string[] = [];
  const rules = tx.contracts;
  const n = terms.years.length;
  if (n < rules.minYears || n > rules.maxYears)
    problems.push(
      `contract length ${n} is outside ${rules.minYears}..${rules.maxYears} years`,
    );
  terms.years.forEach((y, i) => {
    if (y.season !== terms.startSeason + i)
      problems.push(
        `year ${i + 1} is season ${y.season}, expected ${terms.startSeason + i} (seasons must be contiguous)`,
      );
    if (y.baseSalary < rules.minimumBaseSalary)
      problems.push(
        `season ${y.season} base salary ${y.baseSalary} is below the minimum ${rules.minimumBaseSalary}`,
      );
    if (y.guaranteedBase > y.baseSalary)
      problems.push(
        `season ${y.season} guaranteed base ${y.guaranteedBase} exceeds base salary ${y.baseSalary}`,
      );
  });
  return problems;
};

/** The signing bonus charge in each contract year (one entry per year, zeros included). */
export const bonusProration = (
  rules: ContractRules,
  terms: ContractTermsV1,
): readonly MoneyAmount[] =>
  prorateSigningBonus(rules, terms.signingBonus, terms.years.length);

/** Cap charge per contract season. */
export const capChargeBySeason = (
  rules: ContractRules,
  terms: ContractTermsV1,
): readonly SeasonAmount[] => {
  const bonus = bonusProration(rules, terms);
  return terms.years.map((y, i) => ({
    season: y.season,
    amount: sumMoney([y.baseSalary, y.rosterBonus, bonus[i]!]),
  }));
};

/** Cash paid per contract season; the signing bonus is paid in the start season. */
export const cashBySeason = (terms: ContractTermsV1): readonly SeasonAmount[] =>
  terms.years.map((y, i) => ({
    season: y.season,
    amount: sumMoney([
      y.baseSalary,
      y.rosterBonus,
      i === 0 ? terms.signingBonus : ZERO_MONEY,
    ]),
  }));

export type ReleaseImpact = {
  readonly deadCapBySeason: readonly SeasonAmount[];
  readonly guaranteedCashDue: MoneyAmount;
};

/** What survives the termination of a contract in `releaseSeason`. */
export const releaseImpact = (
  rules: ContractRules,
  terms: ContractTermsV1,
  releaseSeason: number,
): ReleaseImpact => {
  const bonus = bonusProration(rules, terms);
  const dead: SeasonAmount[] = [];
  const cash: MoneyAmount[] = [];
  terms.years.forEach((y, i) => {
    if (y.season < releaseSeason) return;
    const owed =
      y.season === releaseSeason || rules.guaranteedFutureBaseOnRelease
        ? y.guaranteedBase
        : ZERO_MONEY;
    cash.push(owed);
    dead.push({ season: y.season, amount: addMoney(bonus[i]!, owed) });
  });
  return { deadCapBySeason: nonZero(dead), guaranteedCashDue: sumMoney(cash) };
};

export type TradeImpact = {
  /** Cap the receiving club takes on, by season (seasons >= the trade season). */
  readonly receiverCapBySeason: readonly SeasonAmount[];
  /** Dead cap the sending club keeps, by season. */
  readonly senderDeadCapBySeason: readonly SeasonAmount[];
};

/** How a contract's cap charges divide between two clubs when traded in `tradeSeason`. */
export const tradeImpact = (
  rules: ContractRules,
  terms: ContractTermsV1,
  tradeSeason: number,
): TradeImpact => {
  const bonus = bonusProration(rules, terms);
  const receiver: SeasonAmount[] = [];
  const sender: SeasonAmount[] = [];
  terms.years.forEach((y, i) => {
    if (y.season < tradeSeason) return;
    const stays = rules.signingBonusStaysWithOriginalClubOnTrade;
    receiver.push({
      season: y.season,
      amount: sumMoney([
        y.baseSalary,
        y.rosterBonus,
        stays ? ZERO_MONEY : bonus[i]!,
      ]),
    });
    sender.push({ season: y.season, amount: stays ? bonus[i]! : ZERO_MONEY });
  });
  return {
    receiverCapBySeason: receiver,
    senderDeadCapBySeason: nonZero(sender),
  };
};

const amountIn = (xs: readonly SeasonAmount[], season: number): MoneyAmount =>
  xs.find((x) => x.season === season)?.amount ?? ZERO_MONEY;

/** Cap charge of one agreement in a season. */
export const agreementCapCharge = (
  rules: ContractRules,
  agreement: ContractAgreement,
  season: number,
): MoneyAmount => amountIn(capChargeBySeason(rules, agreement.terms), season);

/**
 * Everything an organization has committed against the cap in `season`: the charges of its
 * active agreements plus the dead cap of its terminations. Recomputed on every call.
 */
export const organizationCommitments = (
  rules: ContractRules,
  contracts: ContractsState,
  organizationId: EntityId,
  season: number,
): MoneyAmount =>
  sumMoney([
    ...contracts.agreements
      .filter(
        (a) => a.organizationId === organizationId && a.status === 'active',
      )
      .map((a) => agreementCapCharge(rules, a, season)),
    ...contracts.terminations
      .filter((t) => t.organizationId === organizationId)
      .map((t) => amountIn(t.deadCapBySeason, season)),
  ]);

export type CapPosition = {
  readonly season: number;
  readonly cap: MoneyAmount;
  readonly committed: MoneyAmount;
  /** Signed: negative means over the cap. */
  readonly space: number;
};

export const capPosition = (
  tx: TransactionRulesV1,
  contracts: ContractsState,
  organizationId: EntityId,
  season: number,
): CapPosition => {
  const cap = transactionSeasonRules(tx, season).salaryCap;
  const committed = organizationCommitments(
    tx.contracts,
    contracts,
    organizationId,
    season,
  );
  return { season, cap, committed, space: cap - committed };
};

export type CapViolation = {
  readonly season: number;
  readonly cap: MoneyAmount;
  readonly committed: MoneyAmount;
  readonly over: MoneyAmount;
};

/**
 * Seasons in which adding `additions` to an organization's commitments would exceed the cap.
 * Exactly at the cap is legal; one unit over is a violation. A season the ruleset does not
 * cover throws (`UnknownTransactionSeasonError`).
 */
export const capViolationsAfter = (
  tx: TransactionRulesV1,
  contracts: ContractsState,
  organizationId: EntityId,
  additions: readonly SeasonAmount[],
): readonly CapViolation[] => {
  const out: CapViolation[] = [];
  for (const add of additions) {
    const position = capPosition(tx, contracts, organizationId, add.season);
    const committed = addMoney(position.committed, add.amount);
    if (committed > position.cap)
      out.push({
        season: add.season,
        cap: position.cap,
        committed,
        over: moneyAmount(committed - position.cap),
      });
  }
  return out;
};
