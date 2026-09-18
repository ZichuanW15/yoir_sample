import { api } from '@/src/api/client';
import { PayoutStatus } from '@/src/api/types';
import { waitForPayouts } from '@/src/payments/waitForPayouts';

const status = (over: Partial<PayoutStatus>): PayoutStatus => ({
  stripeAccountId: 'acct_1', chargesEnabled: false, payoutsEnabled: false,
  onboardingRequired: true, abn: null, gstRegistered: false, ...over,
});

const pending = status({ chargesEnabled: true });
const ready = status({ chargesEnabled: true, payoutsEnabled: true, onboardingRequired: false });
const noSleep = () => Promise.resolve();

describe('waiting for Stripe to enable payouts', () => {
  afterEach(() => jest.restoreAllMocks());

  test('stops as soon as the counsellor can be paid', async () => {
    const read = jest.spyOn(api, 'getPayoutStatus').mockResolvedValue(ready);

    await expect(waitForPayouts('t', () => {}, { sleep: noSleep })).resolves.toEqual(ready);
    expect(read).toHaveBeenCalledTimes(1);
  });

  test('keeps asking while Stripe is still deciding', async () => {
    // The single read a screen does on focus lands here as often as not, which is
    // why "Payouts pending" used to stay on screen until the person reloaded.
    const read = jest.spyOn(api, 'getPayoutStatus')
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(ready);

    await expect(waitForPayouts('t', () => {}, { sleep: noSleep })).resolves.toEqual(ready);
    expect(read).toHaveBeenCalledTimes(3);
  });

  test('reports every answer, so charges-enabled shows before payouts are', async () => {
    jest.spyOn(api, 'getPayoutStatus')
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(ready);
    const seen: boolean[] = [];

    await waitForPayouts('t', (s) => seen.push(s.chargesEnabled), { sleep: noSleep });

    expect(seen).toEqual([true, true]);
  });

  test('a blip on one poll does not end the wait', async () => {
    jest.spyOn(api, 'getPayoutStatus')
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(ready);

    await expect(waitForPayouts('t', () => {}, { sleep: noSleep })).resolves.toEqual(ready);
  });

  test('gives up after the window rather than polling forever', async () => {
    const read = jest.spyOn(api, 'getPayoutStatus').mockResolvedValue(pending);

    // Not a failure: Stripe may genuinely still be verifying.
    await expect(waitForPayouts('t', () => {}, { attempts: 4, sleep: noSleep })).resolves.toBeNull();
    expect(read).toHaveBeenCalledTimes(4);
  });

  test('waits between attempts on its own timer, with no options injected', async () => {
    // Exercises the real sleep and cancelled defaults rather than substitutes. Fake
    // timers let the genuine delay run without the suite actually waiting for it.
    jest.useFakeTimers();
    jest.spyOn(api, 'getPayoutStatus')
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(ready);

    const inFlight = waitForPayouts('t', () => {});
    await jest.advanceTimersByTimeAsync(5_000);

    await expect(inFlight).resolves.toEqual(ready);
    jest.useRealTimers();
  });

  test('stops immediately when the screen has gone away', async () => {
    const read = jest.spyOn(api, 'getPayoutStatus').mockResolvedValue(pending);

    await expect(
      waitForPayouts('t', () => {}, { sleep: noSleep, cancelled: () => true }),
    ).resolves.toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
});
