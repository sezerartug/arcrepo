import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the `@/*` alias from tsconfig.json.
  resolve: { tsconfigPaths: true },
});
