/**
 * Runs before the jest-expo setup files, while `globalThis.fetch` is still the one
 * Node supplies. Expo SDK 57 replaces that global with `expo/fetch`, whose native
 * module jest-expo stubs, so this is the last point at which a fetch that can reach
 * a real server is reachable. jest.live-fetch-restore.js puts it back afterwards.
 */
globalThis.__nodeFetch = globalThis.fetch;
