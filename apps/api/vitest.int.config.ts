import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Integration tests run against a real PostgreSQL started once per run (src/test/global-setup.ts).
export default defineConfig({
  plugins: [swc.vite()],
  test: {
    include: ['src/**/*.int.test.ts'],
    globalSetup: ['src/test/global-setup.ts'],
    testTimeout: 30_000,
    // First run on Windows unpacks and scans the PostgreSQL binaries.
    hookTimeout: 180_000,
  },
});
