import { defineConfig } from 'vitest/config';
// testTimeout: CI runners are two to three times slower than a dev machine, so whole-turn tests need room past 5 s
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], environment: 'node', setupFiles: ['tests/harness/turnCheckSetup.ts'], testTimeout: 15_000 } });
