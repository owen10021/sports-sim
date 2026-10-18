import {
  PACKAGE_E_SEED,
  SYNTHETIC_PACKAGE_E_RULESET,
  WorldKernel,
  createWorld,
  entityId,
  sealSeed,
  worldId,
  type KernelOptions,
  type WorldSeedBody,
} from '../../src/index';
import { NF, SP, runnerFor, okResult, type Runner } from './orgHarness';
export { NF, SP };

export const E_FIXTURE_1 = 'fixture-2027-w01-southport-at-northfield';
export const E_FIXTURE_2 = 'fixture-2027-w02-northfield-at-southport';
export const E_GAME_DAY_1 = '2027-09-12';
/** A few days before the first fixture: designations are made ahead of game day. */
export const E_PREGAME = '2027-09-10';
export const NF_COACH = entityId('person-nf-coach-e');
export const SP_COACH = entityId('person-sp-coach-e');

const ALL_RIGHTS = [
  'propose',
  'advise',
  'approve',
  'veto',
  'execute',
  'communicate',
] as const;
type Right = (typeof ALL_RIGHTS)[number];
const FOOTBALL_CATEGORIES = ['game_day_activation', 'scheme'] as const;

type Grant = {
  readonly id: string;
  readonly personId: string;
  readonly organizationId: string;
  readonly category: (typeof FOOTBALL_CATEGORIES)[number] | 'medical_clearance';
  readonly rights: readonly Right[];
  readonly transferable: boolean;
  readonly effectiveFrom: string;
  readonly effectiveUntil: null;
  readonly sourcePersonId: string | null;
  readonly revision: number;
};

const grant = (
  club: 'nf' | 'sp',
  holder: string,
  personId: string,
  organizationId: string,
  category: Grant['category'],
  rights: readonly Right[],
  sourcePersonId: string | null,
): Grant => ({
  id: `grant-e-${club}-${holder}-${category}`,
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

/**
 * Package E test world: the frozen Package E seed plus a head coach and football-category
 * authority for both clubs. The GM may propose and approve game-day activation but holds
 * no execute right; only the owner and the head coach do. The frozen seed is unchanged.
 */
export const eSeed = () => {
  const { contentHash: _hash, ...base } = PACKAGE_E_SEED;
  void _hash;
  const org = base.organizationSubstrate!;
  const club = (
    c: 'nf' | 'sp',
    orgId: string,
    owner: string,
    gm: string,
    coach: string,
  ): Grant[] => [
    ...FOOTBALL_CATEGORIES.flatMap((category) => [
      grant(c, 'owner', owner, orgId, category, ALL_RIGHTS, null),
      grant(
        c,
        'gm',
        gm,
        orgId,
        category,
        ['propose', 'advise', 'approve'],
        owner,
      ),
      grant(c, 'coach', coach, orgId, category, ALL_RIGHTS, owner),
    ]),
    grant(c, 'owner', owner, orgId, 'medical_clearance', ALL_RIGHTS, null),
  ];
  return sealSeed({
    ...base,
    initialEntities: [
      ...base.initialEntities,
      { id: NF_COACH, kind: 'person', name: 'Synthetic Northfield coach' },
      { id: SP_COACH, kind: 'person', name: 'Synthetic Southport coach' },
    ],
    organizationSubstrate: {
      roleEpisodes: [
        ...org.roleEpisodes,
        {
          id: 'role-nf-coach-e',
          personId: NF_COACH,
          organizationId: NF.org,
          role: 'head_coach',
          title: 'Head coach',
          startDate: '2027-01-01',
          endDate: null,
        },
        {
          id: 'role-sp-coach-e',
          personId: SP_COACH,
          organizationId: SP.org,
          role: 'head_coach',
          title: 'Head coach',
          startDate: '2027-01-01',
          endDate: null,
        },
      ],
      authorityGrants: [
        ...org.authorityGrants,
        ...club('nf', NF.org, NF.owner, NF.gm, NF_COACH),
        ...club('sp', SP.org, SP.owner, SP.gm, SP_COACH),
      ],
    },
  } satisfies WorldSeedBody);
};

export const eWorld = (simDate = E_PREGAME) => {
  const w = createWorld(eSeed(), SYNTHETIC_PACKAGE_E_RULESET, {
    newWorldId: () => worldId('world-package-e-harness'),
  });
  return { ...w, simDate };
};
export const newPackageEKernel = (
  options?: KernelOptions,
  simDate = E_PREGAME,
) =>
  WorldKernel.fromGenesis(
    eWorld(simDate),
    SYNTHETIC_PACKAGE_E_RULESET,
    options,
  );
export const eRunner = (simDate = E_PREGAME): Runner =>
  runnerFor(newPackageEKernel(undefined, simDate));

export type Designation = {
  playerId: string;
  status: 'active' | 'inactive';
  unitKey: string | null;
  roleKey: string | null;
  depthOrder: number | null;
};
export const active = (
  playerId: string,
  unitKey: string,
  roleKey: string,
  depthOrder = 1,
): Designation => ({
  playerId,
  status: 'active',
  unitKey,
  roleKey,
  depthOrder,
});
export const inactive = (playerId: string): Designation => ({
  playerId,
  status: 'inactive',
  unitKey: null,
  roleKey: null,
  depthOrder: null,
});

export const activationTerms = (
  designations: readonly Designation[],
  fixtureId = E_FIXTURE_1,
  organizationId: string = NF.org,
) => ({ fixtureId, organizationId, designations });

/** Submits a game-day activation proposal as the GM and returns the proposal id. */
export const submitActivation = (
  r: Runner,
  terms: Record<string, unknown>,
  by: string = NF.gm,
  organizationId: string = NF.org,
  extra: Record<string, unknown> = {},
) => {
  okResult(
    r.run({
      type: 'SubmitProposal',
      organizationId,
      actingPersonId: by,
      category: 'game_day_activation',
      subjects: [{ kind: 'entity', id: organizationId }],
      termsType: 'game_day_activation_v1',
      terms,
      requiredApproverPersonIds: [],
      expiresAt: null,
      contingencies: {},
      ...extra,
    }),
  );
  return r.kernel.world.decisions.proposals.at(-1)!.id;
};

export const commitActivation = (
  proposalId: string,
  by: string = NF_COACH,
  extra: Record<string, unknown> = {},
) => ({
  type: 'CommitGameDayActivationProposal',
  proposalId,
  actingPersonId: by,
  expectedRevision: 1,
  beliefIds: [],
  evidenceClaimIds: [],
  rationale: { note: 'game-day designation' },
  ...extra,
});

/** Northfield player ids by position slot (QB2, RB2, WR4, TE2, OL7, DL5, LB4, CB3, S3, K1, P1). */
export const nf = (n: number): string =>
  `player-nf-e${String(n).padStart(2, '0')}`;
export const sp = (n: number): string =>
  `player-sp-e${String(n).padStart(2, '0')}`;
