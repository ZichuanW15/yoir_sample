import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, userFacingError } from '@/src/api/client';
import { AvailabilityWindow, Modality } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { BackBar } from '@/src/components/booking';
import { Glyph } from '@/src/components/Glyph';
import { Button, Chip, ErrorBanner, Press } from '@/src/components/ui';
import {
  addMonths, buildWindowDrafts, dateKey, isSameMonth, monthGrid, parseDateKey, startOfDay,
  startOfMonth, weekdayDatesInRange,
} from '@/src/counsellor/availabilityPlanner';
import { fmtLong, fmtTime, HOURS, hoursAndMinutes, modalityLabel, timeRange } from '@/src/format';
import { FadeUp, ScreenIn } from '@/src/motion';
import { goBack } from '@/src/navigation';
import { colors, fonts, radius, shadow, type } from '@/src/theme';

const DAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MAX_WEEKS = 8;
/** Refused up front rather than left half-created, since each window is its own call. */
const MAX_WINDOWS_PER_SAVE = 60;

/**
 * US-39 — "when do you work?", and nothing else.
 *
 * Availability belongs to the counsellor, so this screen no longer asks which
 * service a time is for, nor how long a session runs: a window is simply hours the
 * counsellor is free, every service they offer can be booked inside it, and the
 * length of a booking comes from the service the job seeker picks. That removes the
 * two things the old slot picker got wrong — it let you choose several durations at
 * one start time, which could only ever produce overlapping rows, and it made you
 * pick a single service, which meant you could not offer two things in the same hour.
 */
export default function AvailabilityScreen() {
  const { session } = useAuth();
  const { flash, confirm } = useChrome();
  const insets = useSafeAreaInsets();

  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set());
  const [weeks, setWeeks] = useState(4);
  const [fromHour, setFromHour] = useState(9);
  // How the counsellor can deliver in these hours. Being in the office only on
  // certain days is normal, so availability may differ by delivery method — but
  // the time itself is shared, and booking either kind takes it from both.
  const [modalities, setModalities] = useState<Modality[]>(['online', 'in_person']);
  const [toHour, setToHour] = useState(12);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      setWindows(await api.listOwnAvailabilityWindows(session.user.id, session.accessToken));
      setError('');
    } catch (cause) {
      setError(userFacingError(cause));
    }
  }, [session]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const cells = useMemo(() => monthGrid(month), [month]);
  const today = startOfDay(new Date());

  /** Repeating weekdays and individually tapped dates describe one set of days. */
  const dates = useMemo(() => {
    const chosen = new Map<string, Date>();
    for (const key of picked) chosen.set(key, parseDateKey(key));
    for (const date of weekdayDatesInRange([...weekdays], new Date(), weeks)) {
      chosen.set(dateKey(date), date);
    }
    return [...chosen.values()].filter((date) => startOfDay(date) >= today);
  }, [picked, weekdays, weeks, today]);

  const drafts = useMemo(
    () => buildWindowDrafts({
      dates, from: { hour: fromHour, minute: 0 }, to: { hour: toHour, minute: 0 }, modalities,
    }),
    [dates, fromHour, toHour, modalities],
  );

  function toggleDate(date: Date) {
    const key = dateKey(date);
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleWeekday(index: number) {
    setWeekdays((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function save() {
    if (!session) return;
    if (toHour <= fromHour) return setError('Your finish time must be after your start time.');
    if (!modalities.length) return setError('Choose at least one way you can meet.');
    if (!drafts.length) return setError('Choose at least one day.');
    if (drafts.length > MAX_WINDOWS_PER_SAVE) {
      return setError(`That is ${drafts.length} days at once. Add up to ${MAX_WINDOWS_PER_SAVE}.`);
    }

    setBusy(true);
    setError('');
    try {
      // One at a time: the server merges each into whatever it touches, so the order
      // matters and a partial failure still leaves a coherent calendar.
      for (const draft of drafts) {
        await api.createAvailabilityWindow(draft, session.accessToken);
      }
      setPicked(new Set());
      setWeekdays(new Set());
      await load();
      flash(`${drafts.length} ${drafts.length === 1 ? 'day' : 'days'} added`);
    } catch (cause) {
      setError(userFacingError(cause));
      await load();
    } finally {
      setBusy(false);
    }
  }

  const remove = useCallback(async (window: AvailabilityWindow) => {
    if (!session) return;
    const sure = await confirm({
      title: 'Remove this availability?',
      message: 'Job seekers will no longer be able to book any of your services in this time.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!sure) return;
    try {
      await api.deleteAvailabilityWindow(window.id, session.accessToken);
      await load();
    } catch (cause) {
      setError(userFacingError(cause));
    }
  }, [session, confirm, load]);

  if (!session || session.user.role !== 'counsellor') return <Redirect href="/" />;

  return (
    <ScreenIn style={s.screen}>
      <BackBar title="Availability" onBack={() => goBack('/counsellor')} />

      <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <FadeUp style={s.intro}>
          <Text style={type.display34}>When do you work?</Text>
          <Text style={type.body}>
            Mark the hours you are free. Every service you offer can be booked inside them, and
            a booking takes only as long as that service lasts.
          </Text>
        </FadeUp>

        {error ? <ErrorBanner message={error} /> : null}

        <FadeUp delay={60} style={s.card}>
          <View style={s.monthBar}>
            <Press onPress={() => setMonth(addMonths(month, -1))} accessibilityLabel="Previous month" style={s.monthNav}>
              <View style={s.flip}><Glyph name="chevronRight" size={16} color={colors.ink} /></View>
            </Press>
            <Text style={s.monthLabel}>
              {month.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
            </Text>
            <Press onPress={() => setMonth(addMonths(month, 1))} accessibilityLabel="Next month" style={s.monthNav}>
              <Glyph name="chevronRight" size={16} color={colors.ink} />
            </Press>
          </View>

          <View style={s.weekHead}>
            {DAY_NAMES.map((name) => <Text key={name} style={s.weekHeadCell}>{name}</Text>)}
          </View>
          <View style={s.grid}>
            {cells.map((date, index) => {
              if (!date) return <View key={`blank-${index}`} style={s.cell} />;
              const past = startOfDay(date) < today;
              const on = picked.has(dateKey(date));
              return (
                <Press
                  key={dateKey(date)}
                  disabled={past}
                  onPress={() => toggleDate(date)}
                  accessibilityLabel={fmtLong(date.toISOString())}
                  accessibilityState={{ selected: on }}
                  style={[s.cell, on && s.cellOn, past && s.cellPast]}
                >
                  <Text style={[s.cellText, on && s.cellTextOn, past && s.cellTextPast]}>
                    {isSameMonth(date, month) ? date.getDate() : ''}
                  </Text>
                </Press>
              );
            })}
          </View>
        </FadeUp>

        <FadeUp delay={120} style={s.card}>
          <Text style={type.groupLabel}>Or repeat every</Text>
          <View style={s.row}>
            {DAY_NAMES.map((name, index) => (
              <Chip
                key={name}
                label={name}
                role="checkbox"
                selected={weekdays.has(index)}
                onPress={() => toggleWeekday(index)}
              />
            ))}
          </View>
          {weekdays.size ? (
            <>
              <Text style={s.hint}>for the next</Text>
              <View style={s.row}>
                {[2, 4, 8].filter((n) => n <= MAX_WEEKS).map((n) => (
                  <Chip key={n} label={`${n} weeks`} selected={weeks === n} onPress={() => setWeeks(n)} />
                ))}
              </View>
            </>
          ) : null}
        </FadeUp>

        <FadeUp delay={180} style={s.card}>
          <Text style={type.groupLabel}>Hours</Text>
          <Text style={s.hint}>From</Text>
          <View style={s.row}>
            {HOURS.map((hour) => (
              <Chip key={hour} label={String(hour)} selected={fromHour === hour} onPress={() => setFromHour(hour)} />
            ))}
          </View>
          <Text style={s.hint}>Until</Text>
          <View style={s.row}>
            {HOURS.map((hour) => (
              <Chip key={hour} label={String(hour)} selected={toHour === hour} onPress={() => setToHour(hour)} />
            ))}
          </View>
          <Text style={s.hint}>How can you meet in these hours?</Text>
          <View style={s.row}>
            {(['online', 'in_person'] as Modality[]).map((option) => (
              <Chip
                key={option}
                label={modalityLabel(option)}
                role="checkbox"
                selected={modalities.includes(option)}
                onPress={() => setModalities((current) => (
                  current.includes(option)
                    ? current.filter((m) => m !== option)
                    : [...current, option]
                ))}
              />
            ))}
          </View>

          <Text style={s.summary}>
            {drafts.length
              ? `${drafts.length} ${drafts.length === 1 ? 'day' : 'days'}, ${fromHour}:00 to ${toHour}:00`
              : 'Choose the days you are free.'}
          </Text>
          <Button label="Add availability" height={54} busy={busy} onPress={save} style={shadow.toast} />
        </FadeUp>

        <FadeUp delay={240} style={s.listHead}>
          <Text style={type.display24}>
            {windows.length ? `${windows.length} on your calendar` : 'Nothing on your calendar yet'}
          </Text>
        </FadeUp>

        {windows.map((window, index) => (
          <FadeUp key={window.id} delay={260 + index * 40}>
            <View style={s.windowRow}>
              <View style={s.windowCopy}>
                <Text style={s.windowDay}>{fmtLong(window.startsAt)}</Text>
                <Text style={s.windowTime}>
                  {timeRange(window.startsAt, window.endsAt)}
                  {' · '}{window.modalities.map(modalityLabel).join(' & ')}
                  {window.hasBookings ? ' · has a booking' : ''}
                  {openNote(window)}
                </Text>
              </View>
              <Press
                onPress={() => remove(window)}
                scaleTo={0.94}
                accessibilityLabel={`Remove ${fmtLong(window.startsAt)} ${fmtTime(window.startsAt)}`}
                style={s.removeButton}
              >
                <Glyph name="trash" size={14} color={colors.dangerInk} />
              </Press>
            </View>
          </FadeUp>
        ))}
      </ScrollView>
    </ScreenIn>
  );
}

/** What is left of a window to book, when that is not simply all of it. */
function openNote(window: AvailabilityWindow): string {
  if (window.freeMinutes === undefined) return '';
  if (window.freeMinutes === 0) return ' · fully booked';
  const length = Math.round((Date.parse(window.endsAt) - Date.parse(window.startsAt)) / 60000);
  return window.freeMinutes < length ? ` · ${hoursAndMinutes(window.freeMinutes)} free` : '';
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  body: { paddingTop: 6, paddingHorizontal: 22, gap: 18 },
  intro: { gap: 8 },

  card: { padding: 18, gap: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.xl },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  summary: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, marginTop: 4 },

  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flip: { transform: [{ scaleX: -1 }] },
  monthNav: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.chip },
  monthLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  weekHead: { flexDirection: 'row' },
  weekHeadCell: { flex: 1, textAlign: 'center', fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellOn: { backgroundColor: colors.green, borderRadius: radius.sm },
  cellPast: { opacity: 0.3 },
  cellText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  cellTextOn: { color: colors.white },
  cellTextPast: { color: colors.muted },

  listHead: { marginTop: 6 },
  windowRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: colors.chip, borderRadius: radius.lg },
  windowCopy: { flex: 1, gap: 2 },
  windowDay: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  windowTime: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  removeButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.dangerBg },
});
