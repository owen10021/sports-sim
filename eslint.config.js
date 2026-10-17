import Module from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The project typechecks with TypeScript 7 (native compiler), which exposes no JavaScript API.
// typescript-eslint still needs the JS API, and eslint-config-expo ships a private TypeScript 6
// next to it. Route `typescript` requests made from lint tooling to that copy so the lint
// toolchain never loads TS 7. This affects ESLint only; tsc, Metro and Vitest are untouched.
const root = path.dirname(fileURLToPath(import.meta.url));
const lintTypescript = path.join(
  root,
  'node_modules',
  'eslint-config-expo',
  'node_modules',
  'typescript',
);
const lintToolRoots = [
  '@typescript-eslint',
  'ts-api-utils',
  'eslint-config-expo',
  'eslint-import-resolver-typescript',
  'eslint-module-utils',
  'eslint-plugin-import',
].map((name) => path.join(root, 'node_modules', name) + path.sep);
const nestedParser = path.join(
  root,
  'node_modules',
  'eslint-config-expo',
  'node_modules',
  '@typescript-eslint',
  'parser',
  'dist',
  'index.js',
);
let nestedParserFailed = false;
const original = Module._resolveFilename;
Module._resolveFilename = function resolve(request, parent, ...rest) {
  if (
    request === 'typescript' &&
    parent?.filename &&
    lintToolRoots.some((tool) => parent.filename.startsWith(tool))
  ) {
    return original.call(this, lintTypescript, parent, ...rest);
  }
  // eslint-plugin-import (hoisted to the root) asks for the TypeScript parser by name, but the
  // parser's TS<6.1 peer range keeps it nested under eslint-config-expo.
  if (request === '@typescript-eslint/parser' && !nestedParserFailed) {
    try {
      return original.call(this, request, parent, ...rest);
    } catch {
      nestedParserFailed = true;
    }
  }
  if (request === '@typescript-eslint/parser') {
    return original.call(this, nestedParser, parent, ...rest);
  }
  return original.call(this, request, parent, ...rest);
};

const { defineConfig, globalIgnores } = await import('eslint/config');
const { default: expoConfig } = await import('eslint-config-expo/flat.js');
const { default: prettierConfig } = await import('eslint-config-prettier/flat');

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/.expo/**',
    'evidence/**',
    'fixtures/**',
    'packages/sim-core/src/goldenExpected.ts',
  ]),
  expoConfig,
  prettierConfig,
]);
