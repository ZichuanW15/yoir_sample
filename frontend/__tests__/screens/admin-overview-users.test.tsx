import { apiMock, counsellorSessionFixture, renderCounsellor, setupCounsellorMocks } from './counsellor-screen-utils';
import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AdminOverview from '@/app/admin';
import AdminUsers from '@/app/admin/counsellors';
import AdminBookings from '@/app/admin/bookings';
import { AdminShell } from '@/src/admin/shell';
import { apiError } from '@/src/api/errors';
import { sessionFixture } from '../fixtures';
import { adminBooking, adminProfessional, adminSeeker, ownerSession, platformStats } from './admin-screen-fixtures';

beforeEach(() => {
  setupCounsellorMocks();
  apiMock.getPlatformStats.mockResolvedValue(platformStats);
  apiMock.listAllCounsellors.mockResolvedValue([adminProfessional]);
  apiMock.listAllJobSeekers.mockResolvedValue([adminSeeker]);
  apiMock.listAllBookings.mockResolvedValue([adminBooking]);
  jest.mocked(useLocalSearchParams).mockReturnValue({});
});

describe('US-48/71 platform-owner workspace (real components, mocked API)', () => {
  test.each([
    ['guest', null, '/auth/login'],
    ['job seeker', sessionFixture, '/'],
    ['professional', counsellorSessionFixture, '/'],
  ] as const)('the shell redirects a %s and withholds administration content', async (_name, session, destination) => {
    await renderCounsellor(<AdminShell title="Private administration"><Text>Private data</Text></AdminShell>, session);
    expect(router.replace).toHaveBeenCalledWith(destination);
    expect(screen.queryByText('Private data')).toBeNull();
    // This is a UI guard. Backend tests independently prove endpoint authorization.
  });

  test('the owner sees all five sections and can open the account sheet to log out', async () => {
    await renderCounsellor(<AdminShell title="Private administration"><Text>Private data</Text></AdminShell>, ownerSession);
    expect(screen.getByText('Private data')).toBeOnTheScreen();
    for (const name of ['Overview', 'Verify', 'Users', 'Bookings', 'Payments']) expect(screen.getByRole('tab', { name })).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('tab', { name: 'Payments' }));
    expect(router.replace).toHaveBeenCalledWith('/admin/payments');
    fireEvent.press(screen.getByRole('button', { name: 'Account, Platform Owner' }));
    expect(await screen.findByRole('button', { name: 'Log out' })).toBeOnTheScreen();
  });

  test('overview renders stored money, unsplit gross, action counts and drill-down destinations', async () => {
    await renderCounsellor(<AdminOverview />, ownerSession);
    expect(await screen.findByText('Across 3 sessions booked on the platform.')).toBeOnTheScreen();
    expect(screen.getByText('$100.25')).toBeOnTheScreen();
    for (const value of ['$80.96', '$14.29', '$5.00', '$1.30', '$8.66', '$12.50', 'No split recorded']) expect(screen.getByText(value)).toBeOnTheScreen();
    expect(apiMock.getPlatformStats).toHaveBeenCalledWith(ownerSession.accessToken);
    fireEvent.press(screen.getByRole('button', { name: 'Job Seekers: 3' }));
    expect(router.replace).toHaveBeenLastCalledWith({ pathname: '/admin/counsellors', params: { role: 'job_seeker' } });
    fireEvent.press(screen.getByRole('button', { name: 'Review pending verifications' }));
    expect(router.replace).toHaveBeenLastCalledWith('/admin/verifications');
    fireEvent.press(screen.getByRole('button', { name: 'Sessions by status. Open bookings' }));
    expect(router.replace).toHaveBeenLastCalledWith('/admin/bookings');
  });

  test('zero totals show genuine empty states without a made-up pending action or unsplit amount', async () => {
    apiMock.getPlatformStats.mockResolvedValue({ ...platformStats, counsellorsPendingVerification: 0, counsellorsAwaitingPayouts: 0, bookingsByStatus: {},
      money: { ...platformStats.money, grossMinor: 0, counsellorPayoutMinor: 0, platformFeeMinor: 0 } });
    await renderCounsellor(<AdminOverview />, ownerSession);
    expect(await screen.findByText('No session has been booked yet.')).toBeOnTheScreen();
    expect(screen.getByText('Nothing is waiting on you.')).toBeOnTheScreen();
    expect(screen.getByText('Nothing has been booked yet.')).toBeOnTheScreen();
    expect(screen.queryByText('No split recorded')).toBeNull();
  });

  test('failed statistics can be retried without displaying invented zero totals', async () => {
    apiMock.getPlatformStats.mockRejectedValueOnce(apiError(503, 'UNAVAILABLE', 'Statistics unavailable.'));
    await renderCounsellor(<AdminOverview />, ownerSession);
    expect(await screen.findByText('Statistics unavailable.')).toBeOnTheScreen();
    expect(screen.queryByText('No session has been booked yet.')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Across 3 sessions booked on the platform.')).toBeOnTheScreen();
    expect(apiMock.getPlatformStats).toHaveBeenCalledTimes(2);
  });

  test('the professional directory exposes a verified-but-unpayable account and links its verification', async () => {
    await renderCounsellor(<AdminUsers />, ownerSession);
    expect(await screen.findByText('Verified but cannot be paid, so nothing they list can be booked.')).toBeOnTheScreen();
    expect(screen.getByText('Payouts not set up')).toBeOnTheScreen();
    expect(screen.getByText(adminProfessional.email)).toBeOnTheScreen();
    expect(screen.queryByText(adminSeeker.email)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: `${adminProfessional.name}, Career Professional. Open their verification` }));
    expect(router.push).toHaveBeenCalledWith(`/admin/verifications/${adminProfessional.id}`);
    fireEvent.press(screen.getByRole('radio', { name: 'Job Seekers · 1' }));
    expect(router.setParams).toHaveBeenCalledWith({ role: 'job_seeker' });
  });

  test('a Job Seeker directory deep link displays its read-only role, email state and booking count', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ role: 'job_seeker' });
    await renderCounsellor(<AdminUsers />, ownerSession);
    expect(await screen.findByText(adminSeeker.email)).toBeOnTheScreen();
    expect(screen.getByText('Email not confirmed')).toBeOnTheScreen();
    expect(screen.getByText('1 booking')).toBeOnTheScreen();
    expect(screen.queryByText(adminProfessional.email)).toBeNull();
    expect(screen.queryByRole('button', { name: /Open their verification/ })).toBeNull();
  });

  test('a partial directory failure exposes no incomplete list and retries both role reads', async () => {
    apiMock.listAllJobSeekers.mockRejectedValueOnce(apiError(503, 'UNAVAILABLE', 'User directory unavailable.'));
    await renderCounsellor(<AdminUsers />, ownerSession);
    expect(await screen.findByText('User directory unavailable.')).toBeOnTheScreen();
    expect(screen.queryByText(adminProfessional.email)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(adminProfessional.email)).toBeOnTheScreen();
    expect(apiMock.listAllJobSeekers).toHaveBeenCalledTimes(2);
    expect(apiMock.listAllCounsellors).toHaveBeenCalledTimes(2);
  });

  test('the bookings overview shows the returned session identity, delivery and status', async () => {
    await renderCounsellor(<AdminBookings />, ownerSession);
    expect(await screen.findByText(adminBooking.serviceTitle)).toBeOnTheScreen();
    expect(screen.getByText('confirmed')).toBeOnTheScreen();
    expect(screen.getByText(/Alex Morgan.*with.*Maya Chen/)).toBeOnTheScreen();
    expect(screen.getByText(/Australia\/Melbourne/)).toBeOnTheScreen();
    expect(screen.getByText(/Online/)).toBeOnTheScreen();
    expect(apiMock.listAllBookings).toHaveBeenCalledWith(ownerSession.accessToken);
  });
});
