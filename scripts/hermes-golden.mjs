// Package A-E Hermes cross-runtime gate.
//
// Clean installs always compile the exact scenario bundle with the platform hermesc shipped
// by `hermes-compiler`. HERMES_CLI / an explicit positional path selects the execution VM;
// on Windows, absent an override, a pinned official standalone Hermes release is fetched and
// SHA-256 verified. The current compiler and the execution VM are intentionally separate:
// hermesc validates current RN bytecode compilation while the VM executes source for identity.
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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

const SCENARIOS = {
  'package-a': { entry: 'entry.ts', name: 'golden' },
  'package-b': { entry: 'entryPackageB.ts', name: 'package-b-golden' },
  'package-c': { entry: 'entryPackageC.ts', name: 'package-c-golden' },
  'package-d': {
    entry: 'entryPackageD.ts',
    name: 'package-d-golden',
    lowerClasses: true,
  },
  'package-e': {
    entry: 'entryPackageE.ts',
    name: 'package-e-golden',
    lowerClasses: true,
  },
};
const chosen = SCENARIOS[scenario];
if (!chosen) {
  console.error(
    'usage: node scripts/hermes-golden.mjs [path-to-hermes-runtime] [--scenario package-a|package-b|package-c|package-d|package-e] (or set HERMES_CLI)',
  );
  process.exit(2);
}

const discoverHermesc = () => {
  const platform = {
    win32: ['win64-bin', 'hermesc.exe'],
    linux: ['linux64-bin', 'hermesc'],
    darwin: ['osx-bin', 'hermesc'],
  }[process.platform];
  if (platform === undefined)
    throw new Error(
      `unsupported platform for bundled hermesc: ${process.platform}`,
    );
  const path = join(
    root,
    'node_modules',
    'hermes-compiler',
    'hermesc',
    platform[0],
    platform[1],
  );
  if (!existsSync(path))
    throw new Error(`bundled hermesc not found at ${path}; run npm ci`);
  return path;
};

const WINDOWS_RUNTIME = {
  release: 'v0.13.0',
  url: 'https://github.com/facebook/hermes/releases/download/v0.13.0/hermes-cli-windows.tar.gz',
  archiveSha256:
    '485907ae87f267f7901f45c12979fea9703967ee2fa930bab887d022de9d6478',
  executableSha256:
    'c0962ee3f84f8767a6b24ff70d9ff91e7dc131920b4ae574b31f0b9043f6e685',
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const verifiedFile = (path, expected, what) => {
  if (!existsSync(path)) throw new Error(`${what} does not exist: ${path}`);
  const actual = sha256(readFileSync(path));
  if (actual !== expected)
    throw new Error(
      `${what} SHA-256 mismatch: expected ${expected}, got ${actual}`,
    );
  return path;
};

const bootstrapWindowsRuntime = async () => {
  const dir = join(
    root,
    'evidence',
    'tmp',
    `hermes-cli-${WINDOWS_RUNTIME.release}`,
  );
  const runtime = join(dir, 'hermes.exe');
  if (existsSync(runtime))
    return verifiedFile(
      runtime,
      WINDOWS_RUNTIME.executableSha256,
      'cached Hermes runtime',
    );
  mkdirSync(dir, { recursive: true });
  const archive = join(dir, 'hermes-cli-windows.tar.gz');
  const response = await fetch(WINDOWS_RUNTIME.url);
  if (!response.ok)
    throw new Error(
      `failed to download pinned Hermes runtime: HTTP ${response.status}`,
    );
  const bytes = Buffer.from(await response.arrayBuffer());
  if (sha256(bytes) !== WINDOWS_RUNTIME.archiveSha256) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error('pinned Hermes runtime archive SHA-256 mismatch');
  }
  writeFileSync(archive, bytes);
  const unpack = spawnSync('tar', ['-xzf', archive, '-C', dir], {
    encoding: 'utf8',
  });
  if (unpack.error) throw unpack.error;
  if (unpack.status !== 0)
    throw new Error(
      `failed to extract pinned Hermes runtime: ${unpack.stderr || unpack.stdout}`,
    );
  return verifiedFile(
    runtime,
    WINDOWS_RUNTIME.executableSha256,
    'bootstrapped Hermes runtime',
  );
};

const resolveRuntime = async () => {
  const explicit = process.env.HERMES_CLI ?? positional[0];
  if (explicit !== undefined) {
    if (!existsSync(explicit))
      throw new Error(`explicit Hermes runtime does not exist: ${explicit}`);
    return explicit;
  }
  if (process.platform === 'win32') return bootstrapWindowsRuntime();
  throw new Error(
    `no pinned standalone Hermes runtime bootstrap is configured for ${process.platform}; pass a runtime path or set HERMES_CLI`,
  );
};

const outDir = join(root, 'evidence', 'tmp');
mkdirSync(outDir, { recursive: true });
const sourceFile = join(outDir, `${chosen.name}.hermes.js`);
const bytecodeFile = join(outDir, `${chosen.name}.current.hbc`);

await build({
  entryPoints: [join(root, 'scripts', 'hermes', chosen.entry)],
  outfile: sourceFile,
  bundle: true,
  format: 'iife',
  platform: 'neutral',
  mainFields: ['module', 'main'],
  target: 'es2015',
  logLevel: 'warning',
});

if (chosen.lowerClasses) {
  const transformed = transformSync(readFileSync(sourceFile, 'utf8'), {
    babelrc: false,
    configFile: false,
    plugins: [transformClasses],
    sourceType: 'script',
  });
  if (transformed?.code === undefined)
    throw new Error('Babel failed to lower Hermes class syntax');
  writeFileSync(sourceFile, `${transformed.code}\n`, 'utf8');
}

let compiler;
let runtime;
try {
  compiler = discoverHermesc();
  runtime = await resolveRuntime();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

const compile = spawnSync(
  compiler,
  ['-emit-binary', '-out', bytecodeFile, sourceFile],
  { encoding: 'utf8', cwd: dirname(compiler) },
);
if (compile.error) throw compile.error;
if (compile.stdout) process.stdout.write(compile.stdout);
if (compile.stderr) process.stderr.write(compile.stderr);
if (compile.status !== 0) process.exit(compile.status ?? 1);

const run = spawnSync(runtime, [sourceFile], {
  encoding: 'utf8',
  cwd: dirname(runtime),
});
if (run.error) throw run.error;
process.stdout.write(run.stdout);
if (run.stderr) process.stderr.write(run.stderr);
if (run.status !== 0) process.exit(run.status ?? 1);

const line = run.stdout.trim().split(/\r?\n/).pop();
const parsed = JSON.parse(line);
writeFileSync(join(outDir, `${chosen.name}.hermes.out.json`), `${line}\n`);
process.exit(parsed.match ? 0 : 1);
