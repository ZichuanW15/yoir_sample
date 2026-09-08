/**
 * Runs after the jest-expo setup files have installed `expo/fetch` as the global
 * `fetch`. Under jest-expo that implementation is backed by a stubbed native module
 * and resolves every request to an empty response with no status, which the API
 * client can only report as `NETWORK_RESPONSE_ERROR`. The live test talks to a real
 * backend, so it gets Node's fetch back — the same one it ran on before SDK 57.
 */
const nodeFetch = globalThis.__nodeFetch;

if (typeof nodeFetch !== 'function') {
  throw new Error('jest.live-fetch-capture.js did not capture a usable global fetch.');
}

Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  enumerable: true,
  writable: true,
  value: nodeFetch,
});

delete globalThis.__nodeFetch;
