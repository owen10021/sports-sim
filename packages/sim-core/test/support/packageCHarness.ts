import {
  tradePackageTerms,
  type TradePackageV1,
  ACQUISITION_TIER_ASSESSMENT,
  COMPETITIVE_WINDOW_KEY,
  recordId,
  type BeliefRecord,
  type FootballWorld,
  type OrganizationPlan,
  PACKAGE_C_SEED,
  SYNTHETIC_PACKAGE_C_RULESET,
  WorldKernel,
  commitAuthorizedDomainChange,
  createWorld,
  requireTransactionRules,
  type LeagueRulesetManifest,
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

const RULESETS = new WeakMap<WorldKernel, LeagueRulesetManifest>();

/** The sealed ruleset a kernel built by this harness runs under. */
export const rulesOf = (kernel: WorldKernel) =>
  requireTransactionRules(RULESETS.get(kernel) ?? SYNTHETIC_PACKAGE_C_RULESET);

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
  const kernel = WorldKernel.fromGenesis(
    createWorld(seed, ruleset, {
      newWorldId: () => worldId('world-package-c-2'),
    }),
    ruleset,
    options,
  );
  RULESETS.set(kernel, ruleset);
  return kernel;
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

/** The Package C world with extra authoritative state laid down before the first command. */
export const newKernelWith = (
  mutate: (world: FootballWorld) => FootballWorld,
  options?: KernelOptions,
): WorldKernel =>
  WorldKernel.fromGenesis(
    mutate(newPackageCKernel().world),
    SYNTHETIC_PACKAGE_C_RULESET,
    options,
  );

let beliefCounter = 0;
/** An organization's own acquisition-tier belief about a player. */
export const tierBelief = (
  organizationId: string,
  authorPersonId: string,
  playerId: string,
  tier: string,
  extra: Record<string, unknown> = {},
): BeliefRecord => {
  beliefCounter += 1;
  return {
    id: recordId(`belief-test-${String(beliefCounter).padStart(3, '0')}`),
    organizationId: entityId(organizationId),
    authorPersonId: entityId(authorPersonId),
    subject: { kind: 'entity', id: playerId },
    assessmentType: ACQUISITION_TIER_ASSESSMENT,
    assessment: { tier, ...extra } as never,
    confidence: 'medium',
    evidenceClaimIds: [],
    formedAt: '2027-02-01',
    supersedesBeliefId: null,
  };
};

/** An active strategy plan stating an organization's competitive posture. */
export const postureOnlyPlan = (
  organizationId: string,
  ownerPersonId: string,
  window: string,
  id = `plan-test-${organizationId}`,
): OrganizationPlan => ({
  id: recordId(id),
  organizationId: entityId(organizationId),
  kind: 'strategy',
  scopeKey: 'franchise',
  status: 'active',
  currentRevision: 1,
  revisions: [
    {
      revision: 1,
      ownerPersonId: entityId(ownerPersonId),
      effectiveAt: '2027-02-01',
      horizon: 'multi_year',
      objectives: [
        { key: COMPETITIVE_WINDOW_KEY, priority: 'high', target: window },
      ],
      constraints: [],
      triggerRefs: [],
      fallbackPlanIds: [],
      basisBeliefIds: [],
      changeReasonRefs: [],
    },
  ],
});

export const withBeliefs =
  (...beliefs: BeliefRecord[]) =>
  (w: FootballWorld): FootballWorld => ({
    ...w,
    information: {
      ...w.information,
      beliefs: [...w.information.beliefs, ...beliefs],
    },
  });

export const withPlans =
  (...plans: OrganizationPlan[]) =>
  (w: FootballWorld): FootballWorld => ({
    ...w,
    plans: { ...w.plans, plans: [...w.plans.plans, ...plans] },
  });

export const compose =
  (...fns: ((w: FootballWorld) => FootballWorld)[]) =>
  (w: FootballWorld): FootballWorld =>
    fns.reduce((acc, f) => f(acc), w);

export const TRADE_TERMS = 'trade_package_v1';

/** Submits a trade-package proposal for `org` and returns its id. */
export const submitTradeProposal = (
  r: { run: (c: Record<string, unknown>) => unknown; kernel: WorldKernel },
  org: string,
  by: string,
  counterparty: string,
  pkg: TradePackageV1,
  extra: Record<string, unknown> = {},
): string => {
  const res = r.run({
    type: 'SubmitProposal',
    organizationId: org,
    actingPersonId: by,
    category: 'acquisition',
    subjects: [{ kind: 'entity', id: counterparty }],
    termsType: TRADE_TERMS,
    terms: tradePackageTerms(pkg),
    requiredApproverPersonIds: [],
    expiresAt: null,
    contingencies: {},
    ...extra,
  }) as { ok: boolean };
  if (!res.ok) throw new Error(`proposal refused: ${JSON.stringify(res)}`);
  return r.kernel.world.decisions.proposals.at(-1)!.id;
};
