import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, userFacingError } from '@/src/api/client';
import { BookableStart, Booking } from '@/src/api/types';
import { isUpcoming } from '@/app/bookings';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { BackBar, beat, RESERVE_MS } from '@/src/components/booking';
import { Glyph } from '@/src/components/Glyph';
import { Button, Card, ErrorBanner, Press, Spinner } from '@/src/components/ui';
import { deviceTimezone, duration, fmtDay, fmtLong, timeRange } from '@/src/format';
import { goBack } from '@/src/navigation';
import { FadeUp, Pop, ScreenIn } from '@/src/motion';
import { colors, fonts, radius, type } from '@/src/theme';

/**
 * US-69 — the open starts the server derives for this booking's service, the same
 * engine US-40 uses to offer a new booking. Grouped into days for the same reason
 * the original picker does: this list changes as other people book.
 */
function groupByDay(slots: BookableStart[]) {
  const days = new Map<string, BookableStart[]>();
  for (const slot of [...slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const key = new Date(slot.startsAt).toDateString();
    days.set(key, [...(days.get(key) ?? []), slot]);
  }
  return [...days.values()];
}

export default function RescheduleBookingScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const insets = useSafeAreaInsets();
  const { session, restoring } = useAuth();
  const { flash } = useChrome();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [slots, setSlots] = useState<BookableStart[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!session || !bookingId) return;
    try {
      const found = await api.getBooking(bookingId, session.accessToken);
      setBooking(found);
      // Only an eligible booking has anywhere to move to — asking the backend for
      // slots on one that cannot be rescheduled would just be discarded below.
      if (found.status === 'confirmed' && isUpcoming(found)) {
        setSlots(await api.listServiceSlots(found.serviceId, found.modality));
      }
      setLoadError('');
    } catch (error) {
      setLoadError(userFacingError(error));
    } finally {
      setLoading(false);
    }
  }, [session, bookingId]);

  useEffect(() => {
    const run = async () => { await load(); };
    void run();
  }, [load]);

  const days = useMemo(() => groupByDay(slots), [slots]);

  if (!restoring && !session) return <Redirect href="/auth/login" />;

  const chosen = slots.find((slot) => slot.startsAt === selected);
  const eligible = booking !== null && booking.status === 'confirmed' && isUpcoming(booking);
  const backToBooking = () => {
    if (bookingId) router.replace({ pathname: '/bookings/[bookingId]', params: { bookingId } });
    else router.replace('/bookings');
  };

  /**
   * US-69 — the backend re-validates the chosen time inside the same locked write
   * that moves the booking, so a slot someone else just took is rejected here
   * rather than accepted and shown as done. On any failure the original booking is
   * reloaded unchanged rather than assumed to still be what the screen last showed.
   */
  async function confirmReschedule() {
    if (!session || !booking || !chosen) return;
    setBusy(true);
    setSubmitError('');
    const busy700 = beat(RESERVE_MS);
    try {
      await api.rescheduleBooking(
        booking.id, chosen.startsAt, booking.modality, deviceTimezone(), session.accessToken,
      );
      await busy700;
      flash('Session rescheduled');
      backToBooking();
    } catch (error) {
      setSelected('');
      await load();
      await busy700;
      setSubmitError(userFacingError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenIn style={s.screen}>
      <BackBar title="Reschedule" onBack={() => goBack({ pathname: '/bookings/[bookingId]', params: { bookingId } })} />

      {loading ? (
        <View style={s.loading}><Spinner size={28} color={colors.green} /></View>
      ) : !booking ? (
        <View style={s.body}><ErrorBanner message={loadError || 'That booking is not available.'} /></View>
      ) : !eligible ? (
        <View style={s.body}>
          <Card style={s.notEligible}>
            <Text style={type.display24}>This session can&apos;t be rescheduled</Text>
            <Text style={type.body}>
              Only an upcoming, confirmed session can be moved to a new time.
            </Text>
            <Button label="Back to booking" tone="outline" onPress={backToBooking} />
          </Card>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
            <FadeUp style={s.intro}>
              <Text style={type.display34}>Pick a new time</Text>
              <Text style={type.body}>
                Currently {fmtLong(booking.startsAt)}, {timeRange(booking.startsAt, booking.endsAt)}.
                Choose another open time for {booking.serviceTitle}
                {booking.counterpartyName ? ` with ${booking.counterpartyName}` : ''}.
              </Text>
            </FadeUp>

            {submitError ? <Pop duration={300}><ErrorBanner message={submitError} /></Pop> : null}

            {days.length === 0 ? (
              <FadeUp delay={100} style={s.empty}>
                <Text style={type.body}>No open times right now. Try again later.</Text>
              </FadeUp>
            ) : null}

            {days.map((day, index) => (
              <FadeUp key={day[0].startsAt} delay={120 + index * 80} style={s.day}>
                <View style={s.dayHeading}>
                  <View style={s.dayDot} />
                  <Text style={s.dayLabel}>{fmtDay(day[0].startsAt)}</Text>
                </View>
                {day.map((slot) => {
                  const on = slot.startsAt === selected;
                  return (
                    <Press
                      key={slot.startsAt}
                      onPress={() => setSelected(slot.startsAt)}
                      scaleTo={0.98}
                      accessibilityRole="radio"
                      accessibilityLabel={`${fmtDay(slot.startsAt)}, ${timeRange(slot.startsAt, slot.endsAt)}, ${duration(slot.startsAt, slot.endsAt)}`}
                      accessibilityState={{ selected: on, checked: on }}
                      style={[s.slot, on ? s.slotOn : s.slotOff]}
                    >
                      <View style={[s.mark, on ? s.markOn : s.markOff]}>
                        {on ? <Pop duration={300}><Glyph name="check" size={13} color={colors.green} /></Pop> : null}
                      </View>
                      <Text style={[s.slotTime, on && s.slotTimeOn]}>{timeRange(slot.startsAt, slot.endsAt)}</Text>
                      <Text style={[s.slotDuration, on && s.slotDurationOn]}>{duration(slot.startsAt, slot.endsAt)}</Text>
                    </Press>
                  );
                })}
              </FadeUp>
            ))}

            <View style={s.tzRow}>
              <Glyph name="clock" size={14} color={colors.sub} />
              <Text style={s.tzText}>Times are shown in your device timezone ({deviceTimezone()}).</Text>
            </View>
          </ScrollView>

          <View style={[s.footer, { paddingBottom: insets.bottom + 22 }]}>
            {chosen ? (
              <FadeUp duration={300} style={s.chosenRow}>
                <Text style={s.chosenWhen}>{fmtDay(chosen.startsAt)}, {timeRange(chosen.startsAt, chosen.endsAt)}</Text>
              </FadeUp>
            ) : null}
            <Button
              label="Confirm new time"
              height={58}
              busy={busy}
              disabled={!chosen}
              onPress={() => { void confirmReschedule(); }}
              style={chosen ? s.ctaReady : s.ctaWaiting}
            />
          </View>
        </>
      )}
    </ScreenIn>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingTop: 6, paddingHorizontal: 22, paddingBottom: 24, gap: 20 },
  intro: { gap: 8 },
  notEligible: { gap: 14 },
  empty: { paddingVertical: 20 },

  day: { gap: 10 },
  dayHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber },
  dayLabel: { fontFamily: fonts.extra, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.muted },

  slot: { minHeight: 62, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.lg, borderWidth: 1.5 },
  slotOn: { backgroundColor: colors.green, borderColor: colors.green },
  slotOff: { backgroundColor: colors.white, borderColor: colors.line },
  mark: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  markOn: { borderColor: colors.yellow, backgroundColor: colors.yellow },
  markOff: { borderColor: colors.mark, backgroundColor: colors.white },
  slotTime: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  slotTimeOn: { color: colors.white },
  slotDuration: { fontFamily: fonts.sans, fontSize: 13, color: colors.sub },
  slotDurationOn: { color: colors.onDarkMuted },

  tzRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tzText: { fontFamily: fonts.sans, fontSize: 12, color: colors.sub },

  footer: {
    paddingTop: 12, paddingHorizontal: 22, gap: 12, backgroundColor: colors.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    shadowColor: colors.green, shadowOpacity: 0.14, shadowRadius: 15, shadowOffset: { width: 0, height: -10 }, elevation: 12,
  },
  chosenRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chosenWhen: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  ctaReady: { opacity: 1 },
  ctaWaiting: { opacity: 0.4 },
});
