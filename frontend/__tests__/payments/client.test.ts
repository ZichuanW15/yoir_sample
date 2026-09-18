import { orderFixture, sessionFixture } from '../fixtures';

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

const loadClient = (): ClientModule => require('@/src/api/client') as ClientModule;
const token = sessionFixture.accessToken;

describe('payment operations on the HTTP boundary', () => {
  beforeEach(() => {
    jest.resetModules();
    fetchMock.mockReset();
    global.fetch = fetchMock as typeof fetch;
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/api/v1';
    delete process.env.EXPO_PUBLIC_USE_DEMO_API;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    if (originalApiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    if (originalDemoFlag === undefined) delete process.env.EXPO_PUBLIC_USE_DEMO_API;
    else process.env.EXPO_PUBLIC_USE_DEMO_API = originalDemoFlag;
  });

  test.each([
    ['getBooking', ''], ['getBookingReceipt', '/receipt'],
  ] as const)('%s reads the authenticated booking with an escaped identifier', async (method, suffix) => {
    const payload = { id: 'booking/1', receiptNumber: 'R-001' };
    fetchMock.mockResolvedValueOnce(jsonResponse(payload));
    const { api } = loadClient();
    await expect(api[method]('booking/1', token)).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.test/api/v1/bookings/booking%2F1${suffix}`,
      { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } },
    );
  });

  test('payment config is public, so it is requested without a bearer token', async () => {
    const config = {
      provider: 'stripe', publishableKey: 'pk_test_123', merchantDisplayName: 'Yoir',
      merchantCountryCode: 'AU', currency: 'AUD', slotHoldMinutes: 15,
      cancellationFullRefundHours: 24, cancellationLateRefundPercent: 0,
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(config));
    const { api } = loadClient();

    await expect(api.getPaymentConfig()).resolves.toEqual(config);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.test/api/v1/payments/config');
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  test('creating a payment intent posts to the order and authenticates', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      paymentIntentId: 'pi_1', clientSecret: 'pi_1_secret', status: 'requires_payment_method',
    }));
    const { api } = loadClient();

    const intent = await api.createPaymentIntent('order-1', token);

    expect(intent.clientSecret).toBe('pi_1_secret');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/orders/order-1/payment-intents',
      {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      },
    );
  });

  test('an order id is escaped rather than pasted into the path', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ order: orderFixture, booking: null }));
    const { api } = loadClient();

    await api.getOrderStatus('order/../../admin', token);

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.example.test/api/v1/orders/order%2F..%2F..%2Fadmin',
    );
  });

  test('cancelling a booking sends the reason the person gave', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      booking: { id: 'booking-1' }, refundedMinor: 9500, currency: 'AUD',
    }));
    const { api } = loadClient();

    await api.cancelBooking('booking-1', 'Something came up', token);

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ reason: 'Something came up' }),
    });
  });

  test('tax details are sent with PUT, the method the contract publishes', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      stripeAccountId: null, chargesEnabled: false, payoutsEnabled: false,
      onboardingRequired: true, abn: '12345678901', gstRegistered: true,
    }));
    const { api } = loadClient();

    await api.updateTaxDetails({ abn: '12345678901', gstRegistered: true }, token);

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.test/api/v1/me/tax-details');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'PUT',
      body: JSON.stringify({ abn: '12345678901', gstRegistered: true }),
    });
  });

  test('onboarding always asks the server for a new link rather than reusing one', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ url: 'https://connect.stripe.test/a', accountId: 'acct_1' }))
      .mockResolvedValueOnce(jsonResponse({ url: 'https://connect.stripe.test/b', accountId: 'acct_1' }));
    const { api } = loadClient();

    const first = await api.startStripeOnboarding(token);
    const second = await api.startStripeOnboarding(token);

    // Account Links are single-use and expire in minutes, so two calls mean two links.
    expect(first.url).not.toBe(second.url);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('a payment failure surfaces the API message rather than a generic one', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(
      {
        code: 'COUNSELLOR_PAYOUTS_UNAVAILABLE',
        message: 'This counsellor cannot accept bookings yet. Please try another counsellor.',
        requestId: 'req-1',
      },
      409,
    ));
    const { api, userFacingError } = loadClient();

    const error = await api.createPaymentIntent('order-1', token).catch((cause: unknown) => cause);

    expect(error).toMatchObject({ status: 409 });
    expect(userFacingError(error)).toContain('cannot accept bookings yet');
  });
});
