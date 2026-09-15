/** Historical requirement probes for fields and views absent from this revision.
 * Excluded from the current implemented-feature QA scope. */
import { apiMock, counsellorProfileFixture, renderCounsellor, serviceFixture, setupCounsellorMocks } from '../screens/counsellor-screen-utils';
import { screen } from '@testing-library/react-native';
import Profile from '@/app/counsellor/profile';
import Availability from '@/app/counsellor/availability';
import { AvailabilitySlot } from '@/src/api/types';

beforeEach(setupCounsellorMocks);
async function openProfile() {
  await renderCounsellor(<Profile />);
  await screen.findByDisplayValue(counsellorProfileFixture.introduction);
}

describe('planned counsellor fields and weekly view', () => {
  test.each([
    ['qualifications', /qualifications?/i],
    ['spoken languages', /(?:spoken languages|languages spoken|languages)/i],
  ])('[QA-130][US30-AC1/2] profile offers an editable %s field', async (_field, label) => {
    await openProfile();
    // Accept an input or labelled choice control; do not prescribe a taxonomy.
    expect(screen.queryAllByLabelText(label).length).toBeGreaterThan(0);
  });

  test('[QA-130][US30-AC3] default delivery supports both online and in-person', async () => {
    await openProfile();
    // Either a single Both option or independently selectable delivery choices
    // can represent the AC. Two mutually exclusive radio choices cannot.
    const both = screen.queryByRole('radio', { name: /both|online\s*(?:and|&|\+|\/)\s*in.person/i })
      ?? screen.queryByRole('button', { name: /both|online\s*(?:and|&|\+|\/)\s*in.person/i });
    const separateChoices = screen.queryByRole('checkbox', { name: /^online$/i })
      && screen.queryByRole('checkbox', { name: /^in.person$/i });
    expect(Boolean(both || separateChoices)).toBe(true);
  });

  test('[QA-145][US39-AC1] one weekly availability view does not mix slots two weeks apart', async () => {
    const ActualDate = Date;
    // Monday morning, with a future Tuesday slot in this same calendar week.
    // Replace only Date; promises, React and waitFor keep real asynchronous timers.
    const now = new ActualDate(2026, 8, 14, 9).getTime();
    class CalendarDate extends ActualDate {
      constructor(...args: unknown[]) {
        super();
        return Reflect.construct(ActualDate, args.length ? args : [now]) as CalendarDate;
      }
      static now() { return now; }
    }
    global.Date = CalendarDate as DateConstructor;
    try {
      const start = new Date(2026, 8, 15, 12);
      const later = new Date(2026, 8, 29, 12);
      const slots: AvailabilitySlot[] = [start, later].map((date, index) => ({
        id: `week-slot-${index}`, serviceId: `week-service-${index}`, status: 'open',
        startsAt: date.toISOString(), endsAt: new Date(date.getTime() + 3600000).toISOString(),
      }));
      apiMock.listOwnServices.mockResolvedValue([
        { ...serviceFixture, id: 'week-service-0', title: 'First weekly slot service' },
        { ...serviceFixture, id: 'week-service-1', title: 'Later weekly slot service' },
      ]);
      apiMock.listOwnAvailabilitySlots.mockResolvedValue(slots);
      await renderCounsellor(<Availability />);
      await screen.findByText('First weekly slot service');
      expect(apiMock.listOwnAvailabilitySlots).toHaveBeenCalledTimes(1);
      const displayedWeeks = Number(screen.queryByText('First weekly slot service') !== null)
        + Number(screen.queryByText('Later weekly slot service') !== null);
      // Exactly one loaded week sentinel: neither a blank screen nor the current
      // unbounded chronological list can satisfy this weekly-view boundary.
      expect(displayedWeeks).toBe(1);
    } finally {
      global.Date = ActualDate;
    }
  });
});
