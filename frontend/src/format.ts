import { Modality } from '@/src/api/types';

/** Formatters copied from the redesign prototype so every label reads identically. */
export const money = (minor: number) => '$' + (minor / 100).toLocaleString('en-AU', { maximumFractionDigits: 0 });

export const modalityLabel = (modality: Modality) => (modality === 'online' ? 'Online' : 'In person');

export const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });

export const fmtLong = (iso: string) =>
  new Date(iso).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).toLowerCase();

export const timeRange = (startsAt: string, endsAt: string) => `${fmtTime(startsAt)} – ${fmtTime(endsAt)}`;

export const duration = (startsAt: string, endsAt: string) =>
  `${Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000)} min`;

/** A length of time in words: "45 min", "1 hour", "2 hours 30 min". */
export const hoursAndMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (!hours) return `${rest} min`;
  const whole = `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return rest ? `${whole} ${rest} min` : whole;
};

export const initials = (name: string) =>
  name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';

export const sameDay = (a: string | Date, b: string | Date) =>
  new Date(a).toDateString() === new Date(b).toDateString();

export const startOfWeek = (date: Date) => {
  const start = new Date(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  return start;
};

export const monthDay = (date: Date) => date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });

export const countdown = (ms: number) => {
  const total = Math.max(0, ms);
  return `${Math.floor(total / 60000)}:${String(Math.floor((total % 60000) / 1000)).padStart(2, '0')}`;
};

export const deviceTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Australia/Melbourne';
  } catch {
    return 'Australia/Melbourne';
  }
};

export const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
export const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
