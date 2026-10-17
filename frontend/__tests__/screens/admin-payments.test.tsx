import { apiMock, deferred, renderCounsellor, setupCounsellorMocks, settle } from './counsellor-screen-utils';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AdminPayments from '@/app/admin/payments';
import AdminOrder from '@/app/admin/payments/[orderId]';
import { apiError } from '@/src/api/errors';
import { PaymentOversight } from '@/src/api/types';
import { adminBooking, ownerSession, payment } from './admin-screen-fixtures';

beforeEach(() => {
  setupCounsellorMocks();
  apiMock.listPaymentOversight.mockResolvedValue([payment]);
  apiMock.listAllBookings.mockResolvedValue([adminBooking]);
  jest.mocked(useLocalSearchParams).mockReturnValue({ orderId: payment.orderId });
});

describe('US-48 / QA-210 admin payments (real components, mocked API)', () => {
  test('waits for orders without claiming the payment list is empty', async () => {
    const pending = deferred<PaymentOversight[]>();
    apiMock.listPaymentOversight.mockReturnValueOnce(pending.promise);
    await renderCounsellor(<AdminPayments />, ownerSession);
    expect(screen.queryByText('No orders yet.')).toBeNull();
    expect(screen.queryByText(payment.serviceTitle)).toBeNull();
    await settle(pending, [payment]);
    expect(await screen.findByText(payment.serviceTitle)).toBeOnTheScreen();
  });

  test('renders server-frozen cent amounts, refund and parties and opens the correct order', async () => {
    await renderCounsellor(<AdminPayments />, ownerSession);
    const row = await screen.findByRole('button', { name: `Order for ${payment.serviceTitle}, ${payment.jobSeekerName}` });
    for (const value of ['$95.25', '$14.29', '$80.96', '$12.50', 'Partially refunded']) expect(screen.getByText(value)).toBeOnTheScreen();
    expect(apiMock.listPaymentOversight).toHaveBeenCalledWith(ownerSession.accessToken);
    fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/admin/payments/[orderId]', params: { orderId: payment.orderId } });
  });

  test('an empty successful response explains there are no orders', async () => {
    apiMock.listPaymentOversight.mockResolvedValue([]);
    await renderCounsellor(<AdminPayments />, ownerSession);
    expect(await screen.findByText('No orders yet.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  test('failed reads are recoverable without being mislabelled an empty payment list', async () => {
    apiMock.listPaymentOversight.mockRejectedValueOnce(apiError(503, 'UNAVAILABLE', 'Payments temporarily unavailable.'));
    await renderCounsellor(<AdminPayments />, ownerSession);
    expect(await screen.findByText('Payments temporarily unavailable.')).toBeOnTheScreen();
    expect(screen.queryByText('No orders yet.')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(payment.serviceTitle)).toBeOnTheScreen();
    expect(apiMock.listPaymentOversight).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  test('the detail joins the matching booking, shows its timezone and preserves all cents', async () => {
    apiMock.listAllBookings.mockResolvedValue([{ ...adminBooking, id: 'unrelated', timezone: 'Europe/London' }, adminBooking]);
    await renderCounsellor(<AdminOrder />, ownerSession);
    expect(await screen.findByText(`Payment reference ${payment.paymentId}`)).toBeOnTheScreen();
    expect(screen.getByText(/11:30.*Australia\/Melbourne/)).toBeOnTheScreen();
    expect(screen.queryByText(/Europe\/London/)).toBeNull();
    for (const value of ['$95.25', '$14.29', '$80.96', '$12.50']) expect(screen.getByText(value)).toBeOnTheScreen();
    expect(screen.getByText(payment.jobSeekerName)).toBeOnTheScreen();
    expect(screen.getByText(payment.counsellorName)).toBeOnTheScreen();
    expect(apiMock.listAllBookings).toHaveBeenCalledWith(ownerSession.accessToken);
    fireEvent.press(screen.getByRole('button', { name: 'Back to Payments' }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  test('a paid order without a booking does not invent a session time', async () => {
    apiMock.listPaymentOversight.mockResolvedValue([{ ...payment, bookingId: null, refundedMinor: 0 }]);
    await renderCounsellor(<AdminOrder />, ownerSession);
    expect(await screen.findByText('Not booked')).toBeOnTheScreen();
    expect(screen.getByText('No session is booked on this order, so there is no time to show.')).toBeOnTheScreen();
    expect(screen.queryByText('Session time')).toBeNull();
    expect(screen.queryByText('Refunded')).toBeNull();
  });

  test('a missing order is distinguished from a read failure', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ orderId: 'missing-order' });
    await renderCounsellor(<AdminOrder />, ownerSession);
    expect(await screen.findByText('This order could not be found.')).toBeOnTheScreen();
    expect(screen.queryByText('Money')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  test.each(['payments', 'bookings'] as const)('a failed %s dependency blocks partial detail and retries both reads', async (dependency) => {
    const endpoint = dependency === 'payments' ? apiMock.listPaymentOversight : apiMock.listAllBookings;
    endpoint.mockRejectedValueOnce(apiError(503, 'UNAVAILABLE', 'Order detail temporarily unavailable.'));
    await renderCounsellor(<AdminOrder />, ownerSession);
    expect(await screen.findByText('Order detail temporarily unavailable.')).toBeOnTheScreen();
    expect(screen.queryByText('This order could not be found.')).toBeNull();
    expect(screen.queryByText('Money')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(`Payment reference ${payment.paymentId}`)).toBeOnTheScreen();
    await waitFor(() => expect(apiMock.listPaymentOversight).toHaveBeenCalledTimes(2));
    expect(apiMock.listAllBookings).toHaveBeenCalledTimes(2);
  });
});
