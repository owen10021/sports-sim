import {
  PACKAGE_C_SEED,
  SYNTHETIC_PACKAGE_C_RULESET,
  WorldKernel,
  commitAuthorizedDomainChange,
  createWorld,
  entityId,
  routeCommand,
  worldId,
  type DomainCommitRequest,
  type KernelOptions,
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
