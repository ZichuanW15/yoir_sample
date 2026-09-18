import type { WindowDraft } from '@/src/api/types';
import { counsellorSessionFixture, serviceFixture } from '../fixtures';
import { accessToken, apiBase, httpResponse, loadRealClient, settleBoundaryRequest, useRealClientBoundary } from '../real-client-boundary-utils';

describe('real-client resource safety (mocked HTTP)', () => {
  const fetchMock = useRealClientBoundary();

  test('F08 / QA #145: a real availability 404 is surfaced instead of inventing local data', async () => {
    const body = { code: 'NOT_FOUND', message: 'Not found.', requestId: 'qa-404' };
    fetchMock.mockResolvedValue(httpResponse(body, 404));
    const { api } = loadRealClient();
    expect(await settleBoundaryRequest(api.listOwnAvailabilityWindows('real-counsellor-id', accessToken)))
      .toMatchObject({ outcome: 'rejected', error: { status: 404, body } });
  });

  test.each([
    ['a real UUID absent from local seeds', 'f172c77a-18d6-4df7-b23d-41ec75201dd9'],
    ['a real ID matching a former local seed', 'counsellor_maya'],
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
    // Login and own services do not authorize inventing a missing profile.
    const result = await settleBoundaryRequest(api.getOwnCounsellorProfile(session.user, session.accessToken));
    expect(fetchMock).toHaveBeenLastCalledWith(`${apiBase}/counsellors/${userId}`, expect.objectContaining({
      headers: expect.objectContaining({ Authorization: `Bearer ${session.accessToken}` }),
    }));
    expect(result).toMatchObject({ outcome: 'rejected', error: { status: 404, body } });
  });

  test('a rejected availability-window creation preserves the server error', async () => {
    const body = { code: 'FORBIDDEN', message: 'Counsellor access required.', requestId: 'qa-window-create' };
    fetchMock.mockResolvedValueOnce(httpResponse(body, 403));
    const { api } = loadRealClient();
    const draft: WindowDraft = {
      modalities: ['online'], startsAt: '2026-10-20T00:00:00.000Z', endsAt: '2026-10-20T01:00:00.000Z',
    };
    const result = await settleBoundaryRequest(api.createAvailabilityWindow(draft, accessToken));
    expect(fetchMock).toHaveBeenCalledWith(`${apiBase}/me/availability-windows`, expect.objectContaining({
      method: 'POST', body: JSON.stringify(draft),
    }));
    expect(result).toMatchObject({ outcome: 'rejected', error: { status: 403, body } });
  });

  test('DEF-RESOURCE-FALLBACK: a missing real window preserves the server deletion error', async () => {
    const body = { code: 'NOT_FOUND', message: 'This window was already removed.', requestId: 'qa-missing-window' };
    fetchMock.mockResolvedValueOnce(httpResponse(body, 404));
    const { api } = loadRealClient();
    const result = await settleBoundaryRequest(api.deleteAvailabilityWindow('removed-real-window', accessToken));
    expect(fetchMock).toHaveBeenCalledWith(`${apiBase}/me/availability-windows/removed-real-window`, expect.objectContaining({ method: 'DELETE' }));
    expect(result).toMatchObject({ outcome: 'rejected', error: { status: 404, body } });
  });
});
