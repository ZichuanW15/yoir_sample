/** Proposed Web session policy probes, not approved Sprint 2 release criteria.
 * US-06 explicitly leaves expiry/refresh/relaunch behavior to a design decision.
 * Keep these assertions visible for that decision, but outside release gates.
 */
import { AuthStatusProbe, jsonResponse, renderPublic, reply, tick } from '../public-screen-utils';
import { fireEvent, screen } from '@testing-library/react-native';
import { sessionFixture } from '../fixtures';

const signIn = () => fireEvent.press(screen.getByRole('button', { name: 'Sign in probe' }));

describe('unapproved Web session policy proposals', () => {
  test('[QA-100][DEF-AUTH-EXPIRY] local authentication ends when the server-provided expiry is reached', async () => {
    jest.setSystemTime(new Date('2026-09-15T00:00:00Z'));
    reply('POST', '/auth/sessions', jsonResponse({ ...sessionFixture, expiresAt: '2026-09-15T00:00:01Z' }));
    renderPublic(<AuthStatusProbe />);
    signIn();
    await screen.findByText('signed in as Alex Morgan');
    await tick(1500);
    expect(screen.queryByText('signed in as Alex Morgan')).toBeNull();
    expect(screen.getByText('signed out')).toBeOnTheScreen();
  });

  test('[QA-100][DEF-AUTH-RESTART] a still-valid session survives provider re-creation without another login', async () => {
    jest.setSystemTime(new Date('2026-09-15T00:00:00Z'));
    reply('POST', '/auth/sessions', jsonResponse({ ...sessionFixture, expiresAt: '2026-09-16T00:00:00Z' }));
    const first = renderPublic(<AuthStatusProbe />);
    signIn();
    await screen.findByText('signed in as Alex Morgan');
    first.unmount();
    renderPublic(<AuthStatusProbe />);
    await tick(100);
    expect(screen.queryByText('signed in as Alex Morgan')).not.toBeNull();
  });
});
