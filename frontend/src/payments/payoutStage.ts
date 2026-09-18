import { PayoutStatus } from '@/src/api/types';

/**
 * Connect onboarding has three states, not two, and they need different words.
 *
 * Whether an account exists and whether Stripe will actually pay into it are
 * separate facts: a counsellor can finish the hosted flow and still be waiting on
 * verification. Reading the button off "has an account" alone told someone who was
 * fully set up to "Continue payout setup", which reads as unfinished work.
 */
export type PayoutStage = 'not_started' | 'in_progress' | 'ready';

export function payoutStage(status: PayoutStatus | null): PayoutStage {
  if (!status) return 'not_started';
  // The server owns readiness: it needs a connected account as well as the flag.
  if (!status.onboardingRequired) return 'ready';
  return status.stripeAccountId ? 'in_progress' : 'not_started';
}

/** Label for the button that opens Stripe's hosted flow. */
export function payoutActionLabel(stage: PayoutStage): string {
  switch (stage) {
    case 'ready':
      // Still worth opening — it is where bank details and identity are changed.
      return 'Update payout details';
    case 'in_progress':
      return 'Continue payout setup';
    default:
      return 'Set up payouts';
  }
}

/** Heading for the status card. */
export function payoutStageTitle(stage: PayoutStage): string {
  switch (stage) {
    case 'ready':
      return 'Ready to be paid';
    case 'in_progress':
      return 'Setup not finished';
    default:
      return 'Payouts not set up';
  }
}
