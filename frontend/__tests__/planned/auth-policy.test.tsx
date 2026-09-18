/** Historical session probes migrated to dev's implemented refresh/persistence contract.
 * Storage is an explicit platform seam; the AuthProvider and HTTP client remain real. */
import { AuthStatusProbe, jsonResponse, renderPublic, reply, tick } from '../public-screen-utils';
import { fireEvent, screen } from '@testing-library/react-native';
import { readSession, writeSession } from '@/src/auth/sessionStore';
import { sessionFixture } from '../fixtures';

const signIn = () => fireEvent.press(screen.getByRole('button', { name: 'Sign in probe' }));

describe('implemented refresh and session restoration contract', () => {
  test('[QA-100][DEF-AUTH-EXPIRY] an access-token deadline does not discard a still-refreshable session', async () => {
    jest.setSystemTime(new Date('2026-09-15T00:00:00Z'));
    reply('POST', '/auth/sessions', jsonResponse({ ...sessionFixture, expiresAt: '2026-09-15T00:00:01Z', refreshToken: 'refresh-1', refreshExpiresAt: '2026-10-15T00:00:00Z' }));
    await renderPublic(<AuthStatusProbe />);
    signIn();
    await screen.findByText('signed in as Alex Morgan');
    await tick(1500);
    expect(screen.getByText('signed in as Alex Morgan')).toBeOnTheScreen();
    expect(screen.queryByText('signed out')).toBeNull();
  });

  test('[QA-100][DEF-AUTH-RESTART] a still-valid session survives provider re-creation without another login', async () => {
    jest.setSystemTime(new Date('2026-09-15T00:00:00Z'));
    reply('POST', '/auth/sessions', jsonResponse({ ...sessionFixture, expiresAt: '2026-09-16T00:00:00Z' }));
    const first = await renderPublic(<AuthStatusProbe />);
    signIn();
    await screen.findByText('signed in as Alex Morgan');
    const stored = jest.mocked(writeSession).mock.calls.at(-1)?.[0];
    expect(stored).toBeDefined();
    first.unmount();
    jest.mocked(readSession).mockResolvedValueOnce(stored!);
    await renderPublic(<AuthStatusProbe />);
    await tick(100);
    expect(screen.queryByText('signed in as Alex Morgan')).not.toBeNull();
  });
});
