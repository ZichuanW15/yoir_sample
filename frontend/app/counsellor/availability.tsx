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
import { fmtDay, fmtLong, fmtTime, HOURS, monthDay, sameDay, startOfWeek, timeRange } from '@/src/format';
import { FadeUp, Float, ScreenIn } from '@/src/motion';
import { colors, fonts, radius, shadow, type } from '@/src/theme';

const DAY_MS = 86_400_000;
const DAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DURATIONS = [30, 60, 90];

const STATUS: Record<AvailabilitySlot['status'], { label: string; bg: string; fg: string }> = {
  open: { label: 'Open', bg: colors.successBg, fg: colors.successInk },
  held: { label: 'Reserved', bg: colors.yellowTint, fg: colors.amberDeep },
  booked: { label: 'Booked', bg: colors.greenTint, fg: colors.successInk },
};

export default function AvailabilityScreen() {
  const { session } = useAuth();
  const { flash } = useChrome();
  const insets = useSafeAreaInsets();

  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AvailabilitySlot | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [hour, setHour] = useState(9);
  const [minutes, setMinutes] = useState(60);
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

  const week = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daySlots = slots
    .filter((slot) => sameDay(slot.startsAt, selectedDay))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const pickDay = (day: Date) => {
    setSelectedDay(day);
    setFormOpen(false);
    setEditing(null);
  };

  const openForm = () => {
    if (!services.length) {
      flash('Add a service first');
      router.push('/counsellor/services/new');
      return;
    }
    setEditing(null);
    setHour(9);
    setMinutes(60);
    setServiceId(serviceId || services[0].id);
    setFormError('');
    setFormOpen(true);
  };

  // A booked slot belongs to a buyer's confirmed session, so it is read-only here.
  const editSlot = (slot: AvailabilitySlot) => {
    if (slot.status === 'booked') return flash('Booked slots cannot be changed');
    setEditing(slot);
    setServiceId(slot.serviceId);
    setHour(new Date(slot.startsAt).getHours());
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
    const start = new Date(selectedDay);
    start.setHours(hour, 0, 0, 0);
    if (start.getTime() <= Date.now()) return setFormError('Choose a time in the future.');
    const end = new Date(start.getTime() + minutes * 60_000);
    const clash = slots.some((slot) => slot.id !== editing?.id && slot.serviceId === serviceId
      && slot.status !== 'booked' && start.toISOString() < slot.endsAt && slot.startsAt < end.toISOString());
    if (clash) return setFormError('This window overlaps an availability slot you already offer.');

    const draft = { serviceId, startsAt: start.toISOString(), endsAt: end.toISOString() };
    const wasEditing = editing;
    try {
      if (wasEditing) {
        const updated = await api.updateAvailabilitySlot(wasEditing.id, draft, session.accessToken);
        setSlots((current) => current.map((slot) => (slot.id === updated.id ? updated : slot)));
      } else {
        const created = await api.createAvailabilitySlot(draft, session.accessToken);
        setSlots((current) => [...current, created]);
      }
      setFormError('');
      setFormOpen(false);
      setEditing(null);
      flash(wasEditing ? 'Slot updated' : 'Slot added');
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
        <FadeUp style={s.intro}>
          <Text style={type.display34}>Your bookable week</Text>
          <Text style={s.introBody}>Open slots appear to buyers on the service they belong to. Booked slots cannot be changed.</Text>
        </FadeUp>

        {formError ? <ErrorBanner message={formError} /> : null}

        <FadeUp delay={80} style={s.weekBlock}>
          <View style={s.weekNav}>
            <Press
              onPress={() => setWeekStart(new Date(weekStart.getTime() - 7 * DAY_MS))}
              scaleTo={0.92}
              accessibilityLabel="Previous week"
              style={s.weekNavButton}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24">
                <Polyline points="14.5,5 7.5,12 14.5,19" fill="none" stroke={colors.green} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Press>
            <Text style={s.weekLabel}>{monthDay(week[0])} â€“ {monthDay(week[6])}</Text>
            <Press
              onPress={() => setWeekStart(new Date(weekStart.getTime() + 7 * DAY_MS))}
              scaleTo={0.92}
              accessibilityLabel="Next week"
              style={s.weekNavButton}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24">
                <Polyline points="9.5,5 16.5,12 9.5,19" fill="none" stroke={colors.green} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Press>
          </View>
          <View style={s.weekStrip} accessibilityRole="radiogroup" accessibilityLabel="Day of the week">
            {week.map((day) => {
              const active = sameDay(day, selectedDay);
              const isToday = sameDay(day, today);
              const past = day.getTime() < today.getTime();
              const count = slots.filter((slot) => sameDay(slot.startsAt, day)).length;
              const countLabel = count === 1 ? '1 slot' : count ? `${count} slots` : 'no slots';
              return (
                <Press
                  key={day.toISOString()}
                  onPress={() => pickDay(day)}
                  scaleTo={0.95}
                  accessibilityRole="radio"
                  accessibilityLabel={`${fmtLong(day.toISOString())}${isToday ? ', today' : ''}, ${countLabel}`}
                  accessibilityState={{ selected: active, checked: active }}
                  style={[
                    s.dayCell,
                    active ? s.dayCellOn : s.dayCellOff,
                    isToday && !active ? s.dayCellToday : null,
                    past ? (active ? s.dayCellPastOn : s.dayCellPast) : null,
                  ]}
                >
                  <Text style={[s.dayName, { color: active ? colors.onDarkMuted : colors.sub }]}>
                    {DAY_NAMES[(day.getDay() + 6) % 7]}
                  </Text>
                  <Text style={[s.dayNum, { color: active ? colors.white : colors.ink }]}>{day.getDate()}</Text>
                  {/* Both rows below keep their height whether or not they hold anything, so no cell jumps. */}
                  <View style={s.dayMeta}>
                    {count ? (
                      <View style={[s.dayCount, { backgroundColor: active ? colors.yellow : colors.yellowTint }]}>
                        <Text style={[s.dayCountText, { color: active ? colors.green : colors.amber }]}>{count}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={s.dayRule}>
                    {isToday ? <View style={[s.dayRuleFill, { backgroundColor: active ? colors.yellow : colors.amber }]} /> : null}
                  </View>
                </Press>
              );
            })}
          </View>
        </FadeUp>

        <FadeUp duration={400} style={s.dayHead}>
          <View style={s.dayHeadDot} />
          <Text style={s.dayHeadTitle}>{fmtLong(selectedDay.toISOString())}</Text>
        </FadeUp>

        {daySlots.map((slot) => {
          const service = services.find((item) => item.id === slot.serviceId);
          const status = STATUS[slot.status];
          return (
            <FadeUp key={slot.id} duration={400}>
              <Press
                onPress={() => editSlot(slot)}
                scaleTo={0.98}
                accessibilityLabel={`${timeRange(slot.startsAt, slot.endsAt)}, ${status.label}`}
                style={s.slotRow}
              >
                <View style={s.slotTile}><Glyph name="clock" size={18} color={colors.green} /></View>
                <View style={s.slotCopy}>
                  <Text style={s.slotRange}>{timeRange(slot.startsAt, slot.endsAt)}</Text>
                  <Text style={s.slotService}>{service ? service.title : 'Service removed'}</Text>
                </View>
                <Tag label={status.label} bg={status.bg} fg={status.fg} />
              </Press>
            </FadeUp>
          );
        })}

        {!daySlots.length ? (
          <FadeUp duration={400} style={s.emptyDay}>
            <Float style={s.emptyMark} distance={9} duration={4000}>
              <View style={s.emptyMarkFill}>
                <Svg width={18} height={18} viewBox="0 0 24 24">
                  <Rect x={3.5} y={5.5} width={17} height={15} rx={2.6} fill="none" stroke={colors.eyebrow} strokeWidth={1.8} strokeLinecap="round" />
                  <Line x1={3.5} y1={10} x2={20.5} y2={10} stroke={colors.eyebrow} strokeWidth={1.8} strokeLinecap="round" />
                </Svg>
              </View>
            </Float>
            <View style={s.emptyCopy}>
              <Text style={s.emptyTitle}>Open this day up</Text>
              <Text style={s.emptyBody}>No availability on this day yet.</Text>
            </View>
          </FadeUp>
        ) : null}

        {formOpen ? (
          <FadeUp duration={400} style={s.form}>
            <Text style={s.formTitle}>
              {editing ? 'Edit slot' : 'New slot'} Â· {fmtDay(selectedDay.toISOString())}
            </Text>

            {services.length > 1 ? (
              <View style={s.group}>
                <Text style={s.groupLabel}>Service</Text>
                <View style={s.chipWrap}>
                  {services.map((service) => (
                    <Chip key={service.id} label={service.title} selected={serviceId === service.id} onPress={() => setServiceId(service.id)} />
                  ))}
                </View>
              </View>
            ) : null}

            <View style={s.group}>
              <Text style={s.groupLabel}>Start time</Text>
              <View style={s.chipWrap}>
                {HOURS.map((option) => (
                  <Chip
                    key={option}
                    label={fmtTime(new Date(2026, 0, 1, option).toISOString())}
                    selected={hour === option}
                    onPress={() => setHour(option)}
                  />
                ))}
              </View>
            </View>

            <View style={s.group}>
              <Text style={s.groupLabel}>Duration</Text>
              <View style={s.chipRow}>
                {DURATIONS.map((option) => (
                  <Chip key={option} label={`${option} min`} selected={minutes === option} onPress={() => setMinutes(option)} />
                ))}
              </View>
            </View>

            <Button label={editing ? 'Save changes' : 'Add slot'} height={52} labelSize={15} onPress={() => { void saveSlot(); }} />
            {editing ? (
              <Button label="Remove slot" tone="danger" height={48} labelSize={14} onPress={() => { void removeSlot(); }} style={s.removeButton} />
            ) : null}
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

  // The day buttons carry their own border, so the strip drops the prototype's
  // wrapper card: the 32pt it spent on padding goes to the cells instead.
  weekBlock: { gap: 12 },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekNavButton: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  weekLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  // Bleeds 14pt into the page gutter each side so seven cells clear 44pt even on a 375pt screen.
  weekStrip: { flexDirection: 'row', gap: 5, marginHorizontal: -14 },
  dayCell: {
    minWidth: 44, flex: 1, height: 72, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: radius.md, borderWidth: 1.5 },
  dayCellOff: { backgroundColor: colors.white, borderColor: colors.line },
  dayCellOn: { backgroundColor: colors.green, borderColor: colors.green },
  dayCellToday: { borderColor: colors.amber },
  dayCellPast: { opacity: 0.45 },
  dayCellPastOn: { opacity: 0.75 },
  dayName: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 15, letterSpacing: 0.2 },
  dayNum: { fontFamily: fonts.extra, fontSize: 20, lineHeight: 24 },
  dayMeta: { height: 17, alignItems: 'center', justifyContent: 'center' },
  dayCount: { minWidth: 19, height: 17, paddingHorizontal: 5, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dayCountText: { fontFamily: fonts.extra, fontSize: 11, lineHeight: 14 },
  dayRule: { height: 3, alignItems: 'center', justifyContent: 'center' },
  dayRuleFill: { width: 16, height: 3, borderRadius: radius.pill },

  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayHeadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber },
  dayHeadTitle: { ...type.display20, fontSize: 22, lineHeight: 25 },

  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.lg },
  slotTile: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' },
  slotCopy: { flex: 1, gap: 2 },
  slotRange: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  slotService: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },

  emptyDay: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.mark, borderRadius: radius.lg },
  emptyMark: { width: 40, height: 40 },
  emptyMarkFill: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.yellowTint, alignItems: 'center', justifyContent: 'center' },
  emptyCopy: { flex: 1, gap: 2 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  emptyBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.muted },

  form: { gap: 16, padding: 20, backgroundColor: colors.yellowTint, borderRadius: radius.xl },
  formTitle: { ...type.display20, fontSize: 22, lineHeight: 25, color: colors.amberDeep },
  group: { gap: 8 },
  groupLabel: { fontFamily: fonts.extra, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.amberInk },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipRow: { flexDirection: 'row', gap: 8 },
  removeButton: { borderWidth: 1.5, borderColor: colors.danger },
  cancel: { height: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: fonts.bold, fontSize: 14, color: colors.amberDeep },

  footer: { paddingHorizontal: 22, paddingTop: 14, backgroundColor: colors.white },
});
