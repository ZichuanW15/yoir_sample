/** HTTP error responses must never be reported as a durable profile save.
 * These fault-injected responses check frontend failure handling, not route presence. */
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
const unavailableFeedback = /(?:profile|saving|service).*(?:unavailable|not available|not supported|not found)|(?:unable|cannot|could not|failed) to (?:load|save).*profile|^Not Found$|^This profile was not found\.$|^Something went wrong\. Please try again\.$/i;
const hasUnavailableFeedback = () => screen.queryAllByText(unavailableFeedback).length > 0;
const enabledSave = () => screen.queryByRole('button', { name: 'Save profile', disabled: false });
const expectNoDurableSuccess = () => {
  expect(screen.queryByText('Your profile is saved and visible on your listings.')).toBeNull();
};

describe('profile save correctness at the real HTTP boundary', () => {
  test.each(unavailableResponses)('[QA-130][US30-AC1] %s cannot announce a durable saved profile', async (_scenario, responseBody) => {
    const real = jest.requireActual('@/src/api/client') as typeof import('@/src/api/client');
    let profileSettled = false;
    let writeSettled = false;
    apiMock.getOwnCounsellorProfile.mockImplementation(async (...args) => {
      try {
        return await real.api.getOwnCounsellorProfile(...args);
      } finally {
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
      ok: false, status: 404, headers: { get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
      json: async () => responseBody,
    } as Response);
    await renderCounsellor(<Profile />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // Wait for the HTTP request to settle before checking recovery feedback.
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
