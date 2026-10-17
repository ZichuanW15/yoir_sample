import { apiFailure, callsTo, deferred, jsonResponse, renderPublic, reply } from '../public-screen-utils';
import { act, fireEvent, screen } from '@testing-library/react-native';
import PrivacySettingsScreen from '@/app/settings/privacy';
import { sessionFixture } from '../fixtures';

describe('Sprint 3 privacy acceptance (advisory suite)', () => {
  test('[S3-PRIVACY-ROLLBACK][US27-AC3][QA-183] a failed privacy update restores the last saved choice', async () => {
    // Real screen, auth and HTTP client; controlled HTTP responses establish the
    // saved choice and the failed PATCH. This is component, not device/API proof.
    const path = '/me/profile-visibility';
    const pending = deferred<Response>();
    reply('GET', path, jsonResponse({ visibility: 'public' }));
    reply('PATCH', path, pending.promise);
    await renderPublic(<PrivacySettingsScreen />, sessionFixture);

    expect((await screen.findByRole('radio', { name: 'Public' })).props.accessibilityState)
      .toMatchObject({ checked: true, selected: true });
    expect(callsTo('GET', path)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Save privacy settings' })).toBeDisabled();

    fireEvent.press(screen.getByRole('radio', { name: 'Restricted' }));
    expect(screen.getByRole('radio', { name: 'Restricted' }).props.accessibilityState)
      .toMatchObject({ checked: true, selected: true });
    fireEvent.press(screen.getByRole('button', { name: 'Save privacy settings' }));
    const writes = callsTo('PATCH', path);
    expect(writes).toHaveLength(1);
    expect(JSON.parse(String(writes[0][1]?.body))).toEqual({ visibility: 'restricted' });
    expect(screen.getByRole('button', { name: 'Save privacy settings' })).toBeDisabled();

    await act(async () => {
      pending.resolve(apiFailure('UNAVAILABLE', 'Privacy settings were not saved.', 503));
    });
    expect(await screen.findByText('Privacy settings were not saved.')).toBeOnTheScreen();
    expect(screen.queryByText('Privacy settings saved')).toBeNull();
    expect(callsTo('PATCH', path)).toHaveLength(1);

    // US-27 AC3 requires the previous saved option after a save failure. The
    // current catch displays the error but leaves Restricted selected instead.
    // Preserve this correctness assertion; never convert the failure into a pass.
    expect({
      public: screen.getByRole('radio', { name: 'Public' }).props.accessibilityState,
      restricted: screen.getByRole('radio', { name: 'Restricted' }).props.accessibilityState,
    }).toEqual({
      public: expect.objectContaining({ checked: true, selected: true }),
      restricted: expect.objectContaining({ checked: false, selected: false }),
    });
  });
});
