import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
    passWithNoTests: false,
    // This suite has several replay/golden files that are CPU/memory heavy. Keep file
    // execution serial so low-memory developer and CI machines do not starve tests.
    maxWorkers: 1,
  },
});
