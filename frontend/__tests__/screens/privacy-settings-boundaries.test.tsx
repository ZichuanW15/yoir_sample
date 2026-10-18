import { apiFailure, callsTo, deferred, jsonResponse, navigation, renderPublic, reply } from '../public-screen-utils';
import { act, fireEvent, screen } from '@testing-library/react-native';
import PrivacySettingsScreen from '@/app/settings/privacy';
import { counsellorSessionFixture, sessionFixture } from '../fixtures';

const path = '/me/profile-visibility';
const save = () => screen.getByRole('button', { name: 'Save privacy settings' });

describe('QA-183 privacy settings confirmed-read and write boundaries', () => {
  test.each([
    ['job seeker', sessionFixture, 'partial', 'Partially visible'],
    ['job seeker', sessionFixture, 'restricted', 'Restricted'],
    ['professional', counsellorSessionFixture, 'partial', 'Partially visible'],
    ['professional', counsellorSessionFixture, 'restricted', 'Restricted'],
  ] as const)('[%#] stored privacy is restored for the member role', async (_role, session, visibility, label) => {
    reply('GET', path, jsonResponse({ visibility }));
    await renderPublic(<PrivacySettingsScreen />, session);
    expect((await screen.findByRole('radio', { name: label })).props.accessibilityState)
      .toMatchObject({ checked: true, selected: true });
    expect(screen.getByRole('radio', { name: 'Public' }).props.accessibilityState.checked).toBe(false);
    expect(save()).toBeDisabled();
    expect(callsTo('PATCH', path)).toHaveLength(0);
    expect(callsTo('GET', path)[0][1]?.headers).toEqual(expect.objectContaining({
      Authorization: `Bearer ${session.accessToken}`,
    }));
  });

  test('no privacy choice or save action is fabricated while the stored setting loads', async () => {
    const pending = deferred<Response>();
    reply('GET', path, pending.promise);
    await renderPublic(<PrivacySettingsScreen />, sessionFixture);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Save privacy settings' })).toBeNull();
    await act(async () => pending.resolve(jsonResponse({ visibility: 'restricted' })));
    expect((await screen.findByRole('radio', { name: 'Restricted' })).props.accessibilityState.checked).toBe(true);
  });

  test('the saved choice and success toast follow the PATCH response, and a pending save cannot be duplicated', async () => {
    const pending = deferred<Response>();
    reply('GET', path, jsonResponse({ visibility: 'public' }));
    reply('PATCH', path, pending.promise);
    await renderPublic(<PrivacySettingsScreen />, sessionFixture);
    fireEvent.press(await screen.findByRole('radio', { name: 'Partially visible' }));
    fireEvent.press(save());
    expect(save()).toBeDisabled();
    fireEvent.press(save());
    expect(callsTo('PATCH', path)).toHaveLength(1);
    expect(JSON.parse(String(callsTo('PATCH', path)[0][1]?.body))).toEqual({ visibility: 'partial' });
    expect(screen.queryByText('Privacy settings saved')).toBeNull();
    // The response is authoritative even if it differs from the requested choice.
    await act(async () => pending.resolve(jsonResponse({ visibility: 'restricted' })));
    expect(await screen.findByText('Privacy settings saved')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Restricted' }).props.accessibilityState.checked).toBe(true);
    expect(save()).toBeDisabled();
  });

  test('reopening reads the confirmed setting again instead of keeping a previous screen selection', async () => {
    reply('GET', path, jsonResponse({ visibility: 'public' }));
    reply('PATCH', path, jsonResponse({ visibility: 'restricted' }));
    const first = await renderPublic(<PrivacySettingsScreen />, sessionFixture);
    fireEvent.press(await screen.findByRole('radio', { name: 'Restricted' }));
    fireEvent.press(save());
    await screen.findByText('Privacy settings saved');
    first.unmount();
    // A fresh HTTP read supplies the saved server value; this is UI behavior,
    // while the API persistence tests verify the actual database transaction.
    reply('GET', path, jsonResponse({ visibility: 'restricted' }));
    await renderPublic(<PrivacySettingsScreen />, sessionFixture);
    expect((await screen.findByRole('radio', { name: 'Restricted' })).props.accessibilityState.checked).toBe(true);
    expect(callsTo('GET', path)).toHaveLength(2);
    expect(save()).toBeDisabled();
    expect(screen.queryByText('Privacy settings saved')).toBeNull();
  });

  test('a failed initial read shows the error without claiming any level is saved', async () => {
    reply('GET', path, apiFailure('UNAVAILABLE', 'Privacy could not be loaded.', 503));
    await renderPublic(<PrivacySettingsScreen />, counsellorSessionFixture);
    expect(await screen.findByText('Privacy could not be loaded.')).toBeOnTheScreen();
    for (const choice of screen.getAllByRole('radio')) expect(choice.props.accessibilityState.checked).toBe(false);
    expect(save()).toBeDisabled();
    expect(screen.queryByText('Privacy settings saved')).toBeNull();
    expect(callsTo('PATCH', path)).toHaveLength(0);
  });

  test('a refused save can be retried and reports success only after the recovered response', async () => {
    reply('GET', path, jsonResponse({ visibility: 'public' }));
    reply('PATCH', path, apiFailure('UNAVAILABLE', 'Privacy update unavailable.', 503));
    await renderPublic(<PrivacySettingsScreen />, counsellorSessionFixture);
    fireEvent.press(await screen.findByRole('radio', { name: 'Restricted' }));
    fireEvent.press(save());
    expect(await screen.findByText('Privacy update unavailable.')).toBeOnTheScreen();
    expect(screen.queryByText('Privacy settings saved')).toBeNull();
    // Selection rollback has its own unchanged advisory assertion. Re-select the
    // requested value explicitly so retry correctness does not depend on that bug.
    fireEvent.press(screen.getByRole('radio', { name: 'Restricted' }));
    const retry = deferred<Response>();
    reply('PATCH', path, retry.promise);
    fireEvent.press(save());
    expect(screen.queryByText('Privacy settings saved')).toBeNull();
    await act(async () => retry.resolve(jsonResponse({ visibility: 'restricted' })));
    expect(await screen.findByText('Privacy settings saved')).toBeOnTheScreen();
    expect(screen.queryByText('Privacy update unavailable.')).toBeNull();
    expect(save()).toBeDisabled();
    expect(callsTo('PATCH', path).map(([, init]) => JSON.parse(String(init?.body))))
      .toEqual([{ visibility: 'restricted' }, { visibility: 'restricted' }]);
  });

  test('an anonymous visitor is redirected without requesting another account’s settings', async () => {
    await renderPublic(<PrivacySettingsScreen />);
    expect(navigation.replace).toHaveBeenCalledWith('/auth/login');
    expect(callsTo('GET', path)).toHaveLength(0);
    expect(callsTo('PATCH', path)).toHaveLength(0);
  });
});
