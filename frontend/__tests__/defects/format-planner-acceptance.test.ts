import { money } from '@/src/format';
import { dateKey, overlapsExisting, weekdayDatesInRange } from '@/src/counsellor/availabilityPlanner';
import { AvailabilitySlot } from '@/src/api/types';

// Ordinary acceptance assertions, intentionally red until the product is fixed.
// IDs map to docs/sprint2/qa/defects.md. Run with TZ=Australia/Melbourne.
describe('unresolved price and availability acceptance', () => {
  test('F01 / QA #115 #124: displayed AUD prices preserve the charged cents', () => {
    expect(money(7050)).toBe('$70.50');
  });

  const slot: AvailabilitySlot = {
    id: 'slot-1', serviceId: 'svc-a', status: 'open',
    startsAt: '2027-01-01T00:00:00Z', endsAt: '2027-01-01T01:00:00Z',
  };
  test('F02 / QA #145: equal endpoints are adjacent regardless of ISO millisecond precision', () => {
    expect(overlapsExisting({
      serviceId: slot.serviceId, startsAt: '2027-01-01T01:00:00.000Z', endsAt: '2027-01-01T02:00:00.000Z',
    }, [slot])).toBe(false);
  });

  test('F03 / QA #121 #145: a booked appointment still occupies the counsellor calendar', () => {
    expect(overlapsExisting({
      serviceId: slot.serviceId, startsAt: slot.startsAt, endsAt: slot.endsAt,
    }, [{ ...slot, status: 'booked' }])).toBe(true);
  });

  test('F04 / QA #121 #145: another service in the same own calendar cannot overlap', () => {
    expect(overlapsExisting({
      serviceId: 'svc-b', startsAt: slot.startsAt, endsAt: slot.endsAt,
    }, [slot])).toBe(true);
  });

  test('F05 / QA #145: weekday recurrence visits every local day once across DST end', () => {
    // Fail visibly if the command is run in the wrong zone; that is not defect evidence.
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Australia/Melbourne');
    const days = weekdayDatesInRange([0, 1, 2, 3, 4, 5, 6], new Date(2026, 3, 4), 1);
    expect(days.map(dateKey)).toEqual([
      '2026-04-04', '2026-04-05', '2026-04-06', '2026-04-07', '2026-04-08', '2026-04-09', '2026-04-10',
    ]);
  });
});
