/**
 * Regenerates the synthetic Package A fixtures using the production sealing code.
 * Run: npx tsx scripts/generate-fixtures.ts
 *
 * Fixtures are SYNTHETIC ONLY. Changing any value changes the content hashes, so the
 * golden scenario (packages/headless/golden) must be regenerated and re-reviewed too.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SCHEMA_VERSION,
  rulesetRefOf,
  sealRuleset,
  sealSeed,
  type SourceProvenance,
} from '../packages/sim-core/src/index';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const provenance: SourceProvenance = {
  sourceId: 'sport-sim-synthetic-package-a',
  sourceKind: 'synthetic',
  retrievedAt: '2026-10-16T00:00:00Z',
  effectiveAsOf: '2026-10-16',
  validationStatus: 'synthetic',
  note: 'Synthetic Package A fixture. Contains no real league data.',
};

const ruleset = sealRuleset({
  schemaVersion: SCHEMA_VERSION,
  rulesetId: 'synthetic-minimal',
  rulesetVersion: 1,
  displayName: 'Synthetic Minimal Ruleset (Package A)',
  provenance: [provenance],
  rules: { maxAdvanceDaysPerCommand: 30 },
});

const seed = sealSeed({
  schemaVersion: SCHEMA_VERSION,
  seedId: 'synthetic-empty',
  seedVersion: 1,
  ruleset: rulesetRefOf(ruleset),
  rngSeed32: 20261016,
  startDate: '2026-10-16',
  provenance: [provenance],
  initialEntities: [],
});

const write = (relative: string, value: unknown): void => {
  const target = join(root, relative);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(`wrote ${relative}`);
};

write('fixtures/rulesets/synthetic-minimal-v1.json', ruleset);
write('fixtures/seeds/synthetic-empty-v1.json', seed);
