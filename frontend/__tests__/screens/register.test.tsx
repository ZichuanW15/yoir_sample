import { apiFailure, AuthStatusProbe, callsTo, deferred, jsonResponse, navigation, renderPublic, reply, routeParams } from '../public-screen-utils';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import RegisterScreen from '@/app/auth/register';
import { sessionFixture } from '../fixtures';

function completeForm() {
  fireEvent.changeText(screen.getByLabelText('Full name'), '  Alex Morgan  ');
  fireEvent.changeText(screen.getByLabelText('Email'), '  alex@example.com  ');
  fireEvent.changeText(screen.getByLabelText('Password'), 'correct-password');
  fireEvent.changeText(screen.getByLabelText('Confirm password'), 'correct-password');
}
const submit = () => fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

describe('registration screen', () => {
  // Characterization only: the current global banner is not evidence of the
  // per-field error association required by US-01 AC2/3. Those stronger probes
  // are in planned/auth-issue-acceptance.test.tsx, excluded from this implemented-
  // scope run. Excluded criteria are NOT passing parent-story acceptance.
  test.each(['Full name', 'Email', 'Password', 'Confirm password'])('[QA-87][characterization] rejects empty %s with the current form-level banner', async (label) => {
    await renderPublic(<RegisterScreen />);
    completeForm();
    fireEvent.changeText(screen.getByLabelText(label), '');
    submit();
    expect(screen.getByText('Complete all required fields.')).toBeOnTheScreen();
    expect(callsTo('POST', '/auth/users')).toHaveLength(0);
  });

  test('[QA-94][characterization] rejects a password below the current eight-character rule', async () => {
    await renderPublic(<RegisterScreen />);
    completeForm();
    fireEvent.changeText(screen.getByLabelText('Password'), 'short');
    fireEvent.changeText(screen.getByLabelText('Confirm password'), 'short');
    submit();
    expect(screen.getByText('Password must be at least 8 characters.')).toBeOnTheScreen();
    expect(callsTo('POST', '/auth/users')).toHaveLength(0);
  });

  test('[QA-87][characterization] rejects mismatched passwords with the current form-level banner', async () => {
    await renderPublic(<><RegisterScreen /><AuthStatusProbe /></>);
    completeForm();
    fireEvent.changeText(screen.getByLabelText('Confirm password'), 'different-password');
    submit();
    expect(screen.getByText('Passwords do not match.')).toBeOnTheScreen();
    expect(callsTo('POST', '/auth/users')).toHaveLength(0);
  });

  test.each(['job_seeker', 'counsellor'] as const)('[QA-87/91] registers %s and retains the booking on the login continuation', async (role) => {
    routeParams({ role, serviceId: 'service-1' });
    reply('POST', '/auth/users', jsonResponse({ ...sessionFixture.user, role }, 201));
    await renderPublic(<><RegisterScreen /><AuthStatusProbe /></>);
    expect(screen.getByRole('radio', { name: role === 'counsellor' ? 'Career Counsellor' : 'Job Seeker' })).toBeChecked();
    completeForm();
    submit();
    expect(await screen.findByText('Your account is ready')).toBeOnTheScreen();
    expect(screen.getByText('signed out')).toBeOnTheScreen();
    expect(callsTo('POST', '/auth/sessions')).toHaveLength(0);
    expect(JSON.parse(callsTo('POST', '/auth/users')[0][1]?.body as string)).toEqual({
      name: 'Alex Morgan', email: 'alex@example.com', password: 'correct-password', passwordConfirmation: 'correct-password', role,
    });
    fireEvent.press(screen.getByRole('button', { name: 'Continue to log in' }));
    expect(navigation.replace).toHaveBeenCalledWith({ pathname: '/auth/login', params: { role, serviceId: 'service-1', email: 'alex@example.com' } });
  });

  test('[QA-91] the user can change the role before submitting', async () => {
    reply('POST', '/auth/users', jsonResponse({ ...sessionFixture.user, role: 'counsellor' }, 201));
    await renderPublic(<RegisterScreen />);
    completeForm();
    fireEvent.press(screen.getByRole('radio', { name: 'Career Counsellor' }));
    submit();
    await screen.findByText('Your account is ready');
    expect(JSON.parse(callsTo('POST', '/auth/users')[0][1]?.body as string).role).toBe('counsellor');
  });

  test.each(['job_seeker', 'counsellor'] as const)('[QA-97/91] duplicate email for %s retains every field and succeeds after correction', async (role) => {
    routeParams({ role });
    reply('POST', '/auth/users', apiFailure('EMAIL_ALREADY_REGISTERED', 'An account already exists for this email address.', 409, { email: 'Use a different email address.' }));
    await renderPublic(<RegisterScreen />);
    completeForm();
    submit();
    expect(await screen.findByText('An account already exists for this email address.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Full name')).toHaveProp('value', '  Alex Morgan  ');
    expect(screen.getByLabelText('Email')).toHaveProp('value', '  alex@example.com  ');
    expect(screen.getByLabelText('Password')).toHaveProp('value', 'correct-password');
    expect(screen.getByLabelText('Confirm password')).toHaveProp('value', 'correct-password');
    expect(screen.getByRole('radio', { name: role === 'counsellor' ? 'Career Counsellor' : 'Job Seeker' })).toBeChecked();
    expect(navigation.replace).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('Email'), 'new@example.com');
    reply('POST', '/auth/users', jsonResponse({ ...sessionFixture.user, role, email: 'new@example.com' }, 201));
    submit();
    await screen.findByText('Your account is ready');
    expect(callsTo('POST', '/auth/users')).toHaveLength(2);
    expect(JSON.parse(callsTo('POST', '/auth/users')[1][1]?.body as string)).toMatchObject({ email: 'new@example.com', role });
    fireEvent.press(screen.getByRole('button', { name: 'Continue to log in' }));
    expect(navigation.replace).toHaveBeenCalledWith({ pathname: '/auth/login', params: { role, email: 'new@example.com' } });
  });

  test('[QA-94] a network failure preserves inputs without success, login or authentication', async () => {
    reply('POST', '/auth/users', new TypeError('offline'));
    await renderPublic(<><RegisterScreen /><AuthStatusProbe /></>);
    completeForm();
    submit();
    expect(await screen.findByText('We could not reach Yoir. Check your connection and try again.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
    expect(screen.getByLabelText('Email')).toHaveProp('value', '  alex@example.com  ');
    expect(screen.getByText('signed out')).toBeOnTheScreen();
    expect(screen.queryByText('Your account is ready')).toBeNull();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(callsTo('POST', '/auth/sessions')).toHaveLength(0);
  });

  test.each([
    [400, 'VALIDATION_ERROR', 'Correct the invalid registration fields.', { name: 'A full name is required.' }],
    [500, 'INTERNAL_ERROR', 'Registration could not be completed.', undefined],
  ] as const)('[QA-94] backend %s rejection remains anonymous and does not claim success', async (status, code, message, fields) => {
    reply('POST', '/auth/users', apiFailure(code, message, status, fields));
    await renderPublic(<><RegisterScreen /><AuthStatusProbe /></>);
    completeForm();
    submit();
    // US-02 permits a field-level OR form-level server-validation message.
    expect(await screen.findByText(message)).toBeOnTheScreen();
    expect(screen.getByText('signed out')).toBeOnTheScreen();
    expect(screen.queryByText('Your account is ready')).toBeNull();
    expect(screen.getByLabelText('Full name')).toHaveProp('value', '  Alex Morgan  ');
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(callsTo('POST', '/auth/sessions')).toHaveLength(0);
  });

  test('[QA-87] double submit during registration sends a single request', async () => {
    const pending = deferred<Response>();
    reply('POST', '/auth/users', pending.promise);
    await renderPublic(<><RegisterScreen /><AuthStatusProbe /></>);
    completeForm();
    submit();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create account' })).toHaveProp('accessibilityState', expect.objectContaining({ busy: true }));
    expect(screen.getByText('signed out')).toBeOnTheScreen();
    expect(screen.queryByText('Your account is ready')).toBeNull();
    expect(navigation.replace).not.toHaveBeenCalled();
    submit();
    expect(callsTo('POST', '/auth/users')).toHaveLength(1);
    await act(async () => pending.resolve(jsonResponse(sessionFixture.user, 201)));
    await waitFor(() => expect(screen.getByText('Your account is ready')).toBeOnTheScreen());
  });
});
