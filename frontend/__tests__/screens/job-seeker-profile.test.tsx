import { act, fireEvent, screen } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { apiFailure, callsTo, deferred, jsonResponse, navigation, renderPublic, reply, tick } from '../public-screen-utils';
import JobSeekerProfileScreen from '@/app/job-seeker/profile';
import { JobSeekerProfile, Session } from '@/src/api/types';
import { sessionFixture } from '../fixtures';

// Not mocked by public-screen-utils: counsellor-profile.test.tsx takes the same approach for the same reason.
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const PROFILE = '/me/job-seeker-profile';
const profileFixture: JobSeekerProfile = {
  name: sessionFixture.user.name,
  email: sessionFixture.user.email,
  photoUrl: null,
  headline: 'Final-year engineering student',
  careerGoals: 'A graduate role in civil engineering.',
};
const counsellorSession: Session = { ...sessionFixture, user: { ...sessionFixture.user, id: 'user-2', role: 'counsellor' } };

async function openProfile(profile: JobSeekerProfile = profileFixture) {
  reply('GET', PROFILE, jsonResponse(profile));
  await renderPublic(<JobSeekerProfileScreen />, sessionFixture);
  await screen.findByDisplayValue(profile.name);
}

beforeEach(() => {
  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockReset();
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockReset();
});

describe('job seeker profile — US-29', () => {
  test('a signed-in Job Seeker opening their profile sees the values the backend returns', async () => {
    await openProfile();
    expect(screen.getByDisplayValue(profileFixture.headline)).toBeOnTheScreen();
    expect(screen.getByDisplayValue(profileFixture.careerGoals)).toBeOnTheScreen();
    expect(screen.getByText(sessionFixture.user.email)).toBeOnTheScreen();
    expect(callsTo('GET', PROFILE)[0][1]?.headers).toMatchObject({ Authorization: `Bearer ${sessionFixture.accessToken}` });
  });

  test('a failed load shows an error and Try again reloads the same profile', async () => {
    reply('GET', PROFILE, apiFailure('UNAVAILABLE', 'Profile could not be loaded.', 503));
    await renderPublic(<JobSeekerProfileScreen />, sessionFixture);
    await screen.findByText('Profile could not be loaded.');
    expect(screen.queryByDisplayValue(profileFixture.headline)).toBeNull();
    reply('GET', PROFILE, jsonResponse(profileFixture));
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByDisplayValue(profileFixture.headline);
    expect(callsTo('GET', PROFILE)).toHaveLength(2);
  });

  test('no session redirects to login as a job seeker', async () => {
    await renderPublic(<JobSeekerProfileScreen />);
    expect(navigation.replace).toHaveBeenCalledWith({ pathname: '/auth/login', params: { role: 'job_seeker' } });
    expect(screen.queryByLabelText('Name')).toBeNull();
  });

  test('a signed-in Career Professional is sent to their own home, not this profile', async () => {
    // The screen's own load effect runs before the role check below takes visual
    // effect, so the backend's own guard (AC4, covered server-side in
    // test_job_seeker_profile.py) is the one actually relied on here — matched below.
    reply('GET', PROFILE, apiFailure('FORBIDDEN', 'Only Job Seekers have a Job Seeker profile.', 403));
    await renderPublic(<JobSeekerProfileScreen />, counsellorSession);
    expect(navigation.replace).toHaveBeenCalledWith('/counsellor');
    expect(screen.queryByLabelText('Name')).toBeNull();
    expect(screen.queryByText(profileFixture.headline)).toBeNull();
  });

  test('requires a name and never calls the backend for an empty one', async () => {
    await openProfile();
    fireEvent.changeText(screen.getByLabelText('Name'), '   ');
    fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByText('Add your name.')).toBeOnTheScreen();
    expect(callsTo('PATCH', PROFILE)).toHaveLength(0);
  });

  test('shows success only once the backend confirms the save, not before', async () => {
    await openProfile();
    const pending = deferred<Response>();
    reply('PATCH', PROFILE, pending.promise);
    fireEvent.changeText(screen.getByLabelText('Career goals'), ' A graduate role in structural engineering. ');
    fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    await tick();
    expect(screen.queryByText('Profile saved')).toBeNull();
    await act(async () => pending.resolve(jsonResponse({ ...profileFixture, careerGoals: 'A graduate role in structural engineering.' })));
    await tick();
    expect(screen.getByText('Profile saved')).toBeOnTheScreen();
    expect(JSON.parse(String(callsTo('PATCH', PROFILE)[0][1]?.body))).toEqual({
      name: profileFixture.name, photoUrl: null, headline: profileFixture.headline, careerGoals: 'A graduate role in structural engineering.',
    });
  });

  test('a backend rejection keeps the typed values on screen and shows its message, with no success toast', async () => {
    await openProfile();
    reply('PATCH', PROFILE, apiFailure('VALIDATION_ERROR', 'Career goals could not be saved.', 400));
    fireEvent.changeText(screen.getByLabelText('Career goals'), 'Typed text that must survive the rejection.');
    fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByText('Career goals could not be saved.')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('Typed text that must survive the rejection.')).toBeOnTheScreen();
    expect(screen.queryByText('Profile saved')).toBeNull();
  });

  test('a profile that failed to load is never saved over', async () => {
    reply('GET', PROFILE, apiFailure('UNAVAILABLE', 'Profile could not be loaded.', 503));
    await renderPublic(<JobSeekerProfileScreen />, sessionFixture);
    await screen.findByText('Profile could not be loaded.');
    expect(screen.queryByRole('button', { name: 'Save profile' })).toBeNull();
    expect(callsTo('PATCH', PROFILE)).toHaveLength(0);
  });

  test('adds a picked photo and saves it, then removing it saves null', async () => {
    await openProfile();
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({ granted: true } as ImagePicker.MediaLibraryPermissionResponse);
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false, assets: [{ uri: 'file://photo.jpg', base64: 'xyz123==' } as ImagePicker.ImagePickerAsset],
    });
    reply('PATCH', PROFILE, jsonResponse({ ...profileFixture, photoUrl: 'data:image/jpeg;base64,xyz123==' }));
    fireEvent.press(screen.getByRole('button', { name: 'Add profile photo' }));
    await screen.findByRole('button', { name: 'Remove photo' });
    fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    await screen.findByText('Profile saved');
    expect(JSON.parse(String(callsTo('PATCH', PROFILE)[0][1]?.body))).toMatchObject({ photoUrl: 'data:image/jpeg;base64,xyz123==' });

    reply('PATCH', PROFILE, jsonResponse({ ...profileFixture, photoUrl: null }));
    fireEvent.press(screen.getByRole('button', { name: 'Remove photo' }));
    fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    await screen.findByText('Profile saved');
    expect(JSON.parse(String(callsTo('PATCH', PROFILE)[1][1]?.body))).toMatchObject({ photoUrl: null });
  });

  test('denied photo permission is reported without opening the picker', async () => {
    await openProfile();
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({ granted: false } as ImagePicker.MediaLibraryPermissionResponse);
    fireEvent.press(screen.getByRole('button', { name: 'Add profile photo' }));
    await screen.findByText('Allow photo access to add a profile photo.');
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  test('opens profile privacy settings', async () => {
    await openProfile();
    fireEvent.press(screen.getByRole('button', { name: 'Profile privacy' }));
    expect(navigation.push).toHaveBeenCalledWith('/settings/privacy');
  });

  test('back returns to the job seeker home', async () => {
    await openProfile();
    fireEvent.press(screen.getByRole('button', { name: /back/i }));
    expect(navigation.back).toHaveBeenCalled();
  });
});
