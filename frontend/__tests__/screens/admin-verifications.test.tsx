import { apiMock, deferred, renderCounsellor, setupCounsellorMocks, settle } from './counsellor-screen-utils';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking } from 'react-native';
import AdminVerifications from '@/app/admin/verifications';
import AdminVerification from '@/app/admin/verifications/[submissionId]';
import { apiError } from '@/src/api/errors';
import { VerificationSubmission } from '@/src/api/types';
import { ownerSession, submission } from './admin-screen-fixtures';

beforeEach(() => {
  setupCounsellorMocks();
  apiMock.listVerificationSubmissions.mockResolvedValue([submission]);
  jest.mocked(useLocalSearchParams).mockReturnValue({ submissionId: submission.id });
});

async function openDetail() {
  await renderCounsellor(<AdminVerification />, ownerSession);
  await screen.findByText(submission.email);
}
async function confirmApproval() {
  fireEvent.press(screen.getByRole('button', { name: 'Approve' }));
  await screen.findByText(`Approve ${submission.counsellorName}?`);
  // The real confirmation sheet is rendered after the original page button.
  await act(async () => { fireEvent.press(screen.getAllByRole('button', { name: 'Approve' }).at(-1)!); });
}

describe('US-32/33/58 admin verification (real components, mocked API)', () => {
  test('the queue asks for waiting applications and opens the selected submission', async () => {
    await renderCounsellor(<AdminVerifications />, ownerSession);
    fireEvent.press(await screen.findByRole('button', { name: `Review ${submission.counsellorName}` }));
    expect(apiMock.listVerificationSubmissions).toHaveBeenCalledWith('pending', ownerSession.accessToken);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/admin/verifications/[submissionId]', params: { submissionId: submission.id } });
  });

  test.each([['Approved', 'verified'], ['Rejected', 'rejected'], ['Everyone', 'all']] as const)(
    'the %s queue sends its filter and handles a successful empty result', async (label, status) => {
      await renderCounsellor(<AdminVerifications />, ownerSession);
      await screen.findByText(submission.email);
      apiMock.listVerificationSubmissions.mockResolvedValue([]);
      fireEvent.press(screen.getByRole('radio', { name: label }));
      expect(await screen.findByText('Nothing here.')).toBeOnTheScreen();
      expect(apiMock.listVerificationSubmissions).toHaveBeenLastCalledWith(status, ownerSession.accessToken);
      expect(screen.queryByText(submission.email)).toBeNull();
    },
  );

  test('queue failure shows a retry and does not claim nobody is waiting', async () => {
    apiMock.listVerificationSubmissions.mockRejectedValueOnce(apiError(503, 'UNAVAILABLE', 'Queue temporarily unavailable.'));
    await renderCounsellor(<AdminVerifications />, ownerSession);
    expect(await screen.findByText('Queue temporarily unavailable.')).toBeOnTheScreen();
    expect(screen.queryByText('Nobody is waiting on a decision.')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(submission.email)).toBeOnTheScreen();
    expect(apiMock.listVerificationSubmissions).toHaveBeenCalledTimes(2);
  });

  test('detail exposes the supplied profile evidence and opens its exact LinkedIn URL', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await openDetail();
    for (const value of [submission.introduction, submission.background, submission.experience]) expect(screen.getByText(value)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Open their LinkedIn profile' }));
    expect(openURL).toHaveBeenCalledWith(submission.linkedInUrl);
    expect(apiMock.decideVerification).not.toHaveBeenCalled();
  });

  test('a missing profile link is stated explicitly and leaving pending makes no decision', async () => {
    apiMock.listVerificationSubmissions.mockResolvedValue([{ ...submission, linkedInUrl: '', introduction: '', background: '', experience: '' }]);
    await openDetail();
    expect(screen.getByText('No LinkedIn profile supplied, so there is nothing to check.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Open their LinkedIn profile' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Leave pending' }));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(apiMock.decideVerification).not.toHaveBeenCalled();
  });

  test('approval requires confirmation and cancellation does not change the current status', async () => {
    await openDetail();
    fireEvent.press(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText(`Approve ${submission.counsellorName}?`)).toBeOnTheScreen();
    expect(apiMock.decideVerification).not.toHaveBeenCalled();
    fireEvent.press(screen.getAllByRole('button', { name: 'Cancel' }).at(-1)!);
    expect(screen.getByText('Pending')).toBeOnTheScreen();
    expect(screen.queryByText('Verified')).toBeNull();
    expect(apiMock.decideVerification).not.toHaveBeenCalled();
  });

  test('confirmed approval stays pending and disables another decision until storage succeeds', async () => {
    const write = deferred<VerificationSubmission>();
    apiMock.decideVerification.mockReturnValueOnce(write.promise);
    await openDetail();
    await confirmApproval();
    await waitFor(() => expect(apiMock.decideVerification).toHaveBeenCalledWith(submission.id, 'verified', '', ownerSession.accessToken));
    expect(screen.getByText('Pending')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();
    fireEvent.press(screen.getByRole('button', { name: 'Approve' }));
    expect(apiMock.decideVerification).toHaveBeenCalledTimes(1);
    await settle(write, { ...submission, status: 'verified', decidedAt: '2026-10-16T00:00:00Z' });
    expect(await screen.findByText('Verified')).toBeOnTheScreen();
    expect(screen.getByText(`${submission.counsellorName} is verified`)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mark as rejected' })).toBeOnTheScreen();
  });

  test('rejection requires a non-blank explanation and stores the trimmed reason', async () => {
    apiMock.decideVerification.mockResolvedValue({ ...submission, status: 'rejected', decisionReason: 'Profile does not match.' });
    await openDetail();
    fireEvent.press(screen.getByRole('button', { name: 'Reject' }));
    fireEvent.changeText(screen.getByLabelText('Why are you rejecting this?'), '   ');
    fireEvent.press(screen.getByRole('button', { name: 'Confirm rejection' }));
    expect(await screen.findByText('Say why, so the Career Professional knows what to change.')).toBeOnTheScreen();
    expect(apiMock.decideVerification).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('Why are you rejecting this?'), '  Profile does not match.  ');
    fireEvent.press(screen.getByRole('button', { name: 'Confirm rejection' }));
    expect(await screen.findByText('Rejected')).toBeOnTheScreen();
    expect(screen.getByText('Profile does not match.')).toBeOnTheScreen();
    expect(apiMock.decideVerification).toHaveBeenCalledWith(submission.id, 'rejected', 'Profile does not match.', ownerSession.accessToken);
    expect(screen.queryByLabelText('Why are you rejecting this?')).toBeNull();
  });

  test('failed rejection preserves reason and status and can be retried without a false success', async () => {
    apiMock.decideVerification.mockRejectedValueOnce(apiError(503, 'UNAVAILABLE', 'Decision was not stored.'))
      .mockResolvedValueOnce({ ...submission, status: 'rejected', decisionReason: 'Please update your profile.' });
    await openDetail();
    fireEvent.press(screen.getByRole('button', { name: 'Reject' }));
    fireEvent.changeText(screen.getByLabelText('Why are you rejecting this?'), 'Please update your profile.');
    fireEvent.press(screen.getByRole('button', { name: 'Confirm rejection' }));
    expect(await screen.findByText('Decision was not stored.')).toBeOnTheScreen();
    expect(screen.getByText('Pending')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('Please update your profile.')).toBeOnTheScreen();
    expect(screen.queryByText(`${submission.counsellorName} was rejected`)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Confirm rejection' }));
    expect(await screen.findByText('Rejected')).toBeOnTheScreen();
    expect(apiMock.decideVerification).toHaveBeenCalledTimes(2);
  });

  test('additional investigation can approve a previously rejected application', async () => {
    apiMock.listVerificationSubmissions.mockResolvedValue([{ ...submission, status: 'rejected', decisionReason: 'Old reason.' }]);
    apiMock.decideVerification.mockResolvedValue({ ...submission, status: 'verified', decisionReason: '' });
    await openDetail();
    expect(screen.getByText('Additional investigation')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Mark as verified' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('Verified')).toBeOnTheScreen();
    expect(screen.queryByText('Old reason.')).toBeNull();
  });

  test('a failed detail read can recover and is distinct from a missing submission', async () => {
    apiMock.listVerificationSubmissions.mockRejectedValueOnce(apiError(503, 'UNAVAILABLE', 'Submission temporarily unavailable.'));
    await renderCounsellor(<AdminVerification />, ownerSession);
    expect(await screen.findByText('Submission temporarily unavailable.')).toBeOnTheScreen();
    expect(screen.queryByText('This submission could not be found.')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(submission.email)).toBeOnTheScreen();
    expect(apiMock.listVerificationSubmissions).toHaveBeenLastCalledWith('all', ownerSession.accessToken);
  });

  test('a missing submission offers no decision controls', async () => {
    apiMock.listVerificationSubmissions.mockResolvedValue([]);
    await renderCounsellor(<AdminVerification />, ownerSession);
    expect(await screen.findByText('This submission could not be found.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
  });
});
