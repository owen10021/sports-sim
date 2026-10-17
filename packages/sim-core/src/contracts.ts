/**
 * Market & Contract domain: contract state (Package C). Authoritative contract agreements
 * and terminations; derived cap ledgers are rebuilt from these and never stored.
 * Element types are refined by Task 6.
 */
export type ContractsState = {
  readonly agreements: readonly unknown[];
  readonly terminations: readonly unknown[];
};

export const emptyContractsState = (): ContractsState => ({
  agreements: [],
  terminations: [],
});
