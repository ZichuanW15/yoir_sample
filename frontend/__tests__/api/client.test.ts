import { platformClient } from '@/src/api/authBridge';
import {
  confirmationFixture,
  orderFixture,
  serviceFixture,
  sessionFixture,
  slotFixture,
} from '../fixtures';

type ClientModule = typeof import('@/src/api/client');

const originalFetch = global.fetch;
const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
const originalDemoFlag = process.env.EXPO_PUBLIC_USE_DEMO_API;
const fetchMock = jest.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Response;
}

function loadClient(): ClientModule {
  return require('@/src/api/client') as ClientModule;
}

describe('API client HTTP boundary', () => {
  beforeEach(() => {
    jest.resetModules();
    fetchMock.mockReset();
    global.fetch = fetchMock as typeof fetch;
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/api/v1/';
    delete process.env.EXPO_PUBLIC_USE_DEMO_API;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    if (originalApiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    if (originalDemoFlag === undefined) delete process.env.EXPO_PUBLIC_USE_DEMO_API;
    else process.env.EXPO_PUBLIC_USE_DEMO_API = originalDemoFlag;
  });

  test('login sends the documented method, URL, headers and body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(sessionFixture));
    const { api } = loadClient();

    await expect(api.login('alex@example.com', 'correct-password')).resolves.toEqual(sessionFixture);

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/v1/auth/sessions', {
      method: 'POST',
      // US-06: the platform travels with the credentials, because it decides how
      // long the server lets the session slide before asking for a password again.
      // Taken from the platform under test rather than hard-coded: the rule is that
      // the client identifier travels with the credentials, not that it is any one
      // value. jest runs as a device, a browser reports 'web'.
      body: JSON.stringify({
        email: 'alex@example.com', password: 'correct-password', client: platformClient,
      }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
  });

  test('register serialises the complete registration request', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(sessionFixture.user, 201));
    const { api } = loadClient();
    const input = {
      name: 'Alex Morgan',
      email: 'alex@example.com',
      password: 'correct-password',
      passwordConfirmation: 'correct-password',
      role: 'job_seeker' as const,
    };

    await expect(api.register(input)).resolves.toEqual(sessionFixture.user);

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/v1/auth/users', {
      method: 'POST',
      body: JSON.stringify(input),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
  });

  test('listServices trims and URL-encodes a query without adding authentication', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([serviceFixture]));
    const { api } = loadClient();

    await expect(api.listServices('  resume review  ')).resolves.toEqual([serviceFixture]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/services?query=resume%20review',
      { headers: { Accept: 'application/json' } },
    );
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(request.headers).not.toHaveProperty('Authorization');
  });

  test('getService URL-encodes the service identifier', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(serviceFixture));
    const { api } = loadClient();

    await api.getService('service/one');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/services/service%2Fone',
      { headers: { Accept: 'application/json' } },
    );
  });

  test('listServiceSlots URL-encodes the service identifier', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([slotFixture]));
    const { api } = loadClient();

    await expect(api.listServiceSlots('service/one')).resolves.toEqual([slotFixture]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/services/service%2Fone/slots',
      { headers: { Accept: 'application/json' } },
    );
  });

  test('createOrder sends the booking payload with Bearer authentication', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(orderFixture, 201));
    const { api } = loadClient();

    await expect(
      api.createOrder(
        'service-1',
        '2026-09-01T00:00:00.000Z',
        'online',
        'Australia/Sydney',
        'test-access-token',
      ),
    ).resolves.toEqual(orderFixture);

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/v1/orders', {
      method: 'POST',
      // The chosen start only; its end follows from the service's own duration, so
      // the client never decides how long it is buying.
      body: JSON.stringify({
        serviceId: 'service-1',
        startsAt: '2026-09-01T00:00:00.000Z',
        modality: 'online',
        timezone: 'Australia/Sydney',
      }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-access-token',
      },
    });
  });

  test('completeStubPayment authenticates and URL-encodes the order identifier', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(confirmationFixture));
    const { api } = loadClient();

    await expect(
      api.completeStubPayment({ ...orderFixture, id: 'order/one' }, 'test-access-token'),
    ).resolves.toEqual(confirmationFixture);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/orders/order%2Fone/payments/stub',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer test-access-token',
        },
      },
    );
  });

  test('converts a structured non-2xx response into ApiError', async () => {
    const body = {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid credentials.',
      requestId: 'request-401',
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(body, 401));
    const { api, ApiError } = loadClient();

    const request = api.login('alex@example.com', 'wrong-password');

    await expect(request).rejects.toMatchObject({ status: 401, body });
    await expect(request).rejects.toBeInstanceOf(ApiError);
  });

  test('uses a deterministic fallback when an error response is not JSON', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: jest.fn().mockRejectedValue(new SyntaxError('Invalid JSON')),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Response);
    const { api } = loadClient();

    await expect(api.listServices()).rejects.toMatchObject({
      status: 502,
      body: {
        code: 'NETWORK_RESPONSE_ERROR',
        message: 'The service returned an unexpected response.',
        requestId: 'unknown',
      },
    });
  });

  test('preserves network errors for user-facing connection handling', async () => {
    const networkError = new TypeError('fetch failed');
    fetchMock.mockRejectedValueOnce(networkError);
    const { api, userFacingError } = loadClient();

    await expect(api.listServices()).rejects.toBe(networkError);
    expect(userFacingError(networkError)).toBe(
      'We could not reach Yoir. Check your connection and try again.',
    );
  });

  test('maps API, generic and unknown failures to safe user-facing messages', () => {
    const { ApiError, userFacingError } = loadClient();

    expect(
      userFacingError(
        new ApiError(409, {
          code: 'CONFLICT',
          message: 'The selected slot is no longer available.',
          requestId: 'request-409',
        }),
      ),
    ).toBe('The selected slot is no longer available.');
    expect(
      userFacingError(
        new ApiError(500, { code: 'SERVER_ERROR', message: '', requestId: 'request-500' }),
      ),
    ).toBe('Something went wrong. Please try again.');
    expect(userFacingError(new Error('A local operation failed.'))).toBe(
      'A local operation failed.',
    );
    expect(userFacingError({ unexpected: true })).toBe('Something went wrong. Please try again.');
  });


  // Correct assertions for malformed responses run in test:defects. Request
  // timeout and production URL policy remain documented hardening gaps; a todo
  // is not executable QA evidence.
});
