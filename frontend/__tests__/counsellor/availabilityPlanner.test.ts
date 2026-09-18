import { AvailabilityWindow } from '@/src/api/types';
import {
  addMonths, buildWindowDrafts, dateKey, isSameMonth, mergesWithExisting, monthGrid,
  parseDateKey, startOfDay, startOfMonth, weekdayDatesInRange,
} from '@/src/counsellor/availabilityPlanner';

const at = (iso: string) => new Date(iso);

describe('planning availability', () => {
  describe('calendar helpers', () => {
    test('a month grid is padded to whole Monday-first weeks', () => {
      const cells = monthGrid(new Date(2026, 8, 1));
      expect(cells.length % 7).toBe(0);
      const days = cells.filter(Boolean) as Date[];
      expect(days[0].getDate()).toBe(1);
      expect(days[days.length - 1].getDate()).toBe(30);
    });

    test('date keys round-trip through the local calendar day', () => {
      const date = new Date(2026, 9, 3, 14, 30);
      expect(dateKey(date)).toBe('2026-10-03');
      expect(dateKey(parseDateKey(dateKey(date)))).toBe('2026-10-03');
    });

    test('startOfDay and isSameMonth behave as the grid expects', () => {
      expect(startOfDay(new Date(2026, 9, 3, 23, 59)).getHours()).toBe(0);
      expect(isSameMonth(new Date(2026, 9, 1), new Date(2026, 9, 30))).toBe(true);
      expect(isSameMonth(new Date(2026, 9, 1), new Date(2026, 10, 1))).toBe(false);
    });

    test('addMonths moves the month without drifting the year', () => {
      expect(addMonths(new Date(2026, 11, 1), 1).getMonth()).toBe(0);
      expect(addMonths(new Date(2026, 11, 1), 1).getFullYear()).toBe(2027);
    });

    test('repeating weekdays yields one date per matching day in range', () => {
      const dates = weekdayDatesInRange([0], new Date(2026, 8, 1), 3);
      expect(dates).toHaveLength(3);
      expect(new Set(dates.map((d) => (d.getDay() + 6) % 7))).toEqual(new Set([0]));
    });

    test('no weeks means no dates', () => {
      expect(weekdayDatesInRange([0, 1], new Date(2026, 8, 1), 0)).toEqual([]);
    });
  });

  describe('building windows', () => {
    test('one window per chosen day, over the hours worked', () => {
      const drafts = buildWindowDrafts({
        dates: [at('2026-10-03T00:00:00'), at('2026-10-05T00:00:00')],
        from: { hour: 9, minute: 0 },
        to: { hour: 12, minute: 0 },
        modalities: ['online'],
      });

      expect(drafts).toHaveLength(2);
      // No service and no duration: that is the whole point of the redesign.
      expect(Object.keys(drafts[0])).toEqual(['startsAt', 'endsAt', 'modalities']);
      expect(new Date(drafts[0].startsAt).getHours()).toBe(9);
      expect(new Date(drafts[0].endsAt).getHours()).toBe(12);
    });

    test('a finish time at or before the start yields nothing', () => {
      const drafts = buildWindowDrafts({
        dates: [at('2026-10-03T00:00:00')],
        from: { hour: 12, minute: 0 },
        to: { hour: 9, minute: 0 },
        modalities: ['online'],
      });
      expect(drafts).toEqual([]);
    });

    test('no dates yields nothing', () => {
      expect(buildWindowDrafts({
        dates: [], from: { hour: 9, minute: 0 }, to: { hour: 12, minute: 0 }, modalities: ['online'],
      })).toEqual([]);
    });

    test('drafts come back in start order', () => {
      const drafts = buildWindowDrafts({
        dates: [at('2026-10-05T00:00:00'), at('2026-10-03T00:00:00')],
        from: { hour: 9, minute: 0 },
        to: { hour: 12, minute: 0 },
        modalities: ['online'],
      });
      expect(drafts.map((d) => d.startsAt)).toEqual([...drafts.map((d) => d.startsAt)].sort());
    });

    test('the same day twice produces one window, not two overlapping ones', () => {
      // The old planner multiplied dates by services by times by durations, which
      // could only ever emit rows that collided.
      const drafts = buildWindowDrafts({
        dates: [at('2026-10-03T00:00:00'), at('2026-10-03T00:00:00')],
        from: { hour: 9, minute: 0 },
        to: { hour: 12, minute: 0 },
        modalities: ['online'],
      });
      expect(drafts).toHaveLength(1);
    });
  });

  describe('merging with the existing calendar', () => {
    const existing: AvailabilityWindow[] = [
      {
        id: 'w1', startsAt: '2026-10-03T09:00:00.000Z', endsAt: '2026-10-03T12:00:00.000Z',
        modalities: ['online', 'in_person'],
      },
    ];

    test('a draft inside an existing window merges with it', () => {
      expect(mergesWithExisting(
        { startsAt: '2026-10-03T10:00:00.000Z', endsAt: '2026-10-03T11:00:00.000Z', modalities: ['online'] }, existing,
      )).toBe(true);
    });

    test('a draft that only touches the edge still merges', () => {
      // 12-14 following 9-12 describes one stretch, not two conflicting ones.
      expect(mergesWithExisting(
        { startsAt: '2026-10-03T12:00:00.000Z', endsAt: '2026-10-03T14:00:00.000Z', modalities: ['online'] }, existing,
      )).toBe(true);
    });

    test('a draft on another day does not', () => {
      expect(mergesWithExisting(
        { startsAt: '2026-10-04T09:00:00.000Z', endsAt: '2026-10-04T12:00:00.000Z', modalities: ['online'] }, existing,
      )).toBe(false);
    });

    test('the window being edited is ignored', () => {
      expect(mergesWithExisting(
        { startsAt: '2026-10-03T09:00:00.000Z', endsAt: '2026-10-03T13:00:00.000Z', modalities: ['online'] },
        existing,
        'w1',
      )).toBe(false);
    });
  });
});
