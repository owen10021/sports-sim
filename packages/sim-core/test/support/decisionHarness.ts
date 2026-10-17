import {
  commitProposal,
  entityId,
  routeCommand,
  type RouteContext,
  type RouteOutcome,
} from '../../src/index';
import { NF } from './orgHarness';

/**
 * TEST ONLY. Package B has no real domain adapter until Task 8, so decision-substrate
 * tests drive the shared commit gate through the kernel's constructor-only `testRouter`
 * seam. It piggybacks on the routable `AdvanceDays` type (carrying a `testCommit` marker)
 * and otherwise defers to the real, static router.
 */
export const testCommitRouter = (ctx: RouteContext): RouteOutcome => {
  const c = ctx.command as {
    readonly type: string;
    readonly testCommit?: Record<string, unknown>;
  };
  if (c.type !== 'AdvanceDays' || c.testCommit === undefined)
    return routeCommand(ctx);
  const t = c.testCommit;
  return commitProposal(ctx, {
    nextWorld: ctx.world,
    proposalId: String(t.proposalId),
    expectedRevision: Number(t.expectedRevision),
    actorPersonId: entityId(String(t.actingPersonId)),
    beliefIds: (t.beliefIds as string[] | undefined) ?? [],
    evidenceClaimIds: (t.evidenceClaimIds as string[] | undefined) ?? [],
    rationale: { note: 'synthetic commit' },
    domainEvents: [
      {
        type: 'TestPlanApplied',
        payload: { proposalId: String(t.proposalId) },
      },
    ],
  });
};

export const commitCommand = (
  by: string,
  proposalId: string,
  expectedRevision: number,
  extra: Record<string, unknown> = {},
) => ({
  type: 'AdvanceDays',
  days: 1,
  testCommit: { proposalId, expectedRevision, actingPersonId: by, ...extra },
});

export const submitCommand = (
  by: string,
  extra: Record<string, unknown> = {},
) => ({
  type: 'SubmitProposal',
  organizationId: NF.org,
  actingPersonId: by,
  category: 'organizational_plan',
  subjects: [{ kind: 'entity', id: 'org-northfield' }],
  termsType: 'test_plan',
  terms: { budget: 100, unit: 'synthetic_units' },
  requiredApproverPersonIds: [],
  expiresAt: null,
  contingencies: {},
  ...extra,
});

export const decisionCommand = (
  type:
    'ApproveProposal' | 'VetoProposal' | 'WithdrawProposal' | 'ExpireProposal',
  by: string,
  proposalId = 'rec-000001',
  expectedRevision = 1,
) => ({ type, actingPersonId: by, proposalId, expectedRevision });

export const reviseCommand = (
  by: string,
  proposalId: string,
  expectedRevision: number,
  changes: Record<string, unknown>,
) => ({
  type: 'ReviseProposal',
  actingPersonId: by,
  proposalId,
  expectedRevision,
  ...changes,
});
