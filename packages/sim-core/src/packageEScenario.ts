import type { ActorKind, EntityId } from './ids';
import { entityId } from './ids';
import type { RejectionCode, WorldKernel } from './kernel';
import { PACKAGE_E_SEED } from './packageEWorldSeed';
import { rulesetRefOf, sealRuleset } from './ruleset';
import { sealSeed, type WorldSeedBody } from './seed';
import { SYNTHETIC_PACKAGE_E_RULESET } from './syntheticFixtures';

export const PACKAGE_E_SCENARIO_ID = 'package-e-golden-v1';
export const PACKAGE_E_WORLD_ID = 'world-package-e-golden-v1';
export const PACKAGE_E_PREGAME = '2027-09-10';
export const PACKAGE_E_GAME_DAY = '2027-09-12';
export const PACKAGE_E_FIXTURE_ID = 'fixture-2027-w01-southport-at-northfield';

export const NF_ORG_E = entityId('org-northfield');
export const SP_ORG_E = entityId('org-southport');
export const NF_OWNER_E = entityId('person-nf-owner');
export const SP_OWNER_E = entityId('person-sp-owner');
export const NF_GM_E = entityId('person-nf-gm');
export const SP_GM_E = entityId('person-sp-gm');
export const NF_COACH_E = entityId('person-nf-coach-e');
export const SP_COACH_E = entityId('person-sp-coach-e');
export const LIMITED_PLAYER_E = entityId('player-nf-e01');
export const LIMITED_BACKUP_E = entityId('player-nf-e02');
export const LIMITED_CAP_UNITS_E = 12;

const { contentHash: _rulesHash, ...rulesBody } = SYNTHETIC_PACKAGE_E_RULESET;
void _rulesHash;
const footballBase = rulesBody.rules.football!;

/** Acceptance-only synthetic calibration: engineered to exercise one midgame E -> D injury. */
export const PACKAGE_E_SCENARIO_RULESET = sealRuleset({
  ...rulesBody,
  rulesetId: 'synthetic-package-e-acceptance-rules',
  displayName: 'Synthetic Package E Acceptance Rules',
  rules: {
    ...rulesBody.rules,
    football: {
      ...footballBase,
      injury: {
        ...footballBase.injury,
        baseRiskBpPerExposure: 12,
        conditions: [
          {
            conditionKey: 'synthetic_acceptance_contact_strain',
            affectedActionKeys: footballBase.actions
              .map((action) => action.actionKey)
              .sort(),
            weightBp: 10000,
            severityMinBp: 3000,
            severityMaxBp: 4000,
          },
        ],
      },
    },
  },
});

const ALL_RIGHTS = [
  'propose',
  'advise',
  'approve',
  'veto',
  'execute',
  'communicate',
] as const;
type Right = (typeof ALL_RIGHTS)[number];
type Category = 'game_day_activation' | 'scheme' | 'medical_clearance';

type Grant = {
  readonly id: string;
  readonly personId: string;
  readonly organizationId: string;
  readonly category: Category;
  readonly rights: readonly Right[];
  readonly transferable: boolean;
  readonly effectiveFrom: string;
  readonly effectiveUntil: null;
  readonly sourcePersonId: string | null;
  readonly revision: number;
};

const grant = (
  id: string,
  personId: string,
  organizationId: string,
  category: Category,
  rights: readonly Right[],
  sourcePersonId: string | null,
): Grant => ({
  id,
  personId,
  organizationId,
  category,
  rights,
  transferable: false,
  effectiveFrom: '2027-01-01',
  effectiveUntil: null,
  sourcePersonId,
  revision: 1,
});

const { contentHash: _seedHash, ...seedBody } = PACKAGE_E_SEED;
void _seedHash;
const organizationSubstrate = seedBody.organizationSubstrate!;
const footballGrants = (
  prefix: string,
  organizationId: EntityId,
  ownerId: EntityId,
  gmId: EntityId,
  coachId: EntityId,
): Grant[] => [
  ...(['game_day_activation', 'scheme'] as const).flatMap((category) => [
    grant(
      `grant-${prefix}-owner-${category}-e`,
      ownerId,
      organizationId,
      category,
      ALL_RIGHTS,
      null,
    ),
    grant(
      `grant-${prefix}-gm-${category}-e`,
      gmId,
      organizationId,
      category,
      ['propose', 'advise', 'approve'],
      ownerId,
    ),
    grant(
      `grant-${prefix}-coach-${category}-e`,
      coachId,
      organizationId,
      category,
      ALL_RIGHTS,
      ownerId,
    ),
  ]),
];

export const PACKAGE_E_SCENARIO_SEED = sealSeed({
  ...seedBody,
  seedId: 'synthetic-package-e-acceptance-scenario',
  startDate: PACKAGE_E_PREGAME,
  ruleset: rulesetRefOf(PACKAGE_E_SCENARIO_RULESET),
  initialEntities: [
    ...seedBody.initialEntities,
    {
      id: NF_COACH_E,
      kind: 'person' as const,
      name: 'Synthetic Northfield head coach',
    },
    {
      id: SP_COACH_E,
      kind: 'person' as const,
      name: 'Synthetic Southport head coach',
    },
  ].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  organizationSubstrate: {
    roleEpisodes: [
      ...organizationSubstrate.roleEpisodes,
      {
        id: 'role-nf-coach-e-acceptance',
        personId: NF_COACH_E,
        organizationId: NF_ORG_E,
        role: 'head_coach' as const,
        title: 'Head Coach',
        startDate: '2027-01-01',
        endDate: null,
      },
      {
        id: 'role-sp-coach-e-acceptance',
        personId: SP_COACH_E,
        organizationId: SP_ORG_E,
        role: 'head_coach' as const,
        title: 'Head Coach',
        startDate: '2027-01-01',
        endDate: null,
      },
    ].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    authorityGrants: [
      ...organizationSubstrate.authorityGrants,
      ...footballGrants('nf', NF_ORG_E, NF_OWNER_E, NF_GM_E, NF_COACH_E),
      ...footballGrants('sp', SP_ORG_E, SP_OWNER_E, SP_GM_E, SP_COACH_E),
      grant(
        'grant-nf-owner-medical-clearance-e',
        NF_OWNER_E,
        NF_ORG_E,
        'medical_clearance',
        ALL_RIGHTS,
        null,
      ),
    ].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  },
} satisfies WorldSeedBody);

const nf = (n: number): string => `player-nf-e${String(n).padStart(2, '0')}`;
const sp = (n: number): string => `player-sp-e${String(n).padStart(2, '0')}`;

const LAYOUT: readonly {
  readonly role: string;
  readonly unit: string;
  readonly count: number;
}[] = [
  { role: 'quarterback', unit: 'offense', count: 2 },
  { role: 'running_back', unit: 'offense', count: 2 },
  { role: 'wide_receiver', unit: 'offense', count: 4 },
  { role: 'tight_end', unit: 'offense', count: 2 },
  { role: 'offensive_line', unit: 'offense', count: 7 },
  { role: 'defensive_line', unit: 'defense', count: 5 },
  { role: 'linebacker', unit: 'defense', count: 4 },
  { role: 'cornerback', unit: 'defense', count: 3 },
  { role: 'safety', unit: 'defense', count: 3 },
  { role: 'kicker', unit: 'kicking', count: 1 },
  { role: 'punter', unit: 'kicking', count: 1 },
];

export interface PackageEDesignationTerm {
  readonly playerId: string;
  readonly status: 'active';
  readonly unitKey: string;
  readonly roleKey: string;
  readonly depthOrder: number;
}

const designationsFor = (
  playerOf: (n: number) => string,
): PackageEDesignationTerm[] => {
  let n = 0;
  const primary = LAYOUT.flatMap(({ role, unit, count }) =>
    Array.from({ length: count }, (_, index) => {
      n += 1;
      return {
        playerId: playerOf(n),
        status: 'active' as const,
        unitKey: unit,
        roleKey: role,
        depthOrder: index + 1,
      };
    }),
  );
  const roleByNumber = (number: number): string => {
    let cursor = 0;
    for (const item of LAYOUT) {
      cursor += item.count;
      if (number <= cursor) return item.role;
    }
    throw new Error(`no synthetic role for player ${number}`);
  };
  const special = [
    {
      unit: 'kicking',
      numbers: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    },
    {
      unit: 'returning',
      numbers: [5, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27],
    },
  ].flatMap(({ unit, numbers }) =>
    numbers.map((number, index) => ({
      playerId: playerOf(number),
      status: 'active' as const,
      unitKey: unit,
      roleKey: roleByNumber(number),
      depthOrder: index + 1,
    })),
  );
  return [...primary, ...special];
};

const OFFENSE = ['inside_run', 'outside_run', 'quick_pass', 'deep_pass'];
const DEFENSE = ['zone_shell', 'man_press', 'run_commit_front'];
const SPECIAL = [
  'kickoff_deep',
  'kick_return_middle',
  'punt_standard',
  'punt_return_safe',
  'field_goal_attempt',
  'field_goal_block',
  'extra_point_attempt',
];

export type PackageEVariant = 'primary' | 'alternate';
export type PackageEMemo = Record<string, string>;
export type PackageEScenarioContext = {
  readonly k: WorldKernel;
  readonly variant: PackageEVariant;
  readonly m: PackageEMemo;
};
type Command = Record<string, unknown>;
type CommandBuilder = Command | ((context: PackageEScenarioContext) => Command);

export interface PackageEStepSpec {
  readonly label: string;
  readonly command: CommandBuilder;
  readonly expect: 'committed' | RejectionCode;
  readonly actorKind?: ActorKind;
  readonly before?: (context: PackageEScenarioContext) => void;
  readonly after?: (context: PackageEScenarioContext) => void;
}

const lastProposal = (k: WorldKernel): string => {
  const proposal = k.world.decisions.proposals.at(-1);
  if (proposal === undefined) throw new Error('expected Package E proposal');
  return proposal.id;
};

const proposal = (
  organizationId: EntityId,
  actingPersonId: EntityId,
  category: string,
  termsType: string,
  terms: Record<string, unknown>,
  subjectId: EntityId = organizationId,
): Command => ({
  type: 'SubmitProposal',
  organizationId,
  actingPersonId,
  category,
  subjects: [{ kind: 'entity', id: subjectId }],
  termsType,
  terms,
  requiredApproverPersonIds: [],
  expiresAt: null,
  contingencies: {},
});

const decisionCommit = (
  type: string,
  proposalId: string,
  actingPersonId: EntityId,
): Command => ({
  type,
  proposalId,
  actingPersonId,
  expectedRevision: 1,
  beliefIds: [],
  evidenceClaimIds: [],
  rationale: { note: 'Package E integrated acceptance scenario' },
});

const strategyTerms = (gm: EntityId, organizationId: EntityId) => ({
  planId: null,
  kind: 'strategy',
  scopeKey: `game_strategy_${organizationId}`,
  ownerPersonId: gm,
  effectiveAt: PACKAGE_E_PREGAME,
  horizon: { seasons: 1 },
  objectives: [
    {
      key: 'compete_week_one',
      priority: 'high',
      target: { fixtureId: PACKAGE_E_FIXTURE_ID },
    },
  ],
  constraints: [],
  triggerRefs: [],
  fallbackPlanIds: [],
  changeReasonRefs: [],
});

const gamePlanTerms = (
  organizationId: EntityId,
  coach: EntityId,
  planId: string,
  variant: PackageEVariant,
): Record<string, unknown> => ({
  fixtureId: PACKAGE_E_FIXTURE_ID,
  organizationId,
  strategyPlanRefs: [{ planId, revision: 1 }],
  authorizedStaffPersonIds: [coach],
  schemeKey: 'base_offense',
  conceptKeys:
    variant === 'alternate' && organizationId === NF_ORG_E
      ? ['inside_run', 'quick_pass', ...DEFENSE, ...SPECIAL]
      : [...OFFENSE, ...DEFENSE, ...SPECIAL],
  personnelPreferenceKeys: ['personnel_11'],
  constraints:
    organizationId === NF_ORG_E
      ? { maxBlitzRateBp: 2500, offensivePriority: variant }
      : { maxBlitzRateBp: 3500, offensivePriority: 'balanced' },
});

const steps: PackageEStepSpec[] = [];
const add = (
  label: string,
  command: CommandBuilder,
  options: Omit<PackageEStepSpec, 'label' | 'command' | 'expect'> & {
    readonly expect?: PackageEStepSpec['expect'];
  } = {},
): void => {
  steps.push({
    label,
    command,
    expect: options.expect ?? 'committed',
    ...(options.actorKind === undefined
      ? {}
      : { actorKind: options.actorKind }),
    ...(options.before === undefined ? {} : { before: options.before }),
    ...(options.after === undefined ? {} : { after: options.after }),
  });
};

for (const club of [
  { key: 'nf', org: NF_ORG_E, gm: NF_GM_E },
  { key: 'sp', org: SP_ORG_E, gm: SP_GM_E },
] as const) {
  add(
    `${club.key}-strategy-proposal`,
    proposal(
      club.org,
      club.gm,
      'organizational_plan',
      'organization_plan_v1',
      strategyTerms(club.gm, club.org),
    ),
    { after: (c) => (c.m[`${club.key}StrategyProposal`] = lastProposal(c.k)) },
  );
  add(
    `${club.key}-strategy-commit`,
    (c) =>
      decisionCommit(
        'CommitPlanProposal',
        c.m[`${club.key}StrategyProposal`]!,
        club.gm,
      ),
    {
      after: (c) => {
        const plan = c.k.world.plans.plans
          .filter((p) => p.organizationId === club.org && p.kind === 'strategy')
          .at(-1)!;
        c.m[`${club.key}StrategyPlan`] = plan.id;
      },
    },
  );
}

add(
  'pregame-medical-episode',
  {
    type: 'CreateMedicalEpisode',
    playerId: LIMITED_PLAYER_E,
    conditionKey: 'synthetic_pregame_load_limit',
    onsetAt: PACKAGE_E_PREGAME,
    sourceKind: 'synthetic_test',
    affectedActionKeys: ['throw_pass'],
    initialStructuralSeverityBp: 0,
    recoveryResponsivenessBp: 5000,
    baselineReinjuryRiskBp: 0,
  },
  {
    after: (c) =>
      (c.m.pregameMedicalEpisode = c.k.world.medical.episodes.at(-1)!.id),
  },
);
add(
  'pregame-clearance-proposal',
  (c) =>
    proposal(
      NF_ORG_E,
      NF_OWNER_E,
      'medical_clearance',
      'medical_clearance_v1',
      {
        episodeId: c.m.pregameMedicalEpisode!,
        playerId: LIMITED_PLAYER_E,
        participation: 'limited',
        maxLoadUnits: LIMITED_CAP_UNITS_E,
      },
      LIMITED_PLAYER_E,
    ),
  { after: (c) => (c.m.pregameClearanceProposal = lastProposal(c.k)) },
);
add(
  'pregame-clearance-commit',
  (c) =>
    decisionCommit(
      'CommitMedicalClearanceProposal',
      c.m.pregameClearanceProposal!,
      NF_OWNER_E,
    ),
  {
    after: (c) =>
      (c.m.pregameClearance = c.k.world.medical.clearances.at(-1)!.id),
  },
);

for (const club of [
  { key: 'nf', org: NF_ORG_E, gm: NF_GM_E, coach: NF_COACH_E, playerOf: nf },
  { key: 'sp', org: SP_ORG_E, gm: SP_GM_E, coach: SP_COACH_E, playerOf: sp },
] as const) {
  add(
    `${club.key}-activation-proposal`,
    proposal(
      club.org,
      club.gm,
      'game_day_activation',
      'game_day_activation_v1',
      {
        fixtureId: PACKAGE_E_FIXTURE_ID,
        organizationId: club.org,
        designations: designationsFor(club.playerOf),
      },
    ),
    {
      after: (c) => (c.m[`${club.key}ActivationProposal`] = lastProposal(c.k)),
    },
  );
  add(`${club.key}-activation-commit`, (c) =>
    decisionCommit(
      'CommitGameDayActivationProposal',
      c.m[`${club.key}ActivationProposal`]!,
      club.coach,
    ),
  );
  add(
    `${club.key}-game-plan-proposal`,
    (c) =>
      proposal(
        club.org,
        club.gm,
        'scheme',
        'game_plan_execution_v1',
        gamePlanTerms(
          club.org,
          club.coach,
          c.m[`${club.key}StrategyPlan`]!,
          c.variant,
        ),
      ),
    { after: (c) => (c.m[`${club.key}GamePlanProposal`] = lastProposal(c.k)) },
  );
  add(
    `${club.key}-game-plan-commit`,
    (c) =>
      decisionCommit(
        'CommitGamePlanProposal',
        c.m[`${club.key}GamePlanProposal`]!,
        club.coach,
      ),
    {
      after: (c) => {
        const snapshot = c.k.world.football.gamePlans
          .filter((p) => p.organizationId === club.org)
          .at(-1)!;
        c.m[`${club.key}GamePlan`] = snapshot.id;
      },
    },
  );
}

add(
  'advance-to-game-day',
  { type: 'AdvanceDays', days: 2 },
  {
    after: (c) => (c.m.reachedGameDay = c.k.world.simDate),
  },
);
add(
  'reject-crossing-unresolved-game',
  { type: 'AdvanceDays', days: 1 },
  { expect: 'INVALID_PAYLOAD' },
);
add(
  'resolve-scheduled-game',
  { type: 'ResolveScheduledGame', fixtureId: PACKAGE_E_FIXTURE_ID },
  {
    before: (c) => {
      c.m.preGameCapabilities = JSON.stringify(
        c.k.world.roster.players.map((p) => ({
          id: p.personId,
          capabilities: p.capabilities,
        })),
      );
    },
    after: (c) => {
      c.m.gameId = c.k.world.football.games.at(-1)!.id;
    },
  },
);
add(
  'reject-duplicate-game-resolution',
  { type: 'ResolveScheduledGame', fixtureId: PACKAGE_E_FIXTURE_ID },
  { expect: 'INVALID_PAYLOAD' },
);

export const PACKAGE_E_STEPS: readonly PackageEStepSpec[] = steps;
