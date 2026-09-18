import { api } from '@/src/api/client';
import { Booking, OrderStatusResponse } from '@/src/api/types';
import { waitForBooking } from '@/src/payments/waitForBooking';

const booking: Booking = {
  id: 'booking-1', orderId: 'order-1', serviceId: 'service-1', serviceTitle: 'Interview coaching',
  startsAt: '2026-10-01T09:00:00Z', endsAt: '2026-10-01T10:00:00Z', timezone: 'Australia/Melbourne',
  modality: 'online', status: 'confirmed', paymentStatus: 'paid',
};

const awaiting: OrderStatusResponse = {
  order: {
    id: 'order-1', serviceId: 'service-1', windowId: 'window-1',
    startsAt: '2026-09-01T00:00:00.000Z',
    endsAt: '2026-09-01T01:00:00.000Z', amountMinor: 9500,
    currency: 'AUD', status: 'awaiting_payment', paymentStatus: 'not_started',
  },
  booking: null,
};

const confirmed: OrderStatusResponse = {
  order: { ...awaiting.order, status: 'confirmed', paymentStatus: 'paid' },
  booking,
};

/** No real waiting; the test drives the clock so the polling logic is what is measured. */
const noSleep = () => Promise.resolve();

describe('waiting for the backend to confirm a paid booking', () => {
  afterEach(() => jest.restoreAllMocks());

  test('returns the booking as soon as the webhook has been processed', async () => {
    const status = jest.spyOn(api, 'getOrderStatus').mockResolvedValue(confirmed);

    await expect(waitForBooking('order-1', 'token', { sleep: noSleep })).resolves.toEqual(booking);
    expect(status).toHaveBeenCalledTimes(1);
  });

  test('keeps asking while the webhook is still in flight', async () => {
    const status = jest.spyOn(api, 'getOrderStatus')
      .mockResolvedValueOnce(awaiting)
      .mockResolvedValueOnce(awaiting)
      .mockResolvedValueOnce(confirmed);

    await expect(waitForBooking('order-1', 'token', { sleep: noSleep })).resolves.toEqual(booking);
    expect(status).toHaveBeenCalledTimes(3);
  });

  test('a blip on one poll does not end the wait', async () => {
    jest.spyOn(api, 'getOrderStatus')
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(confirmed);

    await expect(waitForBooking('order-1', 'token', { sleep: noSleep })).resolves.toEqual(booking);
  });

  test('stops immediately once the backend has refunded a slot someone else took', async () => {
    const status = jest.spyOn(api, 'getOrderStatus').mockResolvedValue({
      order: { ...awaiting.order, status: 'refunded_slot_taken', paymentStatus: 'refunded' },
      booking: null,
    });

    // Polling on would never succeed, and the screen has its own message for this.
    await expect(waitForBooking('order-1', 'token', { sleep: noSleep })).resolves.toBeNull();
    expect(status).toHaveBeenCalledTimes(1);
  });

  test('waits between attempts on its own timer, with no options injected', async () => {
    // Exercises the real sleep default rather than a substitute. Fake timers let the
    // genuine delay run without the suite actually waiting for it.
    jest.useFakeTimers();
    jest.spyOn(api, 'getOrderStatus')
      .mockResolvedValueOnce(awaiting)
      .mockResolvedValueOnce(confirmed);

    const inFlight = waitForBooking('order-1', 'token');
    await jest.advanceTimersByTimeAsync(2_000);

    await expect(inFlight).resolves.toEqual(booking);
    jest.useRealTimers();
  });

  test('gives up after the configured attempts rather than hanging the screen', async () => {
    const status = jest.spyOn(api, 'getOrderStatus').mockResolvedValue(awaiting);

    await expect(
      waitForBooking('order-1', 'token', { attempts: 4, sleep: noSleep }),
    ).resolves.toBeNull();
    expect(status).toHaveBeenCalledTimes(4);
  });
});
