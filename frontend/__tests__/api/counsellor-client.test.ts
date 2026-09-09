import {
  CounsellorProfileUpdate,
  ServiceDraft,
  SlotDraft,
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
  currency: 'AUD',
  modalities: ['online'],
  location: null,
};

const slotDraft: SlotDraft = {
  serviceId: serviceFixture.id,
  startsAt: '2026-09-09T00:00:00.000Z',
  endsAt: '2026-09-09T01:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
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
      const { api, preview } = loadClient();

      await expect(api.getOwnCounsellorProfile(counsellorUser, TOKEN)).resolves.toEqual(
        counsellorProfileFixture,
      );

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/counsellors/counsellor-1`, {
        headers: AUTH_HEADERS,
      });
      expect(preview.active).toBe(false);
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

    test('listOwnAvailabilitySlots reads the counsellor-scoped slot collection', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([slotFixture]));
      const { api } = loadClient();

      await expect(api.listOwnAvailabilitySlots(counsellorUser.id, TOKEN)).resolves.toEqual([
        slotFixture,
      ]);

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/me/availability-slots`, {
        headers: AUTH_HEADERS,
      });
    });

    test('createAvailabilitySlot POSTs the slot draft', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(slotFixture, 201));
      const { api } = loadClient();

      await expect(api.createAvailabilitySlot(slotDraft, TOKEN)).resolves.toEqual(slotFixture);

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/me/availability-slots`, {
        method: 'POST',
        body: JSON.stringify(slotDraft),
        headers: JSON_AUTH_HEADERS,
      });
    });

    test('updateAvailabilitySlot PATCHes the URL-encoded slot identifier', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(slotFixture));
      const { api } = loadClient();

      await expect(api.updateAvailabilitySlot('slot/one', slotDraft, TOKEN)).resolves.toEqual(
        slotFixture,
      );

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/me/availability-slots/slot%2Fone`, {
        method: 'PATCH',
        body: JSON.stringify(slotDraft),
        headers: JSON_AUTH_HEADERS,
      });
    });

    test('deleteAvailabilitySlot DELETEs the URL-encoded slot and resolves on 204', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(undefined, 204));
      const { api } = loadClient();

      await expect(api.deleteAvailabilitySlot('slot/one', TOKEN)).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/me/availability-slots/slot%2Fone`, {
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

      await expect(api.logout(TOKEN)).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/auth/sessions/current`, {
        method: 'DELETE',
        headers: AUTH_HEADERS,
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

  describe('preview fallback to the local store', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-08-28T00:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test.each([404, 405, 501])(
      'a %i from an undeployed route serves local data and raises the preview flag',
      async (status) => {
        fetchMock.mockResolvedValueOnce(status === 404 ? unroutedResponse() : errorResponse(status, 'NOT_IMPLEMENTED'));
        const { api, preview } = loadClient();
        expect(preview.active).toBe(false);

        const services = await settleLocal(api.listOwnServices('counsellor_maya', TOKEN));

        expect(fetchMock).toHaveBeenCalledWith(`${BASE}/me/services`, { headers: AUTH_HEADERS });
        expect(services).toEqual([expect.objectContaining({ id: 'svc_interview' })]);
        expect(preview.active).toBe(true);
      },
    );

    test('getOwnCounsellorProfile falls back to a local profile seeded from the signed-in user', async () => {
      fetchMock.mockResolvedValueOnce(unroutedResponse());
      const { api, preview } = loadClient();

      const profile = await settleLocal(api.getOwnCounsellorProfile(counsellorUser, TOKEN));

      expect(profile).toMatchObject({
        id: counsellorUser.id,
        displayName: counsellorUser.name,
        verificationStatus: 'pending',
      });
      expect(preview.active).toBe(true);
    });

    test('updateOwnCounsellorProfile falls back to a local write that is readable again', async () => {
      fetchMock.mockResolvedValue(unroutedResponse());
      const { api, preview } = loadClient();

      await settleLocal(api.getOwnCounsellorProfile(counsellorUser, TOKEN));
      const updated = await settleLocal(
        api.updateOwnCounsellorProfile(
          counsellorUser.id,
          { ...profileUpdate, introduction: 'Updated locally.' },
          TOKEN,
        ),
      );

      expect(updated.introduction).toBe('Updated locally.');
      expect(updated.baseLocation).toEqual({ state: 'VIC', cityOrRegion: 'Melbourne' });
      expect(preview.active).toBe(true);
    });

    test('the slot lifecycle falls back locally: create, list, update and delete', async () => {
      fetchMock.mockResolvedValue(errorResponse(501, 'NOT_IMPLEMENTED', 'Route not implemented.'));
      const { api, preview } = loadClient();

      const created = await settleLocal(
        api.createAvailabilitySlot(
          { serviceId: 'svc_interview', startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-10-01T01:00:00.000Z' },
          TOKEN,
        ),
      );
      expect(created).toMatchObject({ serviceId: 'svc_interview', status: 'open' });

      const listed = await settleLocal(api.listOwnAvailabilitySlots('counsellor_maya', TOKEN));
      expect(listed.map((slot) => slot.id)).toContain(created.id);

      const updated = await settleLocal(
        api.updateAvailabilitySlot(
          created.id,
          { serviceId: 'svc_interview', startsAt: '2026-10-02T00:00:00.000Z', endsAt: '2026-10-02T01:00:00.000Z' },
          TOKEN,
        ),
      );
      expect(updated.startsAt).toBe('2026-10-02T00:00:00.000Z');

      await expect(settleLocal(api.deleteAvailabilitySlot(created.id, TOKEN))).resolves.toBeUndefined();

      const remaining = await settleLocal(api.listOwnAvailabilitySlots('counsellor_maya', TOKEN));
      expect(remaining.map((slot) => slot.id)).not.toContain(created.id);
      expect(preview.active).toBe(true);
    });

    test('createService falls back locally and the new service appears in the local list', async () => {
      fetchMock.mockResolvedValue(errorResponse(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.'));
      const { api, preview } = loadClient();

      const created = await settleLocal(api.createService('counsellor_maya', serviceDraft, TOKEN));
      expect(created).toMatchObject({ title: serviceDraft.title, active: true });
      expect(created.counsellor.id).toBe('counsellor_maya');

      const services = await settleLocal(api.listOwnServices('counsellor_maya', TOKEN));
      expect(services.map((service) => service.id)).toContain(created.id);
      expect(preview.active).toBe(true);
    });

    test('a local validation failure still surfaces as a rejection behind the fallback', async () => {
      fetchMock.mockResolvedValue(unroutedResponse());
      const { api, preview } = loadClient();

      const pending = api.createAvailabilitySlot(
        { serviceId: 'svc_interview', startsAt: '2026-10-03T02:00:00.000Z', endsAt: '2026-10-03T01:00:00.000Z' },
        TOKEN,
      );
      const rejection = pending.catch((error: unknown) => error);
      await jest.advanceTimersByTimeAsync(300);

      await expect(rejection).resolves.toMatchObject({
        status: 400,
        body: { code: 'VALIDATION_ERROR', fieldErrors: { endsAt: 'Choose an end time after the start time.' } },
      });
      expect(preview.active).toBe(true);
    });

    test('a successful live call after a fallback lowers the preview flag again', async () => {
      fetchMock
        .mockResolvedValueOnce(unroutedResponse())
        .mockResolvedValueOnce(jsonResponse([serviceFixture]));
      const { api, preview } = loadClient();

      await settleLocal(api.listOwnServices('counsellor_maya', TOKEN));
      expect(preview.active).toBe(true);

      await expect(api.listOwnServices('counsellor_maya', TOKEN)).resolves.toEqual([serviceFixture]);
      expect(preview.active).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('a missing resource is not a missing route', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-08-28T00:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('a 404 from a route that has shipped rejects instead of inventing a profile', async () => {
      fetchMock.mockResolvedValueOnce(errorResponse(404, 'NOT_FOUND', 'This counsellor profile is unavailable.'));
      const { api, preview, undeployedRoutes, ApiError } = loadClient();
      // The backend has deployed this route, so a 404 is a genuinely missing resource.
      undeployedRoutes.delete('counsellorProfile');

      const pending = api.getOwnCounsellorProfile(counsellorUser, TOKEN);

      await expect(pending).rejects.toBeInstanceOf(ApiError);
      await expect(pending).rejects.toMatchObject({ status: 404, body: { code: 'NOT_FOUND' } });
      expect(preview.active).toBe(false);
    });

    test('a 404 from a route that has shipped never consults local slot state', async () => {
      fetchMock.mockResolvedValueOnce(errorResponse(404, 'NOT_FOUND', 'This availability slot no longer exists.'));
      const { api, preview, undeployedRoutes } = loadClient();
      undeployedRoutes.delete('availability');

      await expect(api.deleteAvailabilitySlot('slot-1', TOKEN)).rejects.toMatchObject({
        status: 404,
        body: { code: 'NOT_FOUND' },
      });
      expect(preview.active).toBe(false);
    });

    test('a 501 falls back even from a route that has shipped', async () => {
      fetchMock.mockResolvedValueOnce(errorResponse(501, 'NOT_IMPLEMENTED', 'Route not implemented.'));
      const { api, preview, undeployedRoutes } = loadClient();
      undeployedRoutes.delete('ownServices');

      const services = await settleLocal(api.listOwnServices('counsellor_maya', TOKEN));

      expect(services).toEqual([expect.objectContaining({ id: 'svc_interview' })]);
      expect(preview.active).toBe(true);
    });

    test('a live success on one route does not clear the preview flag raised by another', async () => {
      fetchMock
        .mockResolvedValueOnce(unroutedResponse())
        .mockResolvedValueOnce(jsonResponse([slotFixture]));
      const { api, preview } = loadClient();

      await settleLocal(api.listOwnServices('counsellor_maya', TOKEN));
      expect(preview.routes.has('ownServices')).toBe(true);

      await expect(api.listOwnAvailabilitySlots('counsellor_maya', TOKEN)).resolves.toEqual([slotFixture]);

      expect(preview.active).toBe(true);
      expect(preview.routes.has('ownServices')).toBe(true);
      expect(preview.routes.has('availability')).toBe(false);
    });
  });

  describe('failures that are not a missing route', () => {
    test.each([
      [403, 'FORBIDDEN', 'You do not have access to this counsellor workspace.'],
      [500, 'SERVER_ERROR', 'Something went wrong. Please try again.'],
    ])('a %i rejects and leaves the preview flag down', async (status, code, message) => {
      fetchMock.mockResolvedValueOnce(errorResponse(status, code, message));
      const { api, preview, ApiError } = loadClient();

      const pending = api.listOwnServices('counsellor_maya', TOKEN);

      await expect(pending).rejects.toBeInstanceOf(ApiError);
      await expect(pending).rejects.toMatchObject({ status, body: { code, message } });
      expect(preview.active).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('a 403 on the profile route rejects rather than inventing a local profile', async () => {
      fetchMock.mockResolvedValueOnce(errorResponse(403, 'FORBIDDEN', 'Counsellor access required.'));
      const { api, preview } = loadClient();

      await expect(api.getOwnCounsellorProfile(counsellorUser, TOKEN)).rejects.toMatchObject({
        status: 403,
      });
      expect(preview.active).toBe(false);
    });

    test('a network error propagates instead of falling back', async () => {
      const networkError = new TypeError('fetch failed');
      fetchMock.mockRejectedValueOnce(networkError);
      const { api, preview } = loadClient();

      await expect(api.listOwnAvailabilitySlots('counsellor_maya', TOKEN)).rejects.toBe(networkError);
      expect(preview.active).toBe(false);
    });
  });

  describe('demo mode', () => {
    test('every counsellor operation stays local and no request is issued', async () => {
      jest.useFakeTimers();
      try {
        jest.setSystemTime(new Date('2026-08-28T00:00:00.000Z'));
        process.env.EXPO_PUBLIC_USE_DEMO_API = 'true';
        jest.resetModules();
        const { api, isDemoApi, preview } = loadClient();

        expect(isDemoApi).toBe(true);

        const demoUser: User = {
          id: 'counsellor_maya',
          name: 'Maya Chen',
          email: 'maya@yoir.test',
          role: 'counsellor',
        };

        const profile = await settleLocal(api.getOwnCounsellorProfile(demoUser, 'ignored-demo-token'));
        expect(profile).toMatchObject({ id: 'counsellor_maya', displayName: 'Maya Chen' });

        const updated = await settleLocal(
          api.updateOwnCounsellorProfile(
            demoUser.id,
            { ...profileUpdate, introduction: 'Demo introduction.' },
            'ignored-demo-token',
          ),
        );
        expect(updated.introduction).toBe('Demo introduction.');

        const owned = await settleLocal(api.listOwnServices(demoUser.id, 'ignored-demo-token'));
        expect(owned).toEqual([expect.objectContaining({ id: 'svc_interview' })]);

        const created = await settleLocal(
          api.createService(demoUser.id, serviceDraft, 'ignored-demo-token'),
        );
        expect(created.counsellor.id).toBe('counsellor_maya');

        const slots = await settleLocal(
          api.listOwnAvailabilitySlots(demoUser.id, 'ignored-demo-token'),
        );
        expect(slots.length).toBeGreaterThan(0);

        const slot = await settleLocal(
          api.createAvailabilitySlot(
            { serviceId: created.id, startsAt: '2026-10-05T00:00:00.000Z', endsAt: '2026-10-05T01:00:00.000Z' },
            'ignored-demo-token',
          ),
        );
        expect(slot).toMatchObject({ serviceId: created.id, status: 'open' });

        const movedSlot = await settleLocal(
          api.updateAvailabilitySlot(
            slot.id,
            { serviceId: created.id, startsAt: '2026-10-05T02:00:00.000Z', endsAt: '2026-10-05T03:00:00.000Z' },
            'ignored-demo-token',
          ),
        );
        expect(movedSlot.endsAt).toBe('2026-10-05T03:00:00.000Z');

        await expect(
          settleLocal(api.deleteAvailabilitySlot(slot.id, 'ignored-demo-token')),
        ).resolves.toBeUndefined();

        expect(fetchMock).not.toHaveBeenCalled();
        expect(preview.active).toBe(false);
      } finally {
        jest.useRealTimers();
      }
    });

    test('logout stays local in demo mode', async () => {
      jest.useFakeTimers();
      try {
        process.env.EXPO_PUBLIC_USE_DEMO_API = 'true';
        jest.resetModules();
        const { api } = loadClient();

        await expect(settleLocal(api.logout('ignored-demo-token'))).resolves.toBeUndefined();
        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
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
