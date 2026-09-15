/** Existing real-client preview fallback must not report durable backend success.
 * Fault-injected HTTP responses reproduce the integration failure; this is not
 * proof that the missing profile routes persist a profile. */
import { apiMock, renderCounsellor, setupCounsellorMocks } from '../screens/counsellor-screen-utils';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Profile from '@/app/counsellor/profile';

beforeEach(setupCounsellorMocks);
describe('profile save correctness at the real HTTP boundary', () => {
  test('[QA-130][US30-AC1] a missing profile backend cannot announce a durable saved profile', async () => {
    const real = jest.requireActual('@/src/api/client') as typeof import('@/src/api/client');
    real.preview.reset();
    expect(real.isDemoApi).toBe(false);
    let profileSettled = false;
    apiMock.getOwnCounsellorProfile.mockImplementation(async (...args) => {
      try {
        return await real.api.getOwnCounsellorProfile(...args);
      } finally {
        // A correct HTTP rejection must also let this test reach the save
        // assertion; never require the faulty preview read to succeed.
        profileSettled = true;
      }
    });
    apiMock.updateOwnCounsellorProfile.mockImplementation(real.api.updateOwnCounsellorProfile);
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false, status: 404,
      json: async () => ({ code: 'NOT_FOUND', message: 'Not Found', requestId: 'qa-profile-route' }),
    } as Response);
    await renderCounsellor(<Profile />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // Wait for either the real rejection or the current preview fallback to
    // settle; no fixed sleep or assumed loading-message wording is needed.
    await waitFor(() => expect(profileSettled).toBe(true));
    fireEvent.changeText(screen.getByLabelText('LinkedIn profile URL'), 'https://www.linkedin.com/in/qa-person');
    fireEvent.changeText(screen.getByLabelText('Introduction'), 'A professional introduction long enough for the current form.');
    fireEvent.changeText(screen.getByLabelText('Background'), 'Career coaching background');
    fireEvent.changeText(screen.getByLabelText('Experience'), 'Career coaching experience');
    fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/me\/counsellor-profile$/),
      expect.objectContaining({ method: 'PATCH' }),
    ));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save profile' })).toBeEnabled());
    expect(screen.queryByText('Your profile is saved and visible on your listings.') !== null).toBe(false);
  });
});
