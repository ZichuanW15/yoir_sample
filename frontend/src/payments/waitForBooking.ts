import { api } from '@/src/api/client';
import { Booking } from '@/src/api/types';

/**
 * Wait for the backend to confirm the booking after PaymentSheet reports success.
 *
 * PaymentSheet succeeding only means Stripe accepted the card. The booking is
 * created when Stripe's webhook reaches the backend, which is usually immediate but
 * is a separate network hop and can lag. So the app asks the server rather than
 * assuming, and never writes a confirmed booking of its own.
 *
 * Returns the booking, or null if it has not appeared within the timeout — which is
 * not a failure. The payment stands and the webhook will still land; the screen says
 * the payment went through and that confirmation is following.
 */
export async function waitForBooking(
  orderId: string,
  accessToken: string,
  options: { attempts?: number; intervalMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<Booking | null> {
  const attempts = options.attempts ?? 10;
  const intervalMs = options.intervalMs ?? 900;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const status = await api.getOrderStatus(orderId, accessToken);
      if (status.booking) return status.booking;
      // The slot was taken while the payment was in flight, so the backend has
      // already refunded. Polling on would never succeed.
      if (status.order.status === 'refunded_slot_taken') return null;
    } catch {
      // A blip on one poll is not an answer; keep asking until the attempts run out.
    }
    if (attempt < attempts - 1) await sleep(intervalMs);
  }
  return null;
}
