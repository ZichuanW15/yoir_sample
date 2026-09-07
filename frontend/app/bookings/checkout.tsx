import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, userFacingError } from '@/src/api/client';
import { Modality, Order, Service } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { BackBar, beat, BookingSteps, mono, PAY_MS } from '@/src/components/booking';
import { CountdownRing } from '@/src/components/Scenes';
import { Glyph } from '@/src/components/Glyph';
import { Button, ErrorBanner } from '@/src/components/ui';
import { countdown, deviceTimezone, fmtLong, modalityLabel, money, timeRange } from '@/src/format';
import { FadeUp, Pop, ScreenIn } from '@/src/motion';
import { colors, fonts, HOLD_MS, radius, shadow, type } from '@/src/theme';

export default function CheckoutScreen() {
  const params = useLocalSearchParams<{
    orderId: string; serviceId: string; slotId: string; modality: Modality;
    amountMinor: string; startsAt: string; endsAt: string;
  }>();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [service, setService] = useState<Service | null>(null);
  const [payError, setPayError] = useState('');
  const [busy, setBusy] = useState(false);

  const amountMinor = Number(params.amountMinor ?? 0);
  const [remaining, setRemaining] = useState(HOLD_MS);

  // US-41 — the hold is a wall-clock deadline, so the ring counts the real time left.
  useEffect(() => {
    const heldFrom = Date.now();
    const tick = setInterval(() => {
      const left = Math.max(0, HOLD_MS - (Date.now() - heldFrom));
      setRemaining(left);
      if (left <= 0) clearInterval(tick);
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const load = useCallback(async () => {
    if (!params.serviceId) return;
    try {
      setService(await api.getService(params.serviceId));
    } catch (error) {
      setPayError(userFacingError(error));
    }
  }, [params.serviceId]);

  useEffect(() => {
    const run = async () => { await load(); };
    void run();
  }, [load]);

  const expired = remaining <= 0;
  const meetingArea = service?.location ? `${service.location.cityOrRegion}, ${service.location.state}` : '';
  const showMeetingArea = params.modality === 'in_person' && !!meetingArea;

  async function pay() {
    if (!session || expired) return;
    setBusy(true);
    setPayError('');
    const busy1100 = beat(PAY_MS);
    try {
      const order: Order = {
        id: params.orderId, serviceId: params.serviceId, slotId: params.slotId, amountMinor,
        currency: 'AUD', status: 'awaiting_payment', paymentStatus: 'not_started',
      };
      const receipt = await api.completeStubPayment(order, session.accessToken);
      await busy1100;
      // The confirmation replaces checkout: a paid booking can never be paid twice.
      router.replace({
        pathname: '/bookings/confirmation',
        params: {
          bookingId: receipt.booking.id, paymentId: receipt.paymentId, serviceId: params.serviceId,
          modality: params.modality, startsAt: params.startsAt, endsAt: params.endsAt,
          amountMinor: String(amountMinor),
        },
      });
    } catch (error) {
      await busy1100;
      setPayError(userFacingError(error));
    } finally {
      setBusy(false);
    }
  }

  function backToSlots() {
    router.replace({ pathname: '/services/[serviceId]/timeslots', params: { serviceId: params.serviceId } });
  }

  return (
    <ScreenIn style={s.screen}>
      <BackBar title="Review and pay" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <FadeUp><BookingSteps step={1} /></FadeUp>

        <FadeUp delay={80} style={s.hero}>
          <View style={s.heroCopy}>
            <Text style={type.display34}>Almost there</Text>
            <Text style={s.heroBody}>Your slot is reserved while the timer runs.</Text>
          </View>
          <CountdownRing remaining={remaining} total={HOLD_MS} label={countdown(remaining)} />
        </FadeUp>

        {expired ? (
          <Pop duration={300}>
            <View accessibilityRole="alert" style={s.expired}>
              <Text style={s.expiredText}>
                <Text style={s.expiredLead}>Reservation expired.</Text>
                {' '}Your slot was released so someone else could book it. Choose another time to continue.
              </Text>
            </View>
          </Pop>
        ) : null}

        {payError ? <Pop duration={300}><ErrorBanner message={payError} /></Pop> : null}

        <FadeUp delay={160} style={s.summary}>
          <Text style={s.summaryTitle}>{service?.title}</Text>
          <Text style={type.small}>with {service?.counsellor.displayName}</Text>
          <View style={s.rule} />
          <Row label="Date" value={fmtLong(params.startsAt)} />
          <Row label="Time" value={timeRange(params.startsAt, params.endsAt)} />
          <Row label="Timezone" value={deviceTimezone()} />
          <Row label="Delivery" value={modalityLabel(params.modality)} />
          {showMeetingArea ? <Row label="Meeting area" value={meetingArea} /> : null}
          <View style={s.rule} />
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>{money(amountMinor)}</Text>
          </View>
        </FadeUp>

        <FadeUp delay={240} style={s.stub}>
          <View style={s.stubHeading}>
            <Glyph name="lock" size={18} color={colors.amberInk} />
            <Text style={s.stubTitle}>Test-mode payment</Text>
          </View>
          <Text style={s.stubBody}>
            Yoir never collects or stores card details. This build uses the backend payment stub, so no real money moves.
          </Text>
          <View style={s.stubRow}>
            <Text style={s.stubKey}>Method</Text>
            <Text style={s.stubValue}>Yoir test payment</Text>
          </View>
          <View style={s.stubRow}>
            <Text style={s.stubKey}>Order reference</Text>
            <Text style={[s.stubValue, s.reference]}>{params.orderId}</Text>
          </View>
        </FadeUp>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 22 }]}>
        {expired
          ? <Button label="Choose another time" height={58} onPress={backToSlots} />
          : <Button label={`Pay ${money(amountMinor)}`} height={58} busy={busy} onPress={pay} style={shadow.toast} />}
      </View>
    </ScreenIn>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  body: { paddingTop: 6, paddingHorizontal: 22, paddingBottom: 24, gap: 20 },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroCopy: { flex: 1, gap: 6 },
  heroBody: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.muted },

  expired: { backgroundColor: colors.dangerBg, borderRadius: radius.md, padding: 14 },
  expiredText: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.dangerInk },
  expiredLead: { fontFamily: fonts.bold },

  summary: { padding: 20, gap: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.xl },
  summaryTitle: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 25, color: colors.ink },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  rowLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  rowValue: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.ink, textAlign: 'right' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  totalValue: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 34, color: colors.green },

  stub: { padding: 20, gap: 12, backgroundColor: colors.yellowTint, borderRadius: radius.xl },
  stubHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stubTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.amberDeep },
  stubBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: colors.amberDeep },
  stubRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  stubKey: { fontFamily: fonts.sans, fontSize: 13, color: colors.amberDeep },
  stubValue: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.amberDeep, textAlign: 'right' },
  reference: { fontFamily: mono, fontWeight: '700' },

  footer: { paddingTop: 14, paddingHorizontal: 22, backgroundColor: colors.white },
});
