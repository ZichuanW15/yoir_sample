import { PayoutStatus } from '@/src/api/types';
import { payoutActionLabel, payoutStage, payoutStageTitle } from '@/src/payments/payoutStage';

const status = (over: Partial<PayoutStatus>): PayoutStatus => ({
  stripeAccountId: null, chargesEnabled: false, payoutsEnabled: false,
  onboardingRequired: true, abn: null, gstRegistered: false, ...over,
});

describe('how far through payout setup a counsellor is', () => {
  test('nothing started yet', () => {
    expect(payoutStage(status({}))).toBe('not_started');
    expect(payoutActionLabel(payoutStage(status({})))).toBe('Set up payouts');
  });

  test('an account exists but Stripe is still verifying', () => {
    const midway = status({ stripeAccountId: 'acct_1', chargesEnabled: true });
    expect(payoutStage(midway)).toBe('in_progress');
    expect(payoutActionLabel(payoutStage(midway))).toBe('Continue payout setup');
    expect(payoutStageTitle(payoutStage(midway))).toBe('Setup not finished');
  });

  test('fully set up is not told to continue setting up', () => {
    const done = status({
      stripeAccountId: 'acct_1', chargesEnabled: true,
      payoutsEnabled: true, onboardingRequired: false,
    });
    expect(payoutStage(done)).toBe('ready');
    expect(payoutStageTitle(payoutStage(done))).toBe('Ready to be paid');
    // The old rule read only "has an account" and said "Continue payout setup" here.
    expect(payoutActionLabel(payoutStage(done))).toBe('Update payout details');
  });

  test('before the status has loaded, nothing is claimed', () => {
    expect(payoutStage(null)).toBe('not_started');
  });

  test('readiness follows the server, not the raw flag', () => {
    // payoutsEnabled true with onboardingRequired true is the server saying there is
    // no account to pay into; the screen must not overrule that.
    const inconsistent = status({ payoutsEnabled: true, onboardingRequired: true });
    expect(payoutStage(inconsistent)).not.toBe('ready');
  });
});
