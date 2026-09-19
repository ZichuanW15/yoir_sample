import { Session } from '@/src/api/types';

type ClientModule = typeof import('@/src/api/client');
type BridgeModule = typeof import('@/src/api/authBridge');

const BASE = 'https://api.example.test/api/v1';
const originalFetch = global.fetch;
const fetchMock = jest.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Response;
}

const unauthorised = () =>
  jsonResponse({ code: 'AUTHENTICATION_REQUIRED', message: 'expired', requestId: 'r' }, 401);

const sessionWith = (accessToken: string, refreshToken: string | null): Session => ({
  accessToken,
  refreshToken,
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  refreshExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  user: { id: 'u1', name: 'Alex', email: 'alex@example.com', role: 'job_seeker', emailVerified: true },
});

/**
 * An access token lives an hour; the session lives far longer. A 401 therefore
 * usually means only that the short token lapsed, and the app should renew it and
 * carry on rather than throwing the person back to a sign-in screen.
 */
describe('renewing a lapsed access token', () => {
  let api: ClientModule['api'];
  let bridge: BridgeModule;
  let stored: Session | null;

  beforeEach(() => {
    jest.resetModules();
    fetchMock.mockReset();
    global.fetch = fetchMock as typeof fetch;
    process.env.EXPO_PUBLIC_API_URL = BASE;
    delete process.env.EXPO_PUBLIC_USE_DEMO_API;

    bridge = require('@/src/api/authBridge') as BridgeModule;
    api = (require('@/src/api/client') as ClientModule).api;
    bridge.resetAuthBridge();
    stored = sessionWith('expired-token', 'refresh-1');
    bridge.bindAuth(() => stored, (next) => { stored = next; });
  });

  afterAll(() => { global.fetch = originalFetch; });

  test('a 401 is renewed and the original request retried', async () => {
    fetchMock
      .mockResolvedValueOnce(unauthorised())
      .mockResolvedValueOnce(jsonResponse(sessionWith('fresh-token', 'refresh-2')))
      .mockResolvedValueOnce(jsonResponse([]));

    await expect(api.listMyBookings('expired-token')).resolves.toEqual([]);

    const [, refreshCall, retryCall] = fetchMock.mock.calls;
    expect(refreshCall[0]).toBe(`${BASE}/auth/sessions/refresh`);
    // The retry carries the new token, not the one that just failed.
    expect(retryCall[1].headers.Authorization).toBe('Bearer fresh-token');
    expect(stored?.accessToken).toBe('fresh-token');
  });

  test('concurrent 401s cause exactly one refresh', async () => {
    // This is the one that matters. Rotation spends the refresh token, so a second
    // refresh would present an already-used one — which the server reads as a stolen
    // credential and answers by revoking the whole session. Without single-flight,
    // three parallel requests would log the person out.
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/sessions/refresh')) {
        return Promise.resolve(jsonResponse(sessionWith('fresh-token', 'refresh-2')));
      }
      const auth = (init?.headers as Record<string, string>)?.Authorization;
      return Promise.resolve(auth === 'Bearer fresh-token' ? jsonResponse([]) : unauthorised());
    });

    await Promise.all([
      api.listMyBookings('expired-token'),
      api.listMyBookings('expired-token'),
      api.listMyBookings('expired-token'),
    ]);

    const refreshes = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith('/auth/sessions/refresh'));
    expect(refreshes).toHaveLength(1);
  });

  test('a refused refresh drops the session rather than retrying forever', async () => {
    fetchMock
      .mockResolvedValueOnce(unauthorised())
      .mockResolvedValueOnce(unauthorised());

    await expect(api.listMyBookings('expired-token')).rejects.toMatchObject({ status: 401 });

    // Signed out locally, so the app stops showing screens it cannot serve.
    expect(stored).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('with no refresh token there is nothing to renew', async () => {
    stored = sessionWith('expired-token', null);
    fetchMock.mockResolvedValueOnce(unauthorised());

    await expect(api.listMyBookings('expired-token')).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('an unauthenticated call is not renewed', async () => {
    // No token was sent, so a 401 is not an expiry and there is nothing to retry.
    fetchMock.mockResolvedValueOnce(unauthorised());

    await expect(api.listServices()).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('a failing login does not try to refresh its way in', async () => {
    fetchMock.mockResolvedValueOnce(unauthorised());

    await expect(api.login('alex@example.com', 'wrong')).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
