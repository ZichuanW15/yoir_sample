import { apiFailure, AuthStatusProbe, callsTo, deferred, jsonResponse, navigation, renderPublic, reply, routeParams } from '../public-screen-utils';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import LoginScreen from '@/app/auth/login';
import { Platform } from 'react-native';
import { counsellorSessionFixture, sessionFixture } from '../fixtures';

const enterCredentials = () => {
  fireEvent.changeText(screen.getByLabelText('Email'), '  alex@example.com  ');
  fireEvent.changeText(screen.getByLabelText('Password'), 'correct-password');
};

describe('login screen', () => {
  test('[QA-103] missing credentials are rejected before the HTTP request', async () => {
    await renderPublic(<LoginScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByText('Enter your email and password.')).toBeOnTheScreen();
    expect(callsTo('POST', '/auth/sessions')).toHaveLength(0);
  });

  test('[QA-100] successful login authenticates the real provider and opens the job seeker home', async () => {
    reply('POST', '/auth/sessions', jsonResponse(sessionFixture));
    await renderPublic(<LoginScreen />);
    enterCredentials();
    fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/job-seeker'));
    expect(JSON.parse(callsTo('POST', '/auth/sessions')[0][1]?.body as string)).toEqual({ email: 'alex@example.com', password: 'correct-password', client: Platform.OS === 'web' ? 'web' : 'native' });
    expect(screen.getByText('Welcome, Alex')).toBeOnTheScreen();
  });

  test.each([
    ['job_seeker', sessionFixture, '/services/[serviceId]/timeslots'],
    ['counsellor', counsellorSessionFixture, '/services/[serviceId]'],
  ] as const)('[QA-100] a pending booking returns %s to the appropriate route', async (_role, session, pathname) => {
    routeParams({ serviceId: 'service-1' });
    reply('POST', '/auth/sessions', jsonResponse(session));
    await renderPublic(<LoginScreen />);
    enterCredentials();
    fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith({ pathname, params: { serviceId: 'service-1' } }));
  });

  test('[QA-100] a counsellor login without a booking opens the workspace', async () => {
    reply('POST', '/auth/sessions', jsonResponse(counsellorSessionFixture));
    await renderPublic(<LoginScreen />);
    enterCredentials();
    fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/counsellor'));
  });

  test('[QA-103] invalid credentials show the generic safe message and allow retry', async () => {
    reply('POST', '/auth/sessions', apiFailure('INVALID_CREDENTIALS', 'Do not expose account existence', 401));
    await renderPublic(<><LoginScreen /><AuthStatusProbe /></>);
    enterCredentials();
    fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('The email or password is incorrect.')).toBeOnTheScreen();
    expect(screen.queryByText('Do not expose account existence')).toBeNull();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(screen.getByText('signed out')).toBeOnTheScreen();
    reply('POST', '/auth/sessions', jsonResponse(sessionFixture));
    fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/job-seeker'));
    expect(screen.getByText('signed in as Alex Morgan')).toBeOnTheScreen();
  });

  test('[QA-103] offline failure retains the entered email and offers another submit', async () => {
    reply('POST', '/auth/sessions', new TypeError('fetch failed'));
    await renderPublic(<><LoginScreen /><AuthStatusProbe /></>);
    enterCredentials();
    fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('We could not reach Yoir. Check your connection and try again.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Email')).toHaveProp('value', '  alex@example.com  ');
    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled();
    expect(screen.getByText('signed out')).toBeOnTheScreen();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  test('[QA-100] submitting twice while authentication is pending sends one request', async () => {
    const request = deferred<Response>();
    reply('POST', '/auth/sessions', request.promise);
    await renderPublic(<><LoginScreen /><AuthStatusProbe /></>);
    enterCredentials();
    fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    const pending = screen.getByRole('button', { name: 'Logging in' });
    expect(pending).toBeDisabled();
    expect(screen.getByText('signed out')).toBeOnTheScreen();
    expect(navigation.replace).not.toHaveBeenCalled();
    fireEvent.press(pending);
    expect(callsTo('POST', '/auth/sessions')).toHaveLength(1);
    await act(async () => { request.resolve(jsonResponse(sessionFixture)); });
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledTimes(1));
  });

  test('[QA-87] switching to registration preserves the booking and selected role', async () => {
    routeParams({ serviceId: 'service-1', role: 'counsellor', email: 'prefilled@example.com' });
    await renderPublic(<LoginScreen />);
    expect(screen.getByLabelText('Email')).toHaveProp('value', 'prefilled@example.com');
    fireEvent.press(screen.getByText('Create an account'));
    expect(navigation.push).toHaveBeenCalledWith({ pathname: '/auth/register', params: { serviceId: 'service-1', role: 'counsellor' } });
  });
});
