import { apiMock, deferred, renderCounsellor, serviceFixture, setupCounsellorMocks, settle } from './counsellor-screen-utils';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import Availability from '@/app/counsellor/availability';
import { AvailabilitySlot } from '@/src/api/types';
import { apiError } from '@/src/api/errors';
import { fmtLong } from '@/src/format';
import { sessionFixture } from '../fixtures';

// Pin comparison time to 06:00 on the current local calendar day. The screen's
// Date constructors and the React scheduler remain real; Date.now is the clock seam.
const calendarDay = new Date();
const at = (offset = 0, hour = 9, minute = 0) => new Date(calendarDay.getFullYear(), calendarDay.getMonth(), calendarDay.getDate() + offset, hour, minute);
const day = (offset = 0, hour = 9, minute = 0) => at(offset, hour, minute).toISOString();
const slot: AvailabilitySlot = { id: 'slot-1', serviceId: 'service-1', startsAt: day(), endsAt: day(0, 10), status: 'open' };
async function openBulkForm() { await renderCounsellor(<Availability />); await waitFor(() => expect(apiMock.listOwnServices).toHaveBeenCalled()); fireEvent.press(screen.getByRole('button', { name: 'Add availability' })); await screen.findByText('New availability'); }
const addNine = () => fireEvent.press(screen.getByRole('button', { name: /^Add 9[:.]00/ }));
beforeEach(() => { setupCounsellorMocks(); jest.spyOn(Date, 'now').mockReturnValue(at(0, 6).getTime()); });
describe('Counsellor availability — QA #145', () => {
  test.each([null, sessionFixture])('hides availability management from unauthorized roles (%j)', async (session) => {
    await renderCounsellor(<Availability />, session); expect(screen.getByTestId('redirect')).toBeTruthy(); expect(screen.queryByRole('button', { name: 'Add availability' })).toBeNull();
  });
  test('requires a service before opening the availability form', async () => {
    apiMock.listOwnServices.mockResolvedValue([]); await renderCounsellor(<Availability />); await screen.findByText('No availability yet');
    fireEvent.press(screen.getByRole('button', { name: 'Add availability' })); expect(screen.getByText('Add a service first')).toBeTruthy(); expect(router.push).toHaveBeenCalledWith('/counsellor/services/new');
  });
  test('shows a loading error from the API without claiming saved availability', async () => {
    apiMock.listOwnAvailabilitySlots.mockRejectedValue(apiError(503, 'UNAVAILABLE', 'Availability is temporarily unavailable.'));
    await renderCounsellor(<Availability />); await screen.findByText('Availability is temporarily unavailable.'); expect(apiMock.createAvailabilitySlot).not.toHaveBeenCalled();
  });
  test('previews a future combination and persists the exact timezone-qualified timestamps through the real HTTP client', async () => {
    const real = jest.requireActual('@/src/api/client') as typeof import('@/src/api/client');
    expect(real.isDemoApi).toBe(false); apiMock.createAvailabilitySlot.mockImplementation(real.api.createAvailabilitySlot);
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 201, json: async () => slot } as Response);
    await openBulkForm(); expect(screen.getByRole('button', { name: 'Save availability' })).toBeDisabled(); addNine();
    expect(screen.getByText('This creates 1 slot across 1 date.')).toBeTruthy(); fireEvent.press(screen.getByRole('button', { name: 'Save availability' }));
    await screen.findByText('1 slot added'); expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/v1\/me\/availability-slots$/), expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer counsellor-access-token' }), body: JSON.stringify({ serviceId: 'service-1', startsAt: day(), endsAt: day(0, 10) }) }));
    expect(screen.getByText('Open')).toBeTruthy(); expect(screen.queryByText('New availability')).toBeNull();
  });
  test('filters past combinations from preview and disables an entirely past plan', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(at(0, 12).getTime()); await openBulkForm(); addNine();
    expect(screen.getByText("Every combination falls in the past. 1 more already passed and won't be created.")).toBeTruthy(); expect(screen.getByRole('button', { name: 'Save availability' })).toBeDisabled(); expect(apiMock.createAvailabilitySlot).not.toHaveBeenCalled();
    if (at(1).getMonth() !== calendarDay.getMonth()) fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.press(screen.getByRole('checkbox', { name: fmtLong(at(1, 0).toISOString()) }));
    expect(screen.getByText("This creates 1 slot across 2 dates. 1 more already passed and won't be created.")).toBeTruthy();
  });
  test('skips pre-existing overlaps but saves a separate time and reports both outcomes', async () => {
    apiMock.listOwnAvailabilitySlots.mockResolvedValue([slot]); apiMock.createAvailabilitySlot.mockImplementation(async (draft) => ({ id: 'new-slot', ...draft, status: 'open' }));
    await openBulkForm(); addNine(); fireEvent.press(screen.getByRole('radio', { name: '11' })); fireEvent.press(screen.getByRole('button', { name: /^Add 11[:.]00/ }));
    expect(screen.getByText('This creates 2 slots across 1 date.')).toBeTruthy(); fireEvent.press(screen.getByRole('button', { name: 'Save availability' }));
    await screen.findByText('1 slot added, 1 skipped'); expect(apiMock.createAvailabilitySlot).toHaveBeenCalledTimes(1); expect(apiMock.createAvailabilitySlot).toHaveBeenCalledWith({ serviceId: 'service-1', startsAt: day(0, 11), endsAt: day(0, 12) }, 'counsellor-access-token');
  });
  test('rejects an entirely overlapping plan without sending writes', async () => {
    apiMock.listOwnAvailabilitySlots.mockResolvedValue([slot]); await openBulkForm(); addNine(); fireEvent.press(screen.getByRole('button', { name: 'Save availability' }));
    expect(screen.getByText('Every combination overlapped a slot you already offer.')).toBeTruthy(); expect(apiMock.createAvailabilitySlot).not.toHaveBeenCalled(); expect(screen.getByText('New availability')).toBeTruthy();
  });
  test('weekday recurrence previews two weeks and caps an oversized plan before any requests', async () => {
    apiMock.listOwnServices.mockResolvedValue([serviceFixture, { ...serviceFixture, id: 'service-2', title: 'Resume review' }]);
    await openBulkForm(); fireEvent.press(screen.getByRole('radio', { name: 'Days of the week' })); addNine(); fireEvent.press(screen.getByRole('button', { name: 'More weeks' }));
    expect(screen.getByText('This creates 2 slots across 2 dates.')).toBeTruthy();
    for (let count = 0; count < 10; count++) fireEvent.press(screen.getByRole('button', { name: 'More weeks' }));
    for (const name of ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].filter((_, index) => index !== (calendarDay.getDay() + 6) % 7)) fireEvent.press(screen.getByRole('checkbox', { name }));
    fireEvent.press(screen.getByRole('checkbox', { name: 'Resume review' }));
    expect(screen.getByText('That would create 168 slots at once. Narrow your selection to 150 or fewer, then repeat.')).toBeTruthy(); expect(screen.getByRole('button', { name: 'Save availability' })).toBeDisabled(); expect(apiMock.createAvailabilitySlot).not.toHaveBeenCalled();
  });
  test('booked slots cannot enter editing or be removed', async () => {
    apiMock.listOwnAvailabilitySlots.mockResolvedValue([{ ...slot, status: 'booked' }]); await renderCounsellor(<Availability />); await screen.findByText('Booked');
    fireEvent.press(screen.getByRole('button', { name: /, Booked$/ })); expect(screen.getByText('Booked slots cannot be changed')).toBeTruthy(); expect(screen.queryByRole('button', { name: 'Remove slot' })).toBeNull(); expect(apiMock.updateAvailabilitySlot).not.toHaveBeenCalled();
  });
  test('updates a future slot only after server confirmation, then removes it', async () => {
    apiMock.listOwnAvailabilitySlots.mockResolvedValue([slot]);
    const pending = deferred<AvailabilitySlot>(); apiMock.updateAvailabilitySlot.mockReturnValueOnce(pending.promise);
    await renderCounsellor(<Availability />); await screen.findByText('Open'); fireEvent.press(screen.getByRole('button', { name: /, Open$/ }));
    fireEvent.press(screen.getByRole('radio', { name: '11' })); fireEvent.press(screen.getByRole('radio', { name: '30 min' })); fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.queryByText('Slot updated')).toBeNull(); expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();
    await settle(pending, { ...slot, startsAt: day(0, 11), endsAt: day(0, 11, 30) });
    await screen.findByText('Slot updated'); expect(apiMock.updateAvailabilitySlot).toHaveBeenCalledWith('slot-1', { serviceId: 'service-1', startsAt: day(0, 11), endsAt: day(0, 11, 30) }, 'counsellor-access-token');
    fireEvent.press(screen.getByRole('button', { name: /, Open$/ })); fireEvent.press(screen.getByRole('button', { name: 'Remove slot' })); await screen.findByText('Slot removed'); expect(screen.getByText('No availability yet')).toBeTruthy(); expect(apiMock.deleteAvailabilitySlot).toHaveBeenCalledWith('slot-1', 'counsellor-access-token');
  });
  test.each(['update', 'delete'])('a %s failure retains the existing slot and edit form', async (action) => {
    apiMock.listOwnAvailabilitySlots.mockResolvedValue([slot]); const cause = apiError(409, 'SLOT_CHANGED', 'This slot was changed by another request.');
    apiMock.updateAvailabilitySlot.mockRejectedValue(cause); apiMock.deleteAvailabilitySlot.mockRejectedValue(cause);
    await renderCounsellor(<Availability />); await screen.findByText('Open'); fireEvent.press(screen.getByRole('button', { name: /, Open$/ }));
    fireEvent.press(screen.getByRole('button', { name: action === 'update' ? 'Save changes' : 'Remove slot' })); await screen.findByText('This slot was changed by another request.');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy(); expect(screen.queryByText('Slot updated')).toBeNull(); expect(screen.queryByText('Slot removed')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Cancel' })); expect(screen.getByText('Open')).toBeTruthy();
  });
  test('edit detects another slot conflict locally without sending an update', async () => {
    apiMock.listOwnAvailabilitySlots.mockResolvedValue([slot, { ...slot, id: 'slot-2', startsAt: day(0, 11), endsAt: day(0, 12) }]);
    await renderCounsellor(<Availability />); await screen.findAllByText('Open'); fireEvent.press(screen.getAllByRole('button', { name: /, Open$/ })[0]); fireEvent.press(screen.getByRole('radio', { name: '11' }));
    fireEvent.press(screen.getByRole('button', { name: 'Save changes' })); expect(screen.getByText('This window overlaps an availability slot you already offer.')).toBeTruthy(); expect(apiMock.updateAvailabilitySlot).not.toHaveBeenCalled();
  });
});
