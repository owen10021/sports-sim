// Bundle the golden-scenario entry for Hermes and run it in the standalone Hermes CLI.
// Usage: node scripts/hermes-golden.mjs <path-to-hermes.exe> [--scenario package-b]
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hermes = process.argv[2];
const scenarioIndex = process.argv.indexOf('--scenario');
const scenario =
  scenarioIndex > 0 ? process.argv[scenarioIndex + 1] : 'package-a';
const SCENARIOS = {
  'package-a': { entry: 'entry.ts', name: 'golden' },
  'package-b': { entry: 'entryPackageB.ts', name: 'package-b-golden' },
};
const chosen = SCENARIOS[scenario];
if (!hermes || !chosen) {
  console.error(
    'usage: node scripts/hermes-golden.mjs <path-to-hermes> [--scenario package-a|package-b]',
  );
  process.exit(2);
}
const outDir = join(root, 'evidence', 'tmp');
mkdirSync(outDir, { recursive: true });
const outfile = join(outDir, `${chosen.name}.hermes.js`);

await build({
  entryPoints: [join(root, 'scripts', 'hermes', chosen.entry)],
  outfile,
  bundle: true,
  format: 'iife',
  platform: 'neutral',
  mainFields: ['module', 'main'],
  // Hermes has no class private fields / modern syntax guarantees: lower to ES2015.
  target: 'es2015',
  logLevel: 'warning',
});

const run = spawnSync(hermes, [outfile], { encoding: 'utf8' });
if (run.error) throw run.error;
process.stdout.write(run.stdout);
if (run.stderr) process.stderr.write(run.stderr);
if (run.status !== 0) process.exit(run.status ?? 1);

const line = run.stdout.trim().split(/\r?\n/).pop();
const parsed = JSON.parse(line);
writeFileSync(join(outDir, `${chosen.name}.hermes.out.json`), `${line}\n`);
process.exit(parsed.match ? 0 : 1);
