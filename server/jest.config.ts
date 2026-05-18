import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/utils/seed.ts',
    '!src/scripts/**',
  ],
  coverageThreshold: {
    global: { branches: 50, functions: 50, lines: 50, statements: 50 },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 30000,
  // Transform ESM-only packages that Jest can't require() directly
  transformIgnorePatterns: ['node_modules/(?!(ed25519-hd-key)/)'],
  // Integration tests require a live DB — run separately in CI
  testPathIgnorePatterns: ['/node_modules/', '/dist/', 'integration\\.'],
};

export default config;
