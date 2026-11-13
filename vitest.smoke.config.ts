import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/smoke/**/*.smoke.ts'], environment: 'node', testTimeout: 60_000, fileParallelism: false } });
