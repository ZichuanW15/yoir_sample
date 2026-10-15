import { apiMock, counsellorProfileFixture, counsellorSessionFixture, deferred, renderCounsellor, serviceFixture, setupCounsellorMocks } from './counsellor-screen-utils';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import Profile from '@/app/counsellor/profile';
import Workspace from '@/app/counsellor';
import Payments from '@/app/admin/payments';
import AdminUsers from '@/app/admin/counsellors';
import { useLocalSearchParams } from 'expo-router';
import { VerificationStatus } from '@/src/api/types';
import { apiError } from '@/src/api/errors';
import { adoptSession, currentSession } from '@/src/api/authBridge';
import { adminProfessional, adminSeeker, ownerSession, payment } from './admin-screen-fixtures';
import { windowFixture } from '../fixtures';

// Simulate router focus events while keeping the SAME component mounted.
// API responses are controlled: real backend status propagation has separate Web/API tests.
const focused = new Map<() => void | (() => void), void | (() => void)>();
beforeEach(() => {
  setupCounsellorMocks();
  focused.clear();
  jest.spyOn(jest.requireMock<typeof import('expo-router')>('expo-router'), 'useFocusEffect').mockImplementation((callback) => {
    useEffect(() => {
      focused.set(callback, callback());
      return () => { focused.get(callback)?.(); focused.delete(callback); };
    }, [callback]);
  });
  apiMock.listPaymentOversight.mockResolvedValue([payment]);
});
async function focusAgain() {
  await act(async () => {
    for (const [callback, dispose] of focused) { dispose?.(); focused.set(callback, callback()); }
  });
}
const states: [VerificationStatus, string][] = [
  ['pending', 'Verification pending'], ['verified', 'Verified Career Professional'], ['rejected', 'Verification rejected'],
];

describe('QA-195/198 same-mounted counsellor focus refresh', () => {
  test.each(states)('profile replaces a prior status with confirmed %s after returning', async (status, label) => {
    const initial = status === 'verified' ? 'pending' : 'verified';
    apiMock.getOwnCounsellorProfile.mockResolvedValue({ ...counsellorProfileFixture, verificationStatus: initial });
    await renderCounsellor(<Profile />);
    await screen.findByText(initial === 'verified' ? 'Verified Career Professional' : 'Verification pending');
    apiMock.getOwnCounsellorProfile.mockResolvedValue({ ...counsellorProfileFixture, verificationStatus: status });
    await focusAgain();
    expect(await screen.findByText(label)).toBeOnTheScreen();
    expect(apiMock.getOwnCounsellorProfile).toHaveBeenCalledTimes(2);
  });

  test.each(states)('workspace replaces a prior status with confirmed %s after returning', async (status, label) => {
    const initial = status === 'verified' ? 'pending' : 'verified';
    apiMock.getOwnCounsellorProfile.mockResolvedValue({ ...counsellorProfileFixture, verificationStatus: initial });
    await renderCounsellor(<Workspace />);
    await screen.findByText(initial === 'verified' ? 'Verified Career Professional' : 'Verification pending');
    apiMock.getOwnCounsellorProfile.mockResolvedValue({ ...counsellorProfileFixture, verificationStatus: status });
    await focusAgain();
    expect(await screen.findByText(label)).toBeOnTheScreen();
    expect(apiMock.getOwnCounsellorProfile).toHaveBeenCalledTimes(2);
  });

  test('profile marks previously verified status unavailable on focus failure, then recovers', async () => {
    await renderCounsellor(<Profile />);
    await screen.findByText('Verified Career Professional');
    apiMock.getOwnCounsellorProfile.mockRejectedValueOnce(apiError(503, 'UNAVAILABLE', 'Status refresh unavailable.'));
    await focusAgain();
    expect(await screen.findByText('Status unavailable')).toBeOnTheScreen();
    expect(screen.queryByText('Verified Career Professional')).toBeNull();
    expect(screen.getByText('Status refresh unavailable.')).toBeOnTheScreen();
    await focusAgain();
    expect(await screen.findByText('Verified Career Professional')).toBeOnTheScreen();
    expect(screen.queryByText('Status unavailable')).toBeNull();
  });

  test('returning focus while a blur-triggered save is pending does not overwrite the draft', async () => {
    await renderCounsellor(<Profile />);
    await screen.findByText('Verified Career Professional');
    const pending = deferred<typeof counsellorProfileFixture>();
    apiMock.updateOwnCounsellorProfile.mockReturnValueOnce(pending.promise);
    fireEvent.changeText(screen.getByLabelText('Introduction'), 'An unsaved introduction that must not be replaced.');
    apiMock.getOwnCounsellorProfile.mockResolvedValue({ ...counsellorProfileFixture, introduction: 'Old server introduction.' });
    await focusAgain();
    expect(screen.getByDisplayValue('An unsaved introduction that must not be replaced.')).toBeOnTheScreen();
    expect(apiMock.getOwnCounsellorProfile).toHaveBeenCalledTimes(1);
    expect(apiMock.updateOwnCounsellorProfile).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ ...counsellorProfileFixture, introduction: 'An unsaved introduction that must not be replaced.' }));
  });
});

test('QA-210 payment refresh failure clears formerly loaded rows and retry uses new data', async () => {
  await renderCounsellor(<Payments />, ownerSession);
  await screen.findByText(payment.serviceTitle);
  apiMock.listPaymentOversight.mockRejectedValueOnce(apiError(503, 'UNAVAILABLE', 'Payments refresh unavailable.'));
  await focusAgain();
  expect(await screen.findByText('Payments refresh unavailable.')).toBeOnTheScreen();
  expect(screen.queryByText(payment.serviceTitle)).toBeNull();
  expect(screen.queryByText('No orders yet.')).toBeNull();
  apiMock.listPaymentOversight.mockResolvedValue([{ ...payment, serviceTitle: 'Fresh payment detail', refundedMinor: 9525, paymentStatus: 'refunded' }]);
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Fresh payment detail')).toBeOnTheScreen();
  expect(screen.queryByText('Payments refresh unavailable.')).toBeNull();
});

// Exercise the screen reaction to a session already renewed by the HTTP client.
// The real AuthProvider receives the bridge update; apiMock does not perform a
// token exchange, so these are not HTTP-refresh or server-session assertions.
async function renewMountedSession(accessToken: string) {
  const session = currentSession();
  if (!session) throw new Error('Test session was not established before renewal.');
  await act(async () => { adoptSession({ ...session, accessToken }); });
}

describe('Sprint 3 mounted workspace and Users refresh recovery', () => {
  test('workspace recovers all displayed data on the next focus after a successful read followed by failure', async () => {
    await renderCounsellor(<Workspace />);
    await screen.findByText(serviceFixture.title);
    apiMock.getOwnCounsellorProfile.mockRejectedValueOnce(apiError(503, 'UNAVAILABLE', 'Workspace refresh unavailable.'));
    await focusAgain();
    expect(await screen.findByText('Workspace refresh unavailable.')).toBeOnTheScreen();
    expect(apiMock.getOwnCounsellorProfile).toHaveBeenCalledTimes(2);

    apiMock.getOwnCounsellorProfile.mockResolvedValue({ ...counsellorProfileFixture, verificationStatus: 'pending' });
    apiMock.listOwnServices.mockResolvedValue([{ ...serviceFixture, title: 'Newly published coaching' }]);
    apiMock.listOwnAvailabilityWindows.mockResolvedValue([{ ...windowFixture, startsAt: '2030-01-02T00:00:00Z',
      endsAt: '2030-01-02T03:00:00Z', freeMinutes: 60 }]);
    await focusAgain();
    expect(await screen.findByText('Newly published coaching')).toBeOnTheScreen();
    expect(screen.getByText('Verification pending')).toBeOnTheScreen();
    expect(screen.getByText(/1 hour free to book, through/)).toBeOnTheScreen();
    expect(screen.queryByText(serviceFixture.title)).toBeNull();
    expect(screen.queryByText('Verified Career Professional')).toBeNull();
    expect(screen.queryByText('Workspace refresh unavailable.')).toBeNull();
    for (const request of [apiMock.getOwnCounsellorProfile, apiMock.listOwnServices, apiMock.listOwnAvailabilityWindows,
      apiMock.getPayoutStatus, apiMock.getOnboardingState]) expect(request).toHaveBeenCalledTimes(3);
    expect(apiMock.login).toHaveBeenCalledTimes(1);
  });

  test('workspace uses the renewed token for every reload without remounting or logging in again', async () => {
    await renderCounsellor(<Workspace />);
    await screen.findByText('Verified Career Professional');
    apiMock.getOwnCounsellorProfile.mockResolvedValue({ ...counsellorProfileFixture, verificationStatus: 'rejected' });
    apiMock.listOwnServices.mockResolvedValue([{ ...serviceFixture, title: 'Service after renewal' }]);
    await renewMountedSession('renewed-counsellor-access');
    expect(await screen.findByText('Service after renewal')).toBeOnTheScreen();
    expect(screen.getByText('Verification rejected')).toBeOnTheScreen();
    expect(apiMock.getOwnCounsellorProfile).toHaveBeenLastCalledWith(counsellorSessionFixture.user, 'renewed-counsellor-access');
    expect(apiMock.listOwnServices).toHaveBeenLastCalledWith(counsellorSessionFixture.user.id, 'renewed-counsellor-access');
    expect(apiMock.listOwnAvailabilityWindows).toHaveBeenLastCalledWith(counsellorSessionFixture.user.id, 'renewed-counsellor-access');
    expect(apiMock.getPayoutStatus).toHaveBeenLastCalledWith('renewed-counsellor-access');
    expect(apiMock.getOnboardingState).toHaveBeenLastCalledWith('renewed-counsellor-access');
    expect(apiMock.getOwnCounsellorProfile).toHaveBeenCalledTimes(2);
    expect(apiMock.login).toHaveBeenCalledTimes(1);
  });

  test.each(['counsellor', 'job_seeker'] as const)('Users replaces the mounted %s directory after session renewal', async (role) => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ role });
    apiMock.listAllCounsellors.mockResolvedValue([adminProfessional]);
    apiMock.listAllJobSeekers.mockResolvedValue([adminSeeker]);
    const prior = role === 'counsellor' ? adminProfessional : adminSeeker;
    await renderCounsellor(<AdminUsers />, ownerSession);
    await screen.findByText(prior.email);

    apiMock.listAllCounsellors.mockResolvedValue([{ ...adminProfessional, email: 'new-professional@example.com' }]);
    apiMock.listAllJobSeekers.mockResolvedValue([{ ...adminSeeker, email: 'new-seeker@example.com' }]);
    await renewMountedSession('renewed-owner-access');
    expect(await screen.findByText(role === 'counsellor' ? 'new-professional@example.com' : 'new-seeker@example.com')).toBeOnTheScreen();
    expect(screen.queryByText(prior.email)).toBeNull();
    for (const request of [apiMock.listAllCounsellors, apiMock.listAllJobSeekers]) {
      expect(request).toHaveBeenCalledTimes(2);
      expect(request).toHaveBeenLastCalledWith('renewed-owner-access');
    }
    expect(apiMock.login).toHaveBeenCalledTimes(1);
  });

  test.each(['professionals', 'job seekers'] as const)('Users retries both reads with the renewed token after the %s refresh fails', async (failedList) => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ role: 'counsellor' });
    apiMock.listAllCounsellors.mockResolvedValue([adminProfessional]);
    apiMock.listAllJobSeekers.mockResolvedValue([adminSeeker]);
    await renderCounsellor(<AdminUsers />, ownerSession);
    await screen.findByText(adminProfessional.email);
    const failedRequest = failedList === 'professionals' ? apiMock.listAllCounsellors : apiMock.listAllJobSeekers;
    failedRequest.mockRejectedValueOnce(apiError(503, 'UNAVAILABLE', 'Renewed directory read unavailable.'));
    await renewMountedSession('renewed-owner-access');
    expect(await screen.findByText('Renewed directory read unavailable.')).toBeOnTheScreen();
    expect(failedRequest).toHaveBeenCalledTimes(2);
    expect(failedRequest).toHaveBeenLastCalledWith('renewed-owner-access');

    apiMock.listAllCounsellors.mockResolvedValue([{ ...adminProfessional, email: 'recovered-professional@example.com' }]);
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('recovered-professional@example.com')).toBeOnTheScreen();
    expect(screen.queryByText(adminProfessional.email)).toBeNull();
    expect(screen.queryByText('Renewed directory read unavailable.')).toBeNull();
    for (const request of [apiMock.listAllCounsellors, apiMock.listAllJobSeekers]) {
      expect(request).toHaveBeenCalledTimes(3);
      expect(request).toHaveBeenLastCalledWith('renewed-owner-access');
    }
    expect(apiMock.login).toHaveBeenCalledTimes(1);
  });
});
