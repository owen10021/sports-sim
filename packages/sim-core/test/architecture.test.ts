import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcDir = join(__dirname, '..', 'src');
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory()
      ? sourceFiles(full)
      : full.endsWith('.ts')
        ? [full]
        : [];
  });

/** Source with comments and string-literal contents removed, so prose cannot trip the scan. */
const code = (file: string): string =>
  readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const importSpecifiers = (file: string): string[] => {
  const text = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const found: string[] = [];
  const re =
    /(?:import|export)\s[^'";]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of text.matchAll(re))
    found.push((m[1] ?? m[2] ?? m[3] ?? m[4]) as string);
  return found;
};

describe('sim-core architecture boundary (Package A acceptance #8)', () => {
  const files = sourceFiles(srcDir);

  it('scans a meaningful number of source files', () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it('imports only relative modules and @noble/hashes (no React, React Native, Expo, Node, fs, SQLite or network)', () => {
    const bad: string[] = [];
    for (const file of files) {
      for (const spec of importSpecifiers(file)) {
        const allowed =
          spec.startsWith('./') ||
          spec.startsWith('../') ||
          spec.startsWith('@noble/hashes');
        if (!allowed)
          bad.push(`${file.slice(srcDir.length + 1)} imports "${spec}"`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('declares no runtime dependency other than @noble/hashes', () => {
    expect(Object.keys(packageJson.dependencies ?? {})).toEqual([
      '@noble/hashes',
    ]);
  });

  it('never reads wall-clock time, nondeterministic randomness, the environment or the network', () => {
    const forbidden = [
      /Math\.random/,
      /Date\.now/,
      /new Date\(/,
      /\bDate\(/,
      /performance\.now/,
      /\bprocess\./,
      /\bfetch\(/,
      /XMLHttpRequest/,
      /\bsetTimeout\(/,
      /\bsetInterval\(/,
      /crypto\.getRandomValues/,
      /crypto\.randomUUID/,
      /globalThis/,
    ];
    const hits: string[] = [];
    for (const file of files) {
      const text = code(file);
      for (const re of forbidden)
        if (re.test(text))
          hits.push(`${file.slice(srcDir.length + 1)} uses ${re}`);
    }
    expect(hits).toEqual([]);
  });

  it('uses no floating-point authoritative math helpers in the kernel and RNG', () => {
    for (const name of ['kernel.ts', 'rng.ts']) {
      expect(code(join(srcDir, name))).not.toMatch(
        /Math\.(sin|cos|tan|sqrt|pow|exp|log|random)\b/,
      );
    }
  });
});
