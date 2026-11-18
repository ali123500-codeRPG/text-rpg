import { defineConfig } from 'vitest/config';
// testTimeout: CI runners are two to three times slower than a dev machine, and a test whose actors are new sheets works
// out each one's combat level on the fight model (about 0.1-0.3 s apiece here), so whole-turn tests need room past 5 s
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], environment: 'node', setupFiles: ['tests/harness/turnCheckSetup.ts'], testTimeout: 15_000 } });
