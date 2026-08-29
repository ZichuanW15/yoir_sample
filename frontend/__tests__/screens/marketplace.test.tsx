import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import MarketplaceScreen from '@/app/marketplace';
import { api, ApiError } from '@/src/api/client';
import { useAuth } from '@/src/auth/AuthContext';
import { serviceFixture } from '../fixtures';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  router: { replace: jest.fn(), push: jest.fn() },
}));

jest.mock('@/src/api/client', () => {
  const actual = jest.requireActual('@/src/api/client');
  return {
    ...actual,
    isDemoApi: false,
    api: { ...actual.api, listServices: jest.fn() },
  };
});

jest.mock('@/src/auth/AuthContext', () => ({ useAuth: jest.fn() }));

const listServicesMock = api.listServices as jest.MockedFunction<typeof api.listServices>;
const useAuthMock = useAuth as jest.Mock;
const pushMock = router.push as jest.Mock;

describe('Marketplace screen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useAuthMock.mockReturnValue({ session: null, login: jest.fn(), logout: jest.fn() });
  });

  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  test('renders services returned by the API and opens a selected service', async () => {
    listServicesMock.mockResolvedValueOnce([serviceFixture]);
    render(<MarketplaceScreen />);

    expect(await screen.findByText('Interview confidence coaching')).toBeTruthy();
    act(() => jest.runOnlyPendingTimers());
    expect(screen.getByText(/Maya Chen/)).toBeTruthy();
    expect(listServicesMock).toHaveBeenCalledWith('');

    fireEvent.press(screen.getByLabelText('View Interview confidence coaching'));
    expect(pushMock).toHaveBeenCalledWith({
      pathname: '/services/[serviceId]',
      params: { serviceId: 'service-1' },
    });
  });

  test('renders the empty state when the API returns no services', async () => {
    listServicesMock.mockResolvedValueOnce([]);
    render(<MarketplaceScreen />);

    expect(await screen.findByText('No services match your search.')).toBeTruthy();
  });

  test('submits the visible search query to the API', async () => {
    listServicesMock.mockResolvedValueOnce([serviceFixture]).mockResolvedValueOnce([]);
    render(<MarketplaceScreen />);

    expect(await screen.findByText('Interview confidence coaching')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Search services'), 'resume review');
    fireEvent.press(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(listServicesMock).toHaveBeenLastCalledWith('resume review'));
    expect(await screen.findByText('No services match your search.')).toBeTruthy();
  });

  test('renders an API error and retry control', async () => {
    listServicesMock.mockRejectedValueOnce(
      new ApiError(503, {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Services are temporarily unavailable.',
        requestId: 'request-503',
      }),
    );
    render(<MarketplaceScreen />);

    expect(await screen.findByText('Services are temporarily unavailable.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  test('retry repeats the current query and renders the recovered result', async () => {
    listServicesMock
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce([serviceFixture]);
    render(<MarketplaceScreen />);

    expect(
      await screen.findByText('We could not reach Yoir. Check your connection and try again.'),
    ).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Search services'), 'interview');
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(listServicesMock).toHaveBeenLastCalledWith('interview'));
    expect(await screen.findByText('Interview confidence coaching')).toBeTruthy();
  });

  test('renders the connection message after a network failure', async () => {
    listServicesMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    render(<MarketplaceScreen />);

    await waitFor(() =>
      expect(
        screen.getByText('We could not reach Yoir. Check your connection and try again.'),
      ).toBeTruthy(),
    );
  });

  test.todo('prevents an older request from replacing the result of a newer search');
});
