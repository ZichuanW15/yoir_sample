import { navigation, renderPublic, routeParams } from '../public-screen-utils';
import { fireEvent, screen } from '@testing-library/react-native';
import WelcomeScreen from '@/app/auth/welcome';

describe('public role welcome', () => {
  test('[QA-87/91] job seekers can choose registration, login or anonymous browsing', async () => {
    routeParams({ role: 'job_seeker' });
    await renderPublic(<WelcomeScreen />);
    expect(screen.getByText('Book your next session')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    expect(navigation.push).toHaveBeenLastCalledWith({ pathname: '/auth/login', params: { role: 'job_seeker' } });
    fireEvent.press(screen.getByRole('button', { name: 'Create an account' }));
    expect(navigation.push).toHaveBeenLastCalledWith({ pathname: '/auth/register', params: { role: 'job_seeker' } });
    fireEvent.press(screen.getByRole('button', { name: 'Continue as a guest' }));
    expect(navigation.replace).toHaveBeenCalledWith('/marketplace');
  });

  test('[QA-91] counsellor welcome preserves the role and requires an account', async () => {
    routeParams({ role: 'counsellor' });
    await renderPublic(<WelcomeScreen />);
    expect(screen.getByText('Take bookings on Yoir')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Continue as a guest' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Create an account' }));
    expect(navigation.push).toHaveBeenCalledWith({ pathname: '/auth/register', params: { role: 'counsellor' } });
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(navigation.back).toHaveBeenCalledTimes(1);
  });

  test('[QA-87] an unknown role uses the public job-seeker choices', async () => {
    routeParams({ role: 'platform_owner' });
    await renderPublic(<WelcomeScreen />);
    expect(screen.getByRole('button', { name: 'Continue as a guest' })).toBeOnTheScreen();
  });
});
