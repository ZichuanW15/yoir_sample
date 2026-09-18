/**
 * The HTTP shape of the account-recovery and administration calls.
 *
 * These are the calls whose URL or body being wrong is invisible in the app until
 * somebody's link does nothing, so each one is pinned to the published contract.
 */
import { sessionFixture } from '../fixtures';

type ClientModule = typeof import('@/src/api/client');

const originalFetch = global.fetch;
const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
const fetchMock = jest.fn();
const TOKEN = 'admin-access-token';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Response;
}

/** What the generic "accepted" endpoints actually return: 202 and nothing at all. */
function acceptedResponse(status = 202): Response {
  return {
    ok: true,
    status,
    json: jest.fn().mockRejectedValue(new SyntaxError('Unexpected end of JSON input')),
    headers: new Headers(),
  } as unknown as Response;
}

function loadClient(): ClientModule {
  return require('@/src/api/client') as ClientModule;
}

const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };
const AUTH_HEADERS = { ...JSON_HEADERS, Authorization: `Bearer ${TOKEN}` };
// A GET carries no body, so the client sends no Content-Type with it.
const READ_HEADERS = { Accept: 'application/json', Authorization: `Bearer ${TOKEN}` };

describe('confirming an address and recovering an account', () => {
  beforeEach(() => {
    jest.resetModules();
    fetchMock.mockReset();
    global.fetch = fetchMock as typeof fetch;
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/api/v1/';
  });

  afterAll(() => {
    global.fetch = originalFetch;
    if (originalApiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
  });

  test('verifying an address returns a session, because the link proves ownership', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(sessionFixture));
    const { api } = loadClient();

    await expect(api.verifyEmail('link-token')).resolves.toEqual(sessionFixture);

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/v1/auth/email-verifications', {
      method: 'POST',
      body: JSON.stringify({ token: 'link-token' }),
      headers: JSON_HEADERS,
    });
  });

  test('the verify call carries no bearer token: the whole point is not being signed in', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(sessionFixture));
    const { api } = loadClient();

    await api.verifyEmail('link-token');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  test.each([
    ['requestEmailVerification', '/auth/email-verification-requests'],
    ['requestPasswordReset', '/auth/password-reset-requests'],
  ] as const)('%s posts only the address', async (method, path) => {
    fetchMock.mockResolvedValueOnce(acceptedResponse());
    const { api } = loadClient();

    // Resolves rather than throwing: these answer 202 with an empty body, and
    // parsing that as JSON is what made the resend button crash the app.
    await expect(api[method]('alex@example.com')).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(`https://api.example.test/api/v1${path}`, {
      method: 'POST',
      body: JSON.stringify({ email: 'alex@example.com' }),
      headers: JSON_HEADERS,
    });
  });

  test('resetting a password sends the link token with both copies of the new one', async () => {
    fetchMock.mockResolvedValueOnce(acceptedResponse(204));
    const { api } = loadClient();

    await expect(api.resetPassword('reset-token', 'new-password', 'new-password')).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/v1/auth/password-resets', {
      method: 'POST',
      body: JSON.stringify({
        token: 'reset-token', password: 'new-password', passwordConfirmation: 'new-password',
      }),
      headers: JSON_HEADERS,
    });
  });
});

describe('administration calls', () => {
  beforeEach(() => {
    jest.resetModules();
    fetchMock.mockReset();
    global.fetch = fetchMock as typeof fetch;
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/api/v1/';
  });

  afterAll(() => {
    global.fetch = originalFetch;
    if (originalApiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
  });

  test.each([
    ['getPlatformStats', '/admin/stats'],
    ['listPaymentOversight', '/admin/payments'],
    ['listAllBookings', '/admin/bookings'],
    ['listAllCounsellors', '/admin/counsellors'],
  ] as const)('%s reads %s with the caller\'s bearer token', async (method, path) => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const { api } = loadClient();

    await api[method](TOKEN);

    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.test/api/v1${path}`,
      { headers: READ_HEADERS },
    );
  });

  test('the verification queue filters by status in the query string', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const { api } = loadClient();

    await api.listVerificationSubmissions('pending', TOKEN);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/admin/verifications?status=pending',
      { headers: READ_HEADERS },
    );
  });

  test('a decision carries its reason, which the counsellor is emailed', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    const { api } = loadClient();

    await api.decideVerification('counsellor-1', 'rejected', 'Your LinkedIn profile is private.', TOKEN);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/admin/verifications/counsellor-1/decision',
      {
        method: 'POST',
        body: JSON.stringify({ decision: 'rejected', reason: 'Your LinkedIn profile is private.' }),
        headers: AUTH_HEADERS,
      },
    );
  });

  test('ids are escaped rather than pasted into the path', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    const { api } = loadClient();

    await api.decideVerification('a/b?c', 'verified', '', TOKEN);

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.example.test/api/v1/admin/verifications/a%2Fb%3Fc/decision',
    );
  });
});
