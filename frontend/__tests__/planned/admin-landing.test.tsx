/** Dev provides /admin and routes restored owners there from the entry screen.
 * This probe checks whether a fresh login also reaches that destination. */
import { callsTo, jsonResponse, navigation, renderPublic, reply } from '../public-screen-utils';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import LoginScreen from '@/app/auth/login';
import { sessionFixture } from '../fixtures';

describe('planned Platform Owner landing area', () => {
  test('[QA-100][US06-AC3] a backend-confirmed Platform Owner reaches a distinct landing area', async () => {
    reply('POST', '/auth/sessions', jsonResponse({ ...sessionFixture, user: { ...sessionFixture.user, role: 'platform_owner' } }));
    await renderPublic(<LoginScreen />);
    fireEvent.changeText(screen.getByLabelText('Email'), sessionFixture.user.email);
    fireEvent.changeText(screen.getByLabelText('Password'), 'correct-password');
    fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledTimes(1));
    expect(callsTo('POST', '/auth/sessions')).toHaveLength(1);
    const destination = navigation.replace.mock.calls[0][0];
    const pathname = typeof destination === 'string' ? destination : destination.pathname;
    // The signed-in owner now has a dedicated administration route.
    expect(pathname).toBe('/admin');
  });
});
