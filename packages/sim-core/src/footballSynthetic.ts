import type {
  FootballActionRule,
  FootballConceptRule,
  FootballFormationRule,
  FootballFormationSlot,
  FootballRulesV1,
} from './footballRules';

/**
 * The SYNTHETIC football profile Package E acceptance runs on. Structure (formations,
 * vocabularies, bindings, ordering) is real rules content; every number in `outcome`,
 * `injury`, `matchupEdges`, penalties' weights and the exposure conversion is a synthetic
 * engineering/calibration fixture. NOTHING here is empirically validated NFL football,
 * injury or tactical truth, and nothing here may be read as a claim about real players.
 */

const slot = (
  slotKey: string,
  ...eligibleRoles: string[]
): FootballFormationSlot => ({ slotKey, eligibleRoles });

const numbered = (
  prefix: string,
  count: number,
  ...roles: string[]
): FootballFormationSlot[] =>
  Array.from({ length: count }, (_, i) => slot(`${prefix}${i + 1}`, ...roles));

/** Any rostered player except the two specialist roles may serve on a coverage/return unit. */
const SPECIAL_TEAMS_ROLES = [
  'running_back',
  'wide_receiver',
  'tight_end',
  'offensive_line',
  'defensive_line',
  'linebacker',
  'cornerback',
  'safety',
];

const FORMATIONS: readonly FootballFormationRule[] = [
  {
    formationKey: 'single_back_11',
    side: 'offense',
    personnelKey: 'personnel_11',
    slots: [
      slot('qb', 'quarterback'),
      slot('rb', 'running_back'),
      ...numbered('wr', 3, 'wide_receiver'),
      slot('te1', 'tight_end'),
      ...numbered('ol', 5, 'offensive_line'),
    ],
  },
  {
    formationKey: 'two_back_21',
    side: 'offense',
    personnelKey: 'personnel_21',
    slots: [
      slot('qb', 'quarterback'),
      slot('rb', 'running_back'),
      slot('rb2', 'running_back'),
      ...numbered('wr', 2, 'wide_receiver'),
      slot('te1', 'tight_end'),
      ...numbered('ol', 5, 'offensive_line'),
    ],
  },
  {
    formationKey: 'two_tight_12',
    side: 'offense',
    personnelKey: 'personnel_12',
    slots: [
      slot('qb', 'quarterback'),
      slot('rb', 'running_back'),
      ...numbered('wr', 2, 'wide_receiver'),
      slot('te1', 'tight_end'),
      slot('te2', 'tight_end'),
      ...numbered('ol', 5, 'offensive_line'),
    ],
  },
  {
    formationKey: 'four_three_base',
    side: 'defense',
    personnelKey: 'base_defense_43',
    slots: [
      ...numbered('dl', 4, 'defensive_line'),
      ...numbered('lb', 3, 'linebacker'),
      ...numbered('cb', 2, 'cornerback'),
      ...numbered('s', 2, 'safety'),
    ],
  },
  {
    formationKey: 'nickel_425',
    side: 'defense',
    personnelKey: 'nickel_defense',
    slots: [
      ...numbered('dl', 4, 'defensive_line'),
      ...numbered('lb', 2, 'linebacker'),
      ...numbered('cb', 3, 'cornerback'),
      ...numbered('s', 2, 'safety'),
    ],
  },
  {
    formationKey: 'kickoff_unit',
    side: 'kicking',
    personnelKey: 'kickoff_team',
    slots: [
      slot('kicker', 'kicker'),
      ...numbered('cover', 10, ...SPECIAL_TEAMS_ROLES),
    ],
  },
  {
    formationKey: 'kick_return_unit',
    side: 'returning',
    personnelKey: 'return_team',
    slots: [
      slot('returner', 'running_back', 'wide_receiver', 'cornerback'),
      ...numbered('wall', 10, ...SPECIAL_TEAMS_ROLES),
    ],
  },
  {
    formationKey: 'punt_unit',
    side: 'kicking',
    personnelKey: 'punt_team',
    slots: [
      slot('punter', 'punter'),
      ...numbered('shield', 10, ...SPECIAL_TEAMS_ROLES),
    ],
  },
  {
    formationKey: 'punt_return_unit',
    side: 'returning',
    personnelKey: 'return_team',
    slots: [
      slot('returner', 'running_back', 'wide_receiver', 'cornerback'),
      ...numbered('rusher', 10, ...SPECIAL_TEAMS_ROLES),
    ],
  },
  {
    formationKey: 'field_goal_unit',
    side: 'kicking',
    personnelKey: 'field_goal_team',
    slots: [
      slot('kicker', 'kicker'),
      slot('holder', 'punter'),
      ...numbered('protect', 9, ...SPECIAL_TEAMS_ROLES),
    ],
  },
  {
    formationKey: 'field_goal_block_unit',
    side: 'returning',
    personnelKey: 'return_team',
    slots: numbered('rush', 11, ...SPECIAL_TEAMS_ROLES),
  },
];

const ready = (min: number, floor: number, scale: number) => ({
  minFunctionalReadinessBp: min,
  familiarityFloorBp: floor,
  belowFloorExecutionScaleBp: scale,
});

const ACTIONS: readonly FootballActionRule[] = [
  {
    actionKey: 'pass_protect',
    capabilityBindings: [
      { capabilityKey: 'block_technique', weightBp: 4000 },
      { capabilityKey: 'strength', weightBp: 2500 },
      { capabilityKey: 'processing', weightBp: 1500 },
      { capabilityKey: 'agility', weightBp: 2000 },
    ],
    responsibilityKeys: ['protection_scheme'],
    participation: ready(2500, 3000, 7000),
  },
  {
    actionKey: 'run_block',
    capabilityBindings: [
      { capabilityKey: 'block_technique', weightBp: 4000 },
      { capabilityKey: 'strength', weightBp: 4000 },
      { capabilityKey: 'agility', weightBp: 2000 },
    ],
    responsibilityKeys: ['protection_scheme'],
    participation: ready(2500, 3000, 7000),
  },
  {
    actionKey: 'read_progression',
    capabilityBindings: [
      { capabilityKey: 'processing', weightBp: 5000 },
      { capabilityKey: 'anticipation', weightBp: 5000 },
    ],
    responsibilityKeys: ['progression_reads', 'protection_calls'],
    participation: ready(2500, 3500, 6500),
  },
  {
    actionKey: 'throw_pass',
    capabilityBindings: [
      { capabilityKey: 'accuracy', weightBp: 4500 },
      { capabilityKey: 'arm_power', weightBp: 2000 },
      { capabilityKey: 'processing', weightBp: 2000 },
      { capabilityKey: 'anticipation', weightBp: 1500 },
    ],
    responsibilityKeys: ['progression_reads'],
    participation: ready(3000, 3500, 6500),
  },
  {
    actionKey: 'run_route',
    capabilityBindings: [
      { capabilityKey: 'route_craft', weightBp: 4500 },
      { capabilityKey: 'burst', weightBp: 2000 },
      { capabilityKey: 'agility', weightBp: 2000 },
      { capabilityKey: 'anticipation', weightBp: 1500 },
    ],
    responsibilityKeys: ['route_tree'],
    participation: ready(2500, 3000, 7000),
  },
  {
    actionKey: 'catch_ball',
    capabilityBindings: [
      { capabilityKey: 'hands', weightBp: 7000 },
      { capabilityKey: 'agility', weightBp: 1500 },
      { capabilityKey: 'anticipation', weightBp: 1500 },
    ],
    responsibilityKeys: ['route_tree'],
    participation: ready(2500, 3000, 7500),
  },
  {
    actionKey: 'carry_ball',
    capabilityBindings: [
      { capabilityKey: 'vision', weightBp: 3000 },
      { capabilityKey: 'burst', weightBp: 3000 },
      { capabilityKey: 'strength', weightBp: 2000 },
      { capabilityKey: 'agility', weightBp: 2000 },
    ],
    responsibilityKeys: ['run_reads'],
    participation: ready(2500, 3000, 7000),
  },
  {
    actionKey: 'kick_field_goal',
    capabilityBindings: [
      { capabilityKey: 'accuracy', weightBp: 5000 },
      { capabilityKey: 'arm_power', weightBp: 5000 },
    ],
    responsibilityKeys: ['kick_mechanics'],
    participation: ready(4000, 3000, 7000),
  },
  {
    actionKey: 'kick_off',
    capabilityBindings: [
      { capabilityKey: 'arm_power', weightBp: 6000 },
      { capabilityKey: 'accuracy', weightBp: 4000 },
    ],
    responsibilityKeys: ['kick_mechanics'],
    participation: ready(4000, 3000, 7000),
  },
  {
    actionKey: 'punt_ball',
    capabilityBindings: [
      { capabilityKey: 'arm_power', weightBp: 6000 },
      { capabilityKey: 'accuracy', weightBp: 4000 },
    ],
    responsibilityKeys: ['kick_mechanics'],
    participation: ready(4000, 3000, 7000),
  },
  {
    actionKey: 'rush_passer',
    capabilityBindings: [
      { capabilityKey: 'pass_rush', weightBp: 5000 },
      { capabilityKey: 'burst', weightBp: 2500 },
      { capabilityKey: 'strength', weightBp: 2500 },
    ],
    responsibilityKeys: ['gap_responsibility'],
    participation: ready(2500, 3000, 7000),
  },
  {
    actionKey: 'defend_run',
    capabilityBindings: [
      { capabilityKey: 'run_stopping', weightBp: 4500 },
      { capabilityKey: 'tackling', weightBp: 2500 },
      { capabilityKey: 'strength', weightBp: 1500 },
      { capabilityKey: 'processing', weightBp: 1500 },
    ],
    responsibilityKeys: ['run_fits', 'gap_responsibility'],
    participation: ready(2500, 3000, 7000),
  },
  {
    actionKey: 'cover_receiver',
    capabilityBindings: [
      { capabilityKey: 'coverage_instincts', weightBp: 4000 },
      { capabilityKey: 'agility', weightBp: 2000 },
      { capabilityKey: 'burst', weightBp: 2000 },
      { capabilityKey: 'anticipation', weightBp: 2000 },
    ],
    responsibilityKeys: ['coverage_rules', 'coverage_drops'],
    participation: ready(2500, 3000, 6500),
  },
  {
    actionKey: 'tackle_ball_carrier',
    capabilityBindings: [
      { capabilityKey: 'tackling', weightBp: 7000 },
      { capabilityKey: 'burst', weightBp: 1500 },
      { capabilityKey: 'anticipation', weightBp: 1500 },
    ],
    responsibilityKeys: ['run_fits', 'coverage_rules'],
    participation: ready(2500, 3000, 7500),
  },
];

const ids = (...keys: string[]): string[] => keys;

const OL_SLOTS = ids('ol1', 'ol2', 'ol3', 'ol4', 'ol5');
const OFFENSE_FORMATIONS = ids('single_back_11', 'two_back_21', 'two_tight_12');
const DEFENSE_FORMATIONS = ids('four_three_base', 'nickel_425');

const CONCEPTS: readonly FootballConceptRule[] = [
  {
    conceptKey: 'inside_run',
    side: 'offense',
    playCategory: 'run',
    schemeKey: 'base_offense',
    formationKeys: OFFENSE_FORMATIONS,
    assignments: [
      {
        responsibilityKey: 'run_reads',
        actionKey: 'carry_ball',
        slotKeys: ['rb'],
      },
      {
        responsibilityKey: 'protection_scheme',
        actionKey: 'run_block',
        slotKeys: OL_SLOTS,
      },
    ],
  },
  {
    conceptKey: 'outside_run',
    side: 'offense',
    playCategory: 'run',
    schemeKey: 'base_offense',
    formationKeys: OFFENSE_FORMATIONS,
    assignments: [
      {
        responsibilityKey: 'run_reads',
        actionKey: 'carry_ball',
        slotKeys: ['rb'],
      },
      {
        responsibilityKey: 'protection_scheme',
        actionKey: 'run_block',
        slotKeys: OL_SLOTS,
      },
      {
        responsibilityKey: 'route_tree',
        actionKey: 'run_route',
        slotKeys: ['wr1', 'wr2'],
      },
    ],
  },
  {
    conceptKey: 'quick_pass',
    side: 'offense',
    playCategory: 'pass',
    schemeKey: 'base_offense',
    formationKeys: OFFENSE_FORMATIONS,
    assignments: [
      {
        responsibilityKey: 'progression_reads',
        actionKey: 'throw_pass',
        slotKeys: ['qb'],
      },
      {
        responsibilityKey: 'route_tree',
        actionKey: 'run_route',
        slotKeys: ['wr1', 'wr2'],
      },
      {
        responsibilityKey: 'route_tree',
        actionKey: 'catch_ball',
        slotKeys: ['wr1', 'wr2'],
      },
      {
        responsibilityKey: 'protection_scheme',
        actionKey: 'pass_protect',
        slotKeys: OL_SLOTS,
      },
    ],
  },
  {
    conceptKey: 'deep_pass',
    side: 'offense',
    playCategory: 'pass',
    schemeKey: 'base_offense',
    formationKeys: OFFENSE_FORMATIONS,
    assignments: [
      {
        responsibilityKey: 'progression_reads',
        actionKey: 'read_progression',
        slotKeys: ['qb'],
      },
      {
        responsibilityKey: 'progression_reads',
        actionKey: 'throw_pass',
        slotKeys: ['qb'],
      },
      {
        responsibilityKey: 'route_tree',
        actionKey: 'run_route',
        slotKeys: ['wr1', 'wr2'],
      },
      {
        responsibilityKey: 'route_tree',
        actionKey: 'catch_ball',
        slotKeys: ['wr1', 'wr2'],
      },
      {
        responsibilityKey: 'protection_scheme',
        actionKey: 'pass_protect',
        slotKeys: OL_SLOTS,
      },
    ],
  },
  {
    conceptKey: 'zone_shell',
    side: 'defense',
    playCategory: 'defense',
    schemeKey: 'base_defense',
    formationKeys: DEFENSE_FORMATIONS,
    assignments: [
      {
        responsibilityKey: 'coverage_drops',
        actionKey: 'cover_receiver',
        slotKeys: ['lb1', 'lb2', 'cb1', 'cb2', 's1', 's2'],
      },
      {
        responsibilityKey: 'gap_responsibility',
        actionKey: 'rush_passer',
        slotKeys: ['dl1', 'dl2', 'dl3', 'dl4'],
      },
    ],
  },
  {
    conceptKey: 'man_press',
    side: 'defense',
    playCategory: 'defense',
    schemeKey: 'base_defense',
    formationKeys: DEFENSE_FORMATIONS,
    assignments: [
      {
        responsibilityKey: 'coverage_rules',
        actionKey: 'cover_receiver',
        slotKeys: ['cb1', 'cb2', 's1', 's2'],
      },
      {
        responsibilityKey: 'gap_responsibility',
        actionKey: 'rush_passer',
        slotKeys: ['dl1', 'dl2', 'dl3', 'dl4'],
      },
    ],
  },
  {
    conceptKey: 'run_commit_front',
    side: 'defense',
    playCategory: 'defense',
    schemeKey: 'base_defense',
    formationKeys: ['four_three_base'],
    assignments: [
      {
        responsibilityKey: 'run_fits',
        actionKey: 'defend_run',
        slotKeys: ['dl1', 'dl2', 'dl3', 'dl4', 'lb1', 'lb2', 'lb3'],
      },
      {
        responsibilityKey: 'run_fits',
        actionKey: 'tackle_ball_carrier',
        slotKeys: ['s1', 's2'],
      },
    ],
  },
  {
    conceptKey: 'kickoff_deep',
    side: 'kicking',
    playCategory: 'kickoff',
    schemeKey: 'special_teams',
    formationKeys: ['kickoff_unit'],
    assignments: [
      {
        responsibilityKey: 'kick_mechanics',
        actionKey: 'kick_off',
        slotKeys: ['kicker'],
      },
      {
        responsibilityKey: 'run_fits',
        actionKey: 'tackle_ball_carrier',
        slotKeys: numbered('cover', 10).map((s) => s.slotKey),
      },
    ],
  },
  {
    conceptKey: 'kick_return_middle',
    side: 'returning',
    playCategory: 'kickoff',
    schemeKey: 'special_teams',
    formationKeys: ['kick_return_unit'],
    assignments: [
      {
        responsibilityKey: 'run_reads',
        actionKey: 'carry_ball',
        slotKeys: ['returner'],
      },
      {
        responsibilityKey: 'protection_scheme',
        actionKey: 'run_block',
        slotKeys: numbered('wall', 10).map((s) => s.slotKey),
      },
    ],
  },
  {
    conceptKey: 'punt_standard',
    side: 'kicking',
    playCategory: 'punt',
    schemeKey: 'special_teams',
    formationKeys: ['punt_unit'],
    assignments: [
      {
        responsibilityKey: 'kick_mechanics',
        actionKey: 'punt_ball',
        slotKeys: ['punter'],
      },
      {
        responsibilityKey: 'protection_scheme',
        actionKey: 'pass_protect',
        slotKeys: numbered('shield', 10).map((s) => s.slotKey),
      },
    ],
  },
  {
    conceptKey: 'punt_return_safe',
    side: 'returning',
    playCategory: 'punt',
    schemeKey: 'special_teams',
    formationKeys: ['punt_return_unit'],
    assignments: [
      {
        responsibilityKey: 'run_reads',
        actionKey: 'carry_ball',
        slotKeys: ['returner'],
      },
      {
        responsibilityKey: 'gap_responsibility',
        actionKey: 'rush_passer',
        slotKeys: numbered('rusher', 10).map((s) => s.slotKey),
      },
    ],
  },
  {
    conceptKey: 'field_goal_attempt',
    side: 'kicking',
    playCategory: 'field_goal',
    schemeKey: 'special_teams',
    formationKeys: ['field_goal_unit'],
    assignments: [
      {
        responsibilityKey: 'kick_mechanics',
        actionKey: 'kick_field_goal',
        slotKeys: ['kicker'],
      },
      {
        responsibilityKey: 'protection_scheme',
        actionKey: 'pass_protect',
        slotKeys: numbered('protect', 9).map((s) => s.slotKey),
      },
    ],
  },
  {
    conceptKey: 'field_goal_block',
    side: 'returning',
    playCategory: 'field_goal',
    schemeKey: 'special_teams',
    formationKeys: ['field_goal_block_unit'],
    assignments: [
      {
        responsibilityKey: 'gap_responsibility',
        actionKey: 'rush_passer',
        slotKeys: numbered('rush', 11).map((s) => s.slotKey),
      },
    ],
  },
  {
    conceptKey: 'extra_point_attempt',
    side: 'kicking',
    playCategory: 'extra_point',
    schemeKey: 'special_teams',
    formationKeys: ['field_goal_unit'],
    assignments: [
      {
        responsibilityKey: 'kick_mechanics',
        actionKey: 'kick_field_goal',
        slotKeys: ['kicker'],
      },
    ],
  },
];

export const SYNTHETIC_FOOTBALL_RULES: FootballRulesV1 = {
  modelVersion: 1,
  profileKey: 'synthetic_football_v1',
  field: {
    fieldLengthYards: 100,
    firstDownYards: 10,
    downsPerSeries: 4,
    kickoffYardLine: 35,
    touchbackYardLine: 25,
    safetyKickYardLine: 20,
    extraPointYardLine: 85,
    twoPointYardLine: 97,
  },
  clock: {
    quartersPerGame: 4,
    quarterSeconds: 900,
    overtimePeriods: 1,
    overtimeSeconds: 600,
    timeoutsPerHalf: 3,
    tieAllowedAfterOvertime: true,
    playDurations: [
      { playCategory: 'run', minSeconds: 25, maxSeconds: 40 },
      { playCategory: 'pass', minSeconds: 15, maxSeconds: 40 },
      { playCategory: 'defense', minSeconds: 15, maxSeconds: 40 },
      { playCategory: 'kickoff', minSeconds: 5, maxSeconds: 12 },
      { playCategory: 'punt', minSeconds: 8, maxSeconds: 15 },
      { playCategory: 'field_goal', minSeconds: 5, maxSeconds: 10 },
      { playCategory: 'extra_point', minSeconds: 0, maxSeconds: 5 },
    ],
  },
  scoring: {
    touchdown: 6,
    fieldGoal: 3,
    safety: 2,
    extraPoint: 1,
    twoPointConversion: 2,
  },
  penalties: [
    {
      penaltyKey: 'false_start',
      against: 'offense',
      yards: 5,
      automaticFirstDown: false,
      lossOfDown: false,
      enforcement: 'dead_ball',
      weightBp: 3000,
    },
    {
      penaltyKey: 'offensive_holding',
      against: 'offense',
      yards: 10,
      automaticFirstDown: false,
      lossOfDown: false,
      enforcement: 'previous_spot',
      weightBp: 2500,
    },
    {
      penaltyKey: 'offside_defense',
      against: 'defense',
      yards: 5,
      automaticFirstDown: false,
      lossOfDown: false,
      enforcement: 'dead_ball',
      weightBp: 2000,
    },
    {
      penaltyKey: 'defensive_holding',
      against: 'defense',
      yards: 5,
      automaticFirstDown: true,
      lossOfDown: false,
      enforcement: 'spot',
      weightBp: 1500,
    },
    {
      penaltyKey: 'pass_interference_defense',
      against: 'defense',
      yards: 15,
      automaticFirstDown: true,
      lossOfDown: false,
      enforcement: 'spot',
      weightBp: 1000,
    },
  ],
  substitution: {
    playersPerSide: 11,
    minOffensiveLinemenOnLine: 5,
    eligibleReceiverRoles: ['wide_receiver', 'tight_end', 'running_back'],
    maxActiveGameDayPlayers: 46,
  },
  specialTeams: {
    kickDepthYards: 17,
    neutralExecutionBp: 5000,
    fieldGoalMaxKickYards: 52,
    goForItMaxYardsToGo: 2,
    goForItMinYardLine: 55,
  },
  schemes: [
    { schemeKey: 'base_offense', side: 'offense' },
    { schemeKey: 'base_defense', side: 'defense' },
    { schemeKey: 'special_teams', side: 'special_teams' },
  ],
  personnelGroups: [
    { personnelKey: 'personnel_11', side: 'offense' },
    { personnelKey: 'personnel_21', side: 'offense' },
    { personnelKey: 'personnel_12', side: 'offense' },
    { personnelKey: 'base_defense_43', side: 'defense' },
    { personnelKey: 'nickel_defense', side: 'defense' },
    { personnelKey: 'kickoff_team', side: 'kicking' },
    { personnelKey: 'punt_team', side: 'kicking' },
    { personnelKey: 'field_goal_team', side: 'kicking' },
    { personnelKey: 'return_team', side: 'returning' },
  ],
  formations: FORMATIONS,
  responsibilities: [
    {
      responsibilityKey: 'progression_reads',
      transferFamilyKey: 'qb_processing',
    },
    {
      responsibilityKey: 'protection_calls',
      transferFamilyKey: 'qb_processing',
    },
    { responsibilityKey: 'run_reads', transferFamilyKey: 'ball_carrier' },
    { responsibilityKey: 'route_tree', transferFamilyKey: 'route_running' },
    { responsibilityKey: 'protection_scheme', transferFamilyKey: 'blocking' },
    {
      responsibilityKey: 'gap_responsibility',
      transferFamilyKey: 'front_play',
    },
    { responsibilityKey: 'run_fits', transferFamilyKey: 'front_play' },
    { responsibilityKey: 'coverage_drops', transferFamilyKey: 'coverage' },
    { responsibilityKey: 'coverage_rules', transferFamilyKey: 'coverage' },
    { responsibilityKey: 'kick_mechanics', transferFamilyKey: 'kicking' },
  ],
  actions: ACTIONS,
  concepts: CONCEPTS,
  matchupEdges: [
    {
      offenseConceptKey: 'inside_run',
      defenseConceptKey: 'run_commit_front',
      edgeBp: -1200,
    },
    {
      offenseConceptKey: 'inside_run',
      defenseConceptKey: 'zone_shell',
      edgeBp: 600,
    },
    {
      offenseConceptKey: 'outside_run',
      defenseConceptKey: 'run_commit_front',
      edgeBp: -400,
    },
    {
      offenseConceptKey: 'quick_pass',
      defenseConceptKey: 'zone_shell',
      edgeBp: -300,
    },
    {
      offenseConceptKey: 'quick_pass',
      defenseConceptKey: 'man_press',
      edgeBp: 400,
    },
    {
      offenseConceptKey: 'deep_pass',
      defenseConceptKey: 'man_press',
      edgeBp: -500,
    },
    {
      offenseConceptKey: 'deep_pass',
      defenseConceptKey: 'zone_shell',
      edgeBp: 300,
    },
    {
      offenseConceptKey: 'deep_pass',
      defenseConceptKey: 'run_commit_front',
      edgeBp: 1000,
    },
  ],
  exposureConversion: [
    { actionKey: 'pass_protect', loadUnitsPerExposure: 2 },
    { actionKey: 'run_block', loadUnitsPerExposure: 2 },
    { actionKey: 'read_progression', loadUnitsPerExposure: 1 },
    { actionKey: 'throw_pass', loadUnitsPerExposure: 2 },
    { actionKey: 'run_route', loadUnitsPerExposure: 2 },
    { actionKey: 'catch_ball', loadUnitsPerExposure: 2 },
    { actionKey: 'carry_ball', loadUnitsPerExposure: 3 },
    { actionKey: 'kick_field_goal', loadUnitsPerExposure: 1 },
    { actionKey: 'kick_off', loadUnitsPerExposure: 1 },
    { actionKey: 'punt_ball', loadUnitsPerExposure: 1 },
    { actionKey: 'rush_passer', loadUnitsPerExposure: 3 },
    { actionKey: 'defend_run', loadUnitsPerExposure: 3 },
    { actionKey: 'cover_receiver', loadUnitsPerExposure: 2 },
    { actionKey: 'tackle_ball_carrier', loadUnitsPerExposure: 3 },
  ],
  outcome: {
    marginScaleBp: 2500,
    executionNoiseBp: 1500,
    baselineCompletionBp: 6200,
    baselineSackBp: 600,
    baselineInterceptionBp: 250,
    baselineFumbleBp: 120,
    baselineRushYardsTenths: 42,
    baselineCompletionYardsTenths: 70,
    yardsPerMarginTenths: 30,
    maxPlayYards: 99,
    baselineKickMakeBp: 8500,
    kickDistancePenaltyBpPerYard: 120,
    baselinePuntYards: 44,
    baselineKickoffYards: 62,
    baselineReturnYardsTenths: 220,
    penaltyChanceBp: 600,
  },
  injury: {
    contactClasses: ['none', 'incidental', 'engaged', 'tackle'],
    baseRiskBpPerExposure: 6,
    fatigueRiskScaleBp: 3000,
    durabilityProtectionScaleBp: 5000,
    exposureRiskBpByCategory: [
      { playCategory: 'run', riskBp: 10000 },
      { playCategory: 'pass', riskBp: 8000 },
      { playCategory: 'defense', riskBp: 8000 },
      { playCategory: 'kickoff', riskBp: 12000 },
      { playCategory: 'punt', riskBp: 6000 },
      { playCategory: 'field_goal', riskBp: 3000 },
      { playCategory: 'extra_point', riskBp: 2000 },
    ],
    conditions: [
      {
        conditionKey: 'synthetic_lower_leg_strain',
        affectedActionKeys: [
          'carry_ball',
          'run_route',
          'cover_receiver',
          'rush_passer',
        ],
        weightBp: 5000,
        severityMinBp: 1500,
        severityMaxBp: 6000,
      },
      {
        conditionKey: 'synthetic_upper_body_strain',
        affectedActionKeys: [
          'throw_pass',
          'catch_ball',
          'run_block',
          'pass_protect',
        ],
        weightBp: 3500,
        severityMinBp: 1000,
        severityMaxBp: 5000,
      },
      {
        conditionKey: 'synthetic_contact_impairment',
        affectedActionKeys: ['tackle_ball_carrier', 'defend_run', 'kick_off'],
        weightBp: 1500,
        severityMinBp: 2500,
        severityMaxBp: 8000,
      },
    ],
    recoveryResponsivenessMinBp: 3000,
    recoveryResponsivenessMaxBp: 8000,
    baselineReinjuryRiskBp: 500,
  },
  ordering: {
    selectionOrder: ['offense', 'defense'],
    participantOrder: 'slot_declaration',
    phaseOrder: [
      'pre_snap_recognition',
      'assignment_execution',
      'protection_and_pressure',
      'progression_and_target',
      'coverage_and_contest',
      'ball_progression_and_result',
      'contact_and_exposure',
      'flags_and_administration',
      'clock_possession_score',
    ],
  },
};
