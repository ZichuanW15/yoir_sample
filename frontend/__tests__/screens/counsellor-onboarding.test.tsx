import { apiMock, deferred, renderCounsellor, settle, setupCounsellorMocks } from './counsellor-screen-utils';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import Onboarding from '@/app/counsellor/onboarding';
import { OnboardingState } from '@/src/api/types';
import { sessionFixture } from '../fixtures';
import { apiError } from '@/src/api/errors';

beforeEach(setupCounsellorMocks);

const incomplete: OnboardingState = { profileComplete: false, verificationSubmitted: false, complete: false };

describe('Counsellor onboarding gate UI — US-05 (mocked API boundary)', () => {
  test.each([null, sessionFixture])('hides onboarding from anonymous or job-seeker users (%j)', async (session) => {
    await renderCounsellor(<Onboarding />, session);
    expect(screen.getByTestId('redirect')).toHaveTextContent('/');
  });

  test('shows neither step until the onboarding state is received, then both as remaining', async () => {
    const pending = deferred<OnboardingState>();
    apiMock.getOnboardingState.mockReturnValueOnce(pending.promise);
    await renderCounsellor(<Onboarding />);
    expect(screen.queryByText('Professional profile')).toBeNull();
    expect(screen.queryByText('Verification submission')).toBeNull();

    await settle(pending, incomplete);
    expect(screen.getByText('Finish setting up your workspace')).toBeTruthy();
    expect(screen.getByText(/Complete your professional profile and submit your LinkedIn profile/)).toBeTruthy();
    expect(screen.getAllByText('Not done')).toHaveLength(2);
    expect(screen.queryByText('Done')).toBeNull();
  });

  test('offers no route to service creation', async () => {
    apiMock.getOnboardingState.mockResolvedValue(incomplete);
    await renderCounsellor(<Onboarding />);
    await screen.findByText('Professional profile');
    expect(screen.queryByRole('button', { name: 'New' })).toBeNull();
    expect(screen.queryByText(/Publish/)).toBeNull();
  });

  test('a step already done reads as done, and the other as not', async () => {
    apiMock.getOnboardingState.mockResolvedValue({ profileComplete: true, verificationSubmitted: false, complete: false });
    await renderCounsellor(<Onboarding />);
    await screen.findByLabelText('Professional profile, done');
    expect(screen.getByLabelText('Verification submission, not done')).toBeTruthy();
    expect(screen.getByText('Saved — your introduction, background and experience are on file.')).toBeTruthy();
  });

  test('tapping a step opens its own existing screen', async () => {
    apiMock.getOnboardingState.mockResolvedValue(incomplete);
    await renderCounsellor(<Onboarding />);
    await screen.findByText('Professional profile');
    fireEvent.press(screen.getByLabelText('Professional profile, not done'));
    expect(router.push).toHaveBeenLastCalledWith('/counsellor/profile');
    fireEvent.press(screen.getByLabelText('Verification submission, not done'));
    expect(router.push).toHaveBeenLastCalledWith('/counsellor/verification');
  });

  test('both steps already complete routes straight to the workspace instead of showing the gate', async () => {
    apiMock.getOnboardingState.mockResolvedValue({ profileComplete: true, verificationSubmitted: true, complete: true });
    await renderCounsellor(<Onboarding />);
    expect(await screen.findByTestId('redirect')).toHaveTextContent('/counsellor');
    expect(screen.queryByText('Finish setting up your workspace')).toBeNull();
  });

  test('a failed check shows a recoverable error instead of fabricating step status', async () => {
    apiMock.getOnboardingState.mockRejectedValue(apiError(503, 'UNAVAILABLE', 'Onboarding status is temporarily unavailable.'));
    await renderCounsellor(<Onboarding />);
    await screen.findByText('Onboarding status is temporarily unavailable.');
    expect(screen.queryByText('Professional profile')).toBeNull();

    apiMock.getOnboardingState.mockResolvedValue(incomplete);
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Professional profile');
  });
});
