import { AvailabilitySlot, SlotDraft } from '@/src/api/types';

/**
 * Bulk availability creation: an "alarm app" style picker where a counsellor chooses
 * many dates (or days of the week), many services, many start times and many
 * durations at once, and every combination becomes one slot draft.
 *
 * Weekdays are indexed Monday-first (0 = Monday .. 6 = Sunday), matching the day
 * strip already used on the availability screen: `(date.getDay() + 6) % 7`.
 */

export interface TimeOfDay { hour: number; minute: number }

const DAY_MS = 86_400_000;

/** A local (not UTC) calendar-day key, stable for use as a Set/Map key. */
export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfMonth(date: Date): Date {
  const start = new Date(date);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function addMonths(date: Date, count: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + count);
  return next;
}

export function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

const isSameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

/**
 * A Monday-first calendar grid for `month`, padded to full weeks with `null` for the
 * leading and trailing days that belong to adjacent months.
 */
export function monthGrid(month: Date): (Date | null)[] {
  const first = startOfMonth(month);
  const leadingBlanks = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < leadingBlanks; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(first.getFullYear(), first.getMonth(), day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export { isSameMonth };

/** Every date in [start, start + weeks*7 days) whose Monday-first weekday is selected. */
export function weekdayDatesInRange(weekdays: number[], start: Date, weeks: number): Date[] {
  const wanted = new Set(weekdays);
  const from = startOfDay(start);
  const totalDays = Math.max(0, weeks) * 7;
  const dates: Date[] = [];
  for (let i = 0; i < totalDays; i += 1) {
    const day = new Date(from.getTime() + i * DAY_MS);
    if (wanted.has((day.getDay() + 6) % 7)) dates.push(day);
  }
  return dates;
}

export interface BuildSlotDraftsInput {
  dates: Date[];
  serviceIds: string[];
  times: TimeOfDay[];
  durationsMinutes: number[];
}

/** The full cartesian product of dates × services × start times × durations, deduplicated and sorted. */
export function buildSlotDrafts({ dates, serviceIds, times, durationsMinutes }: BuildSlotDraftsInput): SlotDraft[] {
  const drafts: SlotDraft[] = [];
  for (const date of dates) {
    for (const serviceId of serviceIds) {
      for (const time of times) {
        for (const minutes of durationsMinutes) {
          const start = new Date(date);
          start.setHours(time.hour, time.minute, 0, 0);
          const end = new Date(start.getTime() + minutes * 60_000);
          drafts.push({ serviceId, startsAt: start.toISOString(), endsAt: end.toISOString() });
        }
      }
    }
  }

  const seen = new Set<string>();
  const unique = drafts.filter((draft) => {
    const key = `${draft.serviceId}|${draft.startsAt}|${draft.endsAt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.serviceId.localeCompare(b.serviceId));
  return unique;
}

/** Whether `draft` would overlap a still-offerable (non-booked) slot already on that service. */
export function overlapsExisting(draft: SlotDraft, existing: AvailabilitySlot[], ignoreId?: string): boolean {
  return existing.some((slot) => slot.id !== ignoreId && slot.serviceId === draft.serviceId && slot.status !== 'booked'
    && draft.startsAt < slot.endsAt && slot.startsAt < draft.endsAt);
}
