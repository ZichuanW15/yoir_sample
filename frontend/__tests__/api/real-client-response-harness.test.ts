import { counsellorSessionFixture } from '../fixtures';
import { accessToken, httpResponse, loadRealClient, useRealClientBoundary } from '../real-client-boundary-utils';

describe('real-client HTTP response harness', () => {
  const fetchMock = useRealClientBoundary();

  test('JSON login has a case-insensitive Content-Type header and returns the session', async () => {
    const response = httpResponse(counsellorSessionFixture);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('Content-Type')).toBe('application/json');
    fetchMock.mockResolvedValueOnce(response);
    const { api } = loadRealClient();

    await expect(api.login('maya@example.com', 'test-password')).resolves.toEqual(counsellorSessionFixture);
  });

  test.each([204, 205])('HTTP %i stays empty and successful deletion does not parse JSON', async (status) => {
    const response = httpResponse(undefined, status);
    const parse = jest.spyOn(response, 'json');
    expect(response.headers.get('content-type')).toBeNull();
    fetchMock.mockResolvedValueOnce(response);
    const { api } = loadRealClient();

    await expect(api.deleteAvailabilityWindow('window-1', accessToken)).resolves.toBeUndefined();
    expect(parse).not.toHaveBeenCalled();
    await expect(response.json()).rejects.toBeInstanceOf(SyntaxError);
  });
});
