/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  clearMocks: true,
  restoreMocks: true,
  testMatch: ['<rootDir>/__tests__/**/*.(spec|test).[jt]s?(x)'],
  collectCoverageFrom: [
    '<rootDir>/app/**/*.{ts,tsx}',
    '<rootDir>/src/**/*.{ts,tsx}',
    '!<rootDir>/**/*.d.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'json-summary', 'lcov'],
};
