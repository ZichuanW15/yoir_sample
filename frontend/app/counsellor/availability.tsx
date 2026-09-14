import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Polyline, Rect } from 'react-native-svg';
import { api, userFacingError } from '@/src/api/client';
import { AvailabilitySlot, Service } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { Glyph } from '@/src/components/Glyph';
import { Button, Chip, ErrorBanner, IconButton, Press, Tag } from '@/src/components/ui';
import {
  addMonths, buildSlotDrafts, dateKey, monthGrid, overlapsExisting, parseDateKey, startOfMonth,
  TimeOfDay, weekdayDatesInRange,
} from '@/src/counsellor/availabilityPlanner';
import { fmtDay, fmtLong, fmtTime, HOURS, timeRange } from '@/src/format';
import { FadeUp, Float, ScreenIn } from '@/src/motion';
import { colors, fonts, radius, shadow, type } from '@/src/theme';

const DAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DURATIONS = [15, 30, 45, 60, 90, 120];
const MINUTES = [0, 15, 30, 45];
const MAX_WEEKS = 12;
/** A sequential create-per-combination loop is simple and lets each one be checked
 * for overlap against what came before it, so a very large plan is refused up front
 * rather than left half-created. */
const MAX_BULK_SLOTS = 150;

const STATUS: Record<AvailabilitySlot['status'], { label: string; bg: string; fg: string }> = {
  open: { label: 'Open', bg: colors.successBg, fg: colors.successInk },
  held: { label: 'Reserved', bg: colors.yellowTint, fg: colors.amberDeep },
  booked: { label: 'Booked', bg: colors.greenTint, fg: colors.successInk },
};

const timeLabel = (time: TimeOfDay) => fmtTime(new Date(2026, 0, 1, time.hour, time.minute).toISOString());

export default function AvailabilityScreen() {
  const { session } = useAuth();
  const { flash } = useChrome();
  const insets = useSafeAreaInsets();

  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AvailabilitySlot | null>(null);

  // Single-slot edit form: the date stays whatever the slot already has (only its
  // service, start time and duration can change), with the same hour + minute
  // granularity as the bulk picker below.
  const [serviceId, setServiceId] = useState('');
  const [hour, setHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [minutes, setMinutes] = useState(60);

  // Bulk creation form: an "alarm app" style picker — many dates (or days of the
  // week), many services, many start times and many durations, all at once. This is
  // the only way to create availability; there is no per-day browsing calendar
  // alongside it, so there's never two ways to pick a date on screen at once.
  const [dateMode, setDateMode] = useState<'dates' | 'weekdays'>('dates');
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set());
  const [weeksCount, setWeeksCount] = useState(1);
  const [bulkServiceIds, setBulkServiceIds] = useState<Set<string>>(new Set());
  const [times, setTimes] = useState<TimeOfDay[]>([]);
  const [pickHour, setPickHour] = useState(9);
  const [pickMinute, setPickMinute] = useState(0);
  const [durations, setDurations] = useState<Set<number>>(new Set([60]));
  const [bulkBusy, setBulkBusy] = useState(false);
  // Read once (a fresh reading whenever the form opens) rather than calling Date.now()
  // during render: the preview and the actual creation both filter against this same
  // value, so what "New availability" promises is exactly what gets attempted.
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const [ownServices, ownSlots] = await Promise.all([
        api.listOwnServices(session.user.id, session.accessToken),
        api.listOwnAvailabilitySlots(session.user.id, session.accessToken),
      ]);
      setServices(ownServices);
      setSlots(ownSlots);
      setServiceId((current) => current || ownServices[0]?.id || '');
    } catch (cause) {
      setFormError(userFacingError(cause));
    }
  }, [session]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!session || session.user.role !== 'counsellor') return <Redirect href="/" />;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // A flat, chronological list rather than a per-day browse: anything not yet over,
  // tap one to edit or remove it.
  const upcomingSlots = slots
    .filter((slot) => new Date(slot.endsAt).getTime() > nowMs)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const openForm = () => {
    if (!services.length) {
      flash('Add a service first');
      router.push('/counsellor/services/new');
      return;
    }
    setEditing(null);
    setDateMode('dates');
    setSelectedDates(new Set([dateKey(today)]));
    setCalendarMonth(startOfMonth(today));
    setWeekdays(new Set([(today.getDay() + 6) % 7]));
    setWeeksCount(1);
    setBulkServiceIds(new Set([serviceId || services[0].id]));
    setTimes([]);
    setPickHour(9);
    setPickMinute(0);
    setDurations(new Set([60]));
    // The functional-updater form, not a bare `Date.now()` argument: the read happens
    // inside the callback React invokes, not eagerly while this handler is built.
    setNowMs(() => Date.now());
    setFormError('');
    setFormOpen(true);
  };

  // A booked slot belongs to a buyer's confirmed session, so it is read-only here.
  const editSlot = (slot: AvailabilitySlot) => {
    if (slot.status === 'booked') return flash('Booked slots cannot be changed');
    setEditing(slot);
    setServiceId(slot.serviceId);
    setHour(new Date(slot.startsAt).getHours());
    setStartMinute(new Date(slot.startsAt).getMinutes());
    setMinutes(Math.round((new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) / 60000));
    setFormError('');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setFormError('');
  };

  const saveSlot = async () => {
    if (!editing) return;
    if (!serviceId || !services.some((item) => item.id === serviceId)) {
      return setFormError('Choose an active service for this slot.');
    }
    // The date itself isn't editable here — only which service, start time and
    // duration this slot uses — so it's taken straight from the slot being edited.
    const start = new Date(editing.startsAt);
    start.setHours(hour, startMinute, 0, 0);
    if (start.getTime() <= Date.now()) return setFormError('Choose a time in the future.');
    const end = new Date(start.getTime() + minutes * 60_000);
    const draft = { serviceId, startsAt: start.toISOString(), endsAt: end.toISOString() };
    if (overlapsExisting(draft, slots, editing.id)) return setFormError('This window overlaps an availability slot you already offer.');

    try {
      const updated = await api.updateAvailabilitySlot(editing.id, draft, session.accessToken);
      setSlots((current) => current.map((slot) => (slot.id === updated.id ? updated : slot)));
      setFormError('');
      setFormOpen(false);
      setEditing(null);
      flash('Slot updated');
    } catch (cause) {
      setFormError(userFacingError(cause));
    }
  };

  const removeSlot = async () => {
    if (!editing) return;
    try {
      await api.deleteAvailabilitySlot(editing.id, session.accessToken);
      setSlots((current) => current.filter((slot) => slot.id !== editing.id));
      setFormError('');
      setFormOpen(false);
      setEditing(null);
      flash('Slot removed');
    } catch (cause) {
      setFormError(userFacingError(cause));
    }
  };

  const toggleDate = (date: Date) => {
    const key = dateKey(date);
    setSelectedDates((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleWeekday = (day: number) => {
    setWeekdays((current) => {
      const next = new Set(current);
      if (next.has(day)) next.delete(day); else next.add(day);
      return next;
    });
  };

  const toggleBulkService = (id: string) => {
    setBulkServiceIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleDuration = (option: number) => {
    setDurations((current) => {
      const next = new Set(current);
      if (next.has(option)) next.delete(option); else next.add(option);
      return next;
    });
  };

  const addTime = () => {
    setTimes((current) => {
      if (current.some((time) => time.hour === pickHour && time.minute === pickMinute)) return current;
      return [...current, { hour: pickHour, minute: pickMinute }].sort((a, b) => a.hour - b.hour || a.minute - b.minute);
    });
  };

  const removeTime = (time: TimeOfDay) => {
    setTimes((current) => current.filter((item) => !(item.hour === time.hour && item.minute === time.minute)));
  };

  const bulkDates = dateMode === 'dates'
    ? [...selectedDates].sort().map(parseDateKey)
    : weekdayDatesInRange([...weekdays], today, weeksCount);
  const bulkServiceIdList = [...bulkServiceIds];
  const durationsList = [...durations];
  const rawComboCount = bulkDates.length * bulkServiceIdList.length * times.length * durationsList.length;
  const tooMany = rawComboCount > MAX_BULK_SLOTS;
  // Built (and filtered to the future) on every render, not just on submit, so the
  // preview count shown to the counsellor always matches what "Add availability"
  // will actually attempt — a combination that falls in the past today is dropped
  // from both, rather than being counted in the preview and silently skipped later.
  const bulkDrafts = tooMany
    ? []
    : buildSlotDrafts({ dates: bulkDates, serviceIds: bulkServiceIdList, times, durationsMinutes: durationsList })
      .filter((draft) => new Date(draft.startsAt).getTime() > nowMs);
  const previewCount = bulkDrafts.length;
  const pastExcludedCount = Math.max(0, rawComboCount - bulkDrafts.length);

  const createBulkSlots = async () => {
    if (!bulkDates.length) return setFormError(dateMode === 'dates' ? 'Choose at least one date.' : 'Choose at least one day of the week.');
    if (!bulkServiceIdList.length) return setFormError('Choose at least one service.');
    if (!times.length) return setFormError('Add at least one start time.');
    if (!durationsList.length) return setFormError('Choose at least one duration.');
    if (tooMany) {
      return setFormError(`That would create ${rawComboCount} slots at once. Narrow your selection to ${MAX_BULK_SLOTS} or fewer, then repeat.`);
    }

    const drafts = bulkDrafts;
    if (!drafts.length) return setFormError('Every combination falls in the past. Choose a future date or time.');

    setFormError('');
    setBulkBusy(true);

    let created = 0;
    let skipped = 0;
    const createdSlots: AvailabilitySlot[] = [];
    // Sequential, not parallel: each draft is checked against slots created earlier
    // in this same batch, so two selections that would collide with each other are
    // caught too, not only collisions with what already existed.
    for (const draft of drafts) {
      if (overlapsExisting(draft, [...slots, ...createdSlots])) { skipped += 1; continue; }
      try {
        const slot = await api.createAvailabilitySlot(draft, session.accessToken);
        createdSlots.push(slot);
        created += 1;
      } catch {
        skipped += 1;
      }
    }

    if (createdSlots.length) setSlots((current) => [...current, ...createdSlots]);
    setBulkBusy(false);

    // Any successful add returns to the list — the toast already says whether
    // anything was skipped, so there's nothing left to review by staying on the form.
    if (created) {
      flash(skipped
        ? `${created} slot${created === 1 ? '' : 's'} added, ${skipped} skipped`
        : `${created} slot${created === 1 ? '' : 's'} added`);
      setFormOpen(false);
    } else {
      setFormError('Every combination overlapped a slot you already offer.');
    }
  };

  return (
    <ScreenIn style={s.screen}>
      <View style={[s.topBar, { paddingTop: insets.top + 10 }]}>
        <IconButton onPress={() => router.back()} tone="white" label="Back">
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Polyline points="14.5,5 7.5,12 14.5,19" fill="none" stroke={colors.green} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </IconButton>
        <Text style={s.topTitle}>Availability</Text>
        <View style={s.topSpacer} />
      </View>

      <ScrollView contentContainerStyle={[s.body, { paddingBottom: formOpen ? insets.bottom + 24 : 24 }]} showsVerticalScrollIndicator={false}>
        {formError ? <ErrorBanner message={formError} /> : null}

        {/* One task on screen at a time: while either form is open, the list below
            steps aside rather than sitting alongside it. */}
        {!formOpen ? (
          <>
            <FadeUp style={s.intro}>
              <Text style={type.display34}>Your availability</Text>
              <Text style={s.introBody}>Add times buyers can book, or tap something you already added to change it.</Text>
            </FadeUp>

            {upcomingSlots.map((slot) => {
              const service = services.find((item) => item.id === slot.serviceId);
              const status = STATUS[slot.status];
              return (
                <FadeUp key={slot.id} duration={400}>
                  <Press
                    onPress={() => editSlot(slot)}
                    scaleTo={0.98}
                    accessibilityLabel={`${fmtLong(slot.startsAt)}, ${timeRange(slot.startsAt, slot.endsAt)}, ${status.label}`}
                    style={s.slotRow}
                  >
                    <View style={s.slotTile}><Glyph name="clock" size={18} color={colors.green} /></View>
                    <View style={s.slotCopy}>
                      <Text style={s.slotRange}>{fmtDay(slot.startsAt)} · {timeRange(slot.startsAt, slot.endsAt)}</Text>
                      <Text style={s.slotService}>{service ? service.title : 'Service removed'}</Text>
                    </View>
                    <Tag label={status.label} bg={status.bg} fg={status.fg} />
                  </Press>
                </FadeUp>
              );
            })}

            {!upcomingSlots.length ? (
              <FadeUp duration={400} style={s.emptyState}>
                <Float style={s.emptyMark} distance={9} duration={4000}>
                  <View style={s.emptyMarkFill}>
                    <Svg width={18} height={18} viewBox="0 0 24 24">
                      <Rect x={3.5} y={5.5} width={17} height={15} rx={2.6} fill="none" stroke={colors.eyebrow} strokeWidth={1.8} strokeLinecap="round" />
                      <Line x1={3.5} y1={10} x2={20.5} y2={10} stroke={colors.eyebrow} strokeWidth={1.8} strokeLinecap="round" />
                    </Svg>
                  </View>
                </Float>
                <View style={s.emptyCopy}>
                  <Text style={s.emptyTitle}>No availability yet</Text>
                  <Text style={s.emptyBody}>Add availability so buyers can choose a time.</Text>
                </View>
              </FadeUp>
            ) : null}
          </>
        ) : null}

        {formOpen && editing ? (
          <FadeUp duration={400} style={s.form}>
            <Text style={s.formTitle}>Edit slot · {fmtDay(editing.startsAt)}</Text>

            {/* The service picker shows whenever there's a real choice to make: more
                than one active service, or — when the service this slot originally
                belonged to has since been deleted — even just the one that's left. */}
            {services.length > 1 || !services.some((item) => item.id === serviceId) ? (
              <View style={s.group}>
                <Text style={s.groupLabel}>Service</Text>
                {!services.some((item) => item.id === serviceId) ? (
                  <Text style={s.groupHint}>
                    The original service was deleted{services.length ? ' — choose another to keep this slot.' : '. Publish a service to reassign it.'}
                  </Text>
                ) : null}
                {services.length ? (
                  <View style={s.chipWrap}>
                    {services.map((service) => (
                      <Chip key={service.id} label={service.title} selected={serviceId === service.id} onPress={() => setServiceId(service.id)} />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={s.group}>
              <Text style={s.groupLabel}>Start time</Text>
              <View style={s.chipWrap}>
                {HOURS.map((option) => (
                  <Chip key={option} label={String(option)} selected={hour === option} onPress={() => setHour(option)} />
                ))}
              </View>
              <View style={s.chipRow}>
                {MINUTES.map((option) => (
                  <Chip
                    key={option}
                    label={`:${String(option).padStart(2, '0')}`}
                    selected={startMinute === option}
                    onPress={() => setStartMinute(option)}
                  />
                ))}
              </View>
            </View>

            <View style={s.group}>
              <Text style={s.groupLabel}>Duration</Text>
              <View style={s.chipWrap}>
                {DURATIONS.map((option) => (
                  <Chip key={option} label={`${option} min`} selected={minutes === option} onPress={() => setMinutes(option)} />
                ))}
              </View>
            </View>

            <Button label="Save changes" height={52} labelSize={15} onPress={() => { void saveSlot(); }} />
            <Button label="Remove slot" tone="danger" height={48} labelSize={14} onPress={() => { void removeSlot(); }} style={s.removeButton} />
            <Press onPress={closeForm} accessibilityLabel="Cancel" style={s.cancel}>
              <Text style={s.cancelText}>Cancel</Text>
            </Press>
          </FadeUp>
        ) : null}

        {formOpen && !editing ? (
          <FadeUp duration={400} style={s.form}>
            <Text style={s.formTitle}>New availability</Text>
            <Text style={s.formHint}>Pick every date, service, start time and duration you want to open at once.</Text>

            <View style={s.segment}>
              <Press
                onPress={() => setDateMode('dates')}
                scaleTo={0.97}
                accessibilityRole="radio"
                accessibilityLabel="Specific dates"
                accessibilityState={{ selected: dateMode === 'dates' }}
                style={[s.segmentOption, dateMode === 'dates' && s.segmentOptionOn]}
              >
                <Text style={[s.segmentText, dateMode === 'dates' && s.segmentTextOn]}>Specific dates</Text>
              </Press>
              <Press
                onPress={() => setDateMode('weekdays')}
                scaleTo={0.97}
                accessibilityRole="radio"
                accessibilityLabel="Days of the week"
                accessibilityState={{ selected: dateMode === 'weekdays' }}
                style={[s.segmentOption, dateMode === 'weekdays' && s.segmentOptionOn]}
              >
                <Text style={[s.segmentText, dateMode === 'weekdays' && s.segmentTextOn]}>Days of the week</Text>
              </Press>
            </View>

            {dateMode === 'dates' ? (
              <View style={s.group}>
                <View style={s.calendarHead}>
                  <Press onPress={() => setCalendarMonth((month) => addMonths(month, -1))} scaleTo={0.92} accessibilityLabel="Previous month" style={s.calendarNav}>
                    <Svg width={16} height={16} viewBox="0 0 24 24">
                      <Polyline points="14.5,5 7.5,12 14.5,19" fill="none" stroke={colors.amberDeep} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </Press>
                  <Text style={s.calendarMonthLabel}>
                    {calendarMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
                  </Text>
                  <Press onPress={() => setCalendarMonth((month) => addMonths(month, 1))} scaleTo={0.92} accessibilityLabel="Next month" style={s.calendarNav}>
                    <Svg width={16} height={16} viewBox="0 0 24 24">
                      <Polyline points="9.5,5 16.5,12 9.5,19" fill="none" stroke={colors.amberDeep} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </Press>
                </View>
                <View style={s.calendarWeekdays}>
                  {DAY_NAMES.map((name) => <Text key={name} style={s.calendarWeekdayLabel}>{name}</Text>)}
                </View>
                <View style={s.calendarGrid}>
                  {monthGrid(calendarMonth).map((cell, index) => {
                    if (!cell) return <View key={`blank-${index}`} style={s.calendarCell} />;
                    const key = dateKey(cell);
                    const selected = selectedDates.has(key);
                    const past = cell.getTime() < today.getTime();
                    return (
                      <Press
                        key={key}
                        onPress={() => toggleDate(cell)}
                        disabled={past}
                        scaleTo={0.92}
                        accessibilityRole="checkbox"
                        accessibilityLabel={fmtLong(cell.toISOString())}
                        accessibilityState={{ checked: selected, disabled: past }}
                        style={s.calendarCell}
                      >
                        <View style={[s.calendarCellFill, selected && s.calendarCellOn]}>
                          <Text style={[s.calendarCellText, selected && s.calendarCellTextOn, past && !selected && s.calendarCellTextPast]}>
                            {cell.getDate()}
                          </Text>
                        </View>
                      </Press>
                    );
                  })}
                </View>
                <Text style={s.groupHint}>
                  {selectedDates.size ? `${selectedDates.size} date${selectedDates.size === 1 ? '' : 's'} selected.` : 'Tap dates on the calendar to select them.'}
                </Text>
              </View>
            ) : (
              <View style={s.group}>
                <Text style={s.groupLabel}>Repeats on</Text>
                <View style={s.chipRow}>
                  {DAY_NAMES.map((name, index) => (
                    <Chip key={name} label={name} role="checkbox" selected={weekdays.has(index)} onPress={() => toggleWeekday(index)} />
                  ))}
                </View>
                <Text style={s.groupLabel}>For how long</Text>
                <View style={s.stepper}>
                  <Press
                    onPress={() => setWeeksCount((count) => Math.max(1, count - 1))}
                    scaleTo={0.9}
                    accessibilityLabel="Fewer weeks"
                    style={s.stepperButton}
                  >
                    <Text style={s.stepperButtonText}>−</Text>
                  </Press>
                  <Text style={s.stepperValue}>{weeksCount} week{weeksCount === 1 ? '' : 's'}</Text>
                  <Press
                    onPress={() => setWeeksCount((count) => Math.min(MAX_WEEKS, count + 1))}
                    scaleTo={0.9}
                    accessibilityLabel="More weeks"
                    style={s.stepperButton}
                  >
                    <Text style={s.stepperButtonText}>+</Text>
                  </Press>
                </View>
                <Text style={s.groupHint}>
                  Starting {fmtDay(today.toISOString())} — {bulkDates.length} matching date{bulkDates.length === 1 ? '' : 's'}.
                </Text>
              </View>
            )}

            {services.length > 1 ? (
              <View style={s.group}>
                <Text style={s.groupLabel}>Apply to</Text>
                <View style={s.chipWrap}>
                  {services.map((service) => (
                    <Chip
                      key={service.id}
                      label={service.title}
                      role="checkbox"
                      selected={bulkServiceIds.has(service.id)}
                      onPress={() => toggleBulkService(service.id)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            <View style={s.group}>
              <Text style={s.groupLabel}>Start times</Text>
              <View style={s.chipWrap}>
                {HOURS.map((option) => (
                  <Chip key={option} label={String(option)} selected={pickHour === option} onPress={() => setPickHour(option)} />
                ))}
              </View>
              <View style={s.chipRow}>
                {MINUTES.map((option) => (
                  <Chip key={option} label={`:${String(option).padStart(2, '0')}`} selected={pickMinute === option} onPress={() => setPickMinute(option)} />
                ))}
              </View>
              <Press onPress={addTime} scaleTo={0.96} accessibilityLabel={`Add ${timeLabel({ hour: pickHour, minute: pickMinute })}`} style={s.addTimeButton}>
                <Glyph name="plus" size={14} color={colors.white} />
                <Text style={s.addTimeButtonText}>Add {timeLabel({ hour: pickHour, minute: pickMinute })}</Text>
              </Press>
              {times.length ? (
                <View style={s.chipWrap}>
                  {times.map((time) => (
                    <Press
                      key={`${time.hour}-${time.minute}`}
                      onPress={() => removeTime(time)}
                      scaleTo={0.94}
                      accessibilityLabel={`Remove ${timeLabel(time)}`}
                      style={s.timeChip}
                    >
                      <Text style={s.timeChipText}>{timeLabel(time)}</Text>
                      <Glyph name="close" size={11} color={colors.green} />
                    </Press>
                  ))}
                </View>
              ) : (
                <Text style={s.groupHint}>Add at least one start time — you can add as many as you like.</Text>
              )}
            </View>

            <View style={s.group}>
              <Text style={s.groupLabel}>Duration</Text>
              <View style={s.chipWrap}>
                {DURATIONS.map((option) => (
                  <Chip key={option} label={`${option} min`} role="checkbox" selected={durations.has(option)} onPress={() => toggleDuration(option)} />
                ))}
              </View>
            </View>

            {tooMany || previewCount > 0 || pastExcludedCount > 0 ? (
              <View style={s.previewBanner}>
                <Glyph name="calendar" size={16} color={colors.amberDeep} />
                <Text style={s.previewText}>
                  {tooMany
                    ? `That would create ${rawComboCount} slots at once. Narrow your selection to ${MAX_BULK_SLOTS} or fewer, then repeat.`
                    : previewCount > 0
                      ? `This creates ${previewCount} slot${previewCount === 1 ? '' : 's'} across ${bulkDates.length} date${bulkDates.length === 1 ? '' : 's'}.`
                      : 'Every combination falls in the past.'}
                  {!tooMany && pastExcludedCount > 0 ? ` ${pastExcludedCount} more already passed and won't be created.` : ''}
                </Text>
              </View>
            ) : null}

            <Button
              label={bulkBusy ? 'Adding slots…' : 'Save availability'}
              height={52}
              labelSize={15}
              busy={bulkBusy}
              disabled={previewCount === 0}
              onPress={() => { void createBulkSlots(); }}
            />
            <Press onPress={closeForm} accessibilityLabel="Cancel" style={s.cancel}>
              <Text style={s.cancelText}>Cancel</Text>
            </Press>
          </FadeUp>
        ) : null}
      </ScrollView>

      {!formOpen ? (
        <View style={[s.footer, { paddingBottom: insets.bottom + 22 }]}>
          <Button
            label="Add availability"
            height={58}
            onPress={openForm}
            icon={<Glyph name="plus" size={16} color={colors.white} />}
            style={shadow.toast}
          />
        </View>
      ) : null}
    </ScreenIn>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  topTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  topSpacer: { width: 44 },

  body: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 24, gap: 18 },
  intro: { gap: 8 },
  introBody: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 22, color: colors.muted },

  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.lg },
  slotTile: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' },
  slotCopy: { flex: 1, gap: 2 },
  slotRange: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  slotService: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },

  emptyState: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.mark, borderRadius: radius.lg },
  emptyMark: { width: 40, height: 40 },
  emptyMarkFill: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.yellowTint, alignItems: 'center', justifyContent: 'center' },
  emptyCopy: { flex: 1, gap: 2 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  emptyBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.muted },

  form: { gap: 16, padding: 20, backgroundColor: colors.yellowTint, borderRadius: radius.xl },
  formTitle: { ...type.display20, fontSize: 22, lineHeight: 25, color: colors.amberDeep },
  formHint: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.amberInk, marginTop: -8 },
  group: { gap: 8 },
  groupLabel: { fontFamily: fonts.extra, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.amberInk },
  groupHint: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.amberInk },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipRow: { flexDirection: 'row', gap: 8 },
  removeButton: { borderWidth: 1.5, borderColor: colors.danger },
  cancel: { height: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: fonts.bold, fontSize: 14, color: colors.amberDeep },

  // Specific dates vs. days of the week, styled like a segmented control.
  segment: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: radius.pill, padding: 4, gap: 4 },
  segmentOption: { flex: 1, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentOptionOn: { backgroundColor: colors.amber },
  segmentText: { fontFamily: fonts.bold, fontSize: 13, color: colors.amberInk },
  segmentTextOn: { color: colors.white },

  // A Monday-first month calendar for multi-selecting specific dates.
  calendarHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarNav: { width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  calendarMonthLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.amberDeep },
  calendarWeekdays: { flexDirection: 'row' },
  calendarWeekdayLabel: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: fonts.bold, fontSize: 11, color: colors.amberInk },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  calendarCellFill: { width: '100%', height: '100%', borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  calendarCellOn: { backgroundColor: colors.amber },
  calendarCellText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  calendarCellTextOn: { color: colors.white },
  calendarCellTextPast: { color: colors.sub },

  // The "for how long" stepper in days-of-the-week mode.
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepperButton: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  stepperButtonText: { fontFamily: fonts.extra, fontSize: 18, color: colors.amberDeep, lineHeight: 20 },
  stepperValue: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, minWidth: 68, textAlign: 'center' },

  addTimeButton: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.green },
  addTimeButtonText: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  timeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.greenTint },
  timeChipText: { fontFamily: fonts.semi, fontSize: 12, color: colors.green },

  previewBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: colors.white },
  previewText: { flex: 1, fontFamily: fonts.bold, fontSize: 13, lineHeight: 19, color: colors.amberDeep },

  footer: { paddingHorizontal: 22, paddingTop: 14, backgroundColor: colors.white },
});
