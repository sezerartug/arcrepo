import js from '@eslint/js';
import arc from '@arc/config/eslint-plugin';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier/flat';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/dist/', '**/.next/', '**/coverage/', '**/next-env.d.ts']),
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    // Type-aware rules (no-floating-promises etc.) guard transaction and bidding code.
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Nest modules are empty decorated classes by design.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [nextPlugin.configs['core-web-vitals'], reactHooks.configs.flat.recommended],
    settings: { next: { rootDir: 'apps/web/' } },
  },
  {
    plugins: { arc },
    rules: { 'arc/no-cross-module-import': 'error' },
  },
  prettier,
]);
