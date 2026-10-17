import { rulesetRefOf } from './ruleset';
import { PACKAGE_C_SEED } from './packageCWorldSeed';
import type { SourceProvenance } from './provenance';
import { sealSeed, type WorldSeedBody } from './seed';
import type {
  PackageDSubstrateSeed,
  SeedPlayerDevelopmentProfile,
  SeedReadiness,
  SeedRoleKnowledge,
} from './packageDSeedParse';
import { SYNTHETIC_PACKAGE_D_RULESET } from './syntheticFixtures';

/**
 * The synthetic Package D world seed: the accepted Package C world plus a private
 * development substrate for every seeded player. Built with the production sealing code so
 * Node, Vitest, Hermes and the Expo app start from byte-identical inputs; the committed JSON
 * in /fixtures/seeds is generated from this module and a test proves they stay identical.
 *
 * SYNTHETIC calibration: the per-player numbers are deterministic test values spread to
 * give variety, not claims about real players. There is no overall rating, ceiling or
 * destiny field anywhere in the substrate.
 */
const provenance: SourceProvenance = {
  sourceId: 'sport-sim-synthetic-package-d-world',
  sourceKind: 'synthetic',
  retrievedAt: '2026-10-17T00:00:00Z',
  effectiveAsOf: '2027-02-15',
  validationStatus: 'synthetic',
  note: 'Synthetic Package D world fixture. Contains no real league data or real people, and is NOT validated NFL development or medical data.',
};

type Responsibility = {
  readonly responsibilityKey: string;
  readonly transferFamilyKey: string;
};

/** Which responsibilities a position group learns (synthetic). */
const RESPONSIBILITIES: Readonly<Record<string, readonly Responsibility[]>> = {
  quarterback: [
    {
      responsibilityKey: 'progression_reads',
      transferFamilyKey: 'qb_processing',
    },
    {
      responsibilityKey: 'protection_calls',
      transferFamilyKey: 'qb_processing',
    },
  ],
  running_back: [
    { responsibilityKey: 'run_reads', transferFamilyKey: 'ball_carrier' },
  ],
  wide_receiver: [
    { responsibilityKey: 'route_tree', transferFamilyKey: 'route_running' },
  ],
  offensive_line: [
    { responsibilityKey: 'protection_scheme', transferFamilyKey: 'blocking' },
  ],
  defensive_line: [
    {
      responsibilityKey: 'gap_responsibility',
      transferFamilyKey: 'front_play',
    },
  ],
  linebacker: [
    { responsibilityKey: 'run_fits', transferFamilyKey: 'front_play' },
    { responsibilityKey: 'coverage_drops', transferFamilyKey: 'coverage' },
  ],
  cornerback: [
    { responsibilityKey: 'coverage_rules', transferFamilyKey: 'coverage' },
  ],
  safety: [
    { responsibilityKey: 'coverage_rules', transferFamilyKey: 'coverage' },
    { responsibilityKey: 'run_fits', transferFamilyKey: 'front_play' },
  ],
};

const OFFENSE = new Set([
  'quarterback',
  'running_back',
  'wide_receiver',
  'offensive_line',
]);

/** Deterministic spread in `[lo, hi]` from two small integers (synthetic variety only). */
const spread = (a: number, b: number, lo: number, hi: number): number =>
  lo + ((a * 977 + b * 613 + 331) % (hi - lo + 1));

const substrate = (): PackageDSubstrateSeed => {
  const players = PACKAGE_C_SEED.packageCSubstrate!.players;
  const playerProfiles: SeedPlayerDevelopmentProfile[] = [];
  const roleKnowledge: SeedRoleKnowledge[] = [];
  const readiness: SeedReadiness[] = [];
  players.forEach((p, i) => {
    playerProfiles.push({
      personId: p.personId,
      capabilityResponses: p.capabilities.map((c, k) => ({
        capabilityKey: c.key,
        malleabilityBp: spread(i, k, 2500, 8000),
      })),
      processingBp: spread(i, 11, 3000, 8500),
      adaptabilityBp: spread(i, 13, 3000, 8500),
      recoveryBp: spread(i, 17, 3000, 8500),
      durabilityBp: spread(i, 19, 3000, 8500),
    });
    readiness.push({
      playerId: p.personId,
      conditioningBp: spread(i, 23, 5500, 9000),
      acuteFatigueBp: spread(i, 29, 0, 1500),
      accumulatedLoadUnits: spread(i, 31, 0, 40),
    });
    (RESPONSIBILITIES[p.primaryRole] ?? []).forEach((r, k) =>
      roleKnowledge.push({
        playerId: p.personId,
        schemeKey: OFFENSE.has(p.primaryRole) ? 'base_offense' : 'base_defense',
        responsibilityKey: r.responsibilityKey,
        transferFamilyKey: r.transferFamilyKey,
        familiarityBp: spread(i, 37 + k, 3500, 8000),
      }),
    );
  });
  return { playerProfiles, teachingProfiles: [], roleKnowledge, readiness };
};

const body = (): WorldSeedBody => {
  const { contentHash: _contentHash, ...c } = PACKAGE_C_SEED;
  void _contentHash;
  return {
    ...c,
    seedId: 'synthetic-package-d-world',
    ruleset: rulesetRefOf(SYNTHETIC_PACKAGE_D_RULESET),
    provenance: [provenance],
    packageDSubstrate: substrate(),
  };
};

export const PACKAGE_D_SEED = sealSeed(body());
export const PACKAGE_D_SEED_JSON: unknown = JSON.parse(
  JSON.stringify(PACKAGE_D_SEED),
);
