import { apiMock, renderCounsellor, setupCounsellorMocks } from '../screens/counsellor-screen-utils';
import { act, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import Workspace from '@/app/counsellor';
import AdminUsers from '@/app/admin/counsellors';
import { apiError } from '@/src/api/errors';
import { adoptSession, currentSession } from '@/src/api/authBridge';
import { adminProfessional, adminSeeker, ownerSession } from '../screens/admin-screen-fixtures';

// Same-mounted screen tests. These replace router focus and API responses only;
// they do not establish real navigation, HTTP token rotation or database evidence.
const focused = new Map<() => void | (() => void), void | (() => void)>();
beforeEach(() => {
  setupCounsellorMocks();
  focused.clear();
  jest.mocked(useLocalSearchParams).mockReturnValue({ role: 'counsellor' });
  jest.spyOn(jest.requireMock<typeof import('expo-router')>('expo-router'), 'useFocusEffect').mockImplementation((callback) => {
    useEffect(() => {
      focused.set(callback, callback());
      return () => { focused.get(callback)?.(); focused.delete(callback); };
    }, [callback]);
  });
  apiMock.listAllCounsellors.mockResolvedValue([adminProfessional]);
  apiMock.listAllJobSeekers.mockResolvedValue([adminSeeker]);
});

async function focusAgain() {
  await act(async () => {
    for (const [callback, dispose] of focused) { dispose?.(); focused.set(callback, callback()); }
  });
}

function FocusWitness({ onFocus }: { onFocus: () => void }) {
  useFocusEffect(onFocus);
  return null;
}

describe('Sprint 3 refresh acceptance (advisory; ordinary assertions)', () => {
  test('[S3-WORKSPACE-STALE-STATUS][QA-195/198] a failed profile refresh must not present the old verification as current', async () => {
    await renderCounsellor(<Workspace />);
    await screen.findByText('Verified Career Professional');
    apiMock.getOwnCounsellorProfile.mockRejectedValueOnce(apiError(503, 'UNAVAILABLE', 'Verification refresh unavailable.'));
    await focusAgain();
    // Prove the intended failed response reached the mounted screen first.
    expect(apiMock.getOwnCounsellorProfile).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Verification refresh unavailable.')).toBeOnTheScreen();
    // The Profile screen already uses an explicit unavailable state on this path.
    // Workspace must not continue to affirm an unconfirmed prior verification.
    expect(screen.queryByText('Verified Career Professional')).toBeNull();
    expect(screen.getByText('Status unavailable')).toBeOnTheScreen();
  });

  test('[S3-ADMIN-USERS-FOCUS][US-71] returning to the mounted Users directory rereads account status', async () => {
    const onFocus = jest.fn();
    await renderCounsellor(<><FocusWitness onFocus={onFocus} /><AdminUsers /></>, ownerSession);
    await screen.findByText(adminProfessional.email);
    expect(onFocus).toHaveBeenCalledTimes(1);
    apiMock.listAllCounsellors.mockResolvedValue([{ ...adminProfessional, email: 'refocused-professional@example.com',
      verificationStatus: 'rejected', payoutsEnabled: true }]);
    await focusAgain();
    // Independent witness confirms the simulated focus event actually occurred.
    expect(onFocus).toHaveBeenCalledTimes(2);
    expect(apiMock.login).toHaveBeenCalledTimes(1);
    expect(apiMock.listAllCounsellors).toHaveBeenCalledTimes(2);
    expect(apiMock.listAllJobSeekers).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('refocused-professional@example.com')).toBeOnTheScreen();
    expect(screen.queryByText(adminProfessional.email)).toBeNull();
  });

  test('[S3-ADMIN-USERS-STALE-REFRESH][US-71] a failed renewed-session read withholds the old directory until retry succeeds', async () => {
    await renderCounsellor(<AdminUsers />, ownerSession);
    await screen.findByText(adminProfessional.email);
    const session = currentSession();
    if (!session) throw new Error('Test session was not established before renewal.');
    apiMock.listAllJobSeekers.mockRejectedValueOnce(apiError(503, 'UNAVAILABLE', 'Renewed directory read unavailable.'));
    await act(async () => { adoptSession({ ...session, accessToken: 'renewed-owner-access' }); });
    // AuthProvider's real bridge setter triggers the second read; this does not
    // pretend that apiMock exercised an HTTP refresh exchange.
    for (const request of [apiMock.listAllCounsellors, apiMock.listAllJobSeekers]) {
      expect(request).toHaveBeenCalledTimes(2);
      expect(request).toHaveBeenLastCalledWith('renewed-owner-access');
    }
    expect(await screen.findByText('Renewed directory read unavailable.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
    expect(screen.queryByText(adminProfessional.email)).toBeNull();
    expect(screen.queryByRole('button', { name: `${adminProfessional.name}, Career Professional. Open their verification` })).toBeNull();
    expect(screen.queryByText('No Career Professionals yet.')).toBeNull();
  });
});
