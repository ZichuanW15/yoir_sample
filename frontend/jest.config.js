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
    '<rootDir>/src/payments/**/*.{ts,tsx}',
    '<rootDir>/src/format.ts',
    '<rootDir>/src/navigation.ts',
    '!<rootDir>/**/*.d.ts',
    // The two PaymentSheet files are the seams onto Stripe's own SDKs — the native
    // one on a device, Stripe.js Elements in a browser — and which of them loads is
    // decided by Metro's platform resolution, not by anything a test can set. Both
    // are exercised by running the app, not here, and counting them would only make
    // the number below say less than it does.
    '!<rootDir>/src/payments/sheet.tsx',
    '!<rootDir>/src/payments/sheet.web.tsx',
    // The onboarding launchers are the same kind of seam: one drives the system
    // browser through expo-web-browser, the other navigates the page. Which loads is
    // Metro's decision, and neither has anything to assert that running the app does
    // not assert better.
    '!<rootDir>/src/payments/onboarding.ts',
    '!<rootDir>/src/payments/onboarding.web.ts',
    // Same reasoning for the native session store: it is a thin wrapper over the
    // platform keychain, which has no implementation in this runtime. Its browser
    // counterpart is real JavaScript and is tested.
    '!<rootDir>/src/auth/sessionStore.ts',
    // Interfaces and re-exports only. They compile to nothing, so counting them
    // measures the size of the type layer rather than how well anything is tested.
    '!<rootDir>/src/api/types.ts',
    '!<rootDir>/src/payments/types.ts',
    '!<rootDir>/src/payments/index.ts',
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
