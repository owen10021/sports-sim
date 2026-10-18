import { rulesetRefOf } from './ruleset';
import { PACKAGE_D_SEED } from './packageDWorldSeed';
import type {
  PackageCSubstrateSeed,
  SeedContract,
  SeedMembership,
  SeedPlayer,
  SeedRight,
} from './packageCSeedParse';
import type {
  PackageDSubstrateSeed,
  SeedPlayerDevelopmentProfile,
  SeedReadiness,
  SeedRoleKnowledge,
} from './packageDSeedParse';
import type { SourceProvenance } from './provenance';
import { sealSeed, type SeedEntity, type WorldSeedBody } from './seed';
import { SYNTHETIC_PACKAGE_E_RULESET } from './syntheticFixtures';

/**
 * The synthetic Package E world seed: the accepted Package D world plus enough synthetic
 * players on the two fixture clubs (Northfield and Southport) to field complete 11-on-11
 * offense, defense and special-teams units with depth, plus a minimal fixture schedule.
 * Built with the production sealing code so Node, Vitest, Hermes and the Expo app start from
 * byte-identical inputs; the committed JSON in /fixtures/seeds is generated from this module
 * and a test proves they stay identical.
 *
 * SYNTHETIC: names, birth dates, capability values and development profiles are
 * deterministic test values spread to give variety, not claims about real players. There is
 * no overall rating, ceiling or destiny field anywhere. The seed contains no resolved games,
 * calls or outcomes; every one of those is produced by commands.
 */
const provenance: SourceProvenance = {
  sourceId: 'sport-sim-synthetic-package-e-world',
  sourceKind: 'synthetic',
  retrievedAt: '2026-10-18T00:00:00Z',
  effectiveAsOf: '2027-02-15',
  validationStatus: 'synthetic',
  note: 'Synthetic Package E world fixture. Contains no real league data or real people, and is NOT validated NFL football, development or medical data.',
};

type RoleTemplate = {
  readonly role: string;
  readonly count: number;
  readonly starters: number;
  readonly capabilityKeys: readonly string[];
  readonly responsibilities: readonly {
    readonly schemeKey: string;
    readonly responsibilityKey: string;
    readonly transferFamilyKey: string;
  }[];
};

const O = 'base_offense';
const D = 'base_defense';
const ST = 'special_teams';

const ROLE_TEMPLATES: readonly RoleTemplate[] = [
  {
    role: 'quarterback',
    count: 2,
    starters: 1,
    capabilityKeys: [
      'processing',
      'accuracy',
      'arm_power',
      'agility',
      'anticipation',
    ],
    responsibilities: [
      {
        schemeKey: O,
        responsibilityKey: 'progression_reads',
        transferFamilyKey: 'qb_processing',
      },
      {
        schemeKey: O,
        responsibilityKey: 'protection_calls',
        transferFamilyKey: 'qb_processing',
      },
    ],
  },
  {
    role: 'running_back',
    count: 2,
    starters: 1,
    capabilityKeys: ['burst', 'agility', 'strength', 'hands', 'vision'],
    responsibilities: [
      {
        schemeKey: O,
        responsibilityKey: 'run_reads',
        transferFamilyKey: 'ball_carrier',
      },
    ],
  },
  {
    role: 'wide_receiver',
    count: 4,
    starters: 3,
    capabilityKeys: [
      'route_craft',
      'hands',
      'burst',
      'agility',
      'anticipation',
    ],
    responsibilities: [
      {
        schemeKey: O,
        responsibilityKey: 'route_tree',
        transferFamilyKey: 'route_running',
      },
    ],
  },
  {
    role: 'tight_end',
    count: 2,
    starters: 1,
    capabilityKeys: [
      'hands',
      'route_craft',
      'block_technique',
      'strength',
      'agility',
    ],
    responsibilities: [
      {
        schemeKey: O,
        responsibilityKey: 'route_tree',
        transferFamilyKey: 'route_running',
      },
      {
        schemeKey: O,
        responsibilityKey: 'protection_scheme',
        transferFamilyKey: 'blocking',
      },
    ],
  },
  {
    role: 'offensive_line',
    count: 7,
    starters: 5,
    capabilityKeys: ['block_technique', 'strength', 'processing', 'agility'],
    responsibilities: [
      {
        schemeKey: O,
        responsibilityKey: 'protection_scheme',
        transferFamilyKey: 'blocking',
      },
    ],
  },
  {
    role: 'defensive_line',
    count: 5,
    starters: 4,
    capabilityKeys: ['pass_rush', 'run_stopping', 'strength', 'burst'],
    responsibilities: [
      {
        schemeKey: D,
        responsibilityKey: 'gap_responsibility',
        transferFamilyKey: 'front_play',
      },
    ],
  },
  {
    role: 'linebacker',
    count: 4,
    starters: 3,
    capabilityKeys: [
      'tackling',
      'processing',
      'run_stopping',
      'coverage_instincts',
      'burst',
    ],
    responsibilities: [
      {
        schemeKey: D,
        responsibilityKey: 'run_fits',
        transferFamilyKey: 'front_play',
      },
      {
        schemeKey: D,
        responsibilityKey: 'coverage_drops',
        transferFamilyKey: 'coverage',
      },
    ],
  },
  {
    role: 'cornerback',
    count: 3,
    starters: 3,
    capabilityKeys: [
      'coverage_instincts',
      'burst',
      'agility',
      'anticipation',
      'tackling',
    ],
    responsibilities: [
      {
        schemeKey: D,
        responsibilityKey: 'coverage_rules',
        transferFamilyKey: 'coverage',
      },
    ],
  },
  {
    role: 'safety',
    count: 3,
    starters: 2,
    capabilityKeys: [
      'coverage_instincts',
      'tackling',
      'processing',
      'anticipation',
    ],
    responsibilities: [
      {
        schemeKey: D,
        responsibilityKey: 'coverage_rules',
        transferFamilyKey: 'coverage',
      },
      {
        schemeKey: D,
        responsibilityKey: 'run_fits',
        transferFamilyKey: 'front_play',
      },
    ],
  },
  {
    role: 'kicker',
    count: 1,
    starters: 1,
    capabilityKeys: ['accuracy', 'arm_power'],
    responsibilities: [
      {
        schemeKey: ST,
        responsibilityKey: 'kick_mechanics',
        transferFamilyKey: 'kicking',
      },
    ],
  },
  {
    role: 'punter',
    count: 1,
    starters: 1,
    capabilityKeys: ['accuracy', 'arm_power'],
    responsibilities: [
      {
        schemeKey: ST,
        responsibilityKey: 'kick_mechanics',
        transferFamilyKey: 'kicking',
      },
    ],
  },
];

type Club = {
  readonly organizationId: string;
  readonly idPrefix: string;
  readonly nameSalt: number;
};

const CLUBS: readonly Club[] = [
  { organizationId: 'org-northfield', idPrefix: 'player-nf-e', nameSalt: 3 },
  { organizationId: 'org-southport', idPrefix: 'player-sp-e', nameSalt: 11 },
];

/** Invented, deliberately generic synthetic name parts (every full name is labelled). */
const FIRST_NAMES = [
  'Arlo',
  'Beck',
  'Cade',
  'Dax',
  'Emmett',
  'Finn',
  'Gideon',
  'Hollis',
  'Idris',
  'Jory',
  'Knox',
  'Lennox',
  'Mace',
  'Nolan',
  'Orrin',
  'Pax',
  'Quill',
  'Rafe',
  'Soren',
  'Tobin',
  'Ulric',
  'Vance',
  'Wynn',
  'Xander',
  'Yosef',
  'Zeke',
] as const;
const LAST_NAMES = [
  'Ashdown',
  'Brightwater',
  'Carrow',
  'Dunmore',
  'Eastwick',
  'Fairlight',
  'Grayson',
  'Hartwell',
  'Ironside',
  'Jessup',
  'Kestrel',
  'Larkin',
  'Marsh',
  'Northcott',
  'Oakhurst',
  'Pemberton',
  'Quarry',
  'Redfern',
  'Stanhope',
  'Thornby',
  'Underhill',
  'Valmont',
  'Whitlock',
  'Yarrow',
  'Zephyr',
] as const;

/** Deterministic spread in `[lo, hi]` from two small integers (synthetic variety only). */
const spread = (a: number, b: number, lo: number, hi: number): number =>
  lo + ((a * 977 + b * 613 + 331) % (hi - lo + 1));

const pad2 = (n: number): string => String(n).padStart(2, '0');

const birthDate = (n: number): string => {
  const year = 1995 + (n % 9);
  const month = 1 + ((n * 5) % 12);
  const day = 1 + ((n * 7) % 28);
  return `${year}-${pad2(month)}-${pad2(day)}`;
};

type Built = {
  readonly entity: SeedEntity;
  readonly player: SeedPlayer;
  readonly right: SeedRight;
  readonly membership: SeedMembership;
  readonly contract: SeedContract;
  readonly profile: SeedPlayerDevelopmentProfile;
  readonly readiness: SeedReadiness;
  readonly roleKnowledge: readonly SeedRoleKnowledge[];
};

const buildPlayers = (): Built[] => {
  const built: Built[] = [];
  CLUBS.forEach((club) => {
    let index = 0;
    ROLE_TEMPLATES.forEach((template) => {
      for (let n = 0; n < template.count; n++) {
        index += 1;
        const seq = index + club.nameSalt * 100;
        const personId = `${club.idPrefix}${pad2(index)}`;
        const contractId = `contract-seed-${personId}`;
        const starter = n < template.starters;
        built.push({
          entity: {
            id: personId,
            kind: 'person',
            name: `${FIRST_NAMES[(seq * 5 + club.nameSalt) % FIRST_NAMES.length]} ${
              LAST_NAMES[(seq * 7 + 3) % LAST_NAMES.length]
            } (synthetic)`,
          },
          player: {
            personId,
            birthDate: birthDate(seq),
            primaryRole: template.role,
            roleTags: [
              starter ? 'starter_profile' : 'rotational',
              ...(template.role === 'kicker' || template.role === 'punter'
                ? ['special_teams']
                : []),
            ],
            capabilities: template.capabilityKeys.map((key, k) => ({
              key,
              valueBp: spread(seq, k, 3500, 9000),
            })),
          },
          right: {
            id: `right-${personId}`,
            playerId: personId,
            holderOrganizationId: club.organizationId,
            kind: 'contract',
            sourceRecordId: contractId,
            effectiveFrom: '2027-01-15',
            effectiveUntil: null,
          },
          membership: {
            id: `mem-${personId}`,
            playerId: personId,
            organizationId: club.organizationId,
            status: 'active',
            effectiveFrom: '2027-01-15',
            effectiveUntil: null,
            sourceRecordId: contractId,
          },
          contract: {
            id: contractId,
            playerId: personId,
            organizationId: club.organizationId,
            signedAt: '2027-01-15',
            startSeason: 2027,
            signingBonus: 20_000,
            years: [
              {
                season: 2027,
                baseSalary: 60_000,
                rosterBonus: 0,
                guaranteedBase: 30_000,
              },
              {
                season: 2028,
                baseSalary: 65_000,
                rosterBonus: 0,
                guaranteedBase: 0,
              },
            ],
          },
          profile: {
            personId,
            capabilityResponses: template.capabilityKeys.map((key, k) => ({
              capabilityKey: key,
              malleabilityBp: spread(seq, k, 2500, 8000),
            })),
            processingBp: spread(seq, 11, 3000, 8500),
            adaptabilityBp: spread(seq, 13, 3000, 8500),
            recoveryBp: spread(seq, 17, 3000, 8500),
            durabilityBp: spread(seq, 19, 3000, 8500),
          },
          readiness: {
            playerId: personId,
            conditioningBp: spread(seq, 23, 5500, 9000),
            acuteFatigueBp: spread(seq, 29, 0, 1500),
            accumulatedLoadUnits: spread(seq, 31, 0, 40),
          },
          roleKnowledge: template.responsibilities.map((r, k) => ({
            playerId: personId,
            schemeKey: r.schemeKey,
            responsibilityKey: r.responsibilityKey,
            transferFamilyKey: r.transferFamilyKey,
            familiarityBp: spread(seq, 37 + k, 3500, 8000),
          })),
        });
      }
    });
  });
  return built;
};

const body = (): WorldSeedBody => {
  const { contentHash: _contentHash, ...d } = PACKAGE_D_SEED;
  void _contentHash;
  const built = buildPlayers();
  const c = d.packageCSubstrate!;
  const dd = d.packageDSubstrate!;
  const packageC: PackageCSubstrateSeed = {
    ...c,
    players: [...c.players, ...built.map((b) => b.player)],
    rights: [...c.rights, ...built.map((b) => b.right)],
    memberships: [...c.memberships, ...built.map((b) => b.membership)],
    contracts: [...c.contracts, ...built.map((b) => b.contract)],
  };
  const packageD: PackageDSubstrateSeed = {
    ...dd,
    playerProfiles: [...dd.playerProfiles, ...built.map((b) => b.profile)],
    roleKnowledge: [
      ...dd.roleKnowledge,
      ...built.flatMap((b) => b.roleKnowledge),
    ],
    readiness: [...dd.readiness, ...built.map((b) => b.readiness)],
  };
  return {
    ...d,
    seedId: 'synthetic-package-e-world',
    ruleset: rulesetRefOf(SYNTHETIC_PACKAGE_E_RULESET),
    provenance: [provenance],
    initialEntities: [...d.initialEntities, ...built.map((b) => b.entity)],
    packageCSubstrate: packageC,
    packageDSubstrate: packageD,
    packageESubstrate: {
      fixtures: [
        {
          id: 'fixture-2027-w01-southport-at-northfield',
          fixtureDate: '2027-09-12',
          homeOrganizationId: 'org-northfield',
          awayOrganizationId: 'org-southport',
          rulesProfileKey: 'synthetic_football_v1',
        },
        {
          id: 'fixture-2027-w02-northfield-at-southport',
          fixtureDate: '2027-09-19',
          homeOrganizationId: 'org-southport',
          awayOrganizationId: 'org-northfield',
          rulesProfileKey: 'synthetic_football_v1',
        },
      ],
    },
  };
};

export const PACKAGE_E_SEED = sealSeed(body());
export const PACKAGE_E_SEED_JSON: unknown = JSON.parse(
  JSON.stringify(PACKAGE_E_SEED),
);
