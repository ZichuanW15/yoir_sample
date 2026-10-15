import { apiMock, counsellorSessionFixture, deferred, renderCounsellor, setupCounsellorMocks, settle } from './counsellor-screen-utils';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import CounsellorPayoutsScreen from '@/app/counsellor/payouts';
import { apiError } from '@/src/api/errors';
import { PayoutStatus } from '@/src/api/types';
import { usePaymentConfig } from '@/src/payments';
import { onboardingReturnTo, openOnboarding } from '@/src/payments/onboarding';
import { waitForPayouts } from '@/src/payments/waitForPayouts';
import { sessionFixture } from '../fixtures';

jest.mock('@/src/payments', () => ({ usePaymentConfig: jest.fn() }));
// Hosted Stripe onboarding and readiness polling are external boundaries. Their
// helpers have separate unit tests; this suite verifies the real screen's wiring.
jest.mock('@/src/payments/onboarding', () => ({ onboardingReturnTo: jest.fn(), openOnboarding: jest.fn() }));
jest.mock('@/src/payments/waitForPayouts', () => ({ waitForPayouts: jest.fn() }));

const notStarted: PayoutStatus = {
  stripeAccountId: null, chargesEnabled: false, payoutsEnabled: false,
  onboardingRequired: true, abn: null, gstRegistered: false,
};
const pendingStatus: PayoutStatus = { ...notStarted, stripeAccountId: 'acct-pending', chargesEnabled: true };
const readyStatus: PayoutStatus = { ...pendingStatus, payoutsEnabled: true, onboardingRequired: false };

beforeEach(() => {
  setupCounsellorMocks();
  jest.mocked(usePaymentConfig).mockReset().mockReturnValue({ config: null, loading: false, error: '' });
  jest.mocked(onboardingReturnTo).mockReset().mockReturnValue('https://qa.example/counsellor/payouts');
  jest.mocked(openOnboarding).mockReset().mockResolvedValue(undefined);
  jest.mocked(waitForPayouts).mockReset().mockResolvedValue(null);
  apiMock.getPayoutStatus.mockResolvedValue(notStarted);
  apiMock.updateTaxDetails.mockResolvedValue(readyStatus);
  apiMock.startStripeOnboarding.mockResolvedValue({ url: 'https://connect.stripe.test/fresh-link', accountId: 'acct-pending' });
});

describe('US-47 payout setup and tax details — component/API boundary tests', () => {
  test.each([null, sessionFixture])('requires a counsellor role before showing bank or tax controls (%s)', async (session) => {
    await renderCounsellor(<CounsellorPayoutsScreen />, session);
    expect(screen.getByTestId('redirect')).toHaveTextContent('/');
    expect(screen.queryByText('Getting paid')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save tax details' })).toBeNull();
    expect(apiMock.updateTaxDetails).not.toHaveBeenCalled();
  });

  test('before status arrives does not claim readiness and displays the non-Stripe disclosure', async () => {
    const pending = deferred<PayoutStatus>();
    apiMock.getPayoutStatus.mockReturnValueOnce(pending.promise);
    await renderCounsellor(<CounsellorPayoutsScreen />);
    expect(screen.queryByText('Ready to be paid')).toBeNull();
    expect(screen.getByText(/no real payouts are made yet/)).toBeOnTheScreen();
    await settle(pending, notStarted);
    expect(screen.getByText('Payouts not set up')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Set up payouts' })).toBeEnabled();
    expect(screen.getByText('Charges pending')).toBeOnTheScreen();
    expect(screen.getByText('Payouts pending')).toBeOnTheScreen();
    expect(apiMock.getPayoutStatus).toHaveBeenCalledWith(counsellorSessionFixture.accessToken);
    expect(waitForPayouts).not.toHaveBeenCalled();
  });

  test('server-ready status shows update action, enabled flags and populated tax details', async () => {
    apiMock.getPayoutStatus.mockResolvedValue({ ...readyStatus, abn: '51824753556', gstRegistered: true });
    jest.mocked(usePaymentConfig).mockReturnValue({
      config: {
        provider: 'stripe', publishableKey: 'pk_test_qa', merchantDisplayName: 'Yoir',
        merchantCountryCode: 'AU', currency: 'AUD', slotHoldMinutes: 10,
        cancellationFullRefundHours: 24, cancellationLateRefundPercent: 50,
      },
      loading: false, error: '',
    });
    await renderCounsellor(<CounsellorPayoutsScreen />);
    expect(await screen.findByText('Ready to be paid')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Update payout details' })).toBeEnabled();
    expect(screen.getByText('Charges enabled')).toBeOnTheScreen();
    expect(screen.getByText('Payouts enabled')).toBeOnTheScreen();
    expect(screen.getByLabelText('ABN (optional)')).toHaveDisplayValue('51 824 753 556');
    expect(screen.getByRole('radio', { name: 'Registered' })).toBeChecked();
    expect(screen.getByText(/Yoir takes its commission from each session/)).toBeOnTheScreen();
    expect(screen.queryByText(/no real payouts are made yet/)).toBeNull();
  });

  test('a pending connected account polls and only becomes ready from the server update', async () => {
    const pending = deferred<PayoutStatus | null>();
    apiMock.getPayoutStatus.mockResolvedValue(pendingStatus);
    jest.mocked(waitForPayouts).mockReturnValueOnce(pending.promise);
    await renderCounsellor(<CounsellorPayoutsScreen />);
    expect(await screen.findByText('Confirming with Stripe…')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue payout setup' })).toBeOnTheScreen();
    expect(screen.queryByText('Ready to be paid')).toBeNull();
    const [token, update] = jest.mocked(waitForPayouts).mock.calls[0];
    expect(token).toBe(counsellorSessionFixture.accessToken);
    act(() => update(readyStatus));
    await settle(pending, readyStatus);
    expect(screen.getByText('Ready to be paid')).toBeOnTheScreen();
  });

  test('an exhausted readiness poll keeps incomplete setup actionable', async () => {
    apiMock.getPayoutStatus.mockResolvedValue(pendingStatus);
    await renderCounsellor(<CounsellorPayoutsScreen />);
    expect(await screen.findByText('Setup not finished')).toBeOnTheScreen();
    expect(screen.getByText(/Stripe still needs something from you/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue payout setup' })).toBeEnabled();
    expect(screen.queryByText('Ready to be paid')).toBeNull();
  });

  test('unmount cancels the active readiness poll', async () => {
    const pending = deferred<PayoutStatus | null>();
    apiMock.getPayoutStatus.mockResolvedValue(pendingStatus);
    jest.mocked(waitForPayouts).mockReturnValue(pending.promise);
    const view = await renderCounsellor(<CounsellorPayoutsScreen />);
    await screen.findByText('Confirming with Stripe…');
    const options = jest.mocked(waitForPayouts).mock.calls[0][2]!;
    expect(options.cancelled!()).toBe(false);
    view.unmount();
    expect(options.cancelled!()).toBe(true);
    await settle(pending, null);
  });

  test('a status-read failure is visible and never presented as ready', async () => {
    apiMock.getPayoutStatus.mockRejectedValue(apiError(503, 'UNAVAILABLE', 'Payout settings are unavailable.'));
    await renderCounsellor(<CounsellorPayoutsScreen />);
    expect(await screen.findByText('Payout settings are unavailable.')).toBeOnTheScreen();
    expect(screen.queryByText('Ready to be paid')).toBeNull();
  });

  test('opens a fresh platform return link, blocks duplicate setup presses and re-reads status after returning', async () => {
    const pending = deferred<void>();
    jest.mocked(openOnboarding).mockReturnValueOnce(pending.promise);
    apiMock.getPayoutStatus.mockResolvedValueOnce(notStarted).mockResolvedValue(readyStatus);
    await renderCounsellor(<CounsellorPayoutsScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Set up payouts' }));
    await waitFor(() => expect(openOnboarding).toHaveBeenCalledWith('https://connect.stripe.test/fresh-link'));
    const button = screen.getByRole('button', { name: 'Set up payouts' });
    expect(button).toBeDisabled();
    fireEvent.press(button);
    expect(apiMock.startStripeOnboarding).toHaveBeenCalledTimes(1);
    expect(apiMock.startStripeOnboarding).toHaveBeenCalledWith(counsellorSessionFixture.accessToken, 'https://qa.example/counsellor/payouts');
    expect(apiMock.getPayoutStatus).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Ready to be paid')).toBeNull();
    await settle(pending, undefined);
    expect(await screen.findByText('Ready to be paid')).toBeOnTheScreen();
    expect(apiMock.getPayoutStatus).toHaveBeenCalledTimes(2);
  });

  test('a failed onboarding request does not open the browser and can be retried with a new request', async () => {
    apiMock.startStripeOnboarding.mockRejectedValueOnce(apiError(503, 'UNAVAILABLE', 'Setup temporarily unavailable.'));
    await renderCounsellor(<CounsellorPayoutsScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Set up payouts' }));
    expect(await screen.findByText('Setup temporarily unavailable.')).toBeOnTheScreen();
    expect(openOnboarding).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Set up payouts' }));
    await waitFor(() => expect(openOnboarding).toHaveBeenCalledTimes(1));
    expect(apiMock.startStripeOnboarding).toHaveBeenCalledTimes(2);
  });

  test('a browser-launch failure restores the setup action without assuming successful onboarding', async () => {
    jest.mocked(openOnboarding).mockRejectedValueOnce(new Error('Unable to open the hosted setup.'));
    await renderCounsellor(<CounsellorPayoutsScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Set up payouts' }));
    expect(await screen.findByText('Unable to open the hosted setup.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Set up payouts' })).toBeEnabled();
    expect(apiMock.getPayoutStatus).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Ready to be paid')).toBeNull();
  });

  test('a short ABN is rejected before saving and changing the input clears its error', async () => {
    await renderCounsellor(<CounsellorPayoutsScreen />);
    fireEvent.changeText(screen.getByLabelText('ABN (optional)'), '123');
    fireEvent.press(screen.getByRole('button', { name: 'Save tax details' }));
    expect(screen.getByText('An ABN is 11 digits.')).toBeOnTheScreen();
    expect(apiMock.updateTaxDetails).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('ABN (optional)'), '51 824 753 556');
    expect(screen.queryByText('An ABN is 11 digits.')).toBeNull();
  });

  test('GST registration requires an ABN and toggling it off allows null tax details', async () => {
    await renderCounsellor(<CounsellorPayoutsScreen />);
    fireEvent.press(screen.getByRole('radio', { name: 'Registered' }));
    expect(screen.getByText(/tax invoices showing your ABN/)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Save tax details' }));
    expect(screen.getByText('Required when you are registered for GST.')).toBeOnTheScreen();
    expect(apiMock.updateTaxDetails).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('radio', { name: 'Not registered' }));
    expect(screen.getByText(/Your receipts will show no GST/)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Save tax details' }));
    await waitFor(() => expect(apiMock.updateTaxDetails).toHaveBeenCalledWith({ abn: null, gstRegistered: false }, counsellorSessionFixture.accessToken));
    expect(await screen.findByText('Tax details saved')).toBeOnTheScreen();
  });

  test('normalizes and caps an ABN, submits tax details and blocks duplicate saves until confirmation', async () => {
    const pending = deferred<PayoutStatus>();
    apiMock.updateTaxDetails.mockReturnValueOnce(pending.promise);
    await renderCounsellor(<CounsellorPayoutsScreen />);
    fireEvent.changeText(screen.getByLabelText('ABN (optional)'), '51 abc 824 753 556 9');
    expect(screen.getByLabelText('ABN (optional)')).toHaveDisplayValue('51 824 753 556');
    fireEvent.press(screen.getByRole('radio', { name: 'Registered' }));
    fireEvent.press(screen.getByRole('button', { name: 'Save tax details' }));
    const saving = screen.getByRole('button', { name: 'Save tax details' });
    expect(saving).toBeDisabled();
    fireEvent.press(saving);
    expect(apiMock.updateTaxDetails).toHaveBeenCalledTimes(1);
    expect(apiMock.updateTaxDetails).toHaveBeenCalledWith({ abn: '51824753556', gstRegistered: true }, counsellorSessionFixture.accessToken);
    expect(screen.queryByText('Tax details saved')).toBeNull();
    await settle(pending, { ...readyStatus, abn: '51824753556', gstRegistered: true });
    expect(await screen.findByText('Tax details saved')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save tax details' })).toBeEnabled();
  });

  test('server tax validation preserves input and shows field and general errors before a successful retry', async () => {
    apiMock.updateTaxDetails.mockRejectedValueOnce(apiError(422, 'VALIDATION_ERROR', 'Tax details were rejected.', { abn: 'ABN checksum is invalid.' }));
    await renderCounsellor(<CounsellorPayoutsScreen />);
    fireEvent.changeText(screen.getByLabelText('ABN (optional)'), '11111111111');
    fireEvent.press(screen.getByRole('button', { name: 'Save tax details' }));
    expect(await screen.findByText('Tax details were rejected.')).toBeOnTheScreen();
    expect(screen.getByText('ABN checksum is invalid.')).toBeOnTheScreen();
    expect(screen.getByLabelText('ABN (optional)')).toHaveDisplayValue('11 111 111 111');
    expect(screen.queryByText('Tax details saved')).toBeNull();
    fireEvent.changeText(screen.getByLabelText('ABN (optional)'), '51824753556');
    fireEvent.press(screen.getByRole('button', { name: 'Save tax details' }));
    expect(await screen.findByText('Tax details saved')).toBeOnTheScreen();
    expect(apiMock.updateTaxDetails).toHaveBeenCalledTimes(2);
  });

  test('a tax network failure restores the save button without success feedback', async () => {
    apiMock.updateTaxDetails.mockRejectedValueOnce(new TypeError('Network request failed'));
    await renderCounsellor(<CounsellorPayoutsScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Save tax details' }));
    expect(await screen.findByText('We could not reach Yoir. Check your connection and try again.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save tax details' })).toBeEnabled();
    expect(screen.queryByText('Tax details saved')).toBeNull();
  });

  test('Back falls back to the counsellor workspace when there is no history', async () => {
    jest.mocked(router.canGoBack).mockReturnValue(false);
    await renderCounsellor(<CounsellorPayoutsScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
    expect(router.replace).toHaveBeenCalledWith('/counsellor');
  });
});
