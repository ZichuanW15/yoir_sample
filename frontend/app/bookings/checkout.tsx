import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '@/src/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, userFacingError } from '@/src/api/client';
import { Modality, Service } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { BackBar, beat, BookingSteps, desktopAside, mono, PAY_MS } from '@/src/components/booking';
import { CountdownRing } from '@/src/components/Scenes';
import { Glyph } from '@/src/components/Glyph';
import { Button, ErrorBanner } from '@/src/components/ui';
import { BackPill, DesktopPage, useDesktop } from '@/src/desktop';
import { countdown, deviceTimezone, fmtLong, modalityLabel, money, timeRange } from '@/src/format';
import { FadeUp, Pop, ScreenIn } from '@/src/motion';
import { usePaymentConfig, usePaymentSheet } from '@/src/payments';
import { waitForBooking } from '@/src/payments/waitForBooking';
import { colors, fonts, HOLD_MS, radius, shadow, type } from '@/src/theme';

export default function CheckoutScreen() {
  const params = useLocalSearchParams<{
    orderId: string; serviceId: string; modality: Modality;
    amountMinor: string; startsAt: string; endsAt: string; holdExpiresAt?: string;
  }>();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const { config } = usePaymentConfig();
  const { present, supported } = usePaymentSheet();
  const [service, setService] = useState<Service | null>(null);
  const [payError, setPayError] = useState('');
  const [busy, setBusy] = useState(false);

  const amountMinor = Number(params.amountMinor ?? 0);

  /**
   * US-41 — the hold is a deadline the server set, so the ring counts down to that
   * rather than to a timer started when this screen happened to open. A buyer who
   * backgrounds the app and comes back sees the time that is really left.
   */
  const deadline = useMemo(() => {
    const parsed = params.holdExpiresAt ? Date.parse(params.holdExpiresAt) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  }, [params.holdExpiresAt]);
  // The ring's full sweep is the hold length the server is configured for, not a
  // measurement taken here — reading the clock during render is not idempotent.
  const total = (config?.slotHoldMinutes ?? HOLD_MS / 60_000) * 60_000;
  const [remaining, setRemaining] = useState(total);

  useEffect(() => {
    const endsAt = deadline ?? Date.now() + total;
    const measure = () => {
      const left = Math.max(0, endsAt - Date.now());
      setRemaining(left);
      return left;
    };
    measure();
    const tick = setInterval(() => { if (measure() <= 0) clearInterval(tick); }, 1000);
    return () => clearInterval(tick);
  }, [deadline, total]);

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
  const byCard = config?.provider === 'stripe';
  // Both platforms take cards — the native PaymentSheet on a device, Stripe.js
  // Elements in a browser. This is only false if the server says it takes cards
  // but published no publishable key to take them with.
  const cardUnavailableHere = byCard && !supported;

  function goToConfirmation(bookingId: string, paymentReference: string, pending = false) {
    // The confirmation replaces checkout: a paid booking can never be paid twice.
    router.replace({
      pathname: '/bookings/confirmation',
      params: {
        bookingId, paymentId: paymentReference, serviceId: params.serviceId,
        modality: params.modality, startsAt: params.startsAt, endsAt: params.endsAt,
        amountMinor: String(amountMinor), pending: pending ? '1' : '',
      },
    });
  }

  async function payByCard() {
    if (!session) return;
    const intent = await api.createPaymentIntent(params.orderId, session.accessToken);
    const result = await present({
      clientSecret: intent.clientSecret,
      customerName: session.user.name,
    });

    if (result.outcome === 'cancelled') return;  // Closing the sheet is not a failure.
    if (result.outcome !== 'paid') {
      setPayError(result.message ?? 'The payment could not be completed.');
      return;
    }

    // Stripe took the card; the backend confirms the booking off the webhook.
    const booking = await waitForBooking(params.orderId, session.accessToken);
    if (booking) {
      goToConfirmation(booking.id, intent.paymentIntentId);
      return;
    }
    // The money moved but confirmation has not caught up. Never silently claim
    // failure over a successful payment — the confirmation screen says it is pending.
    goToConfirmation('', intent.paymentIntentId, true);
  }

  async function payByStub() {
    if (!session) return;
    const receipt = await api.completeStubPayment(
      {
        id: params.orderId, serviceId: params.serviceId, windowId: '',
        startsAt: params.startsAt, endsAt: params.endsAt, amountMinor,
        currency: 'AUD', status: 'awaiting_payment', paymentStatus: 'not_started',
      },
      session.accessToken,
    );
    goToConfirmation(receipt.booking.id, receipt.paymentId);
  }

  async function pay() {
    if (!session || expired || cardUnavailableHere) return;
    setBusy(true);
    setPayError('');
    const busy1100 = beat(PAY_MS);
    try {
      await (byCard ? payByCard() : payByStub());
      await busy1100;
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

  // Shared by the mobile and desktop layouts, which differ only in where these sit.
  const expiredAlert = expired ? (
    <Pop duration={300}>
      <View accessibilityRole="alert" style={s.expired}>
        <Text style={s.expiredText}>
          <Text style={s.expiredLead}>Reservation expired.</Text>
          {' '}Your slot was released so someone else could book it. Choose another time to continue.
        </Text>
      </View>
    </Pop>
  ) : null;

  const orderSummary = (
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
  );

  // Spec §12 — the cancellation policy is shown before the money moves,
  // not afterwards on a receipt.
  const cancellationPolicy = (
    <FadeUp delay={200} style={s.policy}>
      <View style={s.policyHeading}>
        <Glyph name="shieldCheck" size={18} color={colors.green} />
        <Text style={s.policyTitle}>Cancellation policy</Text>
      </View>
      <Text style={s.policyBody}>
        Cancel at least {config?.cancellationFullRefundHours ?? 24} hours before the session for a
        full refund of {money(amountMinor)}.{' '}
        {(config?.cancellationLateRefundPercent ?? 0) > 0
          ? `Cancel later and ${config?.cancellationLateRefundPercent}% is refunded.`
          : 'Cancelling later than that is not refunded.'}
        {' '}If your Career Professional cancels, you are always refunded in full.
      </Text>
    </FadeUp>
  );

  const paymentMethod = byCard ? (
    <FadeUp delay={240} style={s.method}>
      <View style={s.methodHeading}>
        <Glyph name="lock" size={18} color={colors.green} />
        <Text style={s.methodTitle}>Secure card payment</Text>
      </View>
      <Text style={s.methodBody}>
        Card details are entered directly with Stripe and never reach Yoir&apos;s servers.
        Your Career Professional is paid after the session takes place.
      </Text>
      {cardUnavailableHere ? (
        <Text style={s.methodWarning}>
          Card payments are not set up on this server yet. Your slot stays reserved
          while the timer runs.
        </Text>
      ) : null}
      <View style={s.methodRow}>
        <Text style={s.methodKey}>Booking reference</Text>
        <Text style={[s.methodValue, s.reference]}>{params.orderId}</Text>
      </View>
    </FadeUp>
  ) : (
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
  );

  const payButton = expired
    ? <Button label="Choose another time" height={58} onPress={backToSlots} />
    : (
      <Button
        label={`Pay ${money(amountMinor)}`}
        height={58}
        busy={busy}
        disabled={cardUnavailableHere}
        onPress={pay}
        style={shadow.toast}
      />
    );

  if (desktop) {
    return (
      <DesktopPage>
        <View style={s.desktopTop}>
          <BackPill
            label="Choose a time"
            accessibilityLabel="Go back"
            onPress={() => goBack({ pathname: '/services/[serviceId]/timeslots', params: { serviceId: params.serviceId } })}
          />
          <BookingSteps step={1} />
        </View>
        <View style={s.desktopColumns}>
          <View style={s.desktopMain}>
            <View style={s.desktopIntro}>
              <Text style={s.desktopTitle}>Almost there</Text>
              <Text style={type.body}>Your slot is reserved while the timer runs.</Text>
            </View>
            {expiredAlert}
            {payError ? <Pop duration={300}><ErrorBanner message={payError} /></Pop> : null}
            {orderSummary}
            {cancellationPolicy}
            {paymentMethod}
          </View>
          <View style={[desktopAside, s.desktopAside]}>
            <View style={s.desktopRing}>
              <CountdownRing remaining={remaining} total={total} label={countdown(remaining)} />
            </View>
            <View style={s.desktopPay}>{payButton}</View>
          </View>
        </View>
      </DesktopPage>
    );
  }

  return (
    <ScreenIn style={s.screen}>
      <BackBar title="Review and pay" onBack={() => goBack({ pathname: '/services/[serviceId]/timeslots', params: { serviceId: params.serviceId } })} />

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <FadeUp><BookingSteps step={1} /></FadeUp>

        <FadeUp delay={80} style={s.hero}>
          <View style={s.heroCopy}>
            <Text style={type.display34}>Almost there</Text>
            <Text style={s.heroBody}>Your slot is reserved while the timer runs.</Text>
          </View>
          <CountdownRing remaining={remaining} total={total} label={countdown(remaining)} />
        </FadeUp>

        {expiredAlert}

        {payError ? <Pop duration={300}><ErrorBanner message={payError} /></Pop> : null}

        {orderSummary}

        {cancellationPolicy}

        {paymentMethod}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 22 }]}>
        {payButton}
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

  policy: { padding: 18, gap: 10, backgroundColor: colors.greenTint, borderRadius: radius.lg },
  policyHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  policyTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  policyBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: colors.ink },

  method: { padding: 20, gap: 12, backgroundColor: colors.chip, borderRadius: radius.xl },
  methodHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  methodTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  methodBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: colors.muted },
  methodWarning: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 20, color: colors.dangerInk },
  methodRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  methodKey: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  methodValue: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.ink, textAlign: 'right' },

  stub: { padding: 20, gap: 12, backgroundColor: colors.yellowTint, borderRadius: radius.xl },
  stubHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stubTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.amberDeep },
  stubBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: colors.amberDeep },
  stubRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  stubKey: { fontFamily: fonts.sans, fontSize: 13, color: colors.amberDeep },
  stubValue: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.amberDeep, textAlign: 'right' },
  reference: { fontFamily: mono, fontWeight: '700' },

  footer: { paddingTop: 14, paddingHorizontal: 22, backgroundColor: colors.white },

  desktopTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
  desktopColumns: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  desktopMain: { flex: 1, minWidth: 0, gap: 20 },
  desktopIntro: { gap: 8 },
  desktopTitle: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 39, letterSpacing: -0.4, color: colors.ink },
  desktopAside: { alignItems: 'center', gap: 22, paddingVertical: 30 },
  // The shared ring is drawn at phone size; the desktop card shows it larger.
  desktopRing: { transform: [{ scale: 1.45 }], marginVertical: 20 },
  desktopPay: { alignSelf: 'stretch' },
});
