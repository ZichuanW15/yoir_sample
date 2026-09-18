import { AvailabilityWindow, Modality, WindowDraft } from '@/src/api/types';

/**
 * Bulk availability creation: a counsellor picks many dates (or days of the week)
 * and the hours they work, and each becomes one window.
 *
 * No services and no durations. Availability belongs to the counsellor, and how long
 * a session runs is a property of the service someone books — so the old product of
 * dates x services x times x durations, which could only ever emit overlapping rows,
 * is now dates x one daily span.
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

export interface BuildWindowDraftsInput {
  dates: Date[];
  /** The hours worked on each of those dates, as a single span. */
  from: TimeOfDay;
  to: TimeOfDay;
  /** How the counsellor can deliver in those hours. */
  modalities: Modality[];
}

/**
 * One window per chosen date, deduplicated and sorted.
 *
 * Windows that touch are merged, matching what the server does on save: 9-11 and
 * 10-12 describe one stretch of availability, not two conflicting ones.
 */
export function buildWindowDrafts(
  { dates, from, to, modalities }: BuildWindowDraftsInput,
): WindowDraft[] {
  const drafts: WindowDraft[] = [];
  for (const date of dates) {
    const start = new Date(date);
    start.setHours(from.hour, from.minute, 0, 0);
    const end = new Date(date);
    end.setHours(to.hour, to.minute, 0, 0);
    if (end <= start) continue;
    drafts.push({ startsAt: start.toISOString(), endsAt: end.toISOString(), modalities });
  }

  drafts.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return drafts.reduce<WindowDraft[]>((merged, draft) => {
    const previous = merged[merged.length - 1];
    // Only windows offering the same ways to meet describe the same availability.
    if (previous && draft.startsAt <= previous.endsAt
      && previous.modalities.join() === draft.modalities.join()) {
      previous.endsAt = draft.endsAt > previous.endsAt ? draft.endsAt : previous.endsAt;
      return merged;
    }
    merged.push({ ...draft });
    return merged;
  }, []);
}

/** Whether `draft` touches a window already on the calendar, and would merge with it. */
export function mergesWithExisting(
  draft: WindowDraft, existing: AvailabilityWindow[], ignoreId?: string,
): boolean {
  return existing.some((window) => window.id !== ignoreId
    && draft.startsAt <= window.endsAt && window.startsAt <= draft.endsAt);
}
