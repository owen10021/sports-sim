import {
  ManifestFormatError,
  asRecord,
  asSafeInt,
  requireExactKeys,
} from './provenance';
import { SimDate } from './simDate';

/**
 * Money and ruleset-owned transaction mechanics (Package C). Money is a NON-NEGATIVE SAFE
 * INTEGER in a ruleset-declared synthetic unit. There is no authoritative floating point
 * money anywhere: every operation here either returns an exact integer or throws.
 */
declare const moneyBrand: unique symbol;
export type MoneyAmount = number & { readonly [moneyBrand]: 'MoneyAmount' };

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

export const isMoneyAmount = (v: unknown): v is MoneyAmount =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

export const moneyAmount = (v: unknown): MoneyAmount => {
  if (!isMoneyAmount(v))
    throw new MoneyError(
      `money must be a non-negative safe integer, got ${String(v)}`,
    );
  return v;
};

export const addMoney = (a: MoneyAmount, b: MoneyAmount): MoneyAmount =>
  moneyAmount(a + b);

/** Exact difference; throws rather than going negative. */
export const subtractMoney = (a: MoneyAmount, b: MoneyAmount): MoneyAmount => {
  if (b > a) throw new MoneyError(`money would go negative: ${a} - ${b}`);
  return moneyAmount(a - b);
};

export const sumMoney = (xs: readonly MoneyAmount[]): MoneyAmount =>
  xs.reduce<MoneyAmount>((acc, x) => addMoney(acc, x), 0 as MoneyAmount);

export const ZERO_MONEY = 0 as MoneyAmount;

// ---------------------------------------------------------------------------
// TransactionRulesV1
// ---------------------------------------------------------------------------

export type TransactionSeasonRules = {
  readonly season: number;
  readonly salaryCap: MoneyAmount;
  readonly activeRosterLimit: number;
  readonly reserveRosterLimit: number;
  readonly practiceSquadLimit: number;
  /** Timezone-free logical dates `YYYY-MM-DD`. */
  readonly freeAgencyOpen: string;
  readonly freeAgencyClose: string;
  readonly tradeDeadline: string;
  readonly draftDate: string;
};

export type ContractRules = {
  readonly minYears: number;
  readonly maxYears: number;
  readonly signingBonusProrationMaxYears: number;
  readonly minimumBaseSalary: MoneyAmount;
  readonly guaranteedFutureBaseOnRelease: boolean;
  readonly signingBonusStaysWithOriginalClubOnTrade: boolean;
};

export type MarketRules = {
  readonly defaultOfferValidityDays: number;
  readonly futurePickTradeHorizonSeasons: number;
  readonly resolutionPolicy: 'checkpoint';
};

export type WaiverPolicy = 'all' | 'none';

export type WaiverRules = {
  readonly claimWindowDays: number;
  readonly releasedPlayerWaiverPolicy: WaiverPolicy;
  readonly claimWinnerMovesToEnd: boolean;
};

export type RookieContractRule = {
  readonly round: number;
  readonly years: number;
  readonly baseSalaryBySeason: readonly MoneyAmount[];
  readonly signingBonus: MoneyAmount;
};

export type DraftRules = {
  readonly rounds: number;
  readonly rookieContractByRound: readonly RookieContractRule[];
};

export type TransactionRulesV1 = {
  readonly moneyUnit: 'synthetic-unit';
  readonly seasonRules: readonly TransactionSeasonRules[];
  readonly contracts: ContractRules;
  readonly market: MarketRules;
  readonly waivers: WaiverRules;
  readonly draft: DraftRules;
};

const fail = (path: string, message: string): never => {
  throw new ManifestFormatError(`${path}: ${message}`);
};

const asMoney = (v: unknown, path: string): MoneyAmount => {
  if (!isMoneyAmount(v))
    return fail(
      path,
      'must be a non-negative safe integer (no floats, no negatives)',
    );
  return v;
};

const asBool = (v: unknown, path: string): boolean => {
  if (typeof v !== 'boolean') return fail(path, 'must be a boolean');
  return v;
};

const asDate = (v: unknown, path: string): string => {
  if (!SimDate.isValidISO(v))
    return fail(path, 'must be a valid YYYY-MM-DD logical date');
  return v;
};

const asArray = (v: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(v)) return fail(path, 'must be an array');
  return v as readonly unknown[];
};

const dateIndex = (iso: string): number => SimDate.parse(iso).epochDay;

const parseSeason = (v: unknown, path: string): TransactionSeasonRules => {
  const r = asRecord(v, path);
  requireExactKeys(
    r,
    [
      'season',
      'salaryCap',
      'activeRosterLimit',
      'reserveRosterLimit',
      'practiceSquadLimit',
      'freeAgencyOpen',
      'freeAgencyClose',
      'tradeDeadline',
      'draftDate',
    ],
    [],
    path,
  );
  const out: TransactionSeasonRules = {
    season: asSafeInt(r.season, `${path}.season`, 1900, 3000),
    salaryCap: asMoney(r.salaryCap, `${path}.salaryCap`),
    activeRosterLimit: asSafeInt(
      r.activeRosterLimit,
      `${path}.activeRosterLimit`,
      1,
      1000,
    ),
    reserveRosterLimit: asSafeInt(
      r.reserveRosterLimit,
      `${path}.reserveRosterLimit`,
      0,
      1000,
    ),
    practiceSquadLimit: asSafeInt(
      r.practiceSquadLimit,
      `${path}.practiceSquadLimit`,
      0,
      1000,
    ),
    freeAgencyOpen: asDate(r.freeAgencyOpen, `${path}.freeAgencyOpen`),
    freeAgencyClose: asDate(r.freeAgencyClose, `${path}.freeAgencyClose`),
    tradeDeadline: asDate(r.tradeDeadline, `${path}.tradeDeadline`),
    draftDate: asDate(r.draftDate, `${path}.draftDate`),
  };
  if (dateIndex(out.freeAgencyOpen) > dateIndex(out.freeAgencyClose))
    fail(path, 'freeAgencyOpen must not be after freeAgencyClose');
  return out;
};

const parseContracts = (v: unknown, path: string): ContractRules => {
  const r = asRecord(v, path);
  requireExactKeys(
    r,
    [
      'minYears',
      'maxYears',
      'signingBonusProrationMaxYears',
      'minimumBaseSalary',
      'guaranteedFutureBaseOnRelease',
      'signingBonusStaysWithOriginalClubOnTrade',
    ],
    [],
    path,
  );
  const out: ContractRules = {
    minYears: asSafeInt(r.minYears, `${path}.minYears`, 1, 30),
    maxYears: asSafeInt(r.maxYears, `${path}.maxYears`, 1, 30),
    signingBonusProrationMaxYears: asSafeInt(
      r.signingBonusProrationMaxYears,
      `${path}.signingBonusProrationMaxYears`,
      1,
      30,
    ),
    minimumBaseSalary: asMoney(
      r.minimumBaseSalary,
      `${path}.minimumBaseSalary`,
    ),
    guaranteedFutureBaseOnRelease: asBool(
      r.guaranteedFutureBaseOnRelease,
      `${path}.guaranteedFutureBaseOnRelease`,
    ),
    signingBonusStaysWithOriginalClubOnTrade: asBool(
      r.signingBonusStaysWithOriginalClubOnTrade,
      `${path}.signingBonusStaysWithOriginalClubOnTrade`,
    ),
  };
  if (out.minYears > out.maxYears)
    fail(path, 'minYears must not exceed maxYears');
  return out;
};

const parseMarket = (v: unknown, path: string): MarketRules => {
  const r = asRecord(v, path);
  requireExactKeys(
    r,
    [
      'defaultOfferValidityDays',
      'futurePickTradeHorizonSeasons',
      'resolutionPolicy',
    ],
    [],
    path,
  );
  if (r.resolutionPolicy !== 'checkpoint')
    fail(`${path}.resolutionPolicy`, 'unsupported policy (only "checkpoint")');
  return {
    defaultOfferValidityDays: asSafeInt(
      r.defaultOfferValidityDays,
      `${path}.defaultOfferValidityDays`,
      1,
      3650,
    ),
    futurePickTradeHorizonSeasons: asSafeInt(
      r.futurePickTradeHorizonSeasons,
      `${path}.futurePickTradeHorizonSeasons`,
      0,
      20,
    ),
    resolutionPolicy: 'checkpoint',
  };
};

const parseWaivers = (v: unknown, path: string): WaiverRules => {
  const r = asRecord(v, path);
  requireExactKeys(
    r,
    ['claimWindowDays', 'releasedPlayerWaiverPolicy', 'claimWinnerMovesToEnd'],
    [],
    path,
  );
  const policy = r.releasedPlayerWaiverPolicy;
  if (policy !== 'all' && policy !== 'none')
    fail(
      `${path}.releasedPlayerWaiverPolicy`,
      'unsupported policy (only "all" or "none")',
    );
  return {
    claimWindowDays: asSafeInt(
      r.claimWindowDays,
      `${path}.claimWindowDays`,
      1,
      365,
    ),
    releasedPlayerWaiverPolicy: policy as WaiverPolicy,
    claimWinnerMovesToEnd: asBool(
      r.claimWinnerMovesToEnd,
      `${path}.claimWinnerMovesToEnd`,
    ),
  };
};

const parseRookie = (v: unknown, path: string): RookieContractRule => {
  const r = asRecord(v, path);
  requireExactKeys(
    r,
    ['round', 'years', 'baseSalaryBySeason', 'signingBonus'],
    [],
    path,
  );
  const years = asSafeInt(r.years, `${path}.years`, 1, 30);
  const salaries = asArray(
    r.baseSalaryBySeason,
    `${path}.baseSalaryBySeason`,
  ).map((m, i) => asMoney(m, `${path}.baseSalaryBySeason[${i}]`));
  if (salaries.length !== years)
    fail(
      path,
      'baseSalaryBySeason must have exactly one amount per contract year',
    );
  return {
    round: asSafeInt(r.round, `${path}.round`, 1, 100),
    years,
    baseSalaryBySeason: salaries,
    signingBonus: asMoney(r.signingBonus, `${path}.signingBonus`),
  };
};

const parseDraft = (
  v: unknown,
  path: string,
  contracts: ContractRules,
): DraftRules => {
  const r = asRecord(v, path);
  requireExactKeys(r, ['rounds', 'rookieContractByRound'], [], path);
  const rounds = asSafeInt(r.rounds, `${path}.rounds`, 1, 100);
  const rules = asArray(
    r.rookieContractByRound,
    `${path}.rookieContractByRound`,
  ).map((x, i) => parseRookie(x, `${path}.rookieContractByRound[${i}]`));
  const seen = new Set<number>();
  for (const rule of rules) {
    if (seen.has(rule.round))
      fail(path, `duplicate rookie contract rule for round ${rule.round}`);
    seen.add(rule.round);
    if (rule.round > rounds)
      fail(path, `rookie contract rule for round ${rule.round} exceeds rounds`);
    if (rule.years < contracts.minYears || rule.years > contracts.maxYears)
      fail(
        path,
        `round ${rule.round} rookie years violate contract term bounds`,
      );
    if (rule.baseSalaryBySeason.some((m) => m < contracts.minimumBaseSalary))
      fail(
        path,
        `round ${rule.round} rookie base salary below the contract minimum`,
      );
  }
  for (let round = 1; round <= rounds; round += 1)
    if (!seen.has(round))
      fail(path, `missing rookie contract rule for round ${round}`);
  rules.forEach((rule, i) => {
    if (rule.round !== i + 1)
      fail(
        path,
        'rookieContractByRound must be listed in ascending round order',
      );
  });
  return { rounds, rookieContractByRound: rules };
};

/**
 * Parse/validate untrusted transaction rules. A pure normalizer: the result carries exactly
 * the declared fields, so it can sit inside a content-hashed ruleset body.
 */
export const parseTransactionRulesV1 = (
  v: unknown,
  path: string,
): TransactionRulesV1 => {
  const r = asRecord(v, path);
  requireExactKeys(
    r,
    ['moneyUnit', 'seasonRules', 'contracts', 'market', 'waivers', 'draft'],
    [],
    path,
  );
  if (r.moneyUnit !== 'synthetic-unit')
    fail(`${path}.moneyUnit`, 'unsupported money unit (only "synthetic-unit")');
  const seasonRules = asArray(r.seasonRules, `${path}.seasonRules`).map(
    (s, i) => parseSeason(s, `${path}.seasonRules[${i}]`),
  );
  if (seasonRules.length === 0)
    fail(`${path}.seasonRules`, 'at least one season is required');
  for (let i = 1; i < seasonRules.length; i += 1) {
    const prev = seasonRules[i - 1]!.season;
    const cur = seasonRules[i]!.season;
    if (cur === prev) fail(`${path}.seasonRules`, `duplicate season ${cur}`);
    if (cur < prev)
      fail(`${path}.seasonRules`, 'seasons must be listed in ascending order');
  }
  const contracts = parseContracts(r.contracts, `${path}.contracts`);
  return {
    moneyUnit: 'synthetic-unit',
    seasonRules,
    contracts,
    market: parseMarket(r.market, `${path}.market`),
    waivers: parseWaivers(r.waivers, `${path}.waivers`),
    draft: parseDraft(r.draft, `${path}.draft`, contracts),
  };
};

// ---------------------------------------------------------------------------
// Pure helpers used by Package C commands
// ---------------------------------------------------------------------------

/** Package C actions need transaction rules; a ruleset without them fails closed. */
export class MissingTransactionRulesError extends Error {
  constructor(rulesetId: string) {
    super(
      `Ruleset "${rulesetId}" declares no transaction rules; Package C transaction actions fail closed`,
    );
    this.name = 'MissingTransactionRulesError';
  }
}

export class UnknownTransactionSeasonError extends Error {
  constructor(season: number) {
    super(
      `The active ruleset declares no transaction rules for season ${season}`,
    );
    this.name = 'UnknownTransactionSeasonError';
  }
}

export const requireTransactionRules = (ruleset: {
  readonly rulesetId: string;
  readonly rules: { readonly transactions?: TransactionRulesV1 };
}): TransactionRulesV1 => {
  const tx = ruleset.rules.transactions;
  if (tx === undefined)
    throw new MissingTransactionRulesError(ruleset.rulesetId);
  return tx;
};

export const transactionSeasonRules = (
  tx: TransactionRulesV1,
  season: number,
): TransactionSeasonRules => {
  const found = tx.seasonRules.find((s) => s.season === season);
  if (found === undefined) throw new UnknownTransactionSeasonError(season);
  return found;
};

/**
 * Deterministic integer signing-bonus proration. The bonus is spread over
 * `min(years, signingBonusProrationMaxYears)` seasons: every season gets the integer
 * quotient and the remainder is handed out one unit at a time in season order, earliest
 * first. The result has one entry per contract year (zero after the proration window) and
 * always sums back to exactly the bonus.
 */
export const prorateSigningBonus = (
  contracts: ContractRules,
  signingBonus: MoneyAmount,
  years: number,
): readonly MoneyAmount[] => {
  if (!Number.isSafeInteger(years) || years < 1)
    throw new MoneyError(
      `contract years must be a positive integer, got ${String(years)}`,
    );
  const window = Math.min(years, contracts.signingBonusProrationMaxYears);
  const base = Math.floor(signingBonus / window);
  const remainder = signingBonus - base * window;
  const out: MoneyAmount[] = [];
  for (let i = 0; i < years; i += 1)
    out.push(
      i < window ? moneyAmount(base + (i < remainder ? 1 : 0)) : ZERO_MONEY,
    );
  return out;
};
