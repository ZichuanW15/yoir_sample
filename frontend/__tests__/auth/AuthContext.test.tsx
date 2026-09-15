import { apiFailure, AuthStatusProbe, callsTo, deferred, jsonResponse, renderPublic, reply } from '../public-screen-utils';
import { act, fireEvent, renderHook, screen } from '@testing-library/react-native';
import { useAuth } from '@/src/auth/AuthContext';
import { counsellorSessionFixture, sessionFixture } from '../fixtures';

const signIn = () => fireEvent.press(screen.getByRole('button', { name: 'Sign in probe' }));
const logout = () => fireEvent.press(screen.getByRole('button', { name: 'Log out probe' }));

describe('AuthProvider through the HTTP boundary', () => {
  test('reports a missing auth provider instead of allowing an undefined auth state', () => {
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within AuthProvider.');
  });

  test('[QA-100] stores the returned session and resolves login to its authoritative role', async () => {
    reply('POST', '/auth/sessions', jsonResponse(sessionFixture));
    renderPublic(<AuthStatusProbe />);
    expect(screen.getByText('signed out')).toBeOnTheScreen();
    signIn();
    expect(await screen.findByText('signed in as Alex Morgan')).toBeOnTheScreen();
    expect(screen.getByText('returned job_seeker')).toBeOnTheScreen();
    expect(JSON.parse(callsTo('POST', '/auth/sessions')[0][1]?.body as string)).toEqual({ email: 'alex@example.com', password: 'correct-password' });
  });

  test('[QA-100] preserves the role returned by a counsellor login', async () => {
    reply('POST', '/auth/sessions', jsonResponse(counsellorSessionFixture));
    renderPublic(<AuthStatusProbe />);
    signIn();
    expect(await screen.findByText('signed in as Maya Chen')).toBeOnTheScreen();
    expect(screen.getByText('returned counsellor')).toBeOnTheScreen();
  });

  test('[QA-106] logout drops local identity immediately while server invalidation is pending', async () => {
    const pending = deferred<Response>();
    reply('POST', '/auth/sessions', jsonResponse(sessionFixture));
    reply('DELETE', '/auth/sessions/current', pending.promise);
    renderPublic(<AuthStatusProbe />);
    signIn();
    await screen.findByText('signed in as Alex Morgan');
    logout();
    expect(screen.getByText('signed out')).toBeOnTheScreen();
    expect(callsTo('DELETE', '/auth/sessions/current')[0][1]?.headers).toMatchObject({ Authorization: 'Bearer test-access-token' });
    await act(async () => pending.resolve(jsonResponse(undefined, 204)));
    expect(screen.getByText('signed out')).toBeOnTheScreen();
  });

  test('[QA-106] failed server invalidation does not restore the local identity', async () => {
    reply('POST', '/auth/sessions', jsonResponse(sessionFixture));
    reply('DELETE', '/auth/sessions/current', new TypeError('offline'));
    renderPublic(<AuthStatusProbe />);
    signIn();
    await screen.findByText('signed in as Alex Morgan');
    await act(async () => logout());
    expect(screen.getByText('signed out')).toBeOnTheScreen();
  });

  test('[QA-106] logout without a session sends no authenticated request', () => {
    renderPublic(<AuthStatusProbe />);
    logout();
    expect(screen.getByText('signed out')).toBeOnTheScreen();
    expect(callsTo('DELETE', '/auth/sessions/current')).toHaveLength(0);
  });

  test('[QA-103] an invalid login rejects without authenticating the provider', async () => {
    reply('POST', '/auth/sessions', apiFailure('INVALID_CREDENTIALS', 'Invalid credentials.', 401));
    renderPublic(<AuthStatusProbe />);
    signIn();
    await screen.findByText('login failed');
    expect(screen.getByText('signed out')).toBeOnTheScreen();
  });

  test('[QA-103] a transport error rejects without authenticating the provider', async () => {
    reply('POST', '/auth/sessions', new TypeError('fetch failed'));
    renderPublic(<AuthStatusProbe />);
    signIn();
    await screen.findByText('login failed');
    expect(screen.getByText('signed out')).toBeOnTheScreen();
  });
});
