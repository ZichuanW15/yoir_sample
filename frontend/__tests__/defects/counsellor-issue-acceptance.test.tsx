/** Existing real-client preview fallback must not report durable backend success.
 * Fault-injected HTTP responses reproduce the integration failure; this is not
 * proof that the missing profile routes persist a profile. */
import { apiMock, renderCounsellor, setupCounsellorMocks } from '../screens/counsellor-screen-utils';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Profile from '@/app/counsellor/profile';

beforeEach(setupCounsellorMocks);

// Current API handlers wrap even an unmatched route as NOT_FOUND. A body alone
// cannot distinguish a missing route from a missing resource. Keep the current
// API response, a framework/proxy compatibility response, and a business-resource
// response separately labelled instead of claiming they prove endpoint presence.
const unavailableResponses = [
  ['current API unmatched-route 404', { code: 'NOT_FOUND', message: 'Not Found', requestId: 'qa-profile-route' }],
  ['framework/proxy detail-only 404', { detail: 'Not Found' }],
  ['business profile-resource 404', { code: 'NOT_FOUND', message: 'This profile was not found.', requestId: 'qa-profile-resource' }],
] as const;

// A missing button or absent success text alone is not a passing result: require
// a visible, relevant explanation. No particular fallback screen is prescribed.
const unavailableFeedback = /(?:profile|saving|service).*(?:unavailable|not available|not supported|not found)|(?:unable|cannot|could not|failed) to (?:load|save).*profile|^Not Found$|^This profile was not found\.$/i;
const hasUnavailableFeedback = () => screen.queryAllByText(unavailableFeedback).length > 0;
const enabledSave = () => screen.queryByRole('button', { name: 'Save profile', disabled: false });
const expectNoDurableSuccess = () => {
  expect(screen.queryByText('Your profile is saved and visible on your listings.')).toBeNull();
};

describe('profile save correctness at the real HTTP boundary', () => {
  test.each(unavailableResponses)('[QA-130][US30-AC1] %s cannot announce a durable saved profile', async (_scenario, responseBody) => {
    const real = jest.requireActual('@/src/api/client') as typeof import('@/src/api/client');
    real.preview.reset();
    expect(real.isDemoApi).toBe(false);
    let profileSettled = false;
    let writeSettled = false;
    apiMock.getOwnCounsellorProfile.mockImplementation(async (...args) => {
      try {
        return await real.api.getOwnCounsellorProfile(...args);
      } finally {
        // A correct rejection is allowed; do not require a faulty preview read.
        profileSettled = true;
      }
    });
    apiMock.updateOwnCounsellorProfile.mockImplementation(async (...args) => {
      try {
        return await real.api.updateOwnCounsellorProfile(...args);
      } finally {
        writeSettled = true;
      }
    });
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false, status: 404,
      json: async () => responseBody,
    } as Response);
    await renderCounsellor(<Profile />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // Wait for either the real rejection or the current preview fallback to
    // settle; no fixed sleep or assumed loading-message wording is needed.
    await waitFor(() => expect(profileSettled).toBe(true));
    expectNoDurableSuccess();

    if (!enabledSave()) {
      // A clear unavailable state that disables/removes Save is a valid recovery.
      // A blank screen, a disappeared form, or silent no-op cannot pass this path.
      expect(hasUnavailableFeedback()).toBe(true);
      expect(apiMock.updateOwnCounsellorProfile).not.toHaveBeenCalled();
      return;
    }

    fireEvent.changeText(screen.getByLabelText('LinkedIn profile URL'), 'https://www.linkedin.com/in/qa-person');
    fireEvent.changeText(screen.getByLabelText('Introduction'), 'A professional introduction long enough for the current form.');
    fireEvent.changeText(screen.getByLabelText('Background'), 'Career coaching background');
    fireEvent.changeText(screen.getByLabelText('Experience'), 'Career coaching experience');
    fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    // Accept either a completed attempt with explicit unavailable feedback or a
    // safe UI refusal with Save disabled. Do not mandate PATCH as a product fix.
    await waitFor(() => expect(writeSettled || (hasUnavailableFeedback() && !enabledSave())).toBe(true));
    expectNoDurableSuccess();
    expect(hasUnavailableFeedback()).toBe(true);
    if (!apiMock.updateOwnCounsellorProfile.mock.calls.length) expect(enabledSave()).toBeNull();
  });
});
