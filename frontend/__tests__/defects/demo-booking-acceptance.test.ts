import { demoCreateOrder, demoCreateService, demoCreateSlot, demoListSlots, resetDemoState } from '@/src/api/demo';

describe('demo booking integrity must not teach invalid booking behaviour', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-28T00:00:00Z'));
    resetDemoState();
  });
  afterEach(() => { jest.useRealTimers(); });

  test('F09 / QA #118: an unknown demo slot cannot produce an order', async () => {
    const assertion = expect(demoCreateOrder('svc_interview', 'missing-slot')).rejects.toMatchObject({ status: 404 });
    await Promise.all([assertion, jest.advanceTimersByTimeAsync(300)]);
  });

  test('F10 / QA #121: a demo order cannot reserve another service’s slot', async () => {
    const [slots] = await Promise.all([demoListSlots('svc_resume'), jest.advanceTimersByTimeAsync(300)]);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].serviceId).toBe('svc_resume');
    const assertion = expect(demoCreateOrder('svc_interview', slots[0].id)).rejects.toThrow();
    await Promise.all([assertion, jest.advanceTimersByTimeAsync(300)]);
  });

  test('F11 / QA #121 #145: demo availability rejects overlap across one counsellor’s services', async () => {
    const [slots] = await Promise.all([demoListSlots('svc_interview'), jest.advanceTimersByTimeAsync(300)]);
    expect(slots.length).toBeGreaterThan(0);
    const [second] = await Promise.all([demoCreateService('counsellor_maya', {
      title: 'Second service', description: 'Same counsellor, shared calendar.', priceMinor: 9500,
      currency: 'AUD', modalities: ['online'], location: null,
    }), jest.advanceTimersByTimeAsync(300)]);
    expect(second.counsellor.id).toBe('counsellor_maya');
    const assertion = expect(demoCreateSlot({
      serviceId: second.id, startsAt: slots[0].startsAt, endsAt: slots[0].endsAt,
    })).rejects.toMatchObject({ status: 409 });
    await Promise.all([assertion, jest.advanceTimersByTimeAsync(300)]);
  });
});
