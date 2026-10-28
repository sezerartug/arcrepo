import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC emits decorator metadata, which Nest dependency injection needs.
export default defineConfig({
  plugins: [swc.vite()],
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.int.test.ts'],
    // Nest loads the HTTP adapter lazily inside the test; a cold module load exceeds 5s on Windows.
    testTimeout: 30_000,
  },
});
