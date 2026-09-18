import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';
import { api } from '@/src/api/client';
import { AuthProvider, useAuth } from '@/src/auth/AuthContext';
import { clearSession, readSession, writeSession } from '@/src/auth/sessionStore';
import { sessionFixture } from '../fixtures';

jest.mock('@/src/api/client', () => ({
  api: { login: jest.fn(), logout: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('@/src/auth/sessionStore', () => ({
  readSession: jest.fn().mockResolvedValue(null),
  writeSession: jest.fn().mockResolvedValue(undefined),
  clearSession: jest.fn().mockResolvedValue(undefined),
}));

const loginApiMock = api.login as jest.MockedFunction<typeof api.login>;
const logoutApiMock = api.logout as jest.MockedFunction<typeof api.logout>;
const readSessionMock = readSession as jest.MockedFunction<typeof readSession>;
const writeSessionMock = writeSession as jest.MockedFunction<typeof writeSession>;
const clearSessionMock = clearSession as jest.MockedFunction<typeof clearSession>;

/** An hour from now, matching the API's access-token lifetime. */
const validUntil = () => new Date(Date.now() + 3_600_000).toISOString();

/**
 * The provider renders nothing until the stored session has been read back, so
 * every test has to let that settle first — otherwise it asserts against a blank
 * tree rather than a signed-out one.
 */
async function renderRestored() {
  render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>,
  );
  await screen.findByText(/signed (in|out)/);
}

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
    await renderRestored();

    expect(screen.getByText('signed out')).toBeTruthy();
    fireEvent.press(screen.getByText('Sign in probe'));

    await waitFor(() => expect(screen.getByText('signed in as Alex Morgan')).toBeTruthy());
    expect(loginApiMock).toHaveBeenCalledWith('alex@example.com', 'correct-password', undefined);
  });

  test('logout clears the in-memory session state', async () => {
    loginApiMock.mockResolvedValueOnce(sessionFixture);
    await renderRestored();

    fireEvent.press(screen.getByText('Sign in probe'));
    await screen.findByText('signed in as Alex Morgan');
    fireEvent.press(screen.getByText('Log out probe'));

    expect(screen.getByText('signed out')).toBeTruthy();
    // The refresh token is revoked alongside it, so signing out really ends it.
    expect(logoutApiMock).toHaveBeenCalledWith('test-access-token', undefined);
  });

  test('logout without a session does not call the API boundary', async () => {
    await renderRestored();

    fireEvent.press(screen.getByText('Log out probe'));

    expect(screen.getByText('signed out')).toBeTruthy();
    expect(logoutApiMock).not.toHaveBeenCalled();
  });

  test('a failed login leaves the local session signed out', async () => {
    loginApiMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await renderRestored();

    fireEvent.press(screen.getByText('Sign in probe'));

    await waitFor(() => expect(loginApiMock).toHaveBeenCalled());
    expect(screen.getByText('signed out')).toBeTruthy();
  });

  describe('surviving a reload', () => {
    test('a stored session is restored, so a browser refresh stays signed in', async () => {
      readSessionMock.mockResolvedValueOnce(
        JSON.stringify({ ...sessionFixture, expiresAt: validUntil() }),
      );

      await renderRestored();

      expect(screen.getByText('signed in as Alex Morgan')).toBeTruthy();
      expect(loginApiMock).not.toHaveBeenCalled();
    });

    test('an expired session is discarded rather than restored', async () => {
      // Restoring it would show a signed-in app in which every request 401s.
      readSessionMock.mockResolvedValueOnce(
        JSON.stringify({ ...sessionFixture, expiresAt: '2020-01-01T00:00:00.000Z' }),
      );

      await renderRestored();

      expect(screen.getByText('signed out')).toBeTruthy();
      expect(clearSessionMock).toHaveBeenCalled();
    });

    test.each([
      ['not json at all', 'not json at all'],
      ['a token with no expiry', JSON.stringify({ accessToken: 'x', user: { id: '1' } })],
      ['an empty string', ''],
    ])('%s is ignored rather than crashing the launch', async (_label, stored) => {
      readSessionMock.mockResolvedValueOnce(stored);

      await renderRestored();

      expect(screen.getByText('signed out')).toBeTruthy();
    });

    test('signing in writes the session down for next time', async () => {
      loginApiMock.mockResolvedValueOnce(sessionFixture);
      await renderRestored();

      fireEvent.press(screen.getByText('Sign in probe'));
      await screen.findByText('signed in as Alex Morgan');

      expect(writeSessionMock).toHaveBeenCalledWith(JSON.stringify(sessionFixture));
    });

    test('logging out removes it, so a refresh does not bring it back', async () => {
      loginApiMock.mockResolvedValueOnce(sessionFixture);
      await renderRestored();
      fireEvent.press(screen.getByText('Sign in probe'));
      await screen.findByText('signed in as Alex Morgan');

      fireEvent.press(screen.getByText('Log out probe'));

      expect(screen.getByText('signed out')).toBeTruthy();
      expect(clearSessionMock).toHaveBeenCalled();
    });

    test('a storage failure costs a sign-in, not the app', async () => {
      // Private browsing, blocked site data, a refused keystore.
      readSessionMock.mockRejectedValueOnce(new Error('storage unavailable'));

      render(
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>,
      );

      await waitFor(() => expect(screen.getByText('signed out')).toBeTruthy());
    });
  });
});
