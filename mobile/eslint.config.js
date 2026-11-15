// Lint baseline: errors are bug classes and fail CI; legacy looseness is
// warnings to burn down over time.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'android/*', 'ios/*', 'node_modules/*', 'vendor/*', '.expo/*'] },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      'react/no-unescaped-entities': 'off',
    },
  },
]);
