import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import RegisterScreen from '@/app/auth/register';
import { api, ApiError } from '@/src/api/client';
import { sessionFixture } from '../fixtures';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/src/api/client', () => {
  const actual = jest.requireActual('@/src/api/client');
  return { ...actual, api: { ...actual.api, register: jest.fn() } };
});

const registerMock = api.register as jest.MockedFunction<typeof api.register>;
const replaceMock = router.replace as jest.Mock;
const paramsMock = useLocalSearchParams as jest.Mock;

function completeRegistrationForm() {
  fireEvent.changeText(screen.getByLabelText('Full name'), '  Alex Morgan  ');
  fireEvent.changeText(screen.getByLabelText('Email'), '  alex@example.com  ');
  fireEvent.changeText(screen.getByLabelText('Password'), 'correct-password');
  fireEvent.changeText(screen.getByLabelText('Confirm password'), 'correct-password');
}

describe('Register screen', () => {
  beforeEach(() => {
    paramsMock.mockReturnValue({});
  });

  test('registers valid input and offers navigation to login', async () => {
    registerMock.mockResolvedValueOnce(sessionFixture.user);
    render(<RegisterScreen />);

    completeRegistrationForm();
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(registerMock).toHaveBeenCalledWith({
        name: 'Alex Morgan',
        email: 'alex@example.com',
        password: 'correct-password',
        passwordConfirmation: 'correct-password',
        role: 'job_seeker',
      }),
    );
    expect(screen.getByText('Your account is ready. Continue to log in.')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Continue to log in' }));
    expect(replaceMock).toHaveBeenCalledWith('/auth/login');
  });

  test('preserves a pending booking when continuing to login', async () => {
    paramsMock.mockReturnValue({ serviceId: 'service-1' });
    registerMock.mockResolvedValueOnce(sessionFixture.user);
    render(<RegisterScreen />);

    completeRegistrationForm();
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    await screen.findByText('Your account is ready. Continue to log in.');
    fireEvent.press(screen.getByRole('button', { name: 'Continue to log in' }));

    expect(replaceMock).toHaveBeenCalledWith({
      pathname: '/auth/login',
      params: { serviceId: 'service-1' },
    });
  });

  test('rejects incomplete input before calling register', () => {
    render(<RegisterScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Complete all required fields.')).toBeTruthy();
    expect(registerMock).not.toHaveBeenCalled();
  });

  test('rejects a short password before calling register', () => {
    render(<RegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('Full name'), 'Alex Morgan');
    fireEvent.changeText(screen.getByLabelText('Email'), 'alex@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'short');
    fireEvent.changeText(screen.getByLabelText('Confirm password'), 'short');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Password must be at least 8 characters.')).toBeTruthy();
    expect(registerMock).not.toHaveBeenCalled();
  });

  test('rejects mismatched passwords before calling register', () => {
    render(<RegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('Full name'), 'Alex Morgan');
    fireEvent.changeText(screen.getByLabelText('Email'), 'alex@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'correct-password');
    fireEvent.changeText(screen.getByLabelText('Confirm password'), 'different-password');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Passwords do not match.')).toBeTruthy();
    expect(registerMock).not.toHaveBeenCalled();
  });

  test('submits the Career Counsellor role selected by the user', async () => {
    registerMock.mockResolvedValueOnce({ ...sessionFixture.user, role: 'counsellor' });
    render(<RegisterScreen />);

    fireEvent.press(screen.getByText('Career Counsellor'));
    completeRegistrationForm();
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(registerMock).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'counsellor' }),
      ),
    );
  });

  test('shows an API conflict without reporting success', async () => {
    registerMock.mockRejectedValueOnce(
      new ApiError(409, {
        code: 'CONFLICT',
        message: 'An account already exists for this email.',
        requestId: 'request-409',
      }),
    );
    render(<RegisterScreen />);

    completeRegistrationForm();
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('An account already exists for this email.')).toBeTruthy();
    expect(screen.queryByText('Your account is ready. Continue to log in.')).toBeNull();
  });

  test.todo('discards or resolves a pending booking when a counsellor account is registered');
  test.todo('rejects an invalid or non-scalar booking serviceId before redirecting');
});
