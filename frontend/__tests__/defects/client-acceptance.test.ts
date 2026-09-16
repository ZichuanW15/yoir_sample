import { counsellorSessionFixture, serviceFixture } from '../fixtures';
import {
  accessToken, apiBase, httpResponse, loadRealClient, settleBoundaryRequest, useRealClientBoundary,
} from '../real-client-boundary-utils';

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

  test('F08 / QA #145: a real availability 404 is surfaced instead of inventing local data', async () => {
    const body = { code: 'NOT_FOUND', message: 'Not found.', requestId: 'qa-404' };
    fetchMock.mockResolvedValue(httpResponse(body, 404));
    const { api } = loadRealClient();
    expect(await settleBoundaryRequest(api.listOwnAvailabilitySlots('real-counsellor-id', accessToken)))
      .toMatchObject({ outcome: 'rejected', error: { status: 404, body } });
  });

  test.each([
    ['a real UUID absent from local seeds', 'f172c77a-18d6-4df7-b23d-41ec75201dd9'],
    ['a real ID also present in local demo seeds', 'counsellor_maya'],
  ])('DEF-PROFILE-PROVENANCE: a missing profile for %s cannot invent a verification status', async (_description, userId) => {
    const user = { ...counsellorSessionFixture.user, id: userId };
    const liveService = { ...serviceFixture, counsellor: { ...serviceFixture.counsellor, id: userId } };
    const body = { code: 'NOT_FOUND', message: 'Profile information is unavailable.', requestId: 'qa-profile-provenance' };
    fetchMock
      .mockResolvedValueOnce(httpResponse({ ...counsellorSessionFixture, user }))
      .mockResolvedValueOnce(httpResponse([liveService]))
      .mockResolvedValueOnce(httpResponse(body, 404));
    const { api } = loadRealClient();

    const session = await api.login(user.email, 'qa-test-password');
    const services = await api.listOwnServices(session.user.id, session.accessToken);
    expect(services[0].counsellor).toMatchObject({ id: userId, verificationStatus: 'verified' });
    // This does not require a Sprint 3 profile/verification endpoint to exist or
    // infer verification from login. With no authoritative profile response, the
    // client must expose unavailability rather than fabricate pending OR
    // verified from whichever unrelated local seed happens to match the ID.
    const result = await settleBoundaryRequest(api.getOwnCounsellorProfile(session.user, session.accessToken));
    expect(fetchMock).toHaveBeenLastCalledWith(`${apiBase}/counsellors/${userId}`, expect.objectContaining({
      headers: expect.objectContaining({ Authorization: `Bearer ${session.accessToken}` }),
    }));
    if (result.outcome === 'rejected') {
      expect(result.error).toMatchObject({ status: 404, body });
    } else {
      // Permit a future explicit unknown/unavailable profile model rather than
      // demanding one recovery implementation. A preview flag alone is not
      // enough: known status values still misrepresent unavailable authority.
      expect([null, undefined, 'unknown']).toContain(result.value.verificationStatus);
    }
  });

  test('DEF-RESOURCE-FALLBACK: a missing real service cannot turn slot creation into a local success', async () => {
    const body = { code: 'NOT_FOUND', message: 'This service no longer exists.', requestId: 'qa-missing-service' };
    fetchMock.mockResolvedValueOnce(httpResponse(body, 404));
    const { api, preview } = loadRealClient();
    const draft = { serviceId: 'deleted-real-service', startsAt: '2026-10-20T00:00:00.000Z', endsAt: '2026-10-20T01:00:00.000Z' };
    const result = await settleBoundaryRequest(api.createAvailabilitySlot(draft, accessToken));
    expect(fetchMock).toHaveBeenCalledWith(`${apiBase}/me/availability-slots`, expect.objectContaining({
      method: 'POST', body: JSON.stringify(draft),
    }));
    expect(result).toMatchObject({ outcome: 'rejected', error: { status: 404, body } });
    expect(preview.active).toBe(false);
  });

  test('DEF-RESOURCE-FALLBACK: a missing real slot preserves the server deletion error, not a local replacement', async () => {
    const body = { code: 'NOT_FOUND', message: 'This slot was already removed.', requestId: 'qa-missing-slot' };
    fetchMock.mockResolvedValueOnce(httpResponse(body, 404));
    const { api, preview } = loadRealClient();
    const result = await settleBoundaryRequest(api.deleteAvailabilitySlot('removed-real-slot', accessToken));
    expect(fetchMock).toHaveBeenCalledWith(`${apiBase}/me/availability-slots/removed-real-slot`, expect.objectContaining({ method: 'DELETE' }));
    expect(result).toMatchObject({ outcome: 'rejected', error: { status: 404, body } });
    expect(preview.active).toBe(false);
  });
});
