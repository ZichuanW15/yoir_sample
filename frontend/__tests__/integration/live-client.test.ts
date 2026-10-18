/**
 * Opt-in black-box integration test for the real TypeScript API client.
 *
 * Start a separately managed backend with fresh seeded test data, then run:
 *
 *   LIVE_API_BASE_URL=http://127.0.0.1:8000/api/v1 npm run test:client:live
 *
 * The normal Jest suite skips this test when LIVE_API_BASE_URL is absent. The
 * dedicated npm script fails before Jest starts if the variable is missing, so
 * an explicitly requested live run cannot be reported as a skipped success.
 */

type ClientModule = typeof import('@/src/api/client');
type Window = import('@/src/api/types').AvailabilityWindow;

// PostgreSQL may serialize the same instant with the database session's offset.
// Compare instants, not the spelling of an otherwise valid ISO timestamp.
const windowInstants = (slot: Window) => ({
  ...slot, startsAt: new Date(slot.startsAt).getTime(), endsAt: new Date(slot.endsAt).getTime(),
});

const liveBaseUrl = process.env.LIVE_API_BASE_URL?.replace(/\/$/, '');
const runWhenLive = liveBaseUrl ? test : test.skip;
const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
const originalDemoFlag = process.env.EXPO_PUBLIC_USE_DEMO_API;

function restoreEnvironment(): void {
  if (originalApiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = originalApiUrl;

  if (originalDemoFlag === undefined) delete process.env.EXPO_PUBLIC_USE_DEMO_API;
  else process.env.EXPO_PUBLIC_USE_DEMO_API = originalDemoFlag;
}

describe('TypeScript client to live backend', () => {
  beforeAll(() => {
    if (liveBaseUrl && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(liveBaseUrl).hostname)) {
      throw new Error('These write journeys require a disposable loopback QA backend.');
    }
  });
  afterAll(() => {
    restoreEnvironment();
    jest.resetModules();
  });

  runWhenLive(
    'registers, authenticates, discovers a slot, creates an order and completes stub payment',
    async () => {
      if (!liveBaseUrl) throw new Error('LIVE_API_BASE_URL is required');
      if (typeof fetch !== 'function') {
        throw new Error('The live TypeScript client test requires a runtime with global fetch.');
      }

      process.env.EXPO_PUBLIC_API_URL = liveBaseUrl;
      process.env.EXPO_PUBLIC_USE_DEMO_API = 'false';
      jest.resetModules();

      const { api } = require('@/src/api/client') as ClientModule;
      const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const email = `qa-client-live-${unique}@example.com`;
      const password = 'correct-password';


      const registered = await api.register({
        name: 'QA TypeScript Client',
        email,
        password,
        passwordConfirmation: password,
        role: 'job_seeker',
      });
      expect(registered).toMatchObject({ email, role: 'job_seeker' });

      const unverified = await api.login(email, password);
      expect(unverified.user).toMatchObject({ id: registered.id, email, role: 'job_seeker', emailVerified: false });
      const session = await api.login('sam@example.com', 'password123');
      expect(session.accessToken).toEqual(expect.any(String));
      expect(session.accessToken).not.toBe('demo-access-token');
      expect(session.user).toMatchObject({ email: 'sam@example.com', role: 'job_seeker', emailVerified: true });

      const services = await api.listServices();
      expect(services.length).toBeGreaterThan(0);
      let service = await api.getService(services[0].id);
      let slots = await api.listServiceSlots(service.id, service.modalities[0]);
      for (const listedService of services.slice(1)) {
        if (slots.length > 0) break;
        service = await api.getService(listedService.id);
        slots = await api.listServiceSlots(service.id, service.modalities[0]);
      }

      expect(service).toMatchObject({ active: true });
      expect(service.modalities.length).toBeGreaterThan(0);
      expect(slots.length).toBeGreaterThan(0);
      const slot = slots[0];
      expect(new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()).toBe(service.durationMinutes * 60_000);
      await expect(api.createOrder(service.id, slot.startsAt, service.modalities[0], 'Australia/Melbourne', null, unverified.accessToken)).rejects.toMatchObject({ status: 403 });

      const order = await api.createOrder(
        service.id,
        slot.startsAt,
        service.modalities[0],
        'Australia/Melbourne',
        null,
        session.accessToken,
      );
      expect(order).toMatchObject({
        serviceId: service.id,
        windowId: expect.any(String),
        status: 'awaiting_payment',
        paymentStatus: 'not_started',
        amountMinor: service.priceMinor,
        currency: service.currency,
      });

      const confirmation = await api.completeStubPayment(order, session.accessToken);
      expect(confirmation).toMatchObject({
        paymentStatus: 'paid',
        booking: {
          orderId: order.id,
          serviceId: service.id,
          status: 'confirmed',
          paymentStatus: 'paid',
        },
      });
      expect(new Date(confirmation.booking.startsAt).getTime()).toBe(new Date(slot.startsAt).getTime());
      expect(confirmation.booking).toMatchObject({ modality: service.modalities[0], timezone: 'Australia/Melbourne' });
      expect((await api.listServiceSlots(service.id, service.modalities[0])).map((item) => new Date(item.startsAt).getTime())).not.toContain(new Date(slot.startsAt).getTime());
      // A paid booking survives repeated payment confirmation without a second booking.
      expect((await api.completeStubPayment(order, session.accessToken)).booking.id).toBe(confirmation.booking.id);
      await api.logout(session.accessToken, session.refreshToken);
      const replay = await fetch(`${liveBaseUrl}/orders/${order.id}/payments/stub`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      expect(replay.status).toBe(401);
      await api.logout(unverified.accessToken, unverified.refreshToken);
    },
    30_000,
  );

  runWhenLive('counsellor eligibility, real service persistence and availability create/read/update/delete', async () => {
    if (!liveBaseUrl) throw new Error('LIVE_API_BASE_URL is required');
    process.env.EXPO_PUBLIC_API_URL = liveBaseUrl;
    process.env.EXPO_PUBLIC_USE_DEMO_API = 'false';
    jest.resetModules();
    const { api } = require('@/src/api/client') as ClientModule;
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const email = `qa-counsellor-live-${unique}@example.com`;
    const password = 'correct-password';
    const registered = await api.register({ name: 'QA Pending Counsellor', email, password, passwordConfirmation: password, role: 'counsellor' });
    const pending = await api.login(email, password);
    expect(pending.user).toMatchObject({ id: registered.id, role: 'counsellor' });
    expect(await api.listOwnServices(registered.id, pending.accessToken)).toEqual([]);
    const draft = {
      title: `QA live service ${unique}`, description: 'A real persisted counselling service for isolated integration QA.',
      priceMinor: 7050, durationMinutes: 60, currency: 'AUD' as const, modalities: ['online', 'in_person'] as ('online' | 'in_person')[],
      location: { state: 'VIC', cityOrRegion: 'Melbourne' },
    };
    await expect(api.createService(registered.id, draft, pending.accessToken)).rejects.toMatchObject({ status: 403 });
    expect(await api.listOwnServices(registered.id, pending.accessToken)).toEqual([]);

    // Public demo seed accounts are used only in the disposable QA database.
    const owner = await api.login('maya@example.com', 'password123');
    const outsider = await api.login('jordan@example.com', 'password123');
    const service = await api.createService(owner.user.id, draft, owner.accessToken);
    expect(service).toMatchObject({ ...draft, counsellor: { id: owner.user.id }, active: true });
    expect(await api.getService(service.id)).toMatchObject({ ...draft, id: service.id });
    expect(await api.listOwnServices(owner.user.id, owner.accessToken)).toContainEqual(service);
    expect((await api.listOwnServices(outsider.user.id, outsider.accessToken)).map((item) => item.id)).not.toContain(service.id);

    // A counsellor window is shared by all their services, not owned by this service.
    // Align to the API's quarter-hour grid and stay outside the seed's fortnight.
    const start = Math.ceil(Date.now() / 900_000) * 900_000 + 30 * 24 * 60 * 60_000;
    const windowDraft = {
      startsAt: new Date(start).toISOString(), endsAt: new Date(start + 60 * 60_000).toISOString(),
      modalities: ['online'] as const,
    };
    const created = await api.createAvailabilityWindow({ ...windowDraft, modalities: ['online'] }, owner.accessToken);
    expect(created).toMatchObject({ modalities: ['online'], hasBookings: false });
    expect(new Date(created.startsAt).getTime()).toBe(start);
    expect((await api.listOwnAvailabilityWindows(owner.user.id, owner.accessToken)).map(windowInstants)).toContainEqual(windowInstants(created));
    const atStart = async (instant: number) => (await api.listServiceSlots(service.id, 'online'))
      .filter(item => new Date(item.startsAt).getTime() === instant);
    expect(await atStart(start)).toHaveLength(1);
    await expect(api.deleteAvailabilityWindow(created.id, outsider.accessToken)).rejects.toMatchObject({ status: 404 });
    expect(await atStart(start)).toHaveLength(1);
    const updated = await api.updateAvailabilityWindow(created.id, {
      startsAt: new Date(start + 2 * 60 * 60_000).toISOString(),
      endsAt: new Date(start + 3 * 60 * 60_000).toISOString(),
    }, owner.accessToken);
    expect(updated.id).toBe(created.id);
    expect(new Date(updated.startsAt).getTime()).toBe(start + 2 * 60 * 60_000);
    expect(await atStart(start)).toEqual([]);
    expect(await atStart(start + 2 * 60 * 60_000)).toHaveLength(1);
    await api.deleteAvailabilityWindow(created.id, owner.accessToken);
    expect(await atStart(start + 2 * 60 * 60_000)).toEqual([]);
    expect((await api.listOwnAvailabilityWindows(owner.user.id, owner.accessToken)).map(item => item.id)).not.toContain(created.id);
    for (const session of [pending, owner, outsider]) {
      await api.logout(session.accessToken, session.refreshToken);
      await expect(api.listOwnServices(session.user.id, session.accessToken)).rejects.toMatchObject({ status: 401 });
    }
  }, 30_000);
});
