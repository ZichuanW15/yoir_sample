import {
  CounsellorProfileUpdate,
  ServiceDraft,
  WindowDraft,
  User,
} from '@/src/api/types';

import {
  counsellorProfileFixture,
  counsellorSessionFixture,
  serviceFixture,
  slotFixture,
} from '../fixtures';

type ClientModule = typeof import('@/src/api/client');

const originalFetch = global.fetch;
const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
const originalDemoFlag = process.env.EXPO_PUBLIC_USE_DEMO_API;
const fetchMock = jest.fn();

const BASE = 'https://api.example.test/api/v1';
const TOKEN = 'counsellor-access-token';
const AUTH_HEADERS = {
  Accept: 'application/json',
  Authorization: `Bearer ${TOKEN}`,
};
const JSON_AUTH_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  Authorization: `Bearer ${TOKEN}`,
};

const counsellorUser: User = counsellorSessionFixture.user;

const profileUpdate: CounsellorProfileUpdate = {
  photoUrl: null,
  linkedinUrl: 'https://www.linkedin.com/in/maya-chen',
  introduction: 'Career counsellor specialising in interview preparation.',
  background: 'Ten years in graduate recruitment.',
  experience: 'Coached over 400 candidates.',
  baseLocation: { state: 'VIC', cityOrRegion: 'Melbourne' },
  defaultModality: 'online',
};

const serviceDraft: ServiceDraft = {
  title: 'Interview confidence coaching',
  description: 'Practical interview preparation and feedback.',
  priceMinor: 9500,
  durationMinutes: 60,
  currency: 'AUD',
  modalities: ['online'],
  location: null,
};

const windowDraft: WindowDraft = {
  startsAt: '2026-10-03T01:00:00.000Z',
  endsAt: '2026-10-03T04:00:00.000Z',
  modalities: ['online', 'in_person'],
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Response;
}

function errorResponse(status: number, code = 'NOT_FOUND', message = 'This route is not available.'): Response {
  return jsonResponse({ code, message, requestId: `request-${status}` }, status);
}

/**
 * What an undeployed path actually answers: the framework's own 404, which carries
 * no published error code. A 404 that *does* carry NOT_FOUND is a missing resource.
 */
function unroutedResponse(status = 404): Response {
  return jsonResponse({ detail: 'Not Found' }, status);
}

function loadClient(): ClientModule {
  return require('@/src/api/client') as ClientModule;
}

/** demo.ts pauses 300ms before resolving, so a local resolution needs the fake clock moved on. */
async function settleLocal<T>(pending: Promise<T>): Promise<T> {
  await jest.advanceTimersByTimeAsync(300);
  return pending;
}

describe('counsellor API boundary', () => {
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

  describe('live requests', () => {
    test('getOwnCounsellorProfile reads the counsellor by id with Bearer authentication', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(counsellorProfileFixture));
      const { api } = loadClient();

      await expect(api.getOwnCounsellorProfile(counsellorUser, TOKEN)).resolves.toEqual(
        counsellorProfileFixture,
      );

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/counsellors/counsellor-1`, {
        headers: AUTH_HEADERS,
      });
    });

    test('getOwnCounsellorProfile URL-encodes the counsellor identifier', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(counsellorProfileFixture));
      const { api } = loadClient();

      await api.getOwnCounsellorProfile({ ...counsellorUser, id: 'counsellor/one' }, TOKEN);

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/counsellors/counsellor%2Fone`, {
        headers: AUTH_HEADERS,
      });
    });

    test('updateOwnCounsellorProfile PATCHes the published profile payload', async () => {
      const updated = { ...counsellorProfileFixture, introduction: profileUpdate.introduction };
      fetchMock.mockResolvedValueOnce(jsonResponse(updated));
      const { api } = loadClient();

      await expect(
        api.updateOwnCounsellorProfile(counsellorUser.id, profileUpdate, TOKEN),
      ).resolves.toEqual(updated);

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/me/counsellor-profile`, {
        method: 'PATCH',
        body: JSON.stringify(profileUpdate),
        headers: JSON_AUTH_HEADERS,
      });
    });

    test('listOwnServices reads the counsellor-scoped service collection', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([serviceFixture]));
      const { api } = loadClient();

      await expect(api.listOwnServices(counsellorUser.id, TOKEN)).resolves.toEqual([serviceFixture]);

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/me/services`, { headers: AUTH_HEADERS });
    });

    test('createService POSTs the service draft', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(serviceFixture, 201));
      const { api } = loadClient();

      await expect(api.createService(counsellorUser.id, serviceDraft, TOKEN)).resolves.toEqual(
        serviceFixture,
      );

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/me/services`, {
        method: 'POST',
        body: JSON.stringify(serviceDraft),
        headers: JSON_AUTH_HEADERS,
      });
    });

    test('updateService PATCHes the URL-encoded service identifier', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(serviceFixture));
      const { api } = loadClient();

      await expect(api.updateService('service/one', serviceDraft, TOKEN)).resolves.toEqual(serviceFixture);

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/me/services/service%2Fone`, {
        method: 'PATCH',
        body: JSON.stringify(serviceDraft),
        headers: JSON_AUTH_HEADERS,
      });
    });

    test('deleteService DELETEs the URL-encoded service and resolves on 204', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(undefined, 204));
      const { api } = loadClient();

      await expect(api.deleteService('service/one', TOKEN)).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/me/services/service%2Fone`, {
        method: 'DELETE',
        headers: AUTH_HEADERS,
      });
    });

    test('listOwnAvailabilityWindows reads the calendar that belongs to the counsellor', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([slotFixture]));
      const { api } = loadClient();

      await expect(api.listOwnAvailabilityWindows(counsellorUser.id, TOKEN)).resolves.toEqual([
        slotFixture,
      ]);

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/me/availability-windows`, {
        headers: AUTH_HEADERS,
      });
    });

    test('createAvailabilityWindow POSTs the window draft', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(slotFixture, 201));
      const { api } = loadClient();

      await expect(api.createAvailabilityWindow(windowDraft, TOKEN)).resolves.toEqual(slotFixture);

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/me/availability-windows`, {
        method: 'POST',
        body: JSON.stringify(windowDraft),
        headers: JSON_AUTH_HEADERS,
      });
    });

    test('updateAvailabilityWindow PATCHes the URL-encoded window identifier', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(slotFixture));
      const { api } = loadClient();

      await expect(api.updateAvailabilityWindow('slot/one', windowDraft, TOKEN)).resolves.toEqual(
        slotFixture,
      );

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/me/availability-windows/slot%2Fone`, {
        method: 'PATCH',
        body: JSON.stringify(windowDraft),
        headers: JSON_AUTH_HEADERS,
      });
    });

    test('deleteAvailabilityWindow DELETEs the URL-encoded window and resolves on 204', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(undefined, 204));
      const { api } = loadClient();

      await expect(api.deleteAvailabilityWindow('slot/one', TOKEN)).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/me/availability-windows/slot%2Fone`, {
        method: 'DELETE',
        headers: AUTH_HEADERS,
      });
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.headers).not.toHaveProperty('Content-Type');
    });
  });

  describe('logout', () => {
    test('invalidates the server session and resolves to undefined', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(undefined, 204));
      const { api } = loadClient();

      await expect(api.logout(TOKEN, 'refresh-token')).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/auth/sessions/current`, {
        method: 'DELETE',
        // US-06: the refresh token goes too. Denylisting the access token alone
        // would end nothing, since the session could be minted again seconds later.
        body: JSON.stringify({ refreshToken: 'refresh-token' }),
        headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      });
    });

    test('still resolves when the server rejects the sign-out call', async () => {
      fetchMock.mockResolvedValueOnce(errorResponse(500, 'SERVER_ERROR', 'Something went wrong.'));
      const { api } = loadClient();

      await expect(api.logout(TOKEN)).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('still resolves when the network is unreachable', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
      const { api } = loadClient();

      await expect(api.logout(TOKEN)).resolves.toBeUndefined();
    });
  });



  describe('failures that are not a missing route', () => {
    test.each([
      [403, 'FORBIDDEN', 'You do not have access to this counsellor workspace.'],
      [500, 'SERVER_ERROR', 'Something went wrong. Please try again.'],
    ])('a %i rejects and leaves the preview flag down', async (status, code, message) => {
      fetchMock.mockResolvedValueOnce(errorResponse(status, code, message));
      const { api, ApiError } = loadClient();

      const pending = api.listOwnServices('counsellor_maya', TOKEN);

      await expect(pending).rejects.toBeInstanceOf(ApiError);
      await expect(pending).rejects.toMatchObject({ status, body: { code, message } });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('a 403 on the profile route rejects rather than inventing a local profile', async () => {
      fetchMock.mockResolvedValueOnce(errorResponse(403, 'FORBIDDEN', 'Counsellor access required.'));
      const { api } = loadClient();

      await expect(api.getOwnCounsellorProfile(counsellorUser, TOKEN)).rejects.toMatchObject({
        status: 403,
      });
    });

    test('a network error propagates instead of falling back', async () => {
      const networkError = new TypeError('fetch failed');
      fetchMock.mockRejectedValueOnce(networkError);
      const { api } = loadClient();

      await expect(api.listOwnAvailabilityWindows('counsellor_maya', TOKEN)).rejects.toBe(networkError);
    });
  });


  describe('fieldErrors', () => {
    test('returns the field-level map published alongside an ApiError', () => {
      const { ApiError, fieldErrors } = loadClient();
      const error = new ApiError(400, {
        code: 'VALIDATION_ERROR',
        message: 'Check the highlighted fields.',
        fieldErrors: { title: 'Give the service a title.', priceMinor: 'Enter a price.' },
        requestId: 'request-400',
      });

      expect(fieldErrors(error)).toEqual({
        title: 'Give the service a title.',
        priceMinor: 'Enter a price.',
      });
    });

    test('returns an empty map for an ApiError without field errors and for anything else', () => {
      const { ApiError, fieldErrors } = loadClient();

      expect(
        fieldErrors(new ApiError(409, { code: 'SLOT_OVERLAP', message: 'Overlaps.', requestId: 'r' })),
      ).toEqual({});
      expect(fieldErrors(new Error('A local failure.'))).toEqual({});
      expect(fieldErrors('not an error')).toEqual({});
      expect(fieldErrors(undefined)).toEqual({});
      expect(fieldErrors(null)).toEqual({});
    });
  });
});
