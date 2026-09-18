import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/src/api/client';
import { Modality, Service } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { usePaymentConfig } from '@/src/payments';
import { BookingSteps, mono } from '@/src/components/booking';
import { Glyph } from '@/src/components/Glyph';
import { SuccessSeal } from '@/src/components/Scenes';
import { Button, Press } from '@/src/components/ui';
import { fmtLong, modalityLabel, money, timeRange } from '@/src/format';
import { FadeUp, ScreenIn } from '@/src/motion';
import { colors, fonts, radius, shadow, type } from '@/src/theme';

/**
 * The payment is real, but confirmation is the backend's to give: it comes from
 * Stripe's webhook, not from the app. When the card has cleared and that has not
 * landed yet, say so plainly rather than either claiming a booking that does not
 * exist or implying the payment failed.
 */
function sealMessage(byCard: boolean, pending: boolean): string {
  if (!byCard) return 'Payment successful. No real money was charged \u2014 this build uses a payment stub.';
  if (pending) {
    return 'Your card was charged and we are confirming the booking now. This usually takes a few seconds.';
  }
  return 'Payment successful. Your Career Professional is paid after the session takes place.';
}

/** US-46 — what happens next depends on how the session is delivered. */
function deliveryNote(modality: Modality, meetingArea: string, hasLink: boolean) {
  if (modality === 'in_person') {
    return `In person${meetingArea ? ` · ${meetingArea}` : ''}. Your Career Professional confirms the exact meeting point before the session.`;
  }
  return hasLink
    ? 'Online. The same joining link is in your confirmation email.'
    : 'Online. Joining details are sent to your registered email before the session.';
}

export default function ConfirmationScreen() {
  const params = useLocalSearchParams<{
    bookingId: string; paymentId: string; serviceId: string;
    modality: Modality; startsAt: string; endsAt: string; amountMinor: string;
    /** Set when the card was charged but the confirmation webhook had not landed yet. */
    pending?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { config } = usePaymentConfig();
  const [service, setService] = useState<Service | null>(null);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const pending = params.pending === '1';
  const byCard = config?.provider === 'stripe';

  const load = useCallback(async () => {
    if (!params.serviceId) return;
    try {
      setService(await api.getService(params.serviceId));
    } catch {
      // The booking is already confirmed; its references stand without the service copy.
    }
  }, [params.serviceId]);

  useEffect(() => {
    const run = async () => { await load(); };
    void run();
  }, [load]);

  /**
   * The meeting room is decided by the backend when the booking is confirmed, so it
   * is read back rather than derived here — the link shown must be the one that was
   * also emailed, not a second guess at what it should be.
   */
  useEffect(() => {
    if (!session || !params.bookingId) return;
    let cancelled = false;
    const run = async () => {
      try {
        const booking = await api.getBooking(params.bookingId, session.accessToken);
        if (!cancelled) setMeetingUrl(booking.meetingUrl ?? '');
      } catch {
        // The confirmation stands without it; the link is in the email either way.
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [params.bookingId, session]);

  /**
   * Spec §11 — the receipt is issued in the counsellor's name, because they are the
   * supplier of the session. It is fetched rather than composed here so the number
   * shown is the one the backend actually issued.
   */
  useEffect(() => {
    if (!session || !params.bookingId) return;
    let cancelled = false;
    const run = async () => {
      try {
        const receipt = await api.getBookingReceipt(params.bookingId, session.accessToken);
        if (!cancelled) setReceiptNumber(receipt.receiptNumber);
      } catch {
        // The booking stands without its receipt reference; it is emailed anyway.
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [params.bookingId, session]);

  const meetingArea = service?.location ? `${service.location.cityOrRegion}, ${service.location.state}` : '';

  /** The purchase is finished: the flow is unwound rather than stacked on. */
  function backToMarketplace() {
    if (router.canDismiss()) router.dismissAll();
    router.push('/marketplace');
  }

  return (
    <ScreenIn style={s.screen}>
      <ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>
        <FadeUp><BookingSteps step={2} /></FadeUp>

        <View style={s.seal}>
          <SuccessSeal />
          <FadeUp delay={500}>
            <Text style={s.headline}>{pending ? 'Payment received' : 'You\u2019re booked'}</Text>
          </FadeUp>
          <FadeUp delay={600}>
            <Text style={s.sealBody}>{sealMessage(byCard, pending)}</Text>
          </FadeUp>
        </View>

        <FadeUp delay={700} style={s.summary}>
          <Text style={s.summaryTitle}>{service?.title}</Text>
          <Text style={type.small}>with {service?.counsellor.displayName}</Text>
          <View style={s.rule} />
          <Row label="When" value={fmtLong(params.startsAt)} />
          <Row label="Session" value={timeRange(params.startsAt, params.endsAt)} />
          <Row label="Delivery" value={modalityLabel(params.modality)} />
          <View style={s.row}>
            <Text style={s.rowLabel}>Paid</Text>
            <Text style={[s.rowValue, s.paid]}>{money(Number(params.amountMinor ?? 0))} · Paid</Text>
          </View>
        </FadeUp>

        <FadeUp delay={800} style={s.references}>
          <Text style={type.groupLabel}>References</Text>
          <View style={s.row}>
            <Text style={s.rowLabel}>Booking</Text>
            <Text style={[s.rowValue, s.reference]}>{params.bookingId || 'Confirming\u2026'}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>Payment</Text>
            <Text style={[s.rowValue, s.reference]}>{params.paymentId}</Text>
          </View>
          {receiptNumber ? (
            <View style={s.row}>
              <Text style={s.rowLabel}>Receipt</Text>
              <Text style={[s.rowValue, s.reference]}>{receiptNumber}</Text>
            </View>
          ) : null}
        </FadeUp>

        {meetingUrl ? (
          <FadeUp delay={850} style={s.joining}>
            <Text style={type.groupLabel}>Joining your session</Text>
            <Text style={s.joiningNote}>
              Use this link at the scheduled time. Nothing to install, and it is in your
              email too.
            </Text>
            <Press
              accessibilityLabel="Open the meeting room"
              scaleTo={0.97}
              style={s.join}
              onPress={() => { void Linking.openURL(meetingUrl); }}
            >
              <Glyph name="video" size={18} color={colors.white} />
              <Text style={s.joinLabel}>Open the meeting room</Text>
            </Press>
          </FadeUp>
        ) : null}

        <FadeUp delay={900} style={s.note}>
          <View style={s.noteIcon}><Glyph name="sparkle" size={20} color={colors.green} /></View>
          <Text style={s.noteText}>
            {deliveryNote(params.modality, meetingArea, Boolean(meetingUrl))}{' '}
            {pending
              ? 'Your confirmation will arrive by email shortly; you do not need to pay again.'
              : 'Keep the booking reference \u2014 your Career Professional can see the booking now.'}
          </Text>
        </FadeUp>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 22 }]}>
        <Button label="Back to Explore" height={58} onPress={backToMarketplace} style={shadow.toast} />
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
  body: { paddingHorizontal: 22, paddingBottom: 24, gap: 20 },

  joining: { gap: 8 },
  joiningNote: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.muted },
  join: {
    marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: radius.pill, backgroundColor: colors.green,
  },
  joinLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },

  seal: { alignItems: 'center', gap: 14, paddingVertical: 8 },
  headline: { ...type.display36, textAlign: 'center' },
  sealBody: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, color: colors.muted, textAlign: 'center' },

  summary: { padding: 20, gap: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.xl },
  summaryTitle: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 25, color: colors.ink },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  rowLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  rowValue: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.ink, textAlign: 'right' },
  paid: { color: colors.greenDeep },
  reference: { fontFamily: mono, fontWeight: '700' },

  references: { padding: 20, gap: 12, backgroundColor: colors.chip, borderRadius: radius.xl },

  note: { flexDirection: 'row', gap: 12, padding: 18, backgroundColor: colors.greenTint, borderRadius: radius.lg },
  noteIcon: { marginTop: 2 },
  noteText: { flex: 1, fontFamily: fonts.sans, fontSize: 14, lineHeight: 22, color: colors.ink },

  footer: { paddingTop: 14, paddingHorizontal: 22, backgroundColor: colors.white },
});
