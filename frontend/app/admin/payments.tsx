import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, userFacingError } from '@/src/api/client';
import { PaymentOversight } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { AdminShell, Column, currency, LoadFailed, paymentTone, readable, Table, TableRow } from '@/src/admin/shell';
import { Glyph } from '@/src/components/Glyph';
import { Card, Tag } from '@/src/components/ui';
import { useDesktop } from '@/src/desktop';
import { fmtDay } from '@/src/format';
import { FadeUp } from '@/src/motion';
import { colors, fonts, type } from '@/src/theme';

// Desktop: each order's split across one row.
const columns: Column[] = [
  { label: 'Order', flex: 2 },
  { label: 'Total', flex: 1 },
  { label: 'Career Professional', flex: 1 },
  { label: 'Yoir', flex: 1 },
  { label: 'Payment', width: 150 },
  { label: '', width: 16 },
];

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
  const desktop = useDesktop();

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

  const open = (row: PaymentOversight) =>
    router.push({ pathname: '/admin/payments/[orderId]', params: { orderId: row.orderId } });

  return (
    <AdminShell
      title="Payments"
      subtitle="The split frozen on each order when it was paid. No card details are held."
      busy={rows === null}
    >
      {error ? <LoadFailed message={error} onRetry={() => { setRows(null); void load(); }} /> : null}
      {!error && rows && rows.length === 0 ? <Text style={type.body}>No orders yet.</Text> : null}

      {desktop && rows?.length ? (
        <FadeUp delay={50}>
          <Table columns={columns}>
            {rows.map((row) => {
              const tone = paymentTone[row.paymentStatus] ?? paymentTone.not_started;
              return (
                <TableRow
                  key={row.orderId}
                  columns={columns}
                  accessibilityLabel={`Order for ${row.serviceTitle}, ${row.jobSeekerName}`}
                  onPress={() => open(row)}
                  cells={[
                    <View key="order" style={styles.desktopCell}>
                      <Text style={styles.desktopTitle}>{row.serviceTitle}</Text>
                      <Text style={styles.parties}>
                        {row.jobSeekerName} <Text style={styles.with}>paid</Text> {row.counsellorName}
                      </Text>
                      <Text style={styles.desktopMeta}>{fmtDay(row.createdAt)} · Order: {readable(row.orderStatus)}</Text>
                    </View>,
                    <Text key="total" style={styles.desktopTotal}>{currency(row.amountMinor)}</Text>,
                    <Text key="payout" style={styles.amountValue}>{currency(row.counsellorPayoutMinor)}</Text>,
                    <View key="fee" style={styles.desktopCell}>
                      <Text style={styles.amountValue}>{currency(row.platformFeeMinor)}</Text>
                      {row.refundedMinor > 0 ? <Text style={styles.desktopRefund}>{currency(row.refundedMinor)} refunded</Text> : null}
                    </View>,
                    <Tag key="status" label={readable(row.paymentStatus)} bg={tone.bg} fg={tone.fg} />,
                    <Glyph key="open" name="chevronRight" size={16} color={colors.mark} />,
                  ]}
                />
              );
            })}
          </Table>
        </FadeUp>
      ) : null}

      {(desktop ? [] : rows ?? []).map((row, index) => {
        const tone = paymentTone[row.paymentStatus] ?? paymentTone.not_started;
        return (
          <FadeUp key={row.orderId} delay={50 + Math.min(index, 10) * 25}>
            <Card
              pad={18}
              style={styles.card}
              accessibilityLabel={`Order for ${row.serviceTitle}, ${row.jobSeekerName}`}
              onPress={() => open(row)}
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
  // No flex here: these sit in a column cell, where flex would collapse their height.
  desktopTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  desktopCell: { gap: 2, alignItems: 'flex-start' },
  desktopMeta: { fontFamily: fonts.sans, fontSize: 12, color: colors.sub },
  desktopTotal: { fontFamily: fonts.extra, fontSize: 15, color: colors.ink },
  desktopRefund: { fontFamily: fonts.semi, fontSize: 12, color: colors.amberInk },
});
