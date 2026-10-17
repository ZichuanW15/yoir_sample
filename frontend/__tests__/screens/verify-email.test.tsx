import { apiFailure, AuthStatusProbe, callsTo, deferred, jsonResponse, navigation, renderPublic, reply, routeParams } from '../public-screen-utils';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import VerifyEmailScreen from '@/app/auth/verify';
import { VerifyEmailBanner } from '@/src/components/VerifyEmailBanner';
import { writeSession } from '@/src/auth/sessionStore';
import { sessionFixture } from '../fixtures';

const verifyPath = '/auth/email-verifications';
const resendPath = '/auth/email-verification-requests';
const unverified = { ...sessionFixture, user: { ...sessionFixture.user, emailVerified: false } };

// Actual screens, auth provider and HTTP client; mail delivery is outside this suite.
describe('email verification link and recovery', () => {
  test('waits for server confirmation, adopts and persists the returned session exactly once', async () => {
    routeParams({ token: 'single-use-token' });
    const pending = deferred<Response>();
    reply('POST', verifyPath, pending.promise);
    await renderPublic(<><VerifyEmailScreen /><AuthStatusProbe /></>);
    expect(screen.getByText('Confirming your email…')).toBeOnTheScreen();
    expect(screen.getByText('signed out')).toBeOnTheScreen();
    expect(screen.queryByText("You're confirmed")).toBeNull();
    await act(async () => pending.resolve(jsonResponse(sessionFixture)));
    expect(await screen.findByText("You're confirmed")).toBeOnTheScreen();
    expect(screen.getByText(`signed in as ${sessionFixture.user.name}`)).toBeOnTheScreen();
    expect(writeSession).toHaveBeenCalledWith(JSON.stringify(sessionFixture));
    expect(callsTo('POST', verifyPath)).toHaveLength(1);
    expect(JSON.parse(callsTo('POST', verifyPath)[0][1]?.body as string)).toEqual({ token: 'single-use-token' });
    fireEvent.press(screen.getByRole('button', { name: 'Browse Career Professionals' }));
    expect(navigation.replace).toHaveBeenCalledWith('/marketplace');
  });

  test('a missing token makes no verification request and offers sign-in navigation', async () => {
    await renderPublic(<VerifyEmailScreen />);
    expect(screen.getByText('That link is missing its confirmation code.')).toBeOnTheScreen();
    expect(callsTo('POST', verifyPath)).toHaveLength(0);
    fireEvent.press(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(navigation.replace).toHaveBeenCalledWith('/auth/login');
  });

  test.each(['Expired token.', 'This link has already been used.'])('a rejected token shows %s without adopting a session', async (message) => {
    routeParams({ token: 'bad-token' });
    reply('POST', verifyPath, apiFailure('VALIDATION_ERROR', message, 400));
    await renderPublic(<><VerifyEmailScreen /><AuthStatusProbe /></>);
    expect(await screen.findByText(message)).toBeOnTheScreen();
    expect(screen.getByText('signed out')).toBeOnTheScreen();
    expect(screen.queryByText("You're confirmed")).toBeNull();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  test('network failure offers recovery without claiming verification succeeded', async () => {
    routeParams({ token: 'offline-token' });
    reply('POST', verifyPath, new TypeError('offline'));
    await renderPublic(<VerifyEmailScreen />);
    expect(await screen.findByText('We could not reach Yoir. Check your connection and try again.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Send me a new link' })).toBeEnabled();
    expect(screen.queryByText("You're confirmed")).toBeNull();
  });

  test('resend rejects whitespace without an HTTP request', async () => {
    await renderPublic(<VerifyEmailScreen />);
    fireEvent.changeText(screen.getByLabelText('Email'), '   ');
    fireEvent.press(screen.getByRole('button', { name: 'Send me a new link' }));
    expect(screen.getByText('Enter the address you signed up with.')).toBeOnTheScreen();
    expect(callsTo('POST', resendPath)).toHaveLength(0);
  });

  test('resend trims the address, disables repeated presses and uses enumeration-safe success copy', async () => {
    const pending = deferred<Response>();
    reply('POST', resendPath, pending.promise);
    await renderPublic(<VerifyEmailScreen />);
    fireEvent.changeText(screen.getByLabelText('Email'), '  someone@example.com  ');
    fireEvent.press(screen.getByRole('button', { name: 'Send me a new link' }));
    const sending = screen.getByRole('button', { name: 'Sending' });
    expect(sending).toBeDisabled();
    fireEvent.press(sending);
    expect(callsTo('POST', resendPath)).toHaveLength(1);
    expect(JSON.parse(callsTo('POST', resendPath)[0][1]?.body as string)).toEqual({ email: 'someone@example.com' });
    expect(screen.queryByText(/a new link is on its way/)).toBeNull();
    await act(async () => pending.resolve(jsonResponse(undefined, 204)));
    expect(await screen.findByText('If that address has an account, a new link is on its way.')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Email')).toBeNull();
  });

  test('the signed-in email is prefilled and a failed resend can be retried', async () => {
    reply('POST', resendPath, apiFailure('UNAVAILABLE', 'Email is temporarily unavailable.', 503));
    await renderPublic(<VerifyEmailScreen />, unverified);
    expect(screen.getByLabelText('Email')).toHaveDisplayValue(unverified.user.email);
    fireEvent.press(screen.getByRole('button', { name: 'Send me a new link' }));
    expect(await screen.findByText('Email is temporarily unavailable.')).toBeOnTheScreen();
    expect(screen.queryByText(/a new link is on its way/)).toBeNull();
    reply('POST', resendPath, jsonResponse(undefined, 204));
    fireEvent.press(screen.getByRole('button', { name: 'Send me a new link' }));
    expect(await screen.findByText(/a new link is on its way/)).toBeOnTheScreen();
    expect(callsTo('POST', resendPath)).toHaveLength(2);
  });
});

describe('unverified-email banner', () => {
  test('is absent for a guest', async () => {
    await renderPublic(<VerifyEmailBanner />);
    expect(screen.queryByText(/Confirm your email/)).toBeNull();
    expect(callsTo('POST', resendPath)).toHaveLength(0);
  });

  test('is absent for a verified account', async () => {
    await renderPublic(<VerifyEmailBanner />, sessionFixture);
    expect(screen.queryByText(/Confirm your email/)).toBeNull();
  });

  test('describes the default booking prerequisite', async () => {
    await renderPublic(<VerifyEmailBanner />, unverified);
    expect(screen.getByText('Confirm your email to book a session')).toBeOnTheScreen();
    expect(screen.getByText(`We sent a link to ${unverified.user.email}. Following it confirms your address.`)).toBeOnTheScreen();
  });

  test('supports publishing copy and only shows sent state after the resend response', async () => {
    const pending = deferred<Response>();
    reply('POST', resendPath, pending.promise);
    await renderPublic(<VerifyEmailBanner what="publish a service" />, unverified);
    expect(screen.getByText('Confirm your email to publish a service')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Send the confirmation email again' }));
    expect(screen.queryByText(/We have sent a new link/)).toBeNull();
    expect(JSON.parse(callsTo('POST', resendPath)[0][1]?.body as string)).toEqual({ email: unverified.user.email });
    await act(async () => pending.resolve(jsonResponse(undefined, 204)));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Send the confirmation email again' })).toBeNull());
    expect(screen.getByText(`We have sent a new link to ${unverified.user.email}. It lasts a day.`)).toBeOnTheScreen();
  });
});
