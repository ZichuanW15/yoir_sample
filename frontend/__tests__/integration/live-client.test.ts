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

      const session = await api.login(email, password);
      expect(session.accessToken).toEqual(expect.any(String));
      expect(session.accessToken).not.toBe('demo-access-token');
      expect(session.user).toMatchObject({ id: registered.id, email, role: 'job_seeker' });

      const services = await api.listServices();
      expect(services.length).toBeGreaterThan(0);
      let service = await api.getService(services[0].id);
      let slots = await api.listServiceSlots(service.id);
      for (const listedService of services.slice(1)) {
        if (slots.length > 0) break;
        service = await api.getService(listedService.id);
        slots = await api.listServiceSlots(service.id);
      }

      expect(service).toMatchObject({ active: true });
      expect(service.modalities.length).toBeGreaterThan(0);
      expect(slots.length).toBeGreaterThan(0);
      const slot = slots[0];
      expect(slot).toMatchObject({ serviceId: service.id, status: 'open' });

      const order = await api.createOrder(
        service.id,
        slot.startsAt,
        service.modalities[0],
        'Australia/Melbourne',
        session.accessToken,
      );
      expect(order).toMatchObject({
        serviceId: service.id,
        slotId: slot.startsAt,
        status: 'awaiting_payment',
        paymentStatus: 'not_started',
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
    },
    30_000,
  );
});
