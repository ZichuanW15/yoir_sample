/** Real API client + real local fallback; only fetch and elapsed time are mocked.
 * These checks apply to the shared client, not live HTTP or device networking.
 */
export type ClientModule = typeof import('@/src/api/client');

export const apiBase = 'https://api.example.test/api/v1';
export const accessToken = 'qa-real-client-token';

export function httpResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

export function useRealClientBoundary() {
  const originalFetch = global.fetch;
  const originalDemo = process.env.EXPO_PUBLIC_USE_DEMO_API;
  const originalUrl = process.env.EXPO_PUBLIC_API_URL;
  const fetchMock = jest.fn();
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-16T00:00:00.000Z'));
    fetchMock.mockReset();
    global.fetch = fetchMock;
    process.env.EXPO_PUBLIC_API_URL = apiBase;
    process.env.EXPO_PUBLIC_USE_DEMO_API = 'false';
  });
  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
    if (originalDemo === undefined) delete process.env.EXPO_PUBLIC_USE_DEMO_API;
    else process.env.EXPO_PUBLIC_USE_DEMO_API = originalDemo;
    if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = originalUrl;
    jest.resetModules();
  });
  return fetchMock;
}

export function loadRealClient(): ClientModule {
  return require('@/src/api/client') as ClientModule;
}

/** Attach the rejection handler before advancing the real demo's 300ms timer.
 * A fulfilled fallback remains an explicit failure, never an expected exception.
 */
export async function settleBoundaryRequest<T>(request: Promise<T>) {
  const settled = request.then(
    (value) => ({ outcome: 'fulfilled' as const, value }),
    (error: unknown) => ({ outcome: 'rejected' as const, error }),
  );
  await jest.advanceTimersByTimeAsync(1000);
  return settled;
}
