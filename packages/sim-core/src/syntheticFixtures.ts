import { SCHEMA_VERSION, type SourceProvenance } from './provenance';
import { moneyAmount as m } from './economy';
import { rulesetRefOf, sealRuleset } from './ruleset';
import { sealSeed } from './seed';

/**
 * The synthetic Package A ruleset and seed, built with the production sealing code.
 * Node (headless), tests and the Expo/Hermes app all import THESE values, so every runtime
 * starts from byte-identical inputs. Contains no real league data.
 * The committed JSON in /fixtures is generated from this module and tested against it.
 */
const provenance: SourceProvenance = {
  sourceId: 'sport-sim-synthetic-package-a',
  sourceKind: 'synthetic',
  retrievedAt: '2026-10-16T00:00:00Z',
  effectiveAsOf: '2026-10-16',
  validationStatus: 'synthetic',
  note: 'Synthetic Package A fixture. Contains no real league data.',
};

export const SYNTHETIC_RULESET = sealRuleset({
  schemaVersion: SCHEMA_VERSION,
  rulesetId: 'synthetic-minimal',
  rulesetVersion: 1,
  displayName: 'Synthetic Minimal Ruleset (Package A)',
  provenance: [provenance],
  rules: { maxAdvanceDaysPerCommand: 30 },
});

export const SYNTHETIC_SEED = sealSeed({
  schemaVersion: SCHEMA_VERSION,
  seedId: 'synthetic-empty',
  seedVersion: 1,
  ruleset: rulesetRefOf(SYNTHETIC_RULESET),
  rngSeed32: 20261016,
  startDate: '2026-10-16',
  provenance: [provenance],
  initialEntities: [],
});

const packageCProvenance: SourceProvenance = {
  sourceId: 'sport-sim-synthetic-package-c-rules',
  sourceKind: 'synthetic',
  retrievedAt: '2026-10-17T00:00:00Z',
  effectiveAsOf: '2026-10-17',
  validationStatus: 'synthetic',
  note: 'Synthetic Package C acceptance profile. Values are test boundaries, not claims about current NFL rules or economics.',
};

const seasonRules = (season: number) => ({
  season,
  salaryCap: m(2_000_000),
  activeRosterLimit: 10,
  reserveRosterLimit: 4,
  practiceSquadLimit: 4,
  freeAgencyOpen: `${season}-03-10`,
  freeAgencyClose: `${season}-07-15`,
  tradeDeadline: `${season}-11-03`,
  draftDate: `${season}-04-25`,
});

/**
 * The one explicit synthetic transaction profile Package C acceptance runs on. The money
 * unit is a synthetic integer unit; nothing here reproduces current NFL economics. The
 * committed JSON in /fixtures is generated from this module and tested against it.
 */
export const SYNTHETIC_PACKAGE_C_RULESET = sealRuleset({
  schemaVersion: SCHEMA_VERSION,
  rulesetId: 'synthetic-package-c-rules',
  rulesetVersion: 1,
  displayName: 'Synthetic Package C Transaction Rules',
  provenance: [packageCProvenance],
  rules: {
    maxAdvanceDaysPerCommand: 30,
    transactions: {
      moneyUnit: 'synthetic-unit',
      seasonRules: [2026, 2027, 2028, 2029, 2030].map(seasonRules),
      contracts: {
        minYears: 1,
        maxYears: 5,
        signingBonusProrationMaxYears: 5,
        minimumBaseSalary: m(10_000),
        guaranteedFutureBaseOnRelease: true,
        signingBonusStaysWithOriginalClubOnTrade: true,
      },
      market: {
        defaultOfferValidityDays: 7,
        futurePickTradeHorizonSeasons: 2,
        resolutionPolicy: 'checkpoint',
      },
      waivers: {
        claimWindowDays: 1,
        releasedPlayerWaiverPolicy: 'all',
        claimWinnerMovesToEnd: true,
      },
      draft: {
        rounds: 3,
        rookieContractByRound: [
          {
            round: 1,
            years: 4,
            baseSalaryBySeason: [m(60_000), m(70_000), m(80_000), m(90_000)],
            signingBonus: m(100_000),
          },
          {
            round: 2,
            years: 4,
            baseSalaryBySeason: [m(40_000), m(45_000), m(50_000), m(55_000)],
            signingBonus: m(40_000),
          },
          {
            round: 3,
            years: 3,
            baseSalaryBySeason: [m(20_000), m(22_000), m(24_000)],
            signingBonus: m(10_000),
          },
        ],
      },
    },
  },
});

const packageDProvenance: SourceProvenance = {
  sourceId: 'sport-sim-synthetic-package-d-rules',
  sourceKind: 'synthetic',
  retrievedAt: '2026-10-17T00:00:00Z',
  effectiveAsOf: '2026-10-17',
  validationStatus: 'synthetic',
  note: 'Synthetic Package D development and medical calibration. Values are test boundaries, NOT validated NFL empirical development, aging or medical truth.',
};

const POSITION_SCOPES = [
  'quarterback',
  'running_back',
  'wide_receiver',
  'offensive_line',
  'defensive_line',
  'linebacker',
  'cornerback',
  'safety',
] as const;

const RESOURCE_CAPACITY = [
  ['first_team_reps', 100],
  ['development_reps', 60],
  ['meeting_attention', 40],
  ['installation_work', 30],
] as const;

/** Whole-year ages expressed in days (365.25-day years, rounded) for the synthetic curves. */
const years = (y: number): number => Math.round(y * 365.25);

/**
 * The explicit synthetic development profile Package D acceptance runs on: Package C's
 * transaction rules plus ruleset-owned opportunity structure and synthetic calibration.
 * Nothing here claims to be real player development, aging or medicine. The committed JSON
 * in /fixtures is generated from this module and tested against it.
 */
export const SYNTHETIC_PACKAGE_D_RULESET = sealRuleset({
  schemaVersion: SCHEMA_VERSION,
  rulesetId: 'synthetic-package-d-rules',
  rulesetVersion: 1,
  displayName: 'Synthetic Package D Development Rules',
  provenance: [packageDProvenance],
  rules: {
    maxAdvanceDaysPerCommand: 30,
    transactions: SYNTHETIC_PACKAGE_C_RULESET.rules.transactions!,
    development: {
      modelVersion: 1,
      checkpointCadenceDays: 7,
      opportunityPools: POSITION_SCOPES.flatMap((scopeKey) =>
        RESOURCE_CAPACITY.map(([resourceKey, capacityUnits]) => ({
          resourceKey,
          scopeKey,
          capacityUnits,
        })),
      ),
      maxPlayerLoadUnitsPerCheckpoint: 100,
      recoveryUnitsPerDay: 8,
      roleLearningScaleBp: 2500,
      conditioningScaleBp: 2000,
      medicalRecoveryScaleBp: 1500,
      capabilityFamilies: [
        {
          familyKey: 'explosive_athleticism',
          capabilityKeys: ['burst', 'agility'],
          maturationMidpointAgeDays: years(22),
          declineOnsetAgeDays: years(27),
          adaptationScaleBp: 3000,
          declineScaleBpPerYear: 250,
        },
        {
          familyKey: 'physical_strength',
          capabilityKeys: ['strength', 'arm_power'],
          maturationMidpointAgeDays: years(25),
          declineOnsetAgeDays: years(31),
          adaptationScaleBp: 2500,
          declineScaleBpPerYear: 120,
        },
        {
          familyKey: 'technique',
          capabilityKeys: [
            'hands',
            'block_technique',
            'tackling',
            'run_stopping',
            'route_craft',
            'pass_rush',
            'accuracy',
          ],
          maturationMidpointAgeDays: years(26),
          declineOnsetAgeDays: years(33),
          adaptationScaleBp: 3500,
          declineScaleBpPerYear: 60,
        },
        {
          familyKey: 'processing_recognition',
          capabilityKeys: [
            'processing',
            'vision',
            'anticipation',
            'coverage_instincts',
          ],
          maturationMidpointAgeDays: years(27),
          declineOnsetAgeDays: years(35),
          adaptationScaleBp: 4000,
          declineScaleBpPerYear: 30,
        },
      ],
    },
  },
});
