import { navigation, renderPublic } from '../public-screen-utils';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import EntryScreen from '@/app/index';
import { counsellorSessionFixture, sessionFixture } from '../fixtures';

describe('entry navigation', () => {
  test.each([
    ['I am a Job Seeker', 'job_seeker'],
    ['I am a Career Professional', 'counsellor'],
  ])('[QA-87/91] %s opens its role welcome', async (label, role) => {
    await renderPublic(<EntryScreen />);
    fireEvent.press(screen.getByRole('button', { name: label }));
    expect(navigation.push).toHaveBeenCalledWith({ pathname: '/auth/welcome', params: { role } });
  });

  test('[QA-109] guests can browse without creating a session', async () => {
    await renderPublic(<EntryScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Just looking? Browse as a guest' }));
    expect(navigation.replace).toHaveBeenCalledWith('/marketplace');
  });

  test.each([
    ['job_seeker', sessionFixture, '/job-seeker'],
    ['counsellor', counsellorSessionFixture, '/counsellor'],
    ['platform_owner', { ...sessionFixture, user: { ...sessionFixture.user, role: 'platform_owner' } }, '/admin'],
  ] as const)('[QA-100] an existing %s session opens its signed-in destination', async (_role, session, destination) => {
    await renderPublic(<EntryScreen />, session);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(destination));
    expect(screen.queryByText('I am a Job Seeker')).toBeNull();
  });
});
