import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, userFacingError } from '@/src/api/client';
import { PaymentOversight } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { AdminShell, currency, LoadFailed, paymentTone, readable } from '@/src/admin/shell';
import { Glyph } from '@/src/components/Glyph';
import { Card, Tag } from '@/src/components/ui';
import { fmtDay } from '@/src/format';
import { FadeUp } from '@/src/motion';
import { colors, fonts, type } from '@/src/theme';

/**
 * US-48. Where each order's money went.
 *
 * There are no card details anywhere here, and there is nowhere to add them: Yoir
 * never holds one. What the Platform Owner needs is that the money moved and how it
 * was split, which is read straight off the order. Opening a row shows the whole
 * order: who, which session, and how far it has got.
 */
export default function AdminPaymentsScreen() {
  const { session } = useAuth();
  const [rows, setRows] = useState<PaymentOversight[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    try {
      setRows(await api.listPaymentOversight(session.accessToken));
      setError('');
    } catch (value) {
      setError(userFacingError(value));
      setRows([]);
    }
  }, [session]);

  // On focus, so an order reopened from its detail is read again, not remembered.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <AdminShell
      title="Payments"
      subtitle="The split frozen on each order when it was paid. No card details are held."
      busy={rows === null}
    >
      {error ? <LoadFailed message={error} onRetry={() => { setRows(null); void load(); }} /> : null}
      {!error && rows && rows.length === 0 ? <Text style={type.body}>No orders yet.</Text> : null}

      {(rows ?? []).map((row, index) => {
        const tone = paymentTone[row.paymentStatus] ?? paymentTone.not_started;
        return (
          <FadeUp key={row.orderId} delay={50 + Math.min(index, 10) * 25}>
            <Card
              pad={18}
              style={styles.card}
              accessibilityLabel={`Order for ${row.serviceTitle}, ${row.jobSeekerName}`}
              onPress={() => router.push({ pathname: '/admin/payments/[orderId]', params: { orderId: row.orderId } })}
            >
              <View style={styles.head}>
                <Text style={styles.title}>{row.serviceTitle}</Text>
                <Tag label={readable(row.paymentStatus)} bg={tone.bg} fg={tone.fg} />
              </View>

              <Text style={styles.parties}>
                {row.jobSeekerName} <Text style={styles.with}>paid</Text> {row.counsellorName}
              </Text>

              <View style={styles.split}>
                <Amount label="Total" value={currency(row.amountMinor)} strong />
                <Amount label="Career Professional" value={currency(row.counsellorPayoutMinor)} />
                <Amount label="Yoir" value={currency(row.platformFeeMinor)} />
                {row.refundedMinor > 0 ? <Amount label="Refunded" value={currency(row.refundedMinor)} /> : null}
              </View>

              <View style={styles.foot}>
                <Text style={styles.meta}>{fmtDay(row.createdAt)} · Order: {readable(row.orderStatus)}</Text>
                <Glyph name="chevronRight" size={16} color={colors.mark} />
              </View>
            </Card>
          </FadeUp>
        );
      })}
    </AdminShell>
  );
}

function Amount({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.amount}>
      <Text style={[styles.amountValue, strong && styles.amountStrong]}>{value}</Text>
      <Text style={styles.amountLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  parties: { fontFamily: fonts.semi, fontSize: 13, color: colors.muted },
  with: { fontFamily: fonts.sans, color: colors.sub },
  split: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amount: { flexGrow: 1, flexBasis: '22%', padding: 10, borderRadius: 14, backgroundColor: colors.field, gap: 2 },
  amountValue: { fontFamily: fonts.semi, fontSize: 13, color: colors.ink },
  amountStrong: { fontFamily: fonts.extra, fontSize: 15 },
  amountLabel: { fontFamily: fonts.sans, fontSize: 11, color: colors.sub },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  meta: { flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.sub },
});
