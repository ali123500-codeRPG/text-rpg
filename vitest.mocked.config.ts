import { defineConfig } from 'vitest/config';
import { MOCKED } from './vitest.shared.config';
// npm test, part 2: the files that use vi.mock, each with its own fresh module load (see vitest.shared.config.ts)
export default defineConfig({
  test: { include: MOCKED, environment: 'node', setupFiles: ['tests/harness/turnCheckSetup.ts'], testTimeout: 15_000 },
});
