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
