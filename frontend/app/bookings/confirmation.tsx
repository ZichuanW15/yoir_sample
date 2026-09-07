import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/src/api/client';
import { Modality, Service } from '@/src/api/types';
import { BookingSteps, mono } from '@/src/components/booking';
import { Glyph } from '@/src/components/Glyph';
import { SuccessSeal } from '@/src/components/Scenes';
import { Button } from '@/src/components/ui';
import { fmtLong, modalityLabel, money, timeRange } from '@/src/format';
import { FadeUp, ScreenIn } from '@/src/motion';
import { colors, fonts, radius, shadow, type } from '@/src/theme';

/** US-46 — what happens next depends on how the session is delivered. */
function deliveryNote(modality: Modality, meetingArea: string) {
  if (modality === 'in_person') {
    return `In person${meetingArea ? ` · ${meetingArea}` : ''}. Your counsellor confirms the exact meeting point before the session.`;
  }
  return 'Online. Joining details are sent to your registered email before the session.';
}

export default function ConfirmationScreen() {
  const params = useLocalSearchParams<{
    bookingId: string; paymentId: string; serviceId: string;
    modality: Modality; startsAt: string; endsAt: string; amountMinor: string;
  }>();
  const insets = useSafeAreaInsets();
  const [service, setService] = useState<Service | null>(null);

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
          <FadeUp delay={500}><Text style={s.headline}>You&apos;re booked</Text></FadeUp>
          <FadeUp delay={600}>
            <Text style={s.sealBody}>
              Payment successful. No real money was charged — this build uses a payment stub.
            </Text>
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
            <Text style={[s.rowValue, s.reference]}>{params.bookingId}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>Payment</Text>
            <Text style={[s.rowValue, s.reference]}>{params.paymentId}</Text>
          </View>
        </FadeUp>

        <FadeUp delay={900} style={s.note}>
          <View style={s.noteIcon}><Glyph name="sparkle" size={20} color={colors.green} /></View>
          <Text style={s.noteText}>
            {deliveryNote(params.modality, meetingArea)} Keep the booking reference — your counsellor can see the booking now.
          </Text>
        </FadeUp>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 22 }]}>
        <Button label="Back to Marketplace" height={58} onPress={backToMarketplace} style={shadow.toast} />
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
