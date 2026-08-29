import { fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import ServiceDetailScreen from '@/app/services/[serviceId]';
import { api, ApiError } from '@/src/api/client';
import { useAuth } from '@/src/auth/AuthContext';
import { serviceFixture, sessionFixture } from '../fixtures';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/src/api/client', () => {
  const actual = jest.requireActual('@/src/api/client');
  return { ...actual, api: { ...actual.api, getService: jest.fn() } };
});

jest.mock('@/src/auth/AuthContext', () => ({ useAuth: jest.fn() }));

const paramsMock = useLocalSearchParams as jest.Mock;
const getServiceMock = api.getService as jest.MockedFunction<typeof api.getService>;
const useAuthMock = useAuth as jest.Mock;
const pushMock = router.push as jest.Mock;

describe('Service detail screen', () => {
  beforeEach(() => {
    paramsMock.mockReturnValue({ serviceId: 'service-1' });
    useAuthMock.mockReturnValue({ session: null, login: jest.fn(), logout: jest.fn() });
  });

  test('renders service details returned by the API', async () => {
    getServiceMock.mockResolvedValueOnce(serviceFixture);
    render(<ServiceDetailScreen />);

    expect(await screen.findByText('Interview confidence coaching')).toBeTruthy();
    expect(screen.getByText('Maya Chen')).toBeTruthy();
    expect(screen.getByText('Practical interview preparation and feedback.')).toBeTruthy();
    expect(getServiceMock).toHaveBeenCalledWith('service-1');
  });

  test('renders the API message for a 404 response', async () => {
    getServiceMock.mockRejectedValueOnce(
      new ApiError(404, {
        code: 'NOT_FOUND',
        message: 'Service not found.',
        requestId: 'request-404',
      }),
    );
    render(<ServiceDetailScreen />);

    expect(await screen.findByText('Service not found.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  test('renders the connection message after a network failure', async () => {
    getServiceMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    render(<ServiceDetailScreen />);

    expect(
      await screen.findByText('We could not reach Yoir. Check your connection and try again.'),
    ).toBeTruthy();
  });

  test('renders location, pending verification and no-rating states', async () => {
    getServiceMock.mockResolvedValueOnce({
      ...serviceFixture,
      location: { cityOrRegion: 'Melbourne', state: 'VIC' },
      counsellor: {
        ...serviceFixture.counsellor,
        verificationStatus: 'pending',
        overallRating: null,
        reviewCount: 0,
      },
    });
    render(<ServiceDetailScreen />);

    expect(await screen.findByText('Interview confidence coaching')).toBeTruthy();
    expect(screen.getByText('Verification pending')).toBeTruthy();
    expect(screen.getByText('No reviews yet')).toBeTruthy();
    expect(screen.getByText('Melbourne, VIC')).toBeTruthy();
  });

  test('retry reloads the same service after a temporary failure', async () => {
    getServiceMock
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(serviceFixture);
    render(<ServiceDetailScreen />);

    expect(
      await screen.findByText('We could not reach Yoir. Check your connection and try again.'),
    ).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Interview confidence coaching')).toBeTruthy();
    expect(getServiceMock).toHaveBeenCalledTimes(2);
  });

  test('preserves the service identifier when an anonymous user starts booking', async () => {
    getServiceMock.mockResolvedValueOnce(serviceFixture);
    render(<ServiceDetailScreen />);

    await screen.findByText('Interview confidence coaching');
    fireEvent.press(screen.getByRole('button', { name: 'Book this service' }));

    expect(pushMock).toHaveBeenCalledWith({
      pathname: '/auth/login',
      params: { serviceId: 'service-1' },
    });
  });

  test('sends an authenticated job seeker to the time-slot screen', async () => {
    useAuthMock.mockReturnValue({ session: sessionFixture, login: jest.fn(), logout: jest.fn() });
    getServiceMock.mockResolvedValueOnce(serviceFixture);
    render(<ServiceDetailScreen />);

    await screen.findByText('Interview confidence coaching');
    fireEvent.press(screen.getByRole('button', { name: 'Book this service' }));

    expect(pushMock).toHaveBeenCalledWith({
      pathname: '/services/[serviceId]/timeslots',
      params: { serviceId: 'service-1' },
    });
  });

  test('blocks a counsellor from entering the booking flow', async () => {
    useAuthMock.mockReturnValue({
      session: { ...sessionFixture, user: { ...sessionFixture.user, role: 'counsellor' } },
      login: jest.fn(),
      logout: jest.fn(),
    });
    getServiceMock.mockResolvedValueOnce(serviceFixture);
    render(<ServiceDetailScreen />);

    await screen.findByText('Interview confidence coaching');
    fireEvent.press(screen.getByRole('button', { name: 'Book this service' }));

    expect(screen.getByText('Only Job Seekers can book a service.')).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  test.todo('leaves the loading state when the route has no serviceId');
  test.todo('does not display stale service data after a changed parameter fails');
});
