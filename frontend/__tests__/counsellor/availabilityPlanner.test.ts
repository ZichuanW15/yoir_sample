import { AvailabilitySlot } from '@/src/api/types';
import {
  addMonths,
  buildSlotDrafts,
  dateKey,
  monthGrid,
  overlapsExisting,
  parseDateKey,
  startOfMonth,
  startOfDay,
  isSameMonth,
  weekdayDatesInRange,
} from '@/src/counsellor/availabilityPlanner';

describe('availabilityPlanner', () => {
  describe('dateKey / parseDateKey', () => {
    test('round-trips a local calendar date without drifting across a timezone boundary', () => {
      const date = new Date(2026, 7, 13); // 13 August 2026, local time
      const key = dateKey(date);

      expect(key).toBe('2026-08-13');
      expect(parseDateKey(key)).toEqual(new Date(2026, 7, 13));
    });

    test('pads single-digit months and days', () => {
      expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    });
  });

  describe('startOfMonth / addMonths', () => {
    test('normalises to the first of the month at midnight', () => {
      const start = startOfMonth(new Date(2026, 8, 17, 14, 30));
      expect(start).toEqual(new Date(2026, 8, 1, 0, 0, 0, 0));
    });

    test('addMonths steps forward and backward across a year boundary', () => {
      expect(addMonths(new Date(2026, 11, 1), 1)).toEqual(new Date(2027, 0, 1));
      expect(addMonths(new Date(2026, 0, 1), -1)).toEqual(new Date(2025, 11, 1));
    });
  });

  describe('monthGrid', () => {
    test('pads a Monday-first grid to full weeks with nulls for adjacent months', () => {
      // September 2026 starts on a Tuesday and has 30 days.
      const grid = monthGrid(new Date(2026, 8, 15));

      expect(grid.length).toBe(35); // 1 leading blank + 30 days, padded out to 5 full weeks
      expect(grid[0]).toBeNull(); // Monday the 31st of August is not in this month
      expect(grid[1]).toEqual(new Date(2026, 8, 1));
      const days = grid.filter((cell): cell is Date => cell !== null);
      expect(days).toHaveLength(30);
      expect(days[days.length - 1]).toEqual(new Date(2026, 8, 30));
    });
  });

  describe('weekdayDatesInRange', () => {
    test('collects every matching weekday across the requested number of weeks', () => {
      // Monday 3 August 2026, asking for Monday (0) and Friday (4) across 2 weeks.
      const start = new Date(2026, 7, 3);
      const dates = weekdayDatesInRange([0, 4], start, 2);

      expect(dates.map(dateKey)).toEqual(['2026-08-03', '2026-08-07', '2026-08-10', '2026-08-14']);
    });

    test('returns nothing for zero weeks or an empty weekday selection', () => {
      const start = new Date(2026, 7, 3);
      expect(weekdayDatesInRange([0], start, 0)).toEqual([]);
      expect(weekdayDatesInRange([], start, 4)).toEqual([]);
    });
  });

  describe('buildSlotDrafts', () => {
    test('produces the full cartesian product of dates, services, times and durations', () => {
      const drafts = buildSlotDrafts({
        dates: [new Date(2026, 7, 13), new Date(2026, 7, 14)],
        serviceIds: ['svc-a', 'svc-b'],
        times: [{ hour: 7, minute: 15 }],
        durationsMinutes: [30, 60],
      });

      // 2 dates x 2 services x 1 time x 2 durations
      expect(drafts).toHaveLength(8);
      expect(drafts[0]).toEqual({
        serviceId: 'svc-a',
        startsAt: new Date(2026, 7, 13, 7, 15).toISOString(),
        endsAt: new Date(2026, 7, 13, 7, 45).toISOString(),
      });
    });

    test('sorts by start time, then service id', () => {
      const drafts = buildSlotDrafts({
        dates: [new Date(2026, 7, 14), new Date(2026, 7, 13)],
        serviceIds: ['svc-b', 'svc-a'],
        times: [{ hour: 9, minute: 0 }],
        durationsMinutes: [30],
      });

      expect(drafts.map((d) => d.startsAt)).toEqual([...drafts.map((d) => d.startsAt)].sort());
      expect(drafts[0].serviceId).toBe('svc-a');
      expect(drafts[1].serviceId).toBe('svc-b');
    });

    test('deduplicates identical combinations instead of creating the same slot twice', () => {
      const drafts = buildSlotDrafts({
        dates: [new Date(2026, 7, 13)],
        serviceIds: ['svc-a'],
        times: [{ hour: 9, minute: 0 }, { hour: 9, minute: 0 }],
        durationsMinutes: [30, 30],
      });

      expect(drafts).toHaveLength(1);
    });

    test('returns an empty list when any dimension is empty', () => {
      expect(buildSlotDrafts({ dates: [], serviceIds: ['svc-a'], times: [{ hour: 9, minute: 0 }], durationsMinutes: [30] })).toEqual([]);
      expect(buildSlotDrafts({ dates: [new Date()], serviceIds: [], times: [{ hour: 9, minute: 0 }], durationsMinutes: [30] })).toEqual([]);
    });
  });

  describe('overlapsExisting', () => {
    const existing: AvailabilitySlot[] = [
      { id: 'slot-1', serviceId: 'svc-a', startsAt: '2026-08-13T00:00:00.000Z', endsAt: '2026-08-13T01:00:00.000Z', status: 'open' },
      { id: 'slot-2', serviceId: 'svc-a', startsAt: '2026-08-13T02:00:00.000Z', endsAt: '2026-08-13T03:00:00.000Z', status: 'booked' },
    ];

    test('flags a draft that overlaps an open slot on the same service', () => {
      const draft = { serviceId: 'svc-a', startsAt: '2026-08-13T00:30:00.000Z', endsAt: '2026-08-13T01:30:00.000Z' };
      expect(overlapsExisting(draft, existing)).toBe(true);
    });

    test('accepts a non-overlapping window with adjacent endpoints', () => {
      expect(overlapsExisting({ serviceId: 'svc-a', startsAt: '2026-08-13T01:00:00.000Z', endsAt: '2026-08-13T02:00:00.000Z' }, existing)).toBe(false);
    });

    test('excludes a slot by id, so editing a slot does not clash with itself', () => {
      const draft = { serviceId: 'svc-a', startsAt: '2026-08-13T00:00:00.000Z', endsAt: '2026-08-13T01:00:00.000Z' };
      expect(overlapsExisting(draft, existing, 'slot-1')).toBe(false);
    });
  });

  test('calendar helpers retain local dates without mutating input', () => {
    const date = new Date(2028, 1, 29, 14, 30);
    expect(startOfDay(date)).toEqual(new Date(2028, 1, 29));
    expect(date.getHours()).toBe(14);
    expect(isSameMonth(date, new Date(2028, 1, 1))).toBe(true);
    expect(isSameMonth(date, new Date(2027, 1, 1))).toBe(false);
    expect(isSameMonth(date, new Date(2028, 2, 1))).toBe(false);
    expect(monthGrid(date).filter(Boolean)).toHaveLength(29);
  });

  test('drafts retain elapsed duration across midnight and do not mutate source dates', () => {
    const date = new Date(2026, 11, 31);
    const [draft] = buildSlotDrafts({ dates: [date], serviceIds: ['svc-a'], times: [{ hour: 23, minute: 30 }], durationsMinutes: [90] });
    expect(new Date(draft.endsAt).getTime() - new Date(draft.startsAt).getTime()).toBe(90 * 60_000);
    expect(new Date(draft.endsAt).getFullYear()).toBe(2027);
    expect(date.getHours()).toBe(0);
    expect(buildSlotDrafts({ dates: [date], serviceIds: ['svc-a'], times: [], durationsMinutes: [30] })).toEqual([]);
    expect(buildSlotDrafts({ dates: [date], serviceIds: ['svc-a'], times: [{ hour: 9, minute: 0 }], durationsMinutes: [] })).toEqual([]);
  });
});
