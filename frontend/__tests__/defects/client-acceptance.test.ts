import { httpResponse, loadRealClient, useRealClientBoundary } from '../real-client-boundary-utils';

describe('shared real-client boundary acceptance (mocked HTTP, not deployed endpoint evidence)', () => {
  const fetchMock = useRealClientBoundary();

  test('F06 / QA #109: null HTTP error body remains a structured response failure', async () => {
    fetchMock.mockResolvedValue(httpResponse(null, 502));
    const { api, ApiError } = loadRealClient();
    await expect(api.listServices()).rejects.toBeInstanceOf(ApiError);
  });

  test('F07 / QA #109: malformed success payload cannot reach the service list as valid data', async () => {
    fetchMock.mockResolvedValue(httpResponse({ services: 'invalid' }, 200));
    const { api } = loadRealClient();
    await expect(api.listServices()).rejects.toThrow();
  });

});
