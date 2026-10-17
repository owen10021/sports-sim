import type { ContractTermsV1 } from './contracts';
import {
  moneyAmount,
  type RookieContractRule,
  type TransactionRulesV1,
} from './economy';
import type { PlayerRightsRecord } from './roster';
import type { FootballWorld } from './world';

/**
 * Rookie scale (Package C, Task 13). A drafted player signs through the ordinary contract
 * offer path; the only difference is that the ruleset fixes the terms by draft round. There
 * is no draft-only contract shortcut and no negotiation of scale terms.
 */

/** The ruleset's rookie contract for `startSeason`, with no roster bonus or guarantees. */
export const rookieScaleTerms = (
  rule: RookieContractRule,
  startSeason: number,
): ContractTermsV1 => ({
  startSeason,
  signingBonus: rule.signingBonus,
  years: rule.baseSalaryBySeason.map((base, i) => ({
    season: startSeason + i,
    baseSalary: base,
    rosterBonus: moneyAmount(0),
    guaranteedBase: moneyAmount(0),
  })),
});

/** The round a draft right was acquired in, or undefined when it has no recorded selection. */
export const roundOfDraftRight = (
  world: FootballWorld,
  right: PlayerRightsRecord,
): number | undefined => {
  const selection = world.draft.selections.find(
    (s) => s.id === right.sourceRecordId,
  );
  if (selection === undefined) return undefined;
  return world.draft.picks.find((p) => p.id === selection.pickId)?.round;
};

const sameTerms = (a: ContractTermsV1, b: ContractTermsV1): boolean =>
  a.startSeason === b.startSeason &&
  a.signingBonus === b.signingBonus &&
  a.years.length === b.years.length &&
  a.years.every((y, i) => {
    const o = b.years[i]!;
    return (
      y.season === o.season &&
      y.baseSalary === o.baseSalary &&
      y.rosterBonus === o.rosterBonus &&
      y.guaranteedBase === o.guaranteedBase
    );
  });

/** A reason `terms` are not the rookie scale for this draft right, or null when they are. */
export const rookieScaleProblem = (
  world: FootballWorld,
  tx: TransactionRulesV1,
  right: PlayerRightsRecord,
  terms: ContractTermsV1,
): string | null => {
  const round = roundOfDraftRight(world, right);
  if (round === undefined)
    return 'this draft right has no recorded selection, so no rookie scale applies';
  const rule = tx.draft.rookieContractByRound.find((r) => r.round === round);
  if (rule === undefined)
    return `the ruleset has no rookie contract for round ${round}`;
  const expected = rookieScaleTerms(rule, terms.startSeason);
  return sameTerms(terms, expected)
    ? null
    : `a round ${round} draft pick signs the ruleset rookie contract, not negotiated terms`;
};
