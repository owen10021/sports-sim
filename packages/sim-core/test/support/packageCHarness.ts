import {
  PACKAGE_C_SEED,
  SYNTHETIC_PACKAGE_C_RULESET,
  WorldKernel,
  commitAuthorizedDomainChange,
  createWorld,
  entityId,
  rulesetRefOf,
  routeCommand,
  sealRuleset,
  sealSeed,
  worldId,
  type DomainCommitRequest,
  type KernelOptions,
  type LeagueRulesetBody,
  type WorldSeedBody,
  type RouteContext,
  type RouteOutcome,
} from '../../src/index';

export { NF, SP } from './orgHarness';

/** The Package C synthetic world starts here. */
export const C_TODAY = '2027-02-15';

export const newPackageCKernel = (options?: KernelOptions): WorldKernel =>
  WorldKernel.fromGenesis(
    createWorld(PACKAGE_C_SEED, SYNTHETIC_PACKAGE_C_RULESET, {
      newWorldId: () => worldId('world-package-c-1'),
    }),
    SYNTHETIC_PACKAGE_C_RULESET,
    options,
  );

/**
 * TEST ONLY. Domain routers arrive in later tasks; this drives the domain-commit adapter
 * through the kernel's constructor-only `testRouter` seam. It piggybacks on the routable
 * `AdvanceDays` type (carrying a `testDomainCommit` marker) and otherwise defers to the
 * real, static router.
 */
export const testDomainRouter = (ctx: RouteContext): RouteOutcome => {
  const c = ctx.command as {
    readonly type: string;
    readonly testDomainCommit?: {
      readonly requests: readonly Record<string, unknown>[];
    };
  };
  if (c.type !== 'AdvanceDays' || c.testDomainCommit === undefined)
    return routeCommand(ctx);
  return commitAuthorizedDomainChange(ctx, {
    nextWorld: ctx.world,
    domainEvents: [
      {
        type: 'TestDomainApplied',
        payload: {
          proposalIds: c.testDomainCommit.requests.map((r) =>
            String(r.proposalId),
          ),
        },
      },
    ],
    requests: c.testDomainCommit.requests.map(
      (r) =>
        ({
          beliefIds: [],
          evidenceClaimIds: [],
          rationale: { note: 'synthetic domain commit' },
          ...r,
          organizationId: entityId(String(r.organizationId)),
          actorPersonId: entityId(String(r.actorPersonId)),
        }) as unknown as DomainCommitRequest,
    ),
  });
};

export const domainCommitCommand = (
  requests: readonly Record<string, unknown>[],
) => ({ type: 'AdvanceDays', days: 1, testDomainCommit: { requests } });

export const request = (
  organizationId: string,
  actorPersonId: string,
  proposalId: string,
  terms: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) => ({
  organizationId,
  actorPersonId,
  proposalId,
  expectedRevision: 1,
  expectedCategory: 'acquisition',
  executedTerms: { termsType: 'test_acquisition', terms },
  ...extra,
});

export const ACQ_TERMS = { amount: 500, unit: 'synthetic_units' };

export const submitDomain = (
  organizationId: string,
  by: string,
  category = 'acquisition',
  extra: Record<string, unknown> = {},
) => ({
  type: 'SubmitProposal',
  organizationId,
  actingPersonId: by,
  category,
  subjects: [{ kind: 'entity', id: 'player-fa-01' }],
  termsType: 'test_acquisition',
  terms: ACQ_TERMS,
  requiredApproverPersonIds: [],
  expiresAt: null,
  contingencies: {},
  ...extra,
});

type TxBody = Record<string, unknown> & {
  waivers: Record<string, unknown>;
  seasonRules: Record<string, unknown>[];
};

/**
 * The Package C world under a variant transaction ruleset. The seed is re-sealed against the
 * variant ruleset so nothing but the patched rules differs.
 */
export const newVariantKernel = (
  patch: (tx: TxBody) => TxBody,
  options?: KernelOptions,
): WorldKernel => {
  const { contentHash: _ruleHash, ...rulesetBody } =
    SYNTHETIC_PACKAGE_C_RULESET as unknown as Record<string, unknown> & {
      rules: { transactions: TxBody };
    };
  void _ruleHash;
  const ruleset = sealRuleset({
    ...rulesetBody,
    rules: {
      ...rulesetBody.rules,
      transactions: patch(
        structuredClone(rulesetBody.rules.transactions) as TxBody,
      ),
    },
  } as unknown as LeagueRulesetBody);
  const { contentHash: _seedHash, ...seedBody } =
    PACKAGE_C_SEED as unknown as Record<string, unknown>;
  void _seedHash;
  const seed = sealSeed({
    ...seedBody,
    ruleset: rulesetRefOf(ruleset),
  } as unknown as WorldSeedBody);
  return WorldKernel.fromGenesis(
    createWorld(seed, ruleset, {
      newWorldId: () => worldId('world-package-c-2'),
    }),
    ruleset,
    options,
  );
};

/** Released players do not pass through waivers (`releasedPlayerWaiverPolicy: 'none'`). */
export const newNoWaiverKernel = (options?: KernelOptions): WorldKernel =>
  newVariantKernel(
    (tx) => ({
      ...tx,
      waivers: { ...tx.waivers, releasedPlayerWaiverPolicy: 'none' },
    }),
    options,
  );

/** Every season's salary cap replaced by `capFor(season, current)`. */
export const newCapKernel = (
  capFor: (season: number, current: number) => number,
  options?: KernelOptions,
): WorldKernel =>
  newVariantKernel(
    (tx) => ({
      ...tx,
      seasonRules: tx.seasonRules.map((s) => ({
        ...s,
        salaryCap: capFor(Number(s.season), Number(s.salaryCap)),
      })),
    }),
    options,
  );
