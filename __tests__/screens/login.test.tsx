import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import LoginScreen from '@/app/auth/login';
import { ApiError } from '@/src/api/client';
import { useAuth } from '@/src/auth/AuthContext';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/src/auth/AuthContext', () => ({ useAuth: jest.fn() }));

const useAuthMock = useAuth as jest.Mock;
const paramsMock = useLocalSearchParams as jest.Mock;
const loginMock = jest.fn();
const replaceMock = router.replace as jest.Mock;

function completeLoginForm() {
  fireEvent.changeText(screen.getByLabelText('Email'), '  alex@example.com  ');
  fireEvent.changeText(screen.getByLabelText('Password'), 'correct-password');
}

describe('Login screen', () => {
  beforeEach(() => {
    paramsMock.mockReturnValue({});
    useAuthMock.mockReturnValue({ session: null, login: loginMock, logout: jest.fn() });
  });

  test('logs in with trimmed email and navigates to the marketplace', async () => {
    loginMock.mockResolvedValueOnce(undefined);
    render(<LoginScreen />);

    completeLoginForm();
    fireEvent.press(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('alex@example.com', 'correct-password');
      expect(replaceMock).toHaveBeenCalledWith('/marketplace');
    });
  });

  test('continues a pending booking after login', async () => {
    paramsMock.mockReturnValue({ serviceId: 'service/one' });
    loginMock.mockResolvedValueOnce({
      accessToken: 'job-seeker-token',
      expiresAt: '2026-08-29T01:00:00.000Z',
      user: {
        id: 'job-seeker-1',
        name: 'Alex',
        email: 'alex@example.com',
        role: 'job_seeker',
      },
    });
    render(<LoginScreen />);

    expect(screen.getByText('Log in to choose a time and complete your booking.')).toBeTruthy();
    completeLoginForm();
    fireEvent.press(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith({
        pathname: '/services/[serviceId]/timeslots',
        params: { serviceId: 'service/one' },
      }),
    );
  });

  test('rejects incomplete input before calling the API boundary', () => {
    render(<LoginScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByText('Enter your email and password.')).toBeTruthy();
    expect(loginMock).not.toHaveBeenCalled();
  });

  test('shows the generic invalid-credentials message for a 401', async () => {
    loginMock.mockRejectedValueOnce(
      new ApiError(401, {
        code: 'INVALID_CREDENTIALS',
        message: 'Do not reveal which credential failed.',
        requestId: 'request-401',
      }),
    );
    render(<LoginScreen />);

    completeLoginForm();
    fireEvent.press(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('The email or password is incorrect.')).toBeTruthy();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  test('shows a connection message for a network failure', async () => {
    loginMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    render(<LoginScreen />);

    completeLoginForm();
    fireEvent.press(screen.getByRole('button', { name: 'Log in' }));

    expect(
      await screen.findByText('We could not reach Yoir. Check your connection and try again.'),
    ).toBeTruthy();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  test('routes an authenticated non-job-seeker back to service detail', async () => {
    paramsMock.mockReturnValue({ serviceId: 'service/one' });
    loginMock.mockResolvedValueOnce({
      accessToken: 'counsellor-token',
      expiresAt: '2026-08-29T01:00:00.000Z',
      user: {
        id: 'counsellor-1',
        name: 'Maya',
        email: 'maya@example.com',
        role: 'counsellor',
      },
    });
    render(<LoginScreen />);

    completeLoginForm();
    fireEvent.press(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith({
        pathname: '/services/[serviceId]',
        params: { serviceId: 'service/one' },
      }),
    );
  });

  test.todo('rejects an invalid or non-scalar booking serviceId before redirecting');
});
