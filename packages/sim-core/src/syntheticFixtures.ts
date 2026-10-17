import { SCHEMA_VERSION, type SourceProvenance } from './provenance';
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
