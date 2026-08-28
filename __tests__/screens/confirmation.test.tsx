import { fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import ConfirmationScreen from '@/app/bookings/confirmation';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

const paramsMock = useLocalSearchParams as jest.Mock;
const replaceMock = router.replace as jest.Mock;

describe('Booking confirmation screen', () => {
  beforeEach(() => {
    paramsMock.mockReturnValue({
      bookingId: 'booking-1',
      serviceTitle: 'Interview confidence coaching',
      startsAt: '2026-09-01T00:00:00.000Z',
      paymentId: 'stub-payment-1',
    });
  });

  test('renders the confirmed booking and stub-payment references', () => {
    render(<ConfirmationScreen />);

    expect(screen.getByText('Payment successful')).toBeTruthy();
    expect(screen.getByText('Interview confidence coaching')).toBeTruthy();
    expect(screen.getByText(/Tuesday, 1 September 2026/)).toBeTruthy();
    expect(screen.getByText('booking-1')).toBeTruthy();
    expect(screen.getByText('stub-payment-1')).toBeTruthy();
    expect(
      screen.getByText(
        'Your booking is confirmed. No real money was charged because this executable slice uses a payment stub.',
      ),
    ).toBeTruthy();
  });

  test('returns to the marketplace without reusing booking parameters', () => {
    render(<ConfirmationScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Back to Marketplace' }));

    expect(replaceMock).toHaveBeenCalledWith('/marketplace');
  });

  test.todo('rejects missing booking, service, time, or payment parameters');
  test.todo('shows a safe error instead of throwing for a malformed startsAt parameter');
  test.todo('loads confirmation data from an authenticated API instead of trusting route text');
});
