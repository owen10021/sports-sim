/**
 * Regenerates the synthetic Package A fixture JSON from the production module.
 * Run: npx tsx scripts/generate-fixtures.ts
 *
 * Fixtures are SYNTHETIC ONLY. Changing any value changes the content hashes, so the
 * golden scenario must be regenerated and re-reviewed too.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SYNTHETIC_RULESET, SYNTHETIC_SEED } from '../packages/sim-core/src/index';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const write = (relative: string, value: unknown): void => {
  const target = join(root, relative);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(`wrote ${relative}`);
};

write('fixtures/rulesets/synthetic-minimal-v1.json', SYNTHETIC_RULESET);
write('fixtures/seeds/synthetic-empty-v1.json', SYNTHETIC_SEED);