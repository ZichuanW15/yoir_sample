type ClientModule = typeof import('@/src/api/client');

const originalFetch = global.fetch;
const originalDemo = process.env.EXPO_PUBLIC_USE_DEMO_API;
const originalUrl = process.env.EXPO_PUBLIC_API_URL;
const fetchMock = jest.fn();
const response = (body: unknown, status: number) => ({ ok: status < 400, status, json: async () => body });

describe('unresolved real API boundary acceptance', () => {
  beforeEach(() => {
    jest.resetModules();
    fetchMock.mockReset();
    global.fetch = fetchMock;
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/api/v1';
    process.env.EXPO_PUBLIC_USE_DEMO_API = 'false';
  });
  afterAll(() => {
    global.fetch = originalFetch;
    if (originalDemo === undefined) delete process.env.EXPO_PUBLIC_USE_DEMO_API;
    else process.env.EXPO_PUBLIC_USE_DEMO_API = originalDemo;
    if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = originalUrl;
    jest.resetModules();
  });

  test('F06 / QA #109: null HTTP error body remains a structured response failure', async () => {
    fetchMock.mockResolvedValue(response(null, 502));
    const { api, ApiError } = require('@/src/api/client') as ClientModule;
    await expect(api.listServices()).rejects.toBeInstanceOf(ApiError);
  });

  test('F07 / QA #109: malformed success payload cannot reach the service list as valid data', async () => {
    fetchMock.mockResolvedValue(response({ services: 'invalid' }, 200));
    const { api } = require('@/src/api/client') as ClientModule;
    await expect(api.listServices()).rejects.toThrow();
  });

  test('F08 / QA #145: a real availability 404 is surfaced instead of inventing local data', async () => {
    const body = { code: 'NOT_FOUND', message: 'Not found.', requestId: 'qa-404' };
    fetchMock.mockResolvedValue(response(body, 404));
    const { api } = require('@/src/api/client') as ClientModule;
    await expect(api.listOwnAvailabilitySlots('real-counsellor-id', 'real-token')).rejects.toMatchObject({ status: 404, body });
  });
});
