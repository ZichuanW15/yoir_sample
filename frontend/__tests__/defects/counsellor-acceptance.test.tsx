/** Correct acceptance assertions for known product defects. Run separately with
 * jest.config.defects.js; an unexpected pass signals the defect needs rechecking. */
import { apiMock, fillService, renderCounsellor, setupCounsellorMocks } from '../screens/counsellor-screen-utils';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import ServiceForm from '@/src/counsellor/ServiceForm';
import Availability from '@/app/counsellor/availability';
import { fmtLong } from '@/src/format';
beforeEach(setupCounsellorMocks);
describe('Counsellor known defects — correct acceptance expectations', () => {
  test('QA #136 rejects a negative price instead of silently changing its sign', async () => {
    await renderCounsellor(<ServiceForm counsellorId="counsellor-1" accessToken="counsellor-access-token" />);
    fillService({ price: '-5' }); fireEvent.press(screen.getByRole('button', { name: 'Publish service' }));
    // Flush the fulfilled mocked network request so the failure is behavioral,
    // rather than an async act warning after this intentionally failing assertion.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Publish service' })).toBeEnabled());
    expect(apiMock.createService).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a price greater than zero.')).toBeTruthy();
  });
  test('QA #145 retains a failed window creation error after refreshing the calendar', async () => {
    const today = new Date(); today.setHours(6, 0, 0, 0); jest.spyOn(Date, 'now').mockReturnValue(today.getTime());
    apiMock.listOwnAvailabilityWindows.mockResolvedValue([]);
    apiMock.createAvailabilityWindow.mockRejectedValue(new TypeError('fetch failed'));
    await renderCounsellor(<Availability />); await waitFor(() => expect(apiMock.listOwnAvailabilityWindows).toHaveBeenCalled());
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    if (tomorrow.getMonth() !== new Date().getMonth()) fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.press(screen.getByRole('button', { name: fmtLong(tomorrow.toISOString()) }));
    fireEvent.press(screen.getByRole('button', { name: 'Add availability' }));
    await waitFor(() => expect(apiMock.createAvailabilityWindow).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add availability' })).toBeEnabled());
    // A boolean presence assertion keeps failure output focused on the missing
    // expected feedback, rather than dumping the entire calendar render tree.
    expect(screen.queryByText('We could not reach Yoir. Check your connection and try again.') !== null).toBe(true);
    expect(screen.queryByText('1 day added')).toBeNull();
  });
});
