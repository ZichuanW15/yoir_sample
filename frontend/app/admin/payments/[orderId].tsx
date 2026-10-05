import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, userFacingError } from '@/src/api/client';
import { AdminBooking, PaymentOversight } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { AdminShell, currency, LoadFailed, paymentTone, readable } from '@/src/admin/shell';
import { Card, Tag } from '@/src/components/ui';
import { fmtLong, modalityLabel } from '@/src/format';
import { FadeUp } from '@/src/motion';
import { goBack } from '@/src/navigation';
import { colors, fonts, type } from '@/src/theme';

/** The session time in the booking's own timezone, so it agrees with the zone printed beside it. */
function inZone(iso: string, timeZone: string): string {
  const format: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' };
  try {
    return new Date(iso).toLocaleString('en-AU', { ...format, timeZone });
  } catch {
    // A zone this runtime does not know: the device's time, which is still a true time.
    return new Date(iso).toLocaleString('en-AU', format);
  }
}

/**
 * US-48. One order, end to end: who bought what from whom, when the session is,
 * how the money was split and how far the order has got.
 *
 * Read again on every opening, so what is shown is the backend's record now. It
 * can only be looked at: nothing here changes an order or a payment.
 */
export default function AdminOrderScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { session } = useAuth();
  const [found, setFound] = useState<{ order: PaymentOversight; booking?: AdminBooking } | null>();
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    try {
      // The backend lists orders and bookings but serves neither alone.
      const [orders, bookings] = await Promise.all([
        api.listPaymentOversight(session.accessToken),
        api.listAllBookings(session.accessToken),
      ]);
      const order = orders.find((entry) => entry.orderId === orderId);
      setFound(order ? { order, booking: bookings.find((entry) => entry.id === order.bookingId) } : null);
      setError('');
    } catch (value) {
      setError(userFacingError(value));
    }
  }, [session, orderId]);

  useEffect(() => {
    const run = async () => { await load(); };
    void run();
  }, [load]);

  const order = found?.order;
  const booking = found?.booking;
  const tone = paymentTone[order?.paymentStatus ?? ''] ?? paymentTone.not_started;

  return (
    <AdminShell
      title={order?.serviceTitle ?? 'Order'}
      subtitle={order ? `Ordered ${fmtLong(order.createdAt)}` : undefined}
      busy={found === undefined && !error}
      back={{ label: 'Payments', onPress: () => goBack('/admin/payments') }}
    >
      {error ? <LoadFailed message={error} onRetry={() => { setError(''); void load(); }} /> : null}
      {found === null ? <Text style={type.body}>This order could not be found.</Text> : null}

      {order ? (
        <>
          <FadeUp>
            <Card pad={18} style={styles.card}>
              <Text style={type.groupLabel}>Progress</Text>
              <Row label="Payment"><Tag label={readable(order.paymentStatus)} bg={tone.bg} fg={tone.fg} /></Row>
              <Row label="Order"><Tag label={readable(order.orderStatus)} /></Row>
              <Row label="Session"><Tag label={booking ? readable(booking.status) : 'Not booked'} /></Row>
            </Card>
          </FadeUp>

          <FadeUp delay={60}>
            <Card pad={18} style={styles.card}>
              <Text style={type.groupLabel}>Who and when</Text>
              <Row label="Job Seeker" value={order.jobSeekerName} />
              <Row label="Career Professional" value={order.counsellorName} />
              <Row label="Service" value={order.serviceTitle} />
              {booking ? (
                <>
                  <Row label="Session time" value={`${inZone(booking.startsAt, booking.timezone)} (${booking.timezone})`} />
                  <Row label="Delivery" value={modalityLabel(booking.modality)} />
                </>
              ) : (
                <Text style={type.small}>No session is booked on this order, so there is no time to show.</Text>
              )}
            </Card>
          </FadeUp>

          <FadeUp delay={120}>
            <Card pad={18} style={styles.card}>
              <Text style={type.groupLabel}>Money</Text>
              <Row label="Service price" value={currency(order.amountMinor)} strong />
              <Row label="Yoir commission" value={currency(order.platformFeeMinor)} />
              <Row label="Career Professional amount" value={currency(order.counsellorPayoutMinor)} />
              {order.refundedMinor > 0 ? <Row label="Refunded" value={currency(order.refundedMinor)} /> : null}
            </Card>
          </FadeUp>

          <Text selectable style={styles.reference}>Payment reference {order.paymentId}</Text>
        </>
      ) : null}
    </AdminShell>
  );
}

function Row({ label, value, strong, children }: { label: string; value?: string; strong?: boolean; children?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children ?? <Text style={[styles.rowValue, strong && styles.rowStrong]}>{value}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  rowLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  rowValue: { flex: 1, textAlign: 'right', fontFamily: fonts.semi, fontSize: 14, lineHeight: 20, color: colors.ink },
  rowStrong: { fontFamily: fonts.extra, fontSize: 17 },
  reference: { fontFamily: fonts.sans, fontSize: 12, color: colors.sub, textAlign: 'center' },
});
