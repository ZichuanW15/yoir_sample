import {
  demoCompletePayment,
  demoCreateOrder,
  demoGetService,
  demoListServices,
  demoListSlots,
  demoLogin,
  demoRegister,
} from '@/src/api/demo';

async function advanceDemoDelay() {
  await jest.advanceTimersByTimeAsync(300);
}

describe('local demo API', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-28T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('creates a job-seeker session without contacting a server', async () => {
    const pending = demoLogin('alex@example.com', 'correct-password');
    await advanceDemoDelay();

    await expect(pending).resolves.toMatchObject({
      accessToken: 'demo-access-token',
      expiresAt: '2026-08-28T01:00:00.300Z',
      user: {
        id: 'demo-user',
        name: 'Demo Job Seeker',
        email: 'alex@example.com',
        role: 'job_seeker',
      },
    });
  });

  test('rejects missing demo credentials', async () => {
    const assertion = expect(demoLogin('', '')).rejects.toThrow(
      'Enter your email and password.',
    );
    await advanceDemoDelay();

    await assertion;
  });

  test('returns the public role selected during demo registration', async () => {
    const pending = demoRegister({
      name: 'Taylor Lee',
      email: 'taylor@example.com',
      password: 'correct-password',
      passwordConfirmation: 'correct-password',
      role: 'counsellor',
    });
    await advanceDemoDelay();

    await expect(pending).resolves.toEqual({
      id: 'demo-new-user',
      name: 'Taylor Lee',
      email: 'taylor@example.com',
      role: 'counsellor',
    });
  });

  test('lists all services and filters by title or counsellor', async () => {
    const allPending = demoListServices();
    await advanceDemoDelay();
    const all = await allPending;
    expect(all).toHaveLength(6);

    const titlePending = demoListServices('  RESUME  ');
    await advanceDemoDelay();
    await expect(titlePending).resolves.toEqual([
      expect.objectContaining({ id: 'svc_resume', title: 'Resume and cover letter review' }),
    ]);

    const counsellorPending = demoListServices('maya chen');
    await advanceDemoDelay();
    await expect(counsellorPending).resolves.toEqual([
      expect.objectContaining({ id: 'svc_interview' }),
    ]);
  });

  test('gets one service and rejects an unknown service', async () => {
    const foundPending = demoGetService('svc_interview');
    await advanceDemoDelay();
    await expect(foundPending).resolves.toMatchObject({
      id: 'svc_interview',
      priceMinor: 9500,
      modalities: ['online'],
    });

    const missingAssertion = expect(demoGetService('missing')).rejects.toThrow(
      'Service not found.',
    );
    await advanceDemoDelay();
    await missingAssertion;
  });

  test('completes the executable demo booking and payment flow', async () => {
    const slotsPending = demoListSlots('svc_resume');
    await advanceDemoDelay();
    const slots = await slotsPending;
    expect(slots).toHaveLength(3);
    expect(slots[0]).toMatchObject({ serviceId: 'svc_resume', status: 'open' });

    const orderPending = demoCreateOrder('svc_resume', slots[0].id);
    await advanceDemoDelay();
    const order = await orderPending;
    expect(order).toMatchObject({
      serviceId: 'svc_resume',
      slotId: slots[0].id,
      amountMinor: 7000,
      currency: 'AUD',
      status: 'awaiting_payment',
      paymentStatus: 'not_started',
    });

    const paymentPending = demoCompletePayment(order);
    await advanceDemoDelay();
    await expect(paymentPending).resolves.toMatchObject({
      paymentStatus: 'paid',
      booking: {
        orderId: order.id,
        serviceId: 'svc_resume',
        serviceTitle: 'Resume and cover letter review',
        startsAt: slots[0].startsAt,
        endsAt: slots[0].endsAt,
        timezone: 'Australia/Sydney',
        modality: 'online',
        status: 'confirmed',
        paymentStatus: 'paid',
      },
    });
  });

  test('returns no slots for an unknown service and rejects its order', async () => {
    const slotsPending = demoListSlots('missing');
    await advanceDemoDelay();
    await expect(slotsPending).resolves.toEqual([]);

    const orderAssertion = expect(demoCreateOrder('missing', 'slot-1')).rejects.toThrow(
      'Service not found.',
    );
    await advanceDemoDelay();
    await orderAssertion;
  });
});
