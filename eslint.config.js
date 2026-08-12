import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'coverage', 'playwright-report', 'test-results', 'node_modules', 'spikes'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    // build-time tooling runs under Node
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { URL: 'readonly', console: 'readonly', process: 'readonly' } },
  },
);
