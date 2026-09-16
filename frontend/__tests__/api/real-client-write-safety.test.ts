import type { ServiceDraft, SlotDraft } from '@/src/api/types';
import { counsellorProfileFixture, serviceFixture } from '../fixtures';
import {
  accessToken, apiBase, type ClientModule, httpResponse, loadRealClient, settleBoundaryRequest, useRealClientBoundary,
} from '../real-client-boundary-utils';

const serviceDraft: ServiceDraft = {
  title: serviceFixture.title, description: serviceFixture.description,
  priceMinor: serviceFixture.priceMinor, currency: 'AUD', modalities: ['online'], location: null,
};
const slotDraft: SlotDraft = {
  serviceId: serviceFixture.id, startsAt: '2026-10-20T00:00:00.000Z', endsAt: '2026-10-20T01:00:00.000Z',
};

// Profile/service edits are frontend operations only. A mocked rejection checks
// that the existing client honours authorization; it does not require these
// currently missing backend endpoints or the Sprint 3 verification workflow.
const deniedWrites: {
  operation: string; method: string; path: string;
  invoke: (api: ClientModule['api']) => Promise<unknown>;
}[] = [
  { operation: 'profile save', method: 'PATCH', path: '/me/counsellor-profile', invoke: (api) => api.updateOwnCounsellorProfile('counsellor-1', counsellorProfileFixture, accessToken) },
  { operation: 'service create', method: 'POST', path: '/me/services', invoke: (api) => api.createService('counsellor-1', serviceDraft, accessToken) },
  { operation: 'service edit', method: 'PATCH', path: '/me/services/service-1', invoke: (api) => api.updateService('service-1', serviceDraft, accessToken) },
  { operation: 'service delete', method: 'DELETE', path: '/me/services/service-1', invoke: (api) => api.deleteService('service-1', accessToken) },
  { operation: 'slot create', method: 'POST', path: '/me/availability-slots', invoke: (api) => api.createAvailabilitySlot(slotDraft, accessToken) },
  { operation: 'slot edit', method: 'PATCH', path: '/me/availability-slots/slot-1', invoke: (api) => api.updateAvailabilitySlot('slot-1', slotDraft, accessToken) },
  { operation: 'slot delete', method: 'DELETE', path: '/me/availability-slots/slot-1', invoke: (api) => api.deleteAvailabilitySlot('slot-1', accessToken) },
];

describe('shared real-client write safety (mocked HTTP, no backend/device claim)', () => {
  const fetchMock = useRealClientBoundary();

  test.each(deniedWrites)('$operation: HTTP 403 never becomes a local save or success', async ({ invoke, method, path }) => {
    const body = { code: 'FORBIDDEN', message: 'You may not change this resource.', requestId: 'qa-denied-write' };
    fetchMock.mockResolvedValueOnce(httpResponse(body, 403));
    const { api, preview, ApiError } = loadRealClient();
    const outcome = await settleBoundaryRequest(invoke(api));
    expect(outcome).toMatchObject({ outcome: 'rejected', error: { status: 403, body } });
    if (outcome.outcome === 'rejected') expect(outcome.error).toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`${apiBase}${path}`, expect.objectContaining({
      method, headers: expect.objectContaining({ Authorization: `Bearer ${accessToken}` }),
    }));
    expect(preview.active).toBe(false);
    expect([...preview.routes]).toEqual([]);
  });

  test.each([
    { operation: 'service detail', path: '/services/deleted-service', invoke: (api: ClientModule['api']) => api.getService('deleted-service') },
    { operation: 'public service slots', path: '/services/deleted-service/slots', invoke: (api: ClientModule['api']) => api.listServiceSlots('deleted-service') },
  ])('$operation: a genuine HTTP 404 retains its server error', async ({ path, invoke }) => {
    const body = { code: 'NOT_FOUND', message: 'This service no longer exists.', requestId: 'qa-public-resource-404' };
    fetchMock.mockResolvedValueOnce(httpResponse(body, 404));
    const { api, preview } = loadRealClient();
    expect(await settleBoundaryRequest<unknown>(invoke(api))).toMatchObject({ outcome: 'rejected', error: { status: 404, body } });
    expect(fetchMock).toHaveBeenCalledWith(`${apiBase}${path}`, { headers: { Accept: 'application/json' } });
    expect(preview.active).toBe(false);
  });
});
