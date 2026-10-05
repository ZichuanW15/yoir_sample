import { apiMock, counsellorProfileFixture, deferred, renderCounsellor, setupCounsellorMocks, settle } from './counsellor-screen-utils';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import Profile from '@/app/counsellor/profile';
import { apiError } from '@/src/api/errors';
import { sessionFixture } from '../fixtures';
beforeEach(() => { setupCounsellorMocks(); jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockReset(); jest.mocked(ImagePicker.launchImageLibraryAsync).mockReset(); });
const openProfile = async () => { await renderCounsellor(<Profile />); await screen.findByDisplayValue(counsellorProfileFixture.introduction); };
// The profile saves itself a moment after the last change: wait out that pause rather than press a button.
const afterPause = { timeout: 3000 };
const saved = () => screen.findByText('Your profile is saved and visible on your listings.', {}, afterPause);
describe('Professional profile UI — QA #130 (mocked API boundary; no backend persistence)', () => {
  test.each([null, sessionFixture])('does not expose profile controls to an unauthorized role (%j)', async (session) => {
    await renderCounsellor(<Profile />, session); expect(screen.getByTestId('redirect')).toBeTruthy(); expect(screen.queryByLabelText('Introduction')).toBeNull();
  });
  test('prefills implemented fields and verification status from the mocked API response', async () => {
    await openProfile(); expect(screen.getByDisplayValue(counsellorProfileFixture.background)).toBeTruthy(); expect(screen.getByDisplayValue(counsellorProfileFixture.experience)).toBeTruthy();
    expect(screen.getByDisplayValue('Melbourne')).toBeTruthy(); expect(screen.getByRole('radio', { name: 'VIC' })).toBeSelected(); expect(screen.getByRole('radio', { name: 'Online' })).toBeSelected(); expect(screen.getByText('Verified Career Professional')).toBeTruthy();
  });
  test('saves implemented profile fields by itself and reloads values from the mocked API response', async () => {
    apiMock.getOwnCounsellorProfile.mockResolvedValueOnce({ ...counsellorProfileFixture, linkedinUrl: '', introduction: '', background: '', experience: '', baseLocation: null, verificationStatus: 'pending' });
    const first = await renderCounsellor(<Profile />);
    await waitFor(() => expect(apiMock.getOwnCounsellorProfile).toHaveBeenCalled());
    fireEvent.changeText(screen.getByLabelText('LinkedIn profile URL'), 'linkedin.com/in/maya-chen');
    fireEvent.changeText(screen.getByLabelText('Introduction'), counsellorProfileFixture.introduction);
    fireEvent.changeText(screen.getByLabelText('Background'), counsellorProfileFixture.background);
    fireEvent.changeText(screen.getByLabelText('Experience'), counsellorProfileFixture.experience);
    await saved();
    expect(apiMock.updateOwnCounsellorProfile).toHaveBeenCalledWith('counsellor-1', expect.objectContaining({ introduction: counsellorProfileFixture.introduction, background: counsellorProfileFixture.background, experience: counsellorProfileFixture.experience, baseLocation: null }), 'counsellor-access-token');
    first.unmount();
    await openProfile();
    expect(screen.getByDisplayValue(counsellorProfileFixture.background)).toBeTruthy();
    expect(apiMock.getOwnCounsellorProfile).toHaveBeenCalledTimes(2);
  });
  test('pending verification permits editing and success waits for the mocked API promise', async () => {
    apiMock.getOwnCounsellorProfile.mockResolvedValue({ ...counsellorProfileFixture, verificationStatus: 'pending' });
    const pending = deferred<typeof counsellorProfileFixture>(); apiMock.updateOwnCounsellorProfile.mockReturnValueOnce(pending.promise);
    await openProfile(); expect(screen.getByText('Verification pending')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('LinkedIn profile URL'), ' WWW.LinkedIn.COM/in/updated ');
    fireEvent.changeText(screen.getByLabelText('Introduction'), '  I help graduates prepare confidently for their interviews.  ');
    expect(apiMock.updateOwnCounsellorProfile).not.toHaveBeenCalled();
    await waitFor(() => expect(apiMock.updateOwnCounsellorProfile).toHaveBeenCalledTimes(1), afterPause);
    expect(apiMock.updateOwnCounsellorProfile).toHaveBeenCalledWith('counsellor-1', expect.objectContaining({ linkedinUrl: 'https://www.linkedin.com/in/updated', introduction: 'I help graduates prepare confidently for their interviews.', baseLocation: { state: 'VIC', cityOrRegion: 'Melbourne' }, defaultModality: 'online' }), 'counsellor-access-token');
    expect(screen.getByText('Saving…')).toBeTruthy(); expect(screen.queryByText('Your profile is saved and visible on your listings.')).toBeNull();
    // What was typed is left alone under the cursor; the link is normalised only in what is sent.
    await settle(pending, counsellorProfileFixture); expect(screen.getByText('Your profile is saved and visible on your listings.')).toBeTruthy(); expect(screen.getByDisplayValue(' WWW.LinkedIn.COM/in/updated ')).toBeTruthy();
  });
  test.each([
    ['LinkedIn profile URL', '', 'Add your LinkedIn profile URL so the Platform Owner can verify you.'],
    ['LinkedIn profile URL', 'https://linkedin.com.attacker.example/in/maya', 'Enter a LinkedIn profile URL, for example https://www.linkedin.com/in/your-name.'],
    ['Introduction', 'short', 'Write at least 20 characters so buyers know who they are booking.'],
    ['Background', '   ', 'Describe your professional background.'],
    ['Experience', '', 'Describe the experience you bring to a session.'],
    ['City or region', '', 'Add the city or region for the state you chose.'],
  ])('rejects invalid %s without saving or losing the entered value', async (label, value, message) => {
    await openProfile(); fireEvent.changeText(screen.getByLabelText(label), value);
    expect(await screen.findByText(message, {}, afterPause)).toBeTruthy(); expect(screen.getByText('Not saved yet')).toBeTruthy();
    expect(screen.getByLabelText(label)).toHaveProp('value', value); expect(apiMock.updateOwnCounsellorProfile).not.toHaveBeenCalled();
  });
  test('requires an area for in-person default and saves it once corrected', async () => {
    await openProfile(); fireEvent.press(screen.getByRole('radio', { name: 'In person' })); fireEvent.press(screen.getByRole('radio', { name: 'VIC' }));
    expect(await screen.findByText('An in-person default needs the state and city you usually meet clients in.', {}, afterPause)).toBeTruthy(); expect(apiMock.updateOwnCounsellorProfile).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('radio', { name: 'NSW' })); fireEvent.changeText(screen.getByLabelText('City or region'), ' Sydney ');
    await saved(); expect(apiMock.updateOwnCounsellorProfile).toHaveBeenCalledWith('counsellor-1', expect.objectContaining({ defaultModality: 'in_person', baseLocation: { state: 'NSW', cityOrRegion: 'Sydney' } }), 'counsellor-access-token');
  });
  test('leaving the screen inside the pause still saves the last change', async () => {
    const first = await renderCounsellor(<Profile />); await screen.findByDisplayValue(counsellorProfileFixture.introduction);
    fireEvent.changeText(screen.getByLabelText('Background'), 'Twelve years in graduate recruitment.');
    first.unmount();
    expect(apiMock.updateOwnCounsellorProfile).toHaveBeenCalledWith('counsellor-1', expect.objectContaining({ background: 'Twelve years in graduate recruitment.' }), 'counsellor-access-token');
  });
  test('a profile that could not be loaded is never saved over', async () => {
    apiMock.getOwnCounsellorProfile.mockRejectedValue(apiError(503, 'UNAVAILABLE', 'Profile could not be loaded.')); await renderCounsellor(<Profile />);
    await screen.findByText('Profile could not be loaded.');
    fireEvent.changeText(screen.getByLabelText('Introduction'), 'Typed into a form the backend never filled in for me.');
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(apiMock.updateOwnCounsellorProfile).not.toHaveBeenCalled();
  });
  test('shows load failure without claiming a successful save', async () => {
    apiMock.getOwnCounsellorProfile.mockRejectedValue(apiError(503, 'UNAVAILABLE', 'Profile could not be loaded.')); await renderCounsellor(<Profile />);
    await screen.findByText('Profile could not be loaded.'); expect(screen.queryByText('Your profile is saved and visible on your listings.')).toBeNull();
  });
  test('an API-boundary rejection retains edits and offers a retry', async () => {
    apiMock.updateOwnCounsellorProfile.mockRejectedValueOnce(apiError(422, 'INVALID_PROFILE', 'Introduction is not accepted.'));
    await openProfile(); fireEvent.changeText(screen.getByLabelText('Introduction'), 'An updated introduction that stays available after an error.');
    await screen.findByText('Introduction is not accepted.', {}, afterPause); expect(screen.getByText('Could not save')).toBeTruthy(); expect(screen.getByDisplayValue('An updated introduction that stays available after an error.')).toBeTruthy(); expect(screen.queryByText('Your profile is saved and visible on your listings.')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' })); await saved(); expect(apiMock.updateOwnCounsellorProfile).toHaveBeenCalledTimes(2);
  });
  test('denied photo permission offers a URL alternative without opening the library', async () => {
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({ granted: false } as ImagePicker.MediaLibraryPermissionResponse);
    await openProfile(); fireEvent.press(screen.getByRole('button', { name: 'Edit profile photo' })); await screen.findByText('Allow photo access, or paste an image URL instead.');
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled(); expect(apiMock.updateOwnCounsellorProfile).not.toHaveBeenCalled();
  });
  test('photo library failure provides recoverable feedback', async () => {
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockRejectedValue(new Error('Native picker unavailable'));
    await openProfile(); fireEvent.press(screen.getByRole('button', { name: 'Edit profile photo' })); await screen.findByText('The photo library is unavailable — paste an image URL instead.'); expect(apiMock.updateOwnCounsellorProfile).not.toHaveBeenCalled();
  });
  test('cancelled photo selection leaves the existing photo unchanged', async () => {
    apiMock.getOwnCounsellorProfile.mockResolvedValue({ ...counsellorProfileFixture, photoUrl: 'https://example.test/original.png' });
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({ granted: true } as ImagePicker.MediaLibraryPermissionResponse);
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: true, assets: null });
    await openProfile(); fireEvent.press(screen.getByRole('button', { name: 'Edit profile photo' }));
    await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled());
    expect(screen.getByLabelText('Maya Chen, profile photo')).toHaveProp('source', { uri: 'https://example.test/original.png' });
  });
  test('pasted photo URL is saved, and removing it saves null', async () => {
    await openProfile(); fireEvent.press(screen.getByRole('button', { name: 'Paste an image URL instead' })); fireEvent.changeText(screen.getByLabelText('Image URL'), 'https://example.test/maya.png');
    expect(screen.getByLabelText('Maya Chen, profile photo')).toHaveProp('source', { uri: 'https://example.test/maya.png' });
    await saved();
    expect(apiMock.updateOwnCounsellorProfile).toHaveBeenLastCalledWith('counsellor-1', expect.objectContaining({ photoUrl: 'https://example.test/maya.png' }), 'counsellor-access-token');
    fireEvent.press(screen.getByRole('button', { name: 'Remove photo' }));
    await waitFor(() => expect(apiMock.updateOwnCounsellorProfile).toHaveBeenCalledTimes(2), afterPause); await saved(); expect(apiMock.updateOwnCounsellorProfile).toHaveBeenLastCalledWith('counsellor-1', expect.objectContaining({ photoUrl: null }), 'counsellor-access-token');
  });
});
