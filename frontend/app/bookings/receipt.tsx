import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, userFacingError } from '@/src/api/client';
import { Receipt } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { BackBar } from '@/src/components/booking';
import { Card, ErrorBanner, Spinner } from '@/src/components/ui';
import { BackPill, DesktopPage, useDesktop } from '@/src/desktop';
import { fmtLong, fmtTime } from '@/src/format';
import { goBack } from '@/src/navigation';
import { FadeUp, ScreenIn } from '@/src/motion';
import { colors, fonts, type } from '@/src/theme';

const currency = (minor: number, code: string) =>
  `${code} $${(minor / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The job seeker's receipt for one session.
 *
 * It names the *counsellor* as supplier, with their own ABN and GST, because that
 * is who made the supply — Yoir acts as their agent and invoices commission
 * separately. That is also why these are issued by Yoir rather than as Stripe
 * Invoices, which would name Yoir as the seller and mis-state who sold what.
 */
export default function ReceiptScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const { session } = useAuth();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!bookingId || !session) return;
    try {
      setReceipt(await api.getBookingReceipt(bookingId, session.accessToken));
    } catch (value) {
      setError(userFacingError(value));
    }
  }, [bookingId, session]);

  useEffect(() => {
    const run = async () => { await load(); };
    void run();
  }, [load]);

  // Shared by the mobile and desktop layouts; desktop only frames it differently.
  const content = (
    <>
      {error ? <ErrorBanner message={error} /> : null}
      {!receipt && !error ? (
        <View style={styles.centred}><Spinner size={28} color={colors.green} /></View>
      ) : null}

      {receipt ? (
        <FadeUp delay={100}>
          <Card pad={22} style={styles.sheet}>
            <Text style={type.groupLabel}>{receipt.isTaxInvoice ? 'Tax invoice' : 'Receipt'}</Text>
            <Text style={type.display24}>{receipt.receiptNumber}</Text>
            <Text style={type.small}>Issued {fmtLong(receipt.issuedAt)}</Text>

            <View style={styles.rule} />

            <Row label="From" value={receipt.supplierName} />
            {receipt.isTaxInvoice && receipt.supplierAbn ? (
              <Row label="ABN" value={receipt.supplierAbn} />
            ) : null}
            <Row label="To" value={receipt.buyerName} />

            <View style={styles.rule} />

            <Row label="Service" value={receipt.description} />
            <Row
              label="Session"
              value={`${fmtLong(receipt.sessionStartsAt)} · ${fmtTime(receipt.sessionStartsAt)}`}
            />

            <View style={styles.rule} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total paid</Text>
              <Text style={styles.totalValue}>{currency(receipt.totalMinor, receipt.currency)}</Text>
            </View>
            <Text style={styles.gst}>
              {receipt.isTaxInvoice
                ? `Includes GST of ${currency(receipt.gstMinor, receipt.currency)}.`
                : 'No GST has been charged on this supply.'}
            </Text>
          </Card>
        </FadeUp>
      ) : null}
    </>
  );

  if (desktop) {
    return (
      <DesktopPage>
        <BackPill label="Back" accessibilityLabel="Go back" onPress={() => goBack('/bookings')} />
        <View style={styles.desktopColumn}>{content}</View>
      </DesktopPage>
    );
  }

  return (
    <ScreenIn duration={450} style={styles.screen}>
      <BackBar title="Receipt" onBack={() => goBack('/bookings')} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 32 + insets.bottom }]}>
        {content}
      </ScrollView>
    </ScreenIn>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  body: { paddingTop: 12, paddingHorizontal: 20, gap: 20 },
  centred: { alignItems: 'center', paddingTop: 60 },
  sheet: { gap: 6 },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 5 },
  rowLabel: { width: 78, fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  rowValue: { flex: 1, fontFamily: fonts.semi, fontSize: 14, color: colors.ink },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  totalValue: { fontFamily: fonts.extra, fontSize: 20, color: colors.ink },
  gst: { marginTop: 6, fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.sub },

  desktopColumn: { width: '100%', maxWidth: 600, gap: 20 },
});
