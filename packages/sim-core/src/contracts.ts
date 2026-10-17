import { moneyAmount, type MoneyAmount } from './economy';
import { entityId, recordId, type EntityId, type RecordId } from './ids';
import type { PackageCSubstrateSeed } from './packageCSeedParse';

/**
 * Market & Contract domain: contract state (Package C). Authoritative contract agreements
 * and terminations. Cash schedules, cap charges and organization commitments are derived
 * from these by `contractMath` on demand and are never stored: there is no cached cap total
 * that could disagree with the contracts themselves.
 */

/** One contract year. `guaranteedBase` is the part of `baseSalary` owed even if released. */
export type ContractYearTerms = {
  readonly season: number;
  readonly baseSalary: MoneyAmount;
  readonly rosterBonus: MoneyAmount;
  readonly guaranteedBase: MoneyAmount;
};

/** Integer-money contract terms. `years` are contiguous seasons starting at `startSeason`. */
export type ContractTermsV1 = {
  readonly startSeason: number;
  readonly years: readonly ContractYearTerms[];
  readonly signingBonus: MoneyAmount;
};

export const CONTRACT_STATUSES = [
  'active',
  'terminated',
  'superseded',
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export type ContractAgreement = {
  readonly id: RecordId;
  readonly playerId: EntityId;
  readonly organizationId: EntityId;
  readonly terms: ContractTermsV1;
  readonly signedAt: string;
  /** The accepted market offer this agreement came from, if any (seeded contracts have none). */
  readonly sourceOfferId: RecordId | null;
  /** The authorized proposal that executed it, if any (seeded contracts have none). */
  readonly sourceProposalId: RecordId | null;
  /** The agreement a waiver claim or trade assumed; this agreement carries its terms on. */
  readonly supersedesAgreementId: RecordId | null;
  readonly status: ContractStatus;
};

export const TERMINATION_REASONS = [
  'release',
  'waiver_unclaimed',
  'trade_retained_bonus',
  'extension_retained_bonus',
] as const;
export type TerminationReason = (typeof TERMINATION_REASONS)[number];

/** Cap or cash owed in one season; entries are sorted by season and never zero. */
export type SeasonAmount = {
  readonly season: number;
  readonly amount: MoneyAmount;
};

/**
 * The permanent record of an ended contract: the obligations that survive it. Dead cap
 * stays on the terminating organization's books in the listed seasons; `guaranteedCashDue`
 * is the guaranteed base salary still owed.
 */
export type ContractTermination = {
  readonly id: RecordId;
  readonly agreementId: RecordId;
  readonly organizationId: EntityId;
  readonly playerId: EntityId;
  readonly terminatedAt: string;
  readonly reason: TerminationReason;
  readonly deadCapBySeason: readonly SeasonAmount[];
  readonly guaranteedCashDue: MoneyAmount;
};

export type ContractsState = {
  readonly agreements: readonly ContractAgreement[];
  readonly terminations: readonly ContractTermination[];
};

export const emptyContractsState = (): ContractsState => ({
  agreements: [],
  terminations: [],
});

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Initial contracts from the seed's Package C block, in stable id order. */
export const seededContractsState = (
  sub: PackageCSubstrateSeed | undefined,
): ContractsState => {
  if (sub === undefined) return emptyContractsState();
  return {
    agreements: sub.contracts
      .map((c): ContractAgreement => ({
        id: recordId(c.id),
        playerId: entityId(c.playerId),
        organizationId: entityId(c.organizationId),
        terms: {
          startSeason: c.startSeason,
          signingBonus: moneyAmount(c.signingBonus),
          years: c.years.map((y) => ({
            season: y.season,
            baseSalary: moneyAmount(y.baseSalary),
            rosterBonus: moneyAmount(y.rosterBonus),
            guaranteedBase: moneyAmount(y.guaranteedBase),
          })),
        },
        signedAt: c.signedAt,
        sourceOfferId: null,
        sourceProposalId: null,
        supersedesAgreementId: null,
        status: 'active',
      }))
      .sort((a, b) => byText(a.id, b.id)),
    terminations: [],
  };
};

/** The active agreement binding a player to an organization, if any. */
export const activeAgreementFor = (
  contracts: Pick<ContractsState, 'agreements'>,
  playerId: EntityId,
  organizationId?: EntityId,
): ContractAgreement | undefined =>
  contracts.agreements.find(
    (a) =>
      a.playerId === playerId &&
      a.status === 'active' &&
      (organizationId === undefined || a.organizationId === organizationId),
  );
