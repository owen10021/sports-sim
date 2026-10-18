import type { ContractTermsV1 } from './contracts';
import {
  CONTRACT_OFFER_TERMS_TYPE,
  contractOfferProposalTerms,
} from './freeAgencyCommands';
import { moneyAmount } from './economy';
import type { ActorKind, EntityId } from './ids';
import { entityId } from './ids';
import type { RejectionCode, WorldKernel } from './kernel';
import { agentFor } from './playerMarketView';
import { PACKAGE_D_SEED } from './packageDWorldSeed';
import { sealSeed, type WorldSeedBody } from './seed';
import {
  previewOpportunityImpactForRosterChange,
  type OpportunityImpactBand,
} from './developmentImpact';

export const PACKAGE_D_SCENARIO_ID = 'package-d-golden-v2';

export const NF_ORG = entityId('org-northfield');
export const NF_OWNER = entityId('person-nf-owner');
export const NF_GM = entityId('person-nf-gm');
export const NF_SCOUT = entityId('person-nf-scout');
export const NF_COACH = entityId('person-nf-coach-d');
export const YOUNG_QB = entityId('player-nf-05');
export const VETERAN_QB = entityId('player-fa-04');
export const SCHEME_PLAYER = entityId('player-nf-02');
export const MEDICAL_PLAYER = entityId('player-nf-01');
export const ZERO_GROWTH_PLAYER = entityId('player-nf-03');

const ALL_RIGHTS = [
  'propose',
  'advise',
  'approve',
  'veto',
  'execute',
  'communicate',
] as const;

/**
 * Scenario-only deterministic seed extension. Teaching profiles and first/root transferable
 * authority are seed-owned data, so these must exist before genesis. Every operational
 * delegation and every domain change after genesis still goes through production commands.
 */
const buildScenarioSeed = () => {
  const { contentHash: _contentHash, ...base } = PACKAGE_D_SEED;
  void _contentHash;
  const organizationSubstrate = PACKAGE_D_SEED.organizationSubstrate!;
  const packageDSubstrate = PACKAGE_D_SEED.packageDSubstrate!;
  const rootGrant = (
    category: 'workload_usage' | 'medical_clearance' | 'scheme',
  ) => ({
    id: `grant-nf-owner-${category}`,
    personId: NF_OWNER,
    organizationId: NF_ORG,
    category,
    rights: [...ALL_RIGHTS],
    transferable: true,
    effectiveFrom: '2027-01-01',
    effectiveUntil: null,
    sourcePersonId: null,
    revision: 1,
  });
  const body: WorldSeedBody = {
    ...base,
    seedId: 'synthetic-package-d-golden-scenario',
    initialEntities: [
      ...PACKAGE_D_SEED.initialEntities,
      {
        id: NF_COACH,
        kind: 'person' as const,
        name: 'Morgan Vale (synthetic)',
      },
    ].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    organizationSubstrate: {
      roleEpisodes: [
        ...organizationSubstrate.roleEpisodes,
        {
          id: 'role-nf-coach-d',
          personId: NF_COACH,
          organizationId: NF_ORG,
          role: 'offensive_coordinator' as const,
          title: 'Offensive Coordinator',
          startDate: '2027-01-01',
          endDate: null,
        },
      ].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
      authorityGrants: [
        ...organizationSubstrate.authorityGrants,
        rootGrant('workload_usage'),
        rootGrant('medical_clearance'),
        rootGrant('scheme'),
      ].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    },
    packageDSubstrate: {
      ...packageDSubstrate,
      teachingProfiles: [
        ...packageDSubstrate.teachingProfiles,
        {
          personId: NF_COACH,
          bandwidthUnits: 100,
          expertise: [
            { responsibilityKey: 'progression_reads', teachingBp: 8500 },
            { responsibilityKey: 'protection_scheme', teachingBp: 8000 },
          ],
        },
      ].sort((a, b) =>
        a.personId < b.personId ? -1 : a.personId > b.personId ? 1 : 0,
      ),
    },
  };
  return sealSeed(body);
};

export const PACKAGE_D_SCENARIO_SEED = buildScenarioSeed();

export type PackageDVariant = 'primary' | 'alternate';
export type ScenarioCommand = Record<string, unknown>;
export type PackageDMemo = Record<string, string>;

export type PackageDScenarioContext = {
  readonly k: WorldKernel;
  readonly variant: PackageDVariant;
  readonly m: PackageDMemo;
};

type CommandBuilder =
  ScenarioCommand | ((context: PackageDScenarioContext) => ScenarioCommand);

export interface PackageDStepSpec {
  readonly label: string;
  readonly command: CommandBuilder;
  readonly expect: 'committed' | RejectionCode;
  readonly actorKind?: ActorKind;
  readonly staleRevision?: boolean;
  readonly before?: (context: PackageDScenarioContext) => void;
  readonly after?: (context: PackageDScenarioContext) => void;
}

export class PackageDScenarioError extends Error {}

const require_ = (ok: boolean, message: string): void => {
  if (!ok) throw new PackageDScenarioError(message);
};

const lastProposal = (k: WorldKernel): string => {
  const proposal = k.world.decisions.proposals.at(-1);
  require_(proposal !== undefined, 'expected a proposal');
  return proposal!.id;
};

const proposalCmd = (
  organizationId: EntityId,
  actingPersonId: EntityId,
  category: string,
  subjects: readonly Record<string, unknown>[],
  termsType: string,
  terms: Record<string, unknown>,
): ScenarioCommand => ({
  type: 'SubmitProposal',
  organizationId,
  actingPersonId,
  category,
  subjects,
  termsType,
  terms,
  requiredApproverPersonIds: [],
  expiresAt: null,
  contingencies: {},
});

const roleCommit = (
  proposalId: string,
  schemeProposalId: string,
): ScenarioCommand => ({
  type: 'CommitRoleTransitionProposal',
  proposalId,
  actingPersonId: NF_OWNER,
  expectedRevision: 1,
  beliefIds: [],
  evidenceClaimIds: [],
  rationale: { note: 'Package D role transition' },
  schemeSide: {
    proposalId: schemeProposalId,
    actingPersonId: NF_OWNER,
    expectedRevision: 1,
    beliefIds: [],
    evidenceClaimIds: [],
    rationale: { note: 'Package D scheme transition' },
  },
});

const allocation = (
  playerId: EntityId,
  resourceKey: string,
  scopeKey: string,
  units: number,
  options: {
    teacherPersonId?: EntityId | null;
    responsibilityKeys?: readonly string[];
    basisPlanIds?: readonly string[];
  } = {},
): Record<string, unknown> => ({
  playerId,
  resourceKey,
  scopeKey,
  units,
  teacherPersonId: options.teacherPersonId ?? null,
  responsibilityKeys: [...(options.responsibilityKeys ?? [])],
  basisPlanIds: [...(options.basisPlanIds ?? [])],
});

const workloadProposal = (
  windowId: string,
  allocations: readonly Record<string, unknown>[],
): ScenarioCommand =>
  proposalCmd(
    NF_ORG,
    NF_GM,
    'workload_usage',
    [{ kind: 'entity', id: NF_ORG }],
    'opportunity_allocation_v1',
    { windowId, allocations },
  );

const workloadCommit = (proposalId: string): ScenarioCommand => ({
  type: 'CommitOpportunityAllocationProposal',
  proposalId,
  actingPersonId: NF_COACH,
  expectedRevision: 1,
  beliefIds: [],
  evidenceClaimIds: [],
  rationale: { note: 'Package D workload allocation' },
});

const planObjectives = (includeVeteran: boolean) => [
  {
    key: 'young_qb_install',
    priority: 'high',
    target: {
      playerId: YOUNG_QB,
      schemeKey: 'transition_offense',
      responsibilityKey: 'progression_reads',
      transferFamilyKey: 'qb_processing',
    },
  },
  {
    key: 'line_install',
    priority: 'high',
    target: {
      playerId: SCHEME_PLAYER,
      schemeKey: 'transition_offense',
      responsibilityKey: 'protection_scheme',
      transferFamilyKey: 'blocking',
    },
  },
  ...(includeVeteran
    ? [
        {
          key: 'veteran_qb_integration',
          priority: 'high',
          target: { playerId: VETERAN_QB, role: 'starter_qb' },
        },
      ]
    : []),
];

const initialPlanTerms = () => ({
  planId: null,
  kind: 'succession',
  scopeKey: 'quarterback',
  ownerPersonId: NF_GM,
  effectiveAt: '2027-02-15',
  horizon: { seasons: 2 },
  objectives: planObjectives(false),
  constraints: [],
  triggerRefs: [],
  fallbackPlanIds: [],
  changeReasonRefs: [],
});

const terms2027: ContractTermsV1 = {
  startSeason: 2027,
  signingBonus: moneyAmount(0),
  years: [
    {
      season: 2027,
      baseSalary: moneyAmount(50_000),
      rosterBonus: moneyAmount(0),
      guaranteedBase: moneyAmount(20_000),
    },
  ],
};

const steps: PackageDStepSpec[] = [];
const add = (
  label: string,
  command: CommandBuilder,
  options: Omit<PackageDStepSpec, 'label' | 'command' | 'expect'> & {
    readonly expect?: PackageDStepSpec['expect'];
  } = {},
): void => {
  steps.push({
    label,
    command,
    expect: options.expect ?? 'committed',
    ...(options.actorKind === undefined
      ? {}
      : { actorKind: options.actorKind }),
    ...(options.staleRevision === undefined
      ? {}
      : { staleRevision: options.staleRevision }),
    ...(options.before === undefined ? {} : { before: options.before }),
    ...(options.after === undefined ? {} : { after: options.after }),
  });
};

// --- Authority: root rights are seed-owned; operational delegations are commands. ---------
add('grant-gm-workload', {
  type: 'GrantAuthority',
  organizationId: NF_ORG,
  actingPersonId: NF_OWNER,
  personId: NF_GM,
  category: 'workload_usage',
  rights: ['propose', 'approve'],
  transferable: false,
});
add('grant-coach-workload', {
  type: 'GrantAuthority',
  organizationId: NF_ORG,
  actingPersonId: NF_OWNER,
  personId: NF_COACH,
  category: 'workload_usage',
  rights: ['propose', 'advise', 'approve', 'execute', 'communicate'],
  transferable: false,
});
add('grant-scout-medical', {
  type: 'GrantAuthority',
  organizationId: NF_ORG,
  actingPersonId: NF_OWNER,
  personId: NF_SCOUT,
  category: 'medical_clearance',
  rights: ['advise', 'communicate'],
  transferable: false,
});
add(
  'stale-window-attempt',
  {
    type: 'OpenOpportunityWindow',
    organizationId: NF_ORG,
    phaseKey: 'stale_attempt',
    fromDate: '2027-02-15',
    toDate: '2027-02-22',
  },
  { expect: 'STALE_REVISION', staleRevision: true },
);

// --- Position transition: young player changes label, capability/knowledge do not. --------
add(
  'young-scheme-proposal',
  proposalCmd(
    NF_ORG,
    NF_OWNER,
    'scheme',
    [{ kind: 'entity', id: YOUNG_QB }],
    'role_scheme_transition_v1',
    {
      playerId: YOUNG_QB,
      schemeKey: 'transition_offense',
      responsibilityKeys: ['progression_reads'],
    },
  ),
  { after: (c) => (c.m.youngSchemeProposal = lastProposal(c.k)) },
);
add(
  'young-role-proposal',
  (c) =>
    proposalCmd(
      NF_ORG,
      NF_OWNER,
      'roster',
      [{ kind: 'entity', id: YOUNG_QB }],
      'role_transition_v1',
      {
        playerId: YOUNG_QB,
        primaryRole: 'quarterback',
        roleTags: ['developmental', 'quarterback'],
        schemeProposalId: c.m.youngSchemeProposal,
      },
    ),
  { after: (c) => (c.m.youngRoleProposal = lastProposal(c.k)) },
);
add(
  'young-role-commit',
  (c) => roleCommit(c.m.youngRoleProposal!, c.m.youngSchemeProposal!),
  {
    before: (c) => {
      const player = c.k.world.roster.players.find(
        (p) => p.personId === YOUNG_QB,
      )!;
      c.m.youngCapabilitiesBefore = JSON.stringify(player.capabilities);
      c.m.youngTargetKnowledgeBefore = String(
        c.k.world.development.roleKnowledge.filter(
          (k) =>
            k.playerId === YOUNG_QB &&
            k.schemeKey === 'transition_offense' &&
            k.responsibilityKey === 'progression_reads',
        ).length,
      );
    },
    after: (c) => {
      const player = c.k.world.roster.players.find(
        (p) => p.personId === YOUNG_QB,
      )!;
      c.m.youngCapabilitiesAfterTransition = JSON.stringify(
        player.capabilities,
      );
      c.m.youngRoleAfter = player.primaryRole;
      c.m.youngTargetKnowledgeAfterTransition = String(
        c.k.world.development.roleKnowledge.filter(
          (k) =>
            k.playerId === YOUNG_QB &&
            k.schemeKey === 'transition_offense' &&
            k.responsibilityKey === 'progression_reads',
        ).length,
      );
    },
  },
);

// --- Scheme transition: same role, new scheme; transfer knowledge exists but debt remains. --
add(
  'line-scheme-proposal',
  proposalCmd(
    NF_ORG,
    NF_OWNER,
    'scheme',
    [{ kind: 'entity', id: SCHEME_PLAYER }],
    'role_scheme_transition_v1',
    {
      playerId: SCHEME_PLAYER,
      schemeKey: 'transition_offense',
      responsibilityKeys: ['protection_scheme'],
    },
  ),
  { after: (c) => (c.m.lineSchemeProposal = lastProposal(c.k)) },
);
add(
  'line-role-proposal',
  (c) => {
    const player = c.k.world.roster.players.find(
      (p) => p.personId === SCHEME_PLAYER,
    )!;
    return proposalCmd(
      NF_ORG,
      NF_OWNER,
      'roster',
      [{ kind: 'entity', id: SCHEME_PLAYER }],
      'role_transition_v1',
      {
        playerId: SCHEME_PLAYER,
        primaryRole: player.primaryRole,
        roleTags: [...player.roleTags],
        schemeProposalId: c.m.lineSchemeProposal,
      },
    );
  },
  { after: (c) => (c.m.lineRoleProposal = lastProposal(c.k)) },
);
add(
  'line-scheme-commit',
  (c) => roleCommit(c.m.lineRoleProposal!, c.m.lineSchemeProposal!),
  {
    before: (c) => {
      const player = c.k.world.roster.players.find(
        (p) => p.personId === SCHEME_PLAYER,
      )!;
      c.m.lineCapabilitiesBefore = JSON.stringify(player.capabilities);
      c.m.lineSourceFamiliarity = String(
        c.k.world.development.roleKnowledge.find(
          (k) =>
            k.playerId === SCHEME_PLAYER &&
            k.schemeKey === 'base_offense' &&
            k.responsibilityKey === 'protection_scheme',
        )?.familiarityBp ?? 0,
      );
      c.m.lineTargetFamiliarityBefore = String(
        c.k.world.development.roleKnowledge.find(
          (k) =>
            k.playerId === SCHEME_PLAYER &&
            k.schemeKey === 'transition_offense' &&
            k.responsibilityKey === 'protection_scheme',
        )?.familiarityBp ?? 0,
      );
    },
    after: (c) => {
      const player = c.k.world.roster.players.find(
        (p) => p.personId === SCHEME_PLAYER,
      )!;
      c.m.lineCapabilitiesAfterTransition = JSON.stringify(player.capabilities);
    },
  },
);

// --- Coherent succession/install plan. ------------------------------------------------------
add(
  'initial-development-plan-proposal',
  proposalCmd(
    NF_ORG,
    NF_GM,
    'organizational_plan',
    [{ kind: 'entity', id: NF_ORG }],
    'organization_plan_v1',
    initialPlanTerms(),
  ),
  { after: (c) => (c.m.planProposal = lastProposal(c.k)) },
);
add(
  'initial-development-plan-commit',
  (c) => ({
    type: 'CommitPlanProposal',
    actingPersonId: NF_GM,
    proposalId: c.m.planProposal,
    expectedRevision: 1,
    beliefIds: [],
    evidenceClaimIds: [],
    rationale: { note: 'adopt Package D succession plan' },
  }),
  {
    after: (c) => {
      const plan = c.k.world.plans.plans.find(
        (p) => p.organizationId === NF_ORG && p.scopeKey === 'quarterback',
      )!;
      c.m.planId = plan.id;
      c.m.planRevisionBefore = String(plan.currentRevision);
    },
  },
);

// --- Major injury / medical uncertainty starts before the first work checkpoint. ------------
add(
  'create-medical-episode',
  {
    type: 'CreateMedicalEpisode',
    playerId: MEDICAL_PLAYER,
    conditionKey: 'synthetic_major_knee',
    onsetAt: '2027-02-15',
    sourceKind: 'synthetic_test',
    affectedActionKeys: ['burst', 'cutting'],
    initialStructuralSeverityBp: 7200,
    recoveryResponsivenessBp: 6200,
    baselineReinjuryRiskBp: 6800,
  },
  {
    after: (c) => {
      c.m.medicalEpisode = c.k.world.medical.episodes.at(-1)!.id;
    },
  },
);
add('record-player-preference', (c) => ({
  type: 'RecordParticipationPreference',
  playerId: MEDICAL_PLAYER,
  episodeId: c.m.medicalEpisode,
  preference: 'unwilling',
  sourceClaimIds: [],
}));

// --- February: young QB gets finite opportunity; OL starts installing the new scheme. --------
add(
  'open-february-window',
  {
    type: 'OpenOpportunityWindow',
    organizationId: NF_ORG,
    phaseKey: 'pre_acquisition_development',
    fromDate: '2027-02-15',
    toDate: '2027-02-22',
  },
  {
    after: (c) =>
      (c.m.febWindow = c.k.world.development.opportunityWindows.at(-1)!.id),
  },
);
add(
  'submit-february-work',
  (c) =>
    workloadProposal(c.m.febWindow!, [
      allocation(YOUNG_QB, 'first_team_reps', 'quarterback', 40),
      allocation(YOUNG_QB, 'development_reps', 'quarterback', 30, {
        teacherPersonId: NF_COACH,
        responsibilityKeys: ['progression_reads'],
        basisPlanIds: [c.m.planId!],
      }),
      allocation(YOUNG_QB, 'installation_work', 'quarterback', 20, {
        teacherPersonId: NF_COACH,
        responsibilityKeys: ['progression_reads'],
        basisPlanIds: [c.m.planId!],
      }),
      allocation(SCHEME_PLAYER, 'installation_work', 'offensive_line', 20, {
        teacherPersonId: NF_COACH,
        responsibilityKeys: ['protection_scheme'],
        basisPlanIds: [c.m.planId!],
      }),
    ]),
  { after: (c) => (c.m.febWorkProposal = lastProposal(c.k)) },
);
add('commit-february-work', (c) => workloadCommit(c.m.febWorkProposal!));
add(
  'advance-february-window',
  { type: 'AdvanceDays', days: 7 },
  {
    after: (c) => {
      c.m.lineTargetFamiliarityAfterWork = String(
        c.k.world.development.roleKnowledge.find(
          (k) =>
            k.playerId === SCHEME_PLAYER &&
            k.schemeKey === 'transition_offense' &&
            k.responsibilityKey === 'protection_scheme',
        )?.familiarityBp ?? 0,
      );
    },
  },
);
add(
  'first-medical-reassessment',
  (c) => ({
    type: 'ReassessMedicalEpisode',
    episodeId: c.m.medicalEpisode,
    organizationId: NF_ORG,
    evaluatorPersonId: NF_OWNER,
  }),
  {
    after: (c) => {
      const report = c.k.world.medical.reports.at(-1)!;
      const claim = c.k.world.information.claims.find(
        (entry) => entry.id === report.evidenceClaimIds[0],
      )!;
      c.m.firstMedicalReport = report.id;
      c.m.firstMedicalUncertainty = String(
        (claim.proposition as Record<string, unknown>).uncertainty,
      );
    },
  },
);

// Advance to the real free-agency opening, then narrow medical uncertainty again.
add('advance-to-free-agency', { type: 'AdvanceDays', days: 16 });
add(
  'second-medical-reassessment',
  (c) => ({
    type: 'ReassessMedicalEpisode',
    episodeId: c.m.medicalEpisode,
    organizationId: NF_ORG,
    evaluatorPersonId: NF_OWNER,
  }),
  {
    after: (c) => {
      const report = c.k.world.medical.reports.at(-1)!;
      const claim = c.k.world.information.claims.find(
        (entry) => entry.id === report.evidenceClaimIds[0],
      )!;
      c.m.secondMedicalReport = report.id;
      c.m.secondMedicalUncertainty = String(
        (claim.proposition as Record<string, unknown>).uncertainty,
      );
    },
  },
);
add('medical-recommendation', (c) => {
  const report = c.k.world.medical.reports.at(-1)!;
  return {
    type: 'RecordMedicalRecommendation',
    organizationId: NF_ORG,
    actingPersonId: NF_SCOUT,
    episodeId: c.m.medicalEpisode,
    participation: 'limited',
    maxLoadUnits: 40,
    basisClaimIds: [...report.evidenceClaimIds],
    basisBeliefIds: [report.beliefId],
  };
});
add(
  'medical-clearance-proposal',
  (c) =>
    proposalCmd(
      NF_ORG,
      NF_OWNER,
      'medical_clearance',
      [{ kind: 'entity', id: MEDICAL_PLAYER }],
      'medical_clearance_v1',
      {
        episodeId: c.m.medicalEpisode,
        playerId: MEDICAL_PLAYER,
        participation: 'full',
        maxLoadUnits: null,
      },
    ),
  { after: (c) => (c.m.clearanceProposal = lastProposal(c.k)) },
);
add('medical-clearance-commit', (c) => ({
  type: 'CommitMedicalClearanceProposal',
  proposalId: c.m.clearanceProposal,
  actingPersonId: NF_OWNER,
  expectedRevision: 1,
  beliefIds: [],
  evidenceClaimIds: [],
  rationale: { note: 'legal clearance distinct from recommendation' },
}));

// --- March 10: existing young-QB commitments make the veteran acquisition a real squeeze. ---
add(
  'open-post-acquisition-window',
  {
    type: 'OpenOpportunityWindow',
    organizationId: NF_ORG,
    phaseKey: 'acquisition_squeeze',
    fromDate: '2027-03-10',
    toDate: '2027-03-17',
  },
  {
    after: (c) =>
      (c.m.marchWindow = c.k.world.development.opportunityWindows.at(-1)!.id),
  },
);
add(
  'submit-pre-acquisition-work',
  (c) => {
    const youngFirstTeam = c.variant === 'primary' ? 60 : 40;
    return workloadProposal(c.m.marchWindow!, [
      allocation(YOUNG_QB, 'first_team_reps', 'quarterback', youngFirstTeam, {
        basisPlanIds: [c.m.planId!],
      }),
      allocation(YOUNG_QB, 'development_reps', 'quarterback', 30, {
        teacherPersonId: NF_COACH,
        responsibilityKeys: ['progression_reads'],
        basisPlanIds: [c.m.planId!],
      }),
      allocation(MEDICAL_PLAYER, 'first_team_reps', 'running_back', 60),
    ]);
  },
  { after: (c) => (c.m.preAcquisitionWorkProposal = lastProposal(c.k)) },
);
add('commit-pre-acquisition-work', (c) =>
  workloadCommit(c.m.preAcquisitionWorkProposal!),
);

add(
  'veteran-contract-proposal',
  (c) =>
    proposalCmd(
      NF_ORG,
      NF_GM,
      'contract',
      [{ kind: 'entity', id: VETERAN_QB }],
      CONTRACT_OFFER_TERMS_TYPE,
      contractOfferProposalTerms({
        playerId: VETERAN_QB,
        targetRosterStatus: 'active',
        roleCommitment: 'starter',
        terms: terms2027,
      }) as unknown as Record<string, unknown>,
    ),
  {
    before: (c) => {
      const preview = previewOpportunityImpactForRosterChange(
        c.k.world,
        NF_ORG,
        [VETERAN_QB],
        [],
      );
      const qb = preview.pools.find(
        (pool) =>
          pool.resourceKey === 'first_team_reps' &&
          pool.scopeKey === 'quarterback',
      );
      c.m.squeezeBand = (qb?.crowdingBand ??
        'none') satisfies OpportunityImpactBand;
    },
    after: (c) => (c.m.veteranContractProposal = lastProposal(c.k)),
  },
);
add(
  'veteran-contract-offer',
  (c) => ({
    type: 'SubmitContractOffer',
    organizationId: NF_ORG,
    actingPersonId: NF_GM,
    proposalId: c.m.veteranContractProposal,
    expectedRevision: 1,
    playerId: VETERAN_QB,
    agentPersonId: agentFor(c.k.world, VETERAN_QB, c.k.world.simDate),
    terms: terms2027,
    roleCommitment: 'starter',
    targetRosterStatus: 'active',
    priority: 0,
    contingencyGroupId: null,
  }),
  {
    after: (c) => {
      c.m.veteranOffer = c.k.world.market.contractOffers.at(-1)!.id;
    },
  },
);
add('resolve-veteran-free-agency', { type: 'ResolveFreeAgencyMarket' });
add('commit-veteran-signing', (c) => {
  const offer = c.k.world.market.contractOffers
    .filter((entry) => entry.id === c.m.veteranOffer)
    .sort((a, b) => a.revision - b.revision)
    .at(-1)!;
  require_(
    offer.status === 'accepted_pending_commit',
    `veteran offer should be accepted, got ${offer.status}`,
  );
  return {
    type: 'CommitContractSigning',
    actingPersonId: NF_GM,
    offerId: offer.id,
    offerRevision: offer.revision,
    expectedRevision: 1,
    beliefIds: [],
    evidenceClaimIds: [],
    rationale: { note: 'veteran acquisition creates QB opportunity squeeze' },
  };
});

add(
  'reconcile-plan-proposal',
  (c) => {
    const plan = c.k.world.plans.plans.find(
      (entry) => entry.id === c.m.planId,
    )!;
    const priorProposal = c.k.world.decisions.proposals.find(
      (proposal) => proposal.id === c.m.planProposal,
    )!;
    c.m.planRevisionBefore = String(plan.currentRevision);
    return proposalCmd(
      NF_ORG,
      NF_GM,
      'organizational_plan',
      [{ kind: 'entity', id: NF_ORG }],
      'organization_plan_v1',
      {
        ...(priorProposal.terms as Record<string, unknown>),
        planId: plan.id,
        effectiveAt: c.k.world.simDate,
        objectives: planObjectives(true),
      },
    );
  },
  { after: (c) => (c.m.reconcilePlanProposal = lastProposal(c.k)) },
);
add(
  'reconcile-plan-commit',
  (c) => ({
    type: 'CommitPlanProposal',
    actingPersonId: NF_GM,
    proposalId: c.m.reconcilePlanProposal,
    expectedRevision: 1,
    beliefIds: [],
    evidenceClaimIds: [],
    rationale: { note: 'reconcile succession plan after veteran acquisition' },
  }),
  {
    after: (c) => {
      const plan = c.k.world.plans.plans.find(
        (entry) => entry.id === c.m.planId,
      )!;
      c.m.planRevisionAfter = String(plan.currentRevision);
    },
  },
);
add('advance-post-acquisition-window', { type: 'AdvanceDays', days: 7 });
add(
  'open-succession-window',
  {
    type: 'OpenOpportunityWindow',
    organizationId: NF_ORG,
    phaseKey: 'post_acquisition_succession',
    fromDate: '2027-03-17',
    toDate: '2027-03-24',
  },
  {
    after: (c) =>
      (c.m.successionWindow =
        c.k.world.development.opportunityWindows.at(-1)!.id),
  },
);
add(
  'submit-succession-work',
  (c) => {
    const veteranUnits = c.variant === 'primary' ? 40 : 60;
    const youngUnits = c.variant === 'primary' ? 60 : 40;
    return workloadProposal(c.m.successionWindow!, [
      allocation(YOUNG_QB, 'first_team_reps', 'quarterback', youngUnits, {
        basisPlanIds: [c.m.planId!],
      }),
      allocation(YOUNG_QB, 'development_reps', 'quarterback', 20, {
        teacherPersonId: NF_COACH,
        responsibilityKeys: ['progression_reads'],
        basisPlanIds: [c.m.planId!],
      }),
      allocation(VETERAN_QB, 'first_team_reps', 'quarterback', veteranUnits, {
        basisPlanIds: [c.m.planId!],
      }),
    ]);
  },
  { after: (c) => (c.m.successionWorkProposal = lastProposal(c.k)) },
);
add('commit-succession-work', (c) =>
  workloadCommit(c.m.successionWorkProposal!),
);
add('advance-succession-window', { type: 'AdvanceDays', days: 7 });

// --- Legitimate zero-growth checkpoint: attention/load with no skill work or lesson target. --
add(
  'open-zero-growth-window',
  {
    type: 'OpenOpportunityWindow',
    organizationId: NF_ORG,
    phaseKey: 'zero_growth_control',
    fromDate: '2027-03-24',
    toDate: '2027-03-31',
  },
  {
    after: (c) =>
      (c.m.zeroWindow = c.k.world.development.opportunityWindows.at(-1)!.id),
  },
);
add(
  'submit-zero-growth-work',
  (c) =>
    workloadProposal(c.m.zeroWindow!, [
      allocation(ZERO_GROWTH_PLAYER, 'meeting_attention', 'linebacker', 20, {
        teacherPersonId: NF_COACH,
      }),
    ]),
  { after: (c) => (c.m.zeroWorkProposal = lastProposal(c.k)) },
);
add('commit-zero-growth-work', (c) => workloadCommit(c.m.zeroWorkProposal!));
add('advance-zero-growth-window', { type: 'AdvanceDays', days: 7 });

export const PACKAGE_D_STEPS: readonly PackageDStepSpec[] = steps;
