const expoPreset = require('jest-expo/jest-preset');

/**
 * Configuration for the opt-in live TypeScript client test.
 *
 * It is the jest-expo preset with one change: the global `fetch` the test runs on.
 * Expo SDK 57 installs `expo/fetch` as `globalThis.fetch`, and jest-expo stubs the
 * native module behind it, so under the plain preset every request resolves to an
 * empty response and no live journey can pass. Capturing Node's fetch before the
 * preset loads and restoring it afterwards gives `src/api/client` a transport that
 * reaches the backend, while everything else — transforms, module resolution — stays
 * exactly as the rest of the suite sees it.
 */
module.exports = {
  ...expoPreset,
  setupFiles: [
    '<rootDir>/jest.live-fetch-capture.js',
    ...expoPreset.setupFiles,
    '<rootDir>/jest.live-fetch-restore.js',
  ],
  moduleNameMapper: {
    ...(expoPreset.moduleNameMapper ?? {}),
    // SDK 57 nests expo-modules-core under expo/; jest-expo resolves it bare and by subpath.
    '^expo-modules-core$': '<rootDir>/node_modules/expo/node_modules/expo-modules-core',
    '^expo-modules-core/(.*)$': '<rootDir>/node_modules/expo/node_modules/expo-modules-core/$1',
  },
  clearMocks: true,
  restoreMocks: true,
  testMatch: ['<rootDir>/__tests__/integration/live-client.test.ts'],
};
