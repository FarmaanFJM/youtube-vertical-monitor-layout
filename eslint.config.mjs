import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'dist/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  {
    files: ['src/content/**/*.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser, module: 'readonly' } },
  },
  {
    files: ['**/*.mjs', 'scripts/**'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
  },
];
