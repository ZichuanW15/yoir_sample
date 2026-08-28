import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import TimeSlotsScreen from '@/app/services/[serviceId]/timeslots';
import { api, ApiError } from '@/src/api/client';
import { useAuth } from '@/src/auth/AuthContext';
import {
  confirmationFixture,
  orderFixture,
  serviceFixture,
  sessionFixture,
  slotFixture,
} from '../fixtures';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/src/api/client', () => {
  const actual = jest.requireActual('@/src/api/client');
  return {
    ...actual,
    isDemoApi: false,
    api: {
      ...actual.api,
      getService: jest.fn(),
      listServiceSlots: jest.fn(),
      createOrder: jest.fn(),
      completeStubPayment: jest.fn(),
    },
  };
});

jest.mock('@/src/auth/AuthContext', () => ({ useAuth: jest.fn() }));

const paramsMock = useLocalSearchParams as jest.Mock;
const useAuthMock = useAuth as jest.Mock;
const getServiceMock = api.getService as jest.MockedFunction<typeof api.getService>;
const listSlotsMock = api.listServiceSlots as jest.MockedFunction<typeof api.listServiceSlots>;
const createOrderMock = api.createOrder as jest.MockedFunction<typeof api.createOrder>;
const completePaymentMock = api.completeStubPayment as jest.MockedFunction<
  typeof api.completeStubPayment
>;
const replaceMock = router.replace as jest.Mock;

describe('Time-slot screen', () => {
  beforeEach(() => {
    paramsMock.mockReturnValue({ serviceId: 'service-1' });
    useAuthMock.mockReturnValue({
      session: sessionFixture,
      login: jest.fn(),
      logout: jest.fn(),
    });
    getServiceMock.mockResolvedValue(serviceFixture);
    listSlotsMock.mockResolvedValue([slotFixture]);
    createOrderMock.mockResolvedValue(orderFixture);
    completePaymentMock.mockResolvedValue(confirmationFixture);
  });

  test('loads the selected service and its available slots', async () => {
    render(<TimeSlotsScreen />);

    expect(await screen.findByText('Choose a time')).toBeTruthy();
    expect(screen.getByText(`Select one available session for ${serviceFixture.title}.`)).toBeTruthy();
    expect(screen.getByText('Development payment stub: no real money or card details are used.')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(getServiceMock).toHaveBeenCalledWith('service-1');
    expect(listSlotsMock).toHaveBeenCalledWith('service-1');
  });

  test('redirects an anonymous user to login without loading booking data', async () => {
    useAuthMock.mockReturnValue({ session: null, login: jest.fn(), logout: jest.fn() });
    render(<TimeSlotsScreen />);

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith({
        pathname: '/auth/login',
        params: { serviceId: 'service-1' },
      }),
    );
    expect(getServiceMock).not.toHaveBeenCalled();
    expect(listSlotsMock).not.toHaveBeenCalled();
  });

  test.each(['counsellor', 'platform_owner'] as const)(
    'redirects a %s away without loading booking data',
    async (role) => {
      useAuthMock.mockReturnValue({
        session: { ...sessionFixture, user: { ...sessionFixture.user, role } },
        login: jest.fn(),
        logout: jest.fn(),
      });
      render(<TimeSlotsScreen />);

      await waitFor(() =>
        expect(replaceMock).toHaveBeenCalledWith({
          pathname: '/services/[serviceId]',
          params: { serviceId: 'service-1' },
        }),
      );
      expect(getServiceMock).not.toHaveBeenCalled();
      expect(listSlotsMock).not.toHaveBeenCalled();
    },
  );

  test('keeps payment disabled until the user selects a slot', async () => {
    render(<TimeSlotsScreen />);

    await screen.findByText('Choose a time');
    const payButton = screen.getByRole('button', { name: 'Pay $95.00' });
    fireEvent.press(payButton);
    expect(createOrderMock).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('radio'));
    fireEvent.press(payButton);
    await waitFor(() => expect(createOrderMock).toHaveBeenCalled());
  });

  test('submits the current booking defaults and opens the payment confirmation', async () => {
    createOrderMock.mockResolvedValueOnce(orderFixture);
    completePaymentMock.mockResolvedValueOnce(confirmationFixture);
    render(<TimeSlotsScreen />);

    await screen.findByText('Choose a time');
    fireEvent.press(screen.getByRole('radio'));
    fireEvent.press(screen.getByRole('button', { name: 'Pay $95.00' }));

    await waitFor(() => {
      expect(createOrderMock).toHaveBeenCalledWith(
        'service-1',
        'slot-1',
        'online',
        'Australia/Sydney',
        'test-access-token',
      );
      expect(completePaymentMock).toHaveBeenCalledWith(orderFixture, 'test-access-token');
      expect(replaceMock).toHaveBeenCalledWith({
        pathname: '/bookings/confirmation',
        params: {
          bookingId: 'booking-1',
          serviceTitle: 'Interview confidence coaching',
          startsAt: '2026-09-01T00:00:00.000Z',
          paymentId: 'stub-payment-1',
        },
      });
    });
  });

  test('shows an empty state when no slots are available', async () => {
    listSlotsMock.mockResolvedValueOnce([]);
    render(<TimeSlotsScreen />);

    expect(
      await screen.findByText('No times are currently available. Please check again later.'),
    ).toBeTruthy();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  test('shows a structured load error', async () => {
    getServiceMock.mockRejectedValueOnce(
      new ApiError(503, {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Booking availability is temporarily unavailable.',
        requestId: 'request-503',
      }),
    );
    render(<TimeSlotsScreen />);

    expect(
      await screen.findByText('Booking availability is temporarily unavailable.'),
    ).toBeTruthy();
  });

  test.todo('requires the user to choose a modality when a service offers more than one');
  test.todo('uses a user-selected IANA timezone instead of hard-coded Australia/Sydney');
  test.todo('keeps a payment failure visible after refreshing service and slot data');
  test.todo('leaves the loading state when the route has no serviceId');
});
