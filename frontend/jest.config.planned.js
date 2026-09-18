const base = require('./jest.config');

// Archived feature, UX, and policy proposals only. Nonzero means the proposal is not met,
// not an approved requirement failed. Do not add this to a release gate.
module.exports = {
  ...base,
  testMatch: ['<rootDir>/__tests__/planned/**/*.(spec|test).[jt]s?(x)'],
  testPathIgnorePatterns: [],
  collectCoverage: false,
  coverageThreshold: undefined,
};
