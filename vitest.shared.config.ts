import { defineConfig } from 'vitest/config';
// npm test, part 1: every test file in one shared module load per worker (no per-file isolation), which cuts the
// suite's import time to a fraction. Files that replace modules with vi.mock need a fresh load, so they run in part 2
// (vitest.mocked.config.ts). tests/unit/mocked-files-isolated.test.ts keeps this list complete. vitest.config.ts is
// the fully isolated run: single files, and the nightly check that no test passes only on another file's leftovers.
export const MOCKED = [
  'tests/unit/engine.test.ts',
  'tests/unit/minds-explore.test.ts',
  'tests/unit/pipeline.test.ts',
  'tests/unit/scenario.test.ts',
  'tests/unit/turn-check.test.ts',
  'tests/unit/views.test.ts',
];
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', ...MOCKED],
    environment: 'node',
    setupFiles: ['tests/harness/turnCheckSetup.ts'],
    testTimeout: 15_000,
    isolate: false,
  },
});
