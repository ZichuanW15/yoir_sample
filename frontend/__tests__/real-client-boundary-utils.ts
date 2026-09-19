/** Real API client; only fetch and elapsed time are mocked.
 * These checks apply to the shared client, not live HTTP or device networking.
 */
export type ClientModule = typeof import('@/src/api/client');

export const apiBase = 'https://api.example.test/api/v1';
export const accessToken = 'qa-real-client-token';

export function httpResponse(body: unknown, status = 200): Response {
  const empty = status === 204 || status === 205;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(empty ? {} : { 'Content-Type': 'application/json' }),
    json: async () => {
      if (empty) throw new SyntaxError('Unexpected end of JSON input');
      return body;
    },
  } as Response;
}

export function useRealClientBoundary() {
  const originalFetch = global.fetch;
  const originalUrl = process.env.EXPO_PUBLIC_API_URL;
  const fetchMock = jest.fn();
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-16T00:00:00.000Z'));
    fetchMock.mockReset();
    global.fetch = fetchMock;
    process.env.EXPO_PUBLIC_API_URL = apiBase;
  });
  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = originalUrl;
    jest.resetModules();
  });
  return fetchMock;
}

export function loadRealClient(): ClientModule {
  return require('@/src/api/client') as ClientModule;
}

/** Observe a request without turning an unexpected rejection into a passing test. */
export async function settleBoundaryRequest<T>(request: Promise<T>) {
  const settled = request.then(
    (value) => ({ outcome: 'fulfilled' as const, value }),
    (error: unknown) => ({ outcome: 'rejected' as const, error }),
  );
  await jest.advanceTimersByTimeAsync(1000);
  return settled;
}
