import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';
import { api } from '@/src/api/client';
import { AuthProvider, useAuth } from '@/src/auth/AuthContext';
import { sessionFixture } from '../fixtures';

jest.mock('@/src/api/client', () => ({
  api: { login: jest.fn(), logout: jest.fn().mockResolvedValue(undefined) },
}));

const loginApiMock = api.login as jest.MockedFunction<typeof api.login>;
const logoutApiMock = api.logout as jest.MockedFunction<typeof api.logout>;

function AuthProbe() {
  const { session, login, logout } = useAuth();
  return (
    <View>
      <Text>{session ? `signed in as ${session.user.name}` : 'signed out'}</Text>
      <Pressable
        onPress={() => void login('alex@example.com', 'correct-password').catch(() => undefined)}
      >
        <Text>Sign in probe</Text>
      </Pressable>
      <Pressable onPress={logout}>
        <Text>Log out probe</Text>
      </Pressable>
    </View>
  );
}

describe('AuthProvider', () => {
  test('stores the session returned by login', async () => {
    loginApiMock.mockResolvedValueOnce(sessionFixture);
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(screen.getByText('signed out')).toBeTruthy();
    fireEvent.press(screen.getByText('Sign in probe'));

    await waitFor(() => expect(screen.getByText('signed in as Alex Morgan')).toBeTruthy());
    expect(loginApiMock).toHaveBeenCalledWith('alex@example.com', 'correct-password', undefined);
  });

  test('logout clears the in-memory session state', async () => {
    loginApiMock.mockResolvedValueOnce(sessionFixture);
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    fireEvent.press(screen.getByText('Sign in probe'));
    await screen.findByText('signed in as Alex Morgan');
    fireEvent.press(screen.getByText('Log out probe'));

    expect(screen.getByText('signed out')).toBeTruthy();
    expect(logoutApiMock).toHaveBeenCalledWith('test-access-token');
  });

  test('logout without a session does not call the API boundary', () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    fireEvent.press(screen.getByText('Log out probe'));

    expect(screen.getByText('signed out')).toBeTruthy();
    expect(logoutApiMock).not.toHaveBeenCalled();
  });

  test('a failed login leaves the local session signed out', async () => {
    loginApiMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    fireEvent.press(screen.getByText('Sign in probe'));

    await waitFor(() => expect(loginApiMock).toHaveBeenCalled());
    expect(screen.getByText('signed out')).toBeTruthy();
  });

  test.todo('expires the local session when expiresAt is reached');
  test.todo('persists a valid session across an application restart');
});
