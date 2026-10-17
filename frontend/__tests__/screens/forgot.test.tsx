import { apiFailure, callsTo, deferred, jsonResponse, navigation, renderPublic, reply, routeParams } from '../public-screen-utils';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import ForgotPasswordScreen from '@/app/auth/forgot';

const requestPath = '/auth/password-reset-requests';
const submit = () => fireEvent.press(screen.getByRole('button', { name: /^(Email me a link|Sending)$/ }));

describe('forgot password — US-70', () => {
  test('AT-US-70-1: a registered email shows the generic confirmation after the backend accepts it', async () => {
    reply('POST', requestPath, jsonResponse(undefined, 202));
    await renderPublic(<ForgotPasswordScreen />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'maya@example.com');
    submit();
    expect(await screen.findByText('Check your inbox')).toBeOnTheScreen();
    expect(screen.getByText(/If maya@example\.com has a Yoir account, a reset link is on its way\./)).toBeOnTheScreen();
    expect(JSON.parse(callsTo('POST', requestPath)[0][1]?.body as string)).toEqual({ email: 'maya@example.com' });
  });

  test('AT-US-70-2: an unregistered email produces the identical confirmation — the screen never branches on what the backend knows', async () => {
    reply('POST', requestPath, jsonResponse(undefined, 202));
    await renderPublic(<ForgotPasswordScreen />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'nobody@example.com');
    submit();
    expect(await screen.findByText('Check your inbox')).toBeOnTheScreen();
    expect(screen.getByText(/If nobody@example\.com has a Yoir account, a reset link is on its way\./)).toBeOnTheScreen();
    // Same 202, same code path — there is no "registered" branch on the client to diverge.
    expect(callsTo('POST', requestPath)).toHaveLength(1);
  });

  test('an empty email is rejected before any request is sent', async () => {
    await renderPublic(<ForgotPasswordScreen />);
    submit();
    expect(screen.getByText('Enter the email you signed up with.')).toBeOnTheScreen();
    expect(callsTo('POST', requestPath)).toHaveLength(0);
  });

  test('a server or network failure shows an error and does not claim a link was sent', async () => {
    reply('POST', requestPath, apiFailure('VALIDATION_ERROR', 'That email looks invalid.', 400));
    await renderPublic(<ForgotPasswordScreen />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'bad-address');
    submit();
    expect(await screen.findByText('That email looks invalid.')).toBeOnTheScreen();
    expect(screen.queryByText('Check your inbox')).toBeNull();
  });

  test('offline failure preserves the address and a retry succeeds only after acknowledgement', async () => {
    reply('POST', requestPath, new TypeError('fetch failed'));
    await renderPublic(<ForgotPasswordScreen />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'maya@example.com');
    submit();
    expect(await screen.findByText('We could not reach Yoir. Check your connection and try again.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Email me a link' })).toBeEnabled();
    expect(screen.getByLabelText('Email')).toHaveProp('value', 'maya@example.com');
    const retry = deferred<Response>();
    reply('POST', requestPath, retry.promise);
    submit();
    expect(screen.queryByText('Check your inbox')).toBeNull();
    expect(callsTo('POST', requestPath)).toHaveLength(2);
    await act(async () => retry.resolve(jsonResponse(undefined, 202)));
    expect(await screen.findByText('Check your inbox')).toBeOnTheScreen();
    expect(screen.queryByText('We could not reach Yoir. Check your connection and try again.')).toBeNull();
    expect(callsTo('POST', requestPath).map(([, init]) => JSON.parse(String(init?.body))))
      .toEqual([{ email: 'maya@example.com' }, { email: 'maya@example.com' }]);
  });

  test('submitting shows a busy state and a second press while pending sends one request', async () => {
    const pending = deferred<Response>();
    reply('POST', requestPath, pending.promise);
    await renderPublic(<ForgotPasswordScreen />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'maya@example.com');
    submit();
    const busyButton = screen.getByRole('button', { name: 'Sending' });
    expect(busyButton).toBeDisabled();
    fireEvent.press(busyButton);
    expect(callsTo('POST', requestPath)).toHaveLength(1);
    expect(screen.queryByText('Check your inbox')).toBeNull();
    await act(async () => pending.resolve(jsonResponse(undefined, 202)));
    expect(await screen.findByText('Check your inbox')).toBeOnTheScreen();
  });

  test('the typed email carries over if Forgot password was reached with one prefilled', async () => {
    routeParams({ email: 'prefilled@example.com' });
    await renderPublic(<ForgotPasswordScreen />);
    expect(screen.getByLabelText('Email')).toHaveProp('value', 'prefilled@example.com');
  });

  test('closing the screen goes back', async () => {
    await renderPublic(<ForgotPasswordScreen />);
    fireEvent.press(screen.getByLabelText('Back'));
    expect(navigation.back).toHaveBeenCalled();
  });

  test('after the confirmation, "Back to sign in" returns to login', async () => {
    reply('POST', requestPath, jsonResponse(undefined, 202));
    await renderPublic(<ForgotPasswordScreen />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'maya@example.com');
    submit();
    await screen.findByText('Check your inbox');
    fireEvent.press(screen.getByRole('button', { name: 'Back to sign in' }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/auth/login'));
  });
});
