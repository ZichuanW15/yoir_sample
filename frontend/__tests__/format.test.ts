import {
  countdown, duration, fmtDay, fmtLong, fmtTime, initials, modalityLabel, money,
  monthDay, sameDay, startOfWeek, timeRange,
} from '@/src/format';

describe('display formatting', () => {
  test('prices drop the cents, as the redesign specifies', () => {
    expect(money(9500)).toBe('$95');
    expect(money(16500)).toBe('$165');
    expect(money(7050)).toBe('$71');
  });

  test('names both delivery methods', () => {
    expect(modalityLabel('online')).toBe('Online');
    expect(modalityLabel('in_person')).toBe('In person');
  });

  test('renders dates and times in the redesign formats', () => {
    const startsAt = new Date(2026, 8, 9, 10, 0, 0).toISOString();
    const endsAt = new Date(2026, 8, 9, 11, 30, 0).toISOString();
    expect(fmtDay(startsAt)).toMatch(/Wed/);
    expect(fmtLong(startsAt)).toMatch(/Wednesday/);
    expect(fmtTime(startsAt)).toBe('10:00 am');
    expect(timeRange(startsAt, endsAt)).toBe('10:00 am – 11:30 am');
    expect(duration(startsAt, endsAt)).toBe('90 min');
    expect(monthDay(new Date(2026, 8, 9))).toMatch(/9 Sep/);
  });

  test('builds avatar initials the way the prototype does', () => {
    expect(initials('Maya Chen')).toBe('MC');
    expect(initials('Hannah Okafor')).toBe('HO');
    expect(initials('Prince')).toBe('P');
  });

  test('counts a reservation hold down to zero', () => {
    expect(countdown(15 * 60 * 1000)).toBe('15:00');
    expect(countdown(65_000)).toBe('1:05');
    expect(countdown(-1)).toBe('0:00');
  });

  test('compares days and finds the Monday that starts a week', () => {
    expect(sameDay(new Date(2026, 8, 9, 1), new Date(2026, 8, 9, 23))).toBe(true);
    expect(sameDay(new Date(2026, 8, 9), new Date(2026, 8, 10))).toBe(false);
    // 9 September 2026 is a Wednesday; its week starts on Monday the 7th.
    const monday = startOfWeek(new Date(2026, 8, 9, 15, 30));
    expect(monday.getDate()).toBe(7);
    expect(monday.getHours()).toBe(0);
  });
});
