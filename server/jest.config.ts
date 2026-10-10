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
  // ESM-only packages (ed25519-hd-key and its @noble deps) are compiled to
  // CommonJS by ts-jest so test files that import custody code can load.
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.m?js$': ['ts-jest', { tsconfig: { allowJs: true } }],
  },
  transformIgnorePatterns: ['node_modules/(?!(ed25519-hd-key|@noble)/)'],
  // DB-backed suites (integration.*, concurrency, balance mutations) skip
  // themselves unless CI=true or RUN_DB_TESTS=1, so they live in the default run.
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};

export default config;
