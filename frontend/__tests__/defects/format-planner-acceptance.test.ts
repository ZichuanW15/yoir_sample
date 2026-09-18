import { money } from '@/src/format';
import { dateKey, weekdayDatesInRange } from '@/src/counsellor/availabilityPlanner';

// Ordinary acceptance assertions, intentionally red until the product is fixed.
// IDs map to docs/sprint2/qa/defects.md. Run with TZ=Australia/Melbourne.
describe('unresolved price and availability acceptance', () => {
  test('F01 / QA #115 #124: displayed AUD prices preserve the charged cents', () => {
    expect(money(7050)).toBe('$70.50');
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
