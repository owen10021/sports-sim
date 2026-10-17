import {
  PACKAGE_D_SEED,
  SYNTHETIC_PACKAGE_D_RULESET,
  WorldKernel,
  createWorld,
  sealSeed,
  worldId,
  entityId,
  type KernelOptions,
  type WorldSeedBody,
} from '../../src/index';
import { NF, SP, runnerFor, okResult, type Runner } from './orgHarness';
export { NF, SP };
export const D_TODAY = '2027-02-15';
export const D_END = '2027-03-01';
export const COACH = entityId('person-nf-coach-d');
const RIGHTS = [
  'propose',
  'advise',
  'approve',
  'veto',
  'execute',
  'communicate',
] as const;

/** Synthetic coaches added to a variant genesis; the frozen D seed is unchanged. */
export const dSeed = () => {
  const { contentHash: _hash, ...base } = PACKAGE_D_SEED;
  void _hash;
  const org = base.organizationSubstrate!;
  const sub = base.packageDSubstrate!;
  return sealSeed({
    ...base,
    initialEntities: [
      ...base.initialEntities,
      { id: COACH, kind: 'person', name: 'Synthetic D coach' },
    ],
    organizationSubstrate: {
      roleEpisodes: [
        ...org.roleEpisodes,
        {
          id: 'role-nf-coach-d',
          personId: COACH,
          organizationId: NF.org,
          role: 'head_coach',
          title: 'Head coach',
          startDate: '2027-01-01',
          endDate: null,
        },
      ],
      authorityGrants: [
        ...org.authorityGrants,
        ...(['workload_usage', 'medical_clearance', 'scheme'] as const).map(
          (category) => ({
            id: 'grant-d-owner-' + category,
            personId: NF.owner,
            organizationId: NF.org,
            category,
            rights: RIGHTS,
            transferable: true,
            effectiveFrom: '2027-01-01',
            effectiveUntil: null,
            sourcePersonId: null,
            revision: 1,
          }),
        ),
        {
          id: 'grant-d-gm-workload',
          personId: NF.gm,
          organizationId: NF.org,
          category: 'workload_usage',
          rights: ['propose', 'approve'],
          transferable: false,
          effectiveFrom: '2027-01-01',
          effectiveUntil: null,
          sourcePersonId: NF.owner,
          revision: 1,
        },
        {
          id: 'grant-d-coach-workload',
          personId: COACH,
          organizationId: NF.org,
          category: 'workload_usage',
          rights: RIGHTS,
          transferable: false,
          effectiveFrom: '2027-01-01',
          effectiveUntil: null,
          sourcePersonId: NF.owner,
          revision: 1,
        },
      ],
    },
    packageDSubstrate: {
      ...sub,
      teachingProfiles: [
        {
          personId: COACH,
          bandwidthUnits: 80,
          expertise: [{ responsibilityKey: 'run_reads', teachingBp: 7500 }],
        },
      ],
    },
  } satisfies WorldSeedBody);
};
export const dWorld = () =>
  createWorld(dSeed(), SYNTHETIC_PACKAGE_D_RULESET, {
    newWorldId: () => worldId('world-package-d-harness'),
  });
export const newPackageDKernel = (options?: KernelOptions) =>
  WorldKernel.fromGenesis(dWorld(), SYNTHETIC_PACKAGE_D_RULESET, options);
export const dRunner = () => runnerFor(newPackageDKernel());
export const openWindow = (r: Runner, extra: Record<string, unknown> = {}) => {
  okResult(
    r.run({
      type: 'OpenOpportunityWindow',
      organizationId: NF.org,
      phaseKey: 'synthetic_offseason',
      fromDate: D_TODAY,
      toDate: D_END,
      ...extra,
    }),
  );
  return r.kernel.world.development.opportunityWindows.at(-1)!.id;
};
export const allocationTerms = (playerId = 'player-nf-01', units = 60) => ({
  playerId,
  resourceKey: 'first_team_reps',
  scopeKey: 'running_back',
  units,
  teacherPersonId: null,
  responsibilityKeys: [],
  basisPlanIds: [],
});
export const submitAllocation = (
  r: Runner,
  windowId: string,
  allocations: Record<string, unknown>[],
) => {
  okResult(
    r.run({
      type: 'SubmitProposal',
      organizationId: NF.org,
      actingPersonId: NF.gm,
      category: 'workload_usage',
      subjects: [{ kind: 'entity', id: NF.org }],
      termsType: 'opportunity_allocation_v1',
      terms: { windowId, allocations },
      requiredApproverPersonIds: [],
      expiresAt: null,
      contingencies: {},
    }),
  );
  return r.kernel.world.decisions.proposals.at(-1)!.id;
};
export const commitAllocation = (proposalId: string, by = COACH) => ({
  type: 'CommitOpportunityAllocationProposal',
  proposalId,
  actingPersonId: by,
  expectedRevision: 1,
  beliefIds: [],
  evidenceClaimIds: [],
  rationale: { note: 'finite reps' },
});
export const adoptDevelopmentPlan = (r: Runner) => {
  okResult(
    r.run({
      type: 'SubmitProposal',
      organizationId: NF.org,
      actingPersonId: NF.gm,
      category: 'organizational_plan',
      subjects: [{ kind: 'entity', id: NF.org }],
      termsType: 'organization_plan_v1',
      terms: {
        planId: null,
        kind: 'development',
        scopeKey: 'running_back',
        ownerPersonId: NF.gm,
        effectiveAt: D_TODAY,
        horizon: { days: 14 },
        objectives: [
          {
            key: 'prepare_backup',
            priority: 'high',
            target: { playerId: 'player-nf-05' },
          },
        ],
        constraints: [],
        triggerRefs: [],
        fallbackPlanIds: [],
        changeReasonRefs: [],
      },
      requiredApproverPersonIds: [],
      expiresAt: null,
      contingencies: {},
    }),
  );
  const proposalId = r.kernel.world.decisions.proposals.at(-1)!.id;
  okResult(
    r.run({
      type: 'CommitPlanProposal',
      proposalId,
      actingPersonId: NF.gm,
      expectedRevision: 1,
      beliefIds: [],
      evidenceClaimIds: [],
      rationale: { note: 'intent only' },
    }),
  );
  return r.kernel.world.plans.plans.at(-1)!.id;
};
