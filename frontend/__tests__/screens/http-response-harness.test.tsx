import { jsonResponse, reply } from '../public-screen-utils';
import { api } from '@/src/api/client';
import { sessionFixture } from '../fixtures';

describe('screen HTTP response harness', () => {
  test('JSON responses expose case-insensitive Content-Type and establish a session through the real client', async () => {
    const response = jsonResponse(sessionFixture);
    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    reply('POST', '/auth/sessions', response);
    expect(await api.login('alex@example.com', 'correct-password')).toEqual(sessionFixture);
  });

  test.each([204, 205])('HTTP %i has no JSON body and deletion succeeds without reading one', async (status) => {
    const response = jsonResponse(undefined, status);
    expect(response.headers.get('content-type')).toBeNull();
    await expect(response.json()).rejects.toThrow(SyntaxError);
    reply('DELETE', '/me/availability-windows/window-1', response);
    await expect(api.deleteAvailabilityWindow('window-1', 'token')).resolves.toBeUndefined();
  });
});
