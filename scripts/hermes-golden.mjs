// Bundle a golden-scenario entry for Hermes and run it in the standalone Hermes CLI.
// Usage: node scripts/hermes-golden.mjs <path-to-hermes.exe> [--scenario package-d]
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from '@babel/core';
import transformClasses from '@babel/plugin-transform-classes';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const scenarioIndex = args.indexOf('--scenario');
const scenario = scenarioIndex >= 0 ? args[scenarioIndex + 1] : 'package-a';
const positional = args.filter(
  (arg, index) => arg !== '--scenario' && args[index - 1] !== '--scenario',
);
const hermes = process.env.HERMES_CLI ?? positional[0];
const SCENARIOS = {
  'package-a': { entry: 'entry.ts', name: 'golden' },
  'package-b': { entry: 'entryPackageB.ts', name: 'package-b-golden' },
  'package-c': { entry: 'entryPackageC.ts', name: 'package-c-golden' },
  // The latest prebuilt standalone Hermes CLI (v0.13.0) rejects class expressions.
  // Lower classes only for D's standalone proof; this is a syntax transform, not a logic shim.
  'package-d': {
    entry: 'entryPackageD.ts',
    name: 'package-d-golden',
    lowerClasses: true,
  },
};
const chosen = SCENARIOS[scenario];
if (!hermes || !chosen) {
  console.error(
    'usage: node scripts/hermes-golden.mjs <path-to-hermes> [--scenario package-a|package-b|package-c|package-d] (or set HERMES_CLI)',
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

if (chosen.lowerClasses) {
  const transformed = transformSync(readFileSync(outfile, 'utf8'), {
    babelrc: false,
    configFile: false,
    plugins: [transformClasses],
    sourceType: 'script',
  });
  if (transformed?.code === undefined)
    throw new Error('Babel failed to lower Hermes class syntax');
  writeFileSync(outfile, `${transformed.code}\n`, 'utf8');
}

const run = spawnSync(hermes, [outfile], { encoding: 'utf8' });
if (run.error) throw run.error;
process.stdout.write(run.stdout);
if (run.stderr) process.stderr.write(run.stderr);
if (run.status !== 0) process.exit(run.status ?? 1);

const line = run.stdout.trim().split(/\r?\n/).pop();
const parsed = JSON.parse(line);
writeFileSync(join(outDir, `${chosen.name}.hermes.out.json`), `${line}\n`);
process.exit(parsed.match ? 0 : 1);
