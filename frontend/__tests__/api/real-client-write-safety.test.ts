import type { ServiceDraft, WindowDraft } from '@/src/api/types';
import { counsellorProfileFixture, serviceFixture } from '../fixtures';
import {
  accessToken, apiBase, type ClientModule, httpResponse, loadRealClient, settleBoundaryRequest, useRealClientBoundary,
} from '../real-client-boundary-utils';

const serviceDraft: ServiceDraft = {
  title: serviceFixture.title, description: serviceFixture.description,
  priceMinor: serviceFixture.priceMinor, durationMinutes: serviceFixture.durationMinutes, currency: 'AUD', modalities: ['online'], location: null,
};
const windowDraft: WindowDraft = {
  modalities: ['online'], startsAt: '2026-10-20T00:00:00.000Z', endsAt: '2026-10-20T01:00:00.000Z',
};

// Mocked HTTP rejection verifies client error propagation; backend authorization
// and window ownership are validated separately by backend acceptance tests.
const deniedWrites: {
  operation: string; method: string; path: string;
  invoke: (api: ClientModule['api']) => Promise<unknown>;
}[] = [
  { operation: 'profile save', method: 'PATCH', path: '/me/counsellor-profile', invoke: (api) => api.updateOwnCounsellorProfile('counsellor-1', counsellorProfileFixture, accessToken) },
  { operation: 'service create', method: 'POST', path: '/me/services', invoke: (api) => api.createService('counsellor-1', serviceDraft, accessToken) },
  { operation: 'service edit', method: 'PATCH', path: '/me/services/service-1', invoke: (api) => api.updateService('service-1', serviceDraft, accessToken) },
  { operation: 'service delete', method: 'DELETE', path: '/me/services/service-1', invoke: (api) => api.deleteService('service-1', accessToken) },
  { operation: 'window create', method: 'POST', path: '/me/availability-windows', invoke: (api) => api.createAvailabilityWindow(windowDraft, accessToken) },
  { operation: 'window edit', method: 'PATCH', path: '/me/availability-windows/window-1', invoke: (api) => api.updateAvailabilityWindow('window-1', windowDraft, accessToken) },
  { operation: 'window delete', method: 'DELETE', path: '/me/availability-windows/window-1', invoke: (api) => api.deleteAvailabilityWindow('window-1', accessToken) },
];

describe('shared real-client write safety (mocked HTTP, no backend/device claim)', () => {
  const fetchMock = useRealClientBoundary();

  test.each(deniedWrites)('$operation: HTTP 403 never becomes a local save or success', async ({ invoke, method, path }) => {
    const body = { code: 'FORBIDDEN', message: 'You may not change this resource.', requestId: 'qa-denied-write' };
    fetchMock.mockResolvedValueOnce(httpResponse(body, 403));
    const { api, ApiError } = loadRealClient();
    const outcome = await settleBoundaryRequest(invoke(api));
    expect(outcome).toMatchObject({ outcome: 'rejected', error: { status: 403, body } });
    if (outcome.outcome === 'rejected') expect(outcome.error).toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`${apiBase}${path}`, expect.objectContaining({
      method, headers: expect.objectContaining({ Authorization: `Bearer ${accessToken}` }),
    }));
  });

  test.each([
    { operation: 'service detail', path: '/services/deleted-service', invoke: (api: ClientModule['api']) => api.getService('deleted-service') },
    { operation: 'public service slots', path: '/services/deleted-service/slots', invoke: (api: ClientModule['api']) => api.listServiceSlots('deleted-service') },
  ])('$operation: a genuine HTTP 404 retains its server error', async ({ path, invoke }) => {
    const body = { code: 'NOT_FOUND', message: 'This service no longer exists.', requestId: 'qa-public-resource-404' };
    fetchMock.mockResolvedValueOnce(httpResponse(body, 404));
    const { api } = loadRealClient();
    expect(await settleBoundaryRequest<unknown>(invoke(api))).toMatchObject({ outcome: 'rejected', error: { status: 404, body } });
    expect(fetchMock).toHaveBeenCalledWith(`${apiBase}${path}`, { headers: { Accept: 'application/json' } });
  });
});
