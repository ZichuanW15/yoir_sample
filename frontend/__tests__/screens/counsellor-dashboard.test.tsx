import { apiMock, counsellorProfileFixture, deferred, renderCounsellor, serviceFixture, settle, setupCounsellorMocks } from './counsellor-screen-utils';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import Dashboard from '@/app/counsellor';
import { OnboardingState } from '@/src/api/types';
import { sessionFixture } from '../fixtures';
import { apiError } from '@/src/api/errors';
beforeEach(setupCounsellorMocks);
describe('Counsellor dashboard UI — QA #133 (mocked API boundary)', () => {
  test.each([null, sessionFixture])('hides the workspace from anonymous or job-seeker users (%j)', async (session) => {
    await renderCounsellor(<Dashboard />, session); expect(screen.getByTestId('redirect')).toHaveTextContent('/');
    expect(screen.queryByRole('button', { name: 'New' })).toBeNull();
  });
  test('loads the signed-in counsellor services, profile completion and availability window counts', async () => {
    apiMock.listOwnAvailabilityWindows.mockResolvedValue([
      { id: 'open', modalities: ['online'], startsAt: '2030-09-20T09:00:00Z', endsAt: '2030-09-20T10:00:00Z', hasBookings: false },
      { id: 'booked', modalities: ['online'], startsAt: '2030-09-19T09:00:00Z', endsAt: '2030-09-19T10:00:00Z', hasBookings: true },
    ]);
    await renderCounsellor(<Dashboard />); await screen.findByText(serviceFixture.title);
    expect(apiMock.listOwnServices).toHaveBeenCalledWith('counsellor-1', 'counsellor-access-token');
    expect(screen.getByText('Verified Career Professional')).toBeTruthy(); expect(screen.getByText('5/5')).toBeTruthy(); expect(screen.getByText(/2 open slots\. Next on/)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'New' })); expect(router.push).toHaveBeenLastCalledWith('/counsellor/services/new');
    fireEvent.press(screen.getByRole('button', { name: `Edit ${serviceFixture.title}` })); expect(router.push).toHaveBeenLastCalledWith('/counsellor/services/service-1/edit');
    fireEvent.press(screen.getByRole('button', { name: 'Professional profile' })); expect(router.push).toHaveBeenLastCalledWith('/counsellor/profile');
    fireEvent.press(screen.getByRole('button', { name: 'Availability' })); expect(router.push).toHaveBeenLastCalledWith('/counsellor/availability');
  });
  test('shows the first-service entry and missing LinkedIn guidance for an empty pending profile', async () => {
    apiMock.listOwnServices.mockResolvedValue([]);
    apiMock.getOwnCounsellorProfile.mockResolvedValue({ ...counsellorProfileFixture, verificationStatus: 'pending', linkedinUrl: '' });
    await renderCounsellor(<Dashboard />); await screen.findByRole('button', { name: 'Publish your first service' });
    expect(screen.getByText('Verification pending')).toBeTruthy(); expect(screen.getByText('Add your LinkedIn profile URL so the Platform Owner can verify you.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Publish your first service' })); expect(router.push).toHaveBeenCalledWith('/counsellor/services/new');
  });
  test('renders API load failure without fabricating a published service', async () => {
    apiMock.listOwnServices.mockRejectedValue(apiError(503, 'UNAVAILABLE', 'Services are temporarily unavailable.'));
    await renderCounsellor(<Dashboard />); await screen.findByText('Services are temporarily unavailable.'); expect(screen.queryByText(serviceFixture.title)).toBeNull();
  });
  test('cancel sends no delete; mocked delete success refreshes the displayed list', async () => {
    await renderCounsellor(<Dashboard />); await screen.findByText(serviceFixture.title);
    fireEvent.press(screen.getByRole('button', { name: `Delete ${serviceFixture.title}` })); fireEvent.press(screen.getAllByRole('button', { name: 'Cancel' })[1]); expect(apiMock.deleteService).not.toHaveBeenCalled();
    apiMock.listOwnServices.mockResolvedValue([]);
    fireEvent.press(screen.getByRole('button', { name: `Delete ${serviceFixture.title}` })); fireEvent.press(screen.getByLabelText('Delete'));
    await waitFor(() => expect(screen.queryByText(serviceFixture.title)).toBeNull());
    expect(apiMock.deleteService).toHaveBeenCalledWith('service-1', 'counsellor-access-token'); expect(apiMock.listOwnServices).toHaveBeenCalledTimes(2);
  });
  test('deletion rejection keeps the original service visible', async () => {
    apiMock.deleteService.mockRejectedValue(apiError(409, 'IN_USE', 'Service is still in use.'));
    await renderCounsellor(<Dashboard />); await screen.findByText(serviceFixture.title);
    fireEvent.press(screen.getByRole('button', { name: `Delete ${serviceFixture.title}` })); fireEvent.press(screen.getByLabelText('Delete'));
    await screen.findByText('Service is still in use.'); expect(screen.getByText(serviceFixture.title)).toBeTruthy();
  });
});

describe('Counsellor dashboard onboarding gate — US-05 (mocked API boundary)', () => {
  const incomplete: OnboardingState = { profileComplete: false, verificationSubmitted: false, complete: false };

  test('shows neither the workspace nor the onboarding gate until onboarding state is received', async () => {
    const pending = deferred<OnboardingState>();
    apiMock.getOnboardingState.mockReturnValueOnce(pending.promise);
    await renderCounsellor(<Dashboard />);
    expect(screen.queryByText('Good to see you, Maya')).toBeNull();
    expect(screen.queryByTestId('redirect')).toBeNull();

    await settle(pending, incomplete);
    expect(screen.getByTestId('redirect')).toHaveTextContent('/counsellor/onboarding');
  });

  test('an incomplete onboarding state sends a first-login counsellor to onboarding, not the workspace', async () => {
    apiMock.getOnboardingState.mockResolvedValue(incomplete);
    await renderCounsellor(<Dashboard />);
    expect(await screen.findByTestId('redirect')).toHaveTextContent('/counsellor/onboarding');
    expect(screen.queryByText(serviceFixture.title)).toBeNull();
    expect(screen.queryByRole('button', { name: 'New' })).toBeNull();
  });

  test('a failed onboarding check fails open: the already-familiar workspace still renders, with the failure surfaced', async () => {
    apiMock.getOnboardingState.mockRejectedValue(apiError(503, 'UNAVAILABLE', 'Onboarding status is temporarily unavailable.'));
    await renderCounsellor(<Dashboard />);
    await screen.findByText(serviceFixture.title);
    expect(screen.getByText('Onboarding status is temporarily unavailable.')).toBeTruthy();
    expect(screen.queryByTestId('redirect')).toBeNull();
  });
});
