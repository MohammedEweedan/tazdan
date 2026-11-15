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
  // A floor at the measured level (15 Nov 2026: statements 53.7%, branches
  // 43.1%, functions 49.3%, lines 56.6%), enforced in CI. Raise it as tests
  // are added; never lower it to get a change through.
  coverageThreshold: {
    global: { statements: 53, branches: 42, functions: 48, lines: 56 },
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
