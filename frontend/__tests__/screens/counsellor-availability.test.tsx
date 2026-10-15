import { apiMock, renderCounsellor, setupCounsellorMocks } from './counsellor-screen-utils';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Availability from '@/app/counsellor/availability';
import { AvailabilityWindow } from '@/src/api/types';
import { apiError } from '@/src/api/errors';
import { fmtLong, fmtTime } from '@/src/format';
import { sessionFixture } from '../fixtures';

const tomorrow = () => { const date = new Date(); date.setDate(date.getDate() + 1); date.setHours(9, 0, 0, 0); return date; };
const window = (): AvailabilityWindow => ({ id: 'window-1', startsAt: tomorrow().toISOString(), endsAt: new Date(tomorrow().getTime() + 3 * 3600000).toISOString(), modalities: ['online', 'in_person'], hasBookings: false });
const selectTomorrow = () => {
  // Moving the displayed month is needed on its last day.
  if (tomorrow().getMonth() !== new Date().getMonth()) fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
  fireEvent.press(screen.getByRole('button', { name: fmtLong(tomorrow().toISOString()) }));
};
const removeWindow = () => fireEvent.press(screen.getByRole('button', { name: `Remove ${fmtLong(window().startsAt)} ${fmtTime(window().startsAt)}` }));

beforeEach(setupCounsellorMocks);
describe('Counsellor availability windows — QA #145', () => {
  test.each([null, sessionFixture])('restricts the calendar to counsellors (%j)', async (session) => {
    await renderCounsellor(<Availability />, session);
    expect(screen.getByTestId('redirect')).toHaveTextContent('/');
    expect(apiMock.createAvailabilityWindow).not.toHaveBeenCalled();
  });

  test('load failures explain why the calendar could not be read', async () => {
    apiMock.listOwnAvailabilityWindows.mockRejectedValue(apiError(503, 'UNAVAILABLE', 'Availability is temporarily unavailable.'));
    await renderCounsellor(<Availability />);
    expect(await screen.findByText('Availability is temporarily unavailable.')).toBeTruthy();
  });

  test('sends one service-independent window with delivery choices and timezone-qualified bounds', async () => {
    const real = jest.requireActual<typeof import('@/src/api/client')>('@/src/api/client');
    apiMock.createAvailabilityWindow.mockImplementation(real.api.createAvailabilityWindow);
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, status: 201, headers: { get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null }, json: async () => window(),
    } as Response);
    await renderCounsellor(<Availability />);
    selectTomorrow();
    expect(screen.getByText('1 day, 9:00 to 12:00')).toBeTruthy();
    fireEvent.press(screen.getByRole('checkbox', { name: 'In person' }));
    fireEvent.press(screen.getByRole('button', { name: 'Add availability' }));
    await screen.findByText('1 day added');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/v1\/me\/availability-windows$/), expect.objectContaining({
      method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer counsellor-access-token' }),
      body: JSON.stringify({ startsAt: window().startsAt, endsAt: window().endsAt, modalities: ['online'] }),
    }));
    expect(apiMock.listOwnServices).not.toHaveBeenCalled();
  });

  test('requires days, a positive time range and at least one modality before saving', async () => {
    await renderCounsellor(<Availability />);
    fireEvent.press(screen.getByRole('button', { name: 'Add availability' }));
    expect(screen.getByText('Choose at least one day.')).toBeTruthy();
    selectTomorrow();
    fireEvent.press(screen.getAllByRole('radio', { name: '9' })[1]);
    fireEvent.press(screen.getByRole('button', { name: 'Add availability' }));
    expect(screen.getByText('Your finish time must be after your start time.')).toBeTruthy();
    fireEvent.press(screen.getAllByRole('radio', { name: '12' })[1]);
    fireEvent.press(screen.getByRole('checkbox', { name: 'Online' }));
    fireEvent.press(screen.getByRole('checkbox', { name: 'In person' }));
    fireEvent.press(screen.getByRole('button', { name: 'Add availability' }));
    expect(screen.getByText('Choose at least one way you can meet.')).toBeTruthy();
    expect(apiMock.createAvailabilityWindow).not.toHaveBeenCalled();
  });

  test('repeating one weekday for two weeks creates two windows and reloads merged server state', async () => {
    apiMock.createAvailabilityWindow.mockResolvedValue(window());
    await renderCounsellor(<Availability />);
    fireEvent.press(screen.getByRole('checkbox', { name: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][tomorrow().getDay()] }));
    fireEvent.press(screen.getByRole('radio', { name: '2 weeks' }));
    expect(screen.getByText('2 days, 9:00 to 12:00')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Add availability' }));
    await screen.findByText('2 days added');
    expect(apiMock.createAvailabilityWindow).toHaveBeenCalledTimes(2);
    expect(apiMock.listOwnAvailabilityWindows).toHaveBeenCalledTimes(2);
    for (const [draft] of apiMock.createAvailabilityWindow.mock.calls) {
      expect(draft).toEqual({ startsAt: expect.any(String), endsAt: expect.any(String), modalities: ['online', 'in_person'] });
      expect(Date.parse(draft.endsAt) - Date.parse(draft.startsAt)).toBe(3 * 3600000);
    }
  });

  test('touching availability is sent for the server to merge instead of discarded as a slot conflict', async () => {
    apiMock.listOwnAvailabilityWindows.mockResolvedValue([window()]);
    apiMock.createAvailabilityWindow.mockResolvedValue(window());
    await renderCounsellor(<Availability />);
    selectTomorrow();
    fireEvent.press(screen.getByRole('button', { name: 'Add availability' }));
    await screen.findByText('1 day added');
    expect(apiMock.createAvailabilityWindow).toHaveBeenCalledTimes(1);
  });

  test('cancel preserves a window; confirmed deletion reloads the calendar', async () => {
    apiMock.listOwnAvailabilityWindows.mockResolvedValue([window()]);
    await renderCounsellor(<Availability />);
    await screen.findByText('1 on your calendar');
    removeWindow();
    fireEvent.press(screen.getAllByRole('button', { name: 'Cancel' }).at(-1)!);
    expect(apiMock.deleteAvailabilityWindow).not.toHaveBeenCalled();
    removeWindow();
    apiMock.listOwnAvailabilityWindows.mockResolvedValue([]);
    fireEvent.press(screen.getByLabelText('Remove'));
    await screen.findByText('Nothing on your calendar yet');
    expect(apiMock.deleteAvailabilityWindow).toHaveBeenCalledWith('window-1', 'counsellor-access-token');
  });

  test('a booked window remains visible when the server refuses deletion', async () => {
    apiMock.listOwnAvailabilityWindows.mockResolvedValue([{ ...window(), hasBookings: true }]);
    apiMock.deleteAvailabilityWindow.mockRejectedValue(apiError(409, 'WINDOW_HAS_BOOKINGS', 'This availability has a booking.'));
    await renderCounsellor(<Availability />);
    await screen.findByText(/has a booking/);
    removeWindow();
    fireEvent.press(screen.getByLabelText('Remove'));
    await waitFor(() => expect(screen.getByText('This availability has a booking.')).toBeTruthy());
    expect(screen.getByText('1 on your calendar')).toBeTruthy();
  });

  test('each window says what is left to book: nothing, part of it, or (unsaid) all of it', async () => {
    apiMock.listOwnAvailabilityWindows.mockResolvedValue([
      { ...window(), id: 'full', hasBookings: true, freeMinutes: 0 },
      { ...window(), id: 'part', hasBookings: true, freeMinutes: 120 },
      { ...window(), id: 'open', freeMinutes: 180 },
    ]);
    await renderCounsellor(<Availability />);
    await screen.findByText('3 on your calendar');
    expect(screen.getByText(/has a booking · fully booked$/)).toBeTruthy();
    expect(screen.getByText(/has a booking · 2 hours free$/)).toBeTruthy();
    expect(screen.getAllByText(/(free|fully booked)$/)).toHaveLength(2);
  });
});
