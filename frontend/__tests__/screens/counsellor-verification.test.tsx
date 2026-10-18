import { apiMock, counsellorProfileFixture, deferred, renderCounsellor, setupCounsellorMocks } from './counsellor-screen-utils';
import { act, fireEvent, screen } from '@testing-library/react-native';
import Verification from '@/app/counsellor/verification';
import { apiError } from '@/src/api/errors';
import { CounsellorProfile, VerificationSubmission } from '@/src/api/types';
import { verificationCopy } from '@/src/verification';

beforeEach(setupCounsellorMocks);

const unsubmitted: CounsellorProfile = { ...counsellorProfileFixture, verificationStatus: 'pending', linkedinUrl: '' };
const stored: VerificationSubmission = {
  id: 'counsellor-1', counsellorId: 'counsellor-1', counsellorName: 'Maya Chen', email: 'maya@example.com',
  linkedInUrl: 'https://www.linkedin.com/in/maya-chen', introduction: '', background: '', experience: '',
  status: 'pending', submittedAt: '2026-10-05T00:00:00Z',
};
const open = async (profile = unsubmitted) => {
  apiMock.getOwnCounsellorProfile.mockResolvedValue(profile);
  await renderCounsellor(<Verification />);
  await screen.findByText('How verification works');
};
const submit = (url: string) => {
  fireEvent.changeText(screen.getByLabelText('LinkedIn profile URL'), url);
  fireEvent.press(screen.getByRole('button', { name: 'Submit for verification' }));
};

describe('Verification screen — US-31, US-32 (mocked API boundary)', () => {
  test('an empty or non-LinkedIn URL is refused in the app and nothing is sent', async () => {
    await open();
    submit('');
    expect(screen.getByText('Enter your LinkedIn profile URL.')).toBeTruthy();
    submit('https://example.com/in/maya');
    expect(screen.getByText(/Enter a LinkedIn profile URL, for example/)).toBeTruthy();
    expect(apiMock.submitVerification).not.toHaveBeenCalled();
  });

  test('in review is shown only once the backend has stored the submission', async () => {
    const pending = deferred<VerificationSubmission>();
    apiMock.submitVerification.mockReturnValueOnce(pending.promise);
    await open();
    submit(' www.linkedin.com/in/maya-chen ');
    expect(apiMock.submitVerification).toHaveBeenCalledWith('https://www.linkedin.com/in/maya-chen', 'counsellor-access-token');
    expect(screen.queryByText(verificationCopy.pending.body)).toBeNull();
    await act(async () => pending.resolve(stored));
    expect(await screen.findByText(verificationCopy.pending.body)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Update my submission' })).toBeTruthy();
  });

  test('a failed submission shows the error and claims no new status', async () => {
    apiMock.submitVerification.mockRejectedValue(apiError(503, 'UNAVAILABLE', 'Verification is temporarily unavailable.'));
    await open();
    submit('linkedin.com/in/maya-chen');
    expect(await screen.findByText('Verification is temporarily unavailable.')).toBeTruthy();
    expect(screen.getByText(verificationCopy.unsubmitted.body)).toBeTruthy();
    expect(screen.queryByText(verificationCopy.pending.body)).toBeNull();
  });

  test('a status that cannot be read shows the error and a retry, never a guessed status', async () => {
    apiMock.getOwnCounsellorProfile.mockRejectedValue(apiError(503, 'UNAVAILABLE', 'Profile is temporarily unavailable.'));
    await renderCounsellor(<Verification />);
    expect(await screen.findByText('Profile is temporarily unavailable.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.queryByText(verificationCopy.pending.label)).toBeNull();
  });

  test.each([
    ['verified', verificationCopy.verified.label],
    ['rejected', verificationCopy.rejected.label],
  ] as const)('%s reads in the shared wording', async (verificationStatus, label) => {
    await open({ ...counsellorProfileFixture, verificationStatus });
    expect(screen.getByText(label)).toBeTruthy();
    // Verified has nothing left to send; rejected can send again.
    expect(screen.queryByRole('button', { name: 'Resubmit for verification' }) !== null).toBe(verificationStatus === 'rejected');
  });
});
