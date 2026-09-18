const base = require('./jest.config');

/** Correct acceptance assertions for unresolved product defects.
 * This command deliberately returns non-zero while defects reproduce.
 * Never convert these to test.failing: an unrelated exception must not pass QA.
 */
module.exports = {
  ...base,
  testMatch: ['<rootDir>/__tests__/defects/**/*.(spec|test).[jt]s?(x)'],
  testPathIgnorePatterns: [],
  collectCoverage: false,
  coverageThreshold: undefined,
};
