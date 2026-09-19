import { api } from '@/src/api/client';
import { PayoutStatus } from '@/src/api/types';

/**
 * Watch payout readiness until Stripe says the counsellor can be paid.
 *
 * Readiness is not something the app decides or can observe at the moment someone
 * returns from onboarding. Stripe flips it on its own side and tells the backend over
 * an `account.updated` webhook, which may land a second or a minute later. Reading the
 * status once — which is all a screen does on focus — therefore catches "pending" as
 * often as not, and leaves it on screen until the person happens to reload.
 *
 * So the screen asks repeatedly for a short while instead. `onUpdate` fires on every
 * answer, not just the last, because the intermediate states are worth showing:
 * charges are usually enabled before payouts are.
 *
 * Returns the ready status, or null if it has not arrived within the window — which
 * is not a failure. Stripe may genuinely still be verifying, and the screen says so.
 */
export async function waitForPayouts(
  accessToken: string,
  onUpdate: (status: PayoutStatus) => void,
  options: {
    attempts?: number;
    intervalMs?: number;
    sleep?: (ms: number) => Promise<void>;
    cancelled?: () => boolean;
  } = {},
): Promise<PayoutStatus | null> {
  const attempts = options.attempts ?? 12;
  const intervalMs = options.intervalMs ?? 2500;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const cancelled = options.cancelled ?? (() => false);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (cancelled()) return null;
    try {
      const status = await api.getPayoutStatus(accessToken);
      if (cancelled()) return null;
      onUpdate(status);
      if (!status.onboardingRequired) return status;
    } catch {
      // A blip on one poll is not an answer; keep asking until the attempts run out.
    }
    if (attempt < attempts - 1) await sleep(intervalMs);
  }
  return null;
}
