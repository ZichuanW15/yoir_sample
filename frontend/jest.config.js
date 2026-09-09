/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // SDK 57 nests expo-modules-core under expo/; jest-expo resolves it bare and by subpath.
  moduleNameMapper: {
    '^expo-modules-core$': '<rootDir>/node_modules/expo/node_modules/expo-modules-core',
    '^expo-modules-core/(.*)$': '<rootDir>/node_modules/expo/node_modules/expo-modules-core/$1',
  },
  clearMocks: true,
  restoreMocks: true,
  testMatch: ['<rootDir>/__tests__/**/*.(spec|test).[jt]s?(x)'],
  // The live client test needs Node's real `fetch`, which this preset replaces
  // with a stubbed `expo/fetch`. It runs under jest.config.live.js instead.
  testPathIgnorePatterns: ['<rootDir>/__tests__/integration/live-client.test.ts'],
  // The screen suites were retired with the old design; the redesigned screens are
  // not under test yet. Coverage is scoped to the modules that still have suites so
  // the number means something instead of averaging in untested UI.
  collectCoverageFrom: [
    '<rootDir>/src/api/**/*.{ts,tsx}',
    '<rootDir>/src/marketplace/**/*.{ts,tsx}',
    '<rootDir>/src/auth/**/*.{ts,tsx}',
    '<rootDir>/src/format.ts',
    '!<rootDir>/**/*.d.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'json-summary', 'lcov'],
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 80,
      functions: 90,
      lines: 90,
    },
  },
};
