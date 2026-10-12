import { apiFailure, callsTo, deferred, jsonResponse, navigation, renderPublic, reply, routeParams } from '../public-screen-utils';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import ResetPasswordScreen from '@/app/auth/reset';

const resetPath = '/auth/password-resets';
const fillMatching = (password = 'a-brand-new-password') => {
  fireEvent.changeText(screen.getByLabelText('New password'), password);
  fireEvent.changeText(screen.getByLabelText('Confirm new password'), password);
};
const submit = () => fireEvent.press(screen.getByRole('button', { name: /^(Save new password|Saving)$/ }));

describe('set a new password — US-70', () => {
  beforeEach(() => routeParams({ token: 'a-valid-reset-token' }));

  test('AT-US-70-3: a valid token with matching passwords succeeds only once the backend confirms, then goes to login', async () => {
    reply('POST', resetPath, jsonResponse(undefined, 204));
    await renderPublic(<ResetPasswordScreen />);
    fillMatching('a-brand-new-password');
    submit();
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/auth/login'));
    expect(JSON.parse(callsTo('POST', resetPath)[0][1]?.body as string)).toEqual({
      token: 'a-valid-reset-token', password: 'a-brand-new-password', passwordConfirmation: 'a-brand-new-password',
    });
  });

  test('mismatched passwords are rejected before any request, and nothing navigates', async () => {
    await renderPublic(<ResetPasswordScreen />);
    fireEvent.changeText(screen.getByLabelText('New password'), 'one-password');
    fireEvent.changeText(screen.getByLabelText('Confirm new password'), 'a-different-one');
    submit();
    expect(screen.getByText('The passwords do not match.')).toBeOnTheScreen();
    expect(screen.getByText('Does not match the new password.')).toBeOnTheScreen();
    expect(callsTo('POST', resetPath)).toHaveLength(0);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  test('AT-US-70-4: an expired, used or altered token is rejected — the screen shows an error, not success', async () => {
    reply('POST', resetPath, apiFailure('VALIDATION_ERROR', 'This reset link is no longer valid. Ask for a new one.', 400, { token: 'Expired or already used.' }));
    await renderPublic(<ResetPasswordScreen />);
    fillMatching();
    submit();
    expect(await screen.findByText('This reset link is no longer valid. Ask for a new one.')).toBeOnTheScreen();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  test('a link with no token at all is refused before any request, not silently accepted', async () => {
    routeParams({});
    await renderPublic(<ResetPasswordScreen />);
    fillMatching();
    submit();
    expect(screen.getByText('That link is missing its reset code. Ask for a new one.')).toBeOnTheScreen();
    expect(callsTo('POST', resetPath)).toHaveLength(0);
  });

  test('AC6: while the request is in flight the screen is busy, not successful, and a second press sends one request', async () => {
    const pending = deferred<Response>();
    reply('POST', resetPath, pending.promise);
    await renderPublic(<ResetPasswordScreen />);
    fillMatching();
    submit();
    const busyButton = screen.getByRole('button', { name: 'Saving' });
    expect(busyButton).toBeDisabled();
    expect(navigation.replace).not.toHaveBeenCalled();
    fireEvent.press(busyButton);
    expect(callsTo('POST', resetPath)).toHaveLength(1);
    await act(async () => { pending.resolve(jsonResponse(undefined, 204)); });
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledTimes(1));
  });

  test('AC6: a network failure shows an error and does not navigate to login', async () => {
    reply('POST', resetPath, new TypeError('fetch failed'));
    await renderPublic(<ResetPasswordScreen />);
    fillMatching();
    submit();
    expect(await screen.findByText('We could not reach Yoir. Check your connection and try again.')).toBeOnTheScreen();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save new password' })).toBeEnabled();
  });
});
