import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '@/src/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, fieldErrors, userFacingError } from '@/src/api/client';
import { BookableStart, Modality, Service } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { BackBar, beat, BookingSteps, RESERVE_MS } from '@/src/components/booking';
import { Glyph } from '@/src/components/Glyph';
import { Button, ErrorBanner, Press } from '@/src/components/ui';
import { deviceTimezone, duration, fmtDay, modalityLabel, money, timeRange } from '@/src/format';
import { FadeUp, Pop, ScreenIn } from '@/src/motion';
import { colors, fonts, radius, type } from '@/src/theme';

/**
 * US-40 — the offers the server derived for this service, grouped into days.
 *
 * These are not stored rows: the backend works them out from the counsellor's
 * windows, this service's duration and what is already taken, so the list changes
 * as other people book — including bookings of the counsellor's *other* services.
 */
function groupByDay(slots: BookableStart[]) {
  const days = new Map<string, BookableStart[]>();
  for (const slot of [...slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const key = new Date(slot.startsAt).toDateString();
    days.set(key, [...(days.get(key) ?? []), slot]);
  }
  return [...days.values()];
}

export default function TimeSlotsScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [service, setService] = useState<Service | null>(null);
  const [slots, setSlots] = useState<BookableStart[]>([]);
  const [selected, setSelected] = useState('');
  const [modality, setModality] = useState<Modality | null>(null);
  const [slotsError, setSlotsError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!serviceId) return;
    try {
      const loaded = await api.getService(serviceId);
      const chosenModality = modality ?? loaded.modalities[0] ?? null;
      // Availability can differ by delivery method — a counsellor may be in the
      // office only on some days — so the offers are asked for per modality.
      const available = await api.listServiceSlots(serviceId, chosenModality ?? undefined);
      setService(loaded);
      setSlots(available);
      setModality(chosenModality);
    } catch (error) {
      setSlotsError(userFacingError(error));
    }
  }, [serviceId, modality]);

  useEffect(() => {
    // Reserving needs an access token, so an unauthenticated arrival logs in first.
    if (!session) {
      router.replace({ pathname: '/auth/login', params: { serviceId } });
      return;
    }
    const run = async () => { await load(); };
    void run();
  }, [load, serviceId, session]);

  const days = useMemo(() => groupByDay(slots), [slots]);
  const chosen = slots.find((slot) => slot.startsAt === selected);
  const multiModal = (service?.modalities.length ?? 0) > 1;
  const meetingArea = service?.location ? `${service.location.cityOrRegion}, ${service.location.state}` : '';

  /**
   * US-41 — the slot is held server-side before payment, so a slot someone else
   * took fails here rather than after the buyer has paid.
   */
  async function reserve() {
    if (!session || !service || !chosen || !modality) return;
    setBusy(true);
    setSlotsError('');
    const busy700 = beat(RESERVE_MS);
    try {
      const order = await api.createOrder(service.id, chosen.startsAt, modality, deviceTimezone(), session.accessToken);
      await busy700;
      router.push({
        pathname: '/bookings/checkout',
        params: {
          orderId: order.id, serviceId: service.id, modality,
          amountMinor: String(order.amountMinor), startsAt: chosen.startsAt, endsAt: chosen.endsAt,
          // The server owns the hold deadline, so checkout counts down to its
          // answer rather than starting a timer of its own.
          holdExpiresAt: order.holdExpiresAt ?? '',
        },
      });
    } catch (error) {
      // Refresh availability first, then report — reloading must not wipe the reason.
      const detail = fieldErrors(error).startsAt;
      setSelected('');
      await load();
      await busy700;
      setSlotsError(detail ? `${userFacingError(error)} ${detail}` : userFacingError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenIn style={s.screen}>
      <BackBar title="Choose a time" onBack={() => goBack({ pathname: '/services/[serviceId]', params: { serviceId } })} />

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <FadeUp><BookingSteps step={0} /></FadeUp>

        <FadeUp delay={80} style={s.intro}>
          <Text style={type.display34}>When suits you?</Text>
          {service ? <Text style={type.body}>Select one available session for {service.title}.</Text> : null}
        </FadeUp>

        {slotsError ? <Pop duration={300}><ErrorBanner message={slotsError} /></Pop> : null}

        {multiModal && service ? (
          <FadeUp delay={140} style={s.delivery}>
            <Text style={s.deliveryLabel}>How would you like this session delivered?</Text>
            <View style={s.deliveryChips}>
              {service.modalities.map((option) => (
                <Press
                  key={option}
                  onPress={() => setModality(option)}
                  scaleTo={0.94}
                  accessibilityRole="radio"
                  accessibilityLabel={modalityLabel(option)}
                  accessibilityState={{ selected: modality === option, checked: modality === option }}
                  style={[s.modeChip, modality === option ? s.modeChipOn : s.modeChipOff]}
                >
                  <Text style={[s.modeChipText, modality === option ? s.modeChipTextOn : s.modeChipTextOff]}>
                    {modalityLabel(option)}
                  </Text>
                </Press>
              ))}
            </View>
            {modality === 'in_person' && meetingArea
              ? <Text style={type.small}>Meeting area: {meetingArea}</Text>
              : null}
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
        {chosen && service ? (
          <FadeUp duration={300} style={s.chosenRow}>
            <Text style={s.chosenWhen}>{fmtDay(chosen.startsAt)}, {timeRange(chosen.startsAt, chosen.endsAt)}</Text>
            <Text style={s.chosenPrice}>{money(service.priceMinor)}</Text>
          </FadeUp>
        ) : null}
        <Button
          label="Continue to payment"
          height={58}
          busy={busy}
          disabled={!chosen}
          onPress={reserve}
          style={chosen ? s.ctaReady : s.ctaWaiting}
        />
      </View>
    </ScreenIn>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  body: { paddingTop: 6, paddingHorizontal: 22, paddingBottom: 24, gap: 20 },
  intro: { gap: 8 },

  delivery: { gap: 10 },
  deliveryLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  deliveryChips: { flexDirection: 'row', gap: 8 },
  modeChip: { height: 42, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  modeChipOn: { backgroundColor: colors.green, borderColor: colors.green },
  modeChipOff: { backgroundColor: colors.white, borderColor: colors.line },
  modeChipText: { fontFamily: fonts.bold, fontSize: 13 },
  modeChipTextOn: { color: colors.white },
  modeChipTextOff: { color: colors.muted },

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
  chosenPrice: { fontFamily: fonts.extra, fontSize: 14, color: colors.green },
  ctaReady: { opacity: 1 },
  ctaWaiting: { opacity: 0.4 },
});
