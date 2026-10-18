import {
  SYNTHETIC_PACKAGE_E_RULESET,
  entityId,
  recordId,
  type EntityId,
  type FootballSelectionSituation,
  type FootballWorld,
  type GameDayDesignation,
  type GamePlanExecutionSnapshot,
  type GameState,
  type PlayStateInput,
} from '../../src/index';
import {
  E_FIXTURE_1,
  E_GAME_DAY_1,
  NF,
  SP,
  eWorld,
  nf,
  sp,
} from './packageEHarness';

export const RULESET = SYNTHETIC_PACKAGE_E_RULESET;

/** Position layout shared by both synthetic clubs: ids 1..34. */
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

export const OFFENSE_CONCEPTS = [
  'inside_run',
  'outside_run',
  'quick_pass',
  'deep_pass',
];
export const DEFENSE_CONCEPTS = ['zone_shell', 'man_press', 'run_commit_front'];
export const SPECIAL_TEAMS_CONCEPTS = [
  'kickoff_deep',
  'kick_return_middle',
  'punt_standard',
  'punt_return_safe',
  'field_goal_attempt',
  'field_goal_block',
  'extra_point_attempt',
];

export const designationsFor = (
  organizationId: string,
  playerOf: (n: number) => string,
): GameDayDesignation[] => {
  let n = 0;
  const primary = LAYOUT.flatMap(({ role, unit, count }) =>
    Array.from({ length: count }, (_, i) => {
      n += 1;
      return {
        id: recordId(`designation-${organizationId}-${n}`),
        fixtureId: recordId(E_FIXTURE_1),
        organizationId: entityId(organizationId),
        playerId: entityId(playerOf(n)),
        status: 'active' as const,
        unitKey: unit,
        roleKey: role,
        depthOrder: i + 1,
        sourceProposalId: recordId(`proposal-${organizationId}`),
        committedAt: E_GAME_DAY_1,
      };
    }),
  );
  const roleByNumber = (i: number): string => {
    let cursor = 0;
    for (const entry of LAYOUT) {
      cursor += entry.count;
      if (i <= cursor) return entry.role;
    }
    throw new Error(`no synthetic role for player ${i}`);
  };
  const special = [
    {
      unit: 'kicking',
      numbers: [33, 34, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    },
    { unit: 'returning', numbers: [5, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27] },
  ].flatMap(({ unit, numbers }) =>
    numbers.map((playerNumber, i) => ({
      id: recordId(`designation-${organizationId}-st-${unit}-${i + 1}`),
      fixtureId: recordId(E_FIXTURE_1),
      organizationId: entityId(organizationId),
      playerId: entityId(playerOf(playerNumber)),
      status: 'active' as const,
      unitKey: unit,
      roleKey: roleByNumber(playerNumber),
      depthOrder: i + 1,
      sourceProposalId: recordId(`proposal-${organizationId}`),
      committedAt: E_GAME_DAY_1,
    })),
  );
  return [...primary, ...special];
};

export const planFor = (
  organizationId: string,
  over: Partial<GamePlanExecutionSnapshot> = {},
): GamePlanExecutionSnapshot => ({
  id: recordId(`gameplan-${organizationId}`),
  fixtureId: recordId(E_FIXTURE_1),
  organizationId: entityId(organizationId),
  capturedAt: E_GAME_DAY_1,
  strategyPlanRefs: [],
  schemeProposalRef: {
    proposalId: recordId(`proposal-${organizationId}`),
    revision: 1,
    termsHash: 'hash',
  },
  authorizedStaffPersonIds: [],
  schemeKey: 'base_offense',
  conceptKeys: [
    ...OFFENSE_CONCEPTS,
    ...DEFENSE_CONCEPTS,
    ...SPECIAL_TEAMS_CONCEPTS,
  ],
  personnelPreferenceKeys: ['personnel_11'],
  constraints: { maxBlitzRateBp: 2500 },
  sourceProposalId: recordId(`proposal-${organizationId}`),
  ...over,
});

/** The Package E world on game day with full active designations and a game plan per club. */
export const selectionWorld = (): FootballWorld => {
  const base = eWorld(E_GAME_DAY_1);
  return {
    ...base,
    football: {
      ...base.football,
      designations: [
        ...designationsFor(NF.org, nf),
        ...designationsFor(SP.org, sp),
      ],
      gamePlans: [planFor(NF.org), planFor(SP.org)],
    },
  };
};

export const fixtureOrgs = (
  world: Pick<FootballWorld, 'football'>,
): { readonly home: EntityId; readonly away: EntityId } => {
  const f = world.football.fixtures.find((x) => x.id === E_FIXTURE_1)!;
  return { home: f.homeOrganizationId, away: f.awayOrganizationId };
};

export const situationFor = (
  possession: EntityId,
  over: Partial<FootballSelectionSituation> = {},
): FootballSelectionSituation => ({
  possessionOrganizationId: possession,
  period: 1,
  clockSecondsRemaining: 900,
  down: 1,
  yardsToGo: 10,
  yardLine: 25,
  homeScore: 0,
  awayScore: 0,
  homeTimeoutsRemaining: 3,
  awayTimeoutsRemaining: 3,
  resolvedCalls: [],
  ...over,
});

/** A fresh game: scoreboard at kickoff of the first scrimmage down, no plays resolved. */
export const gameStateFor = (
  possession: EntityId,
  over: Partial<GameState> = {},
): GameState => ({
  ...situationFor(possession),
  fixtureId: recordId(E_FIXTURE_1),
  playsResolved: 0,
  nextSnap: 'scrimmage',
  status: 'in_progress',
  kickoffKind: null,
  openingReceiverOrganizationId: possession,
  driveCount: 1,
  drivePlays: 0,
  workloadByPlayer: [],
  ...over,
});

/** The exact accepted resolver input for a world: no team rating or control flag exists. */
export const playInput = (
  world: FootballWorld,
  gameState: GameState,
  ruleset: PlayStateInput['ruleset'] = RULESET,
): PlayStateInput => ({
  ruleset,
  football: world.football,
  latent: {
    roster: world.roster,
    development: world.development,
    medical: world.medical,
  },
  gameState,
});

/** `n` well-spread unsigned 32-bit rolls, deterministic and RNG-free. */
export const spreadRolls = (n: number): number[] =>
  Array.from({ length: n }, (_, i) => Math.imul(i + 1, 2654435761) >>> 0);

/** Every key of every object reachable from a value, for structural leak checks. */
export const allKeys = (
  value: unknown,
  out = new Set<string>(),
): Set<string> => {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
  else if (value !== null && typeof value === 'object')
    Object.entries(value).forEach(([k, v]) => {
      out.add(k);
      allKeys(v, out);
    });
  return out;
};
