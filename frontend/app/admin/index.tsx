import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, userFacingError } from '@/src/api/client';
import { PlatformStats } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { AdminShell } from '@/src/admin/shell';
import { Card, ErrorBanner, Press } from '@/src/components/ui';
import { Glyph } from '@/src/components/Glyph';
import { FadeUp } from '@/src/motion';
import { colors, fonts, radius, type } from '@/src/theme';

const currency = (minor: number) =>
  `$${(minor / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const bookingOrder = ['confirmed', 'completed', 'paid_out', 'cancelled', 'refunded'];
const bookingLabel: Record<string, string> = {
  confirmed: 'Confirmed', completed: 'Completed', paid_out: 'Paid out',
  cancelled: 'Cancelled', refunded: 'Refunded',
};

export default function AdminOverviewScreen() {
  const { session } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    try {
      setStats(await api.getPlatformStats(session.accessToken));
      setError('');
    } catch (value) {
      setError(userFacingError(value));
    }
  }, [session]);

  useEffect(() => {
    const run = async () => { await load(); };
    void run();
  }, [load]);

  return (
    <AdminShell
      title="Overview"
      subtitle="Everything below is read from the breakdown frozen on each order, never recalculated."
      busy={!stats && !error}
    >
      {error ? <ErrorBanner message={error} /> : null}

      {stats ? (
        <>
          {stats.counsellorsPendingVerification > 0 ? (
            <FadeUp delay={80}>
              <Press
                accessibilityLabel="Review pending verifications"
                scaleTo={0.98}
                style={styles.callout}
                onPress={() => router.replace('/admin/verifications')}
              >
                <Glyph name="shieldCheck" size={20} color={colors.amberInk} />
                <Text style={styles.calloutText}>
                  {stats.counsellorsPendingVerification} counsellor
                  {stats.counsellorsPendingVerification === 1 ? '' : 's'} waiting on a decision
                </Text>
                <Glyph name="chevronRight" size={16} color={colors.amberInk} />
              </Press>
            </FadeUp>
          ) : null}

          <FadeUp delay={120} style={styles.section}>
            <Text style={type.groupLabel}>People</Text>
            <View style={styles.grid}>
              <Stat label="Job seekers" value={String(stats.jobSeekers)} />
              <Stat label="Counsellors" value={String(stats.counsellors)} />
              <Stat label="Awaiting review" value={String(stats.counsellorsPendingVerification)} />
              <Stat
                label="Cannot be paid"
                value={String(stats.counsellorsAwaitingPayouts)}
                note="Verified, but payouts not set up — nothing they list can be booked."
              />
            </View>
          </FadeUp>

          <FadeUp delay={180} style={styles.section}>
            <Text style={type.groupLabel}>Activity</Text>
            <View style={styles.grid}>
              <Stat label="Active services" value={String(stats.servicesActive)} />
              <Stat label="Holds awaiting payment" value={String(stats.ordersAwaitingPayment)} />
              {bookingOrder
                .filter((status) => stats.bookingsByStatus[status])
                .map((status) => (
                  <Stat
                    key={status}
                    label={`${bookingLabel[status]} bookings`}
                    value={String(stats.bookingsByStatus[status])}
                  />
                ))}
            </View>
          </FadeUp>

          <FadeUp delay={240} style={styles.section}>
            <Text style={type.groupLabel}>Money</Text>
            <Card pad={20} style={styles.money}>
              <Line label="Gross taken" value={currency(stats.money.grossMinor)} strong />
              <View style={styles.rule} />
              <Line label="Counsellor payouts" value={currency(stats.money.counsellorPayoutMinor)} />
              <Line label="Yoir commission" value={currency(stats.money.platformFeeMinor)} />
              <Line label="…of which GST" value={currency(stats.money.platformFeeGstMinor)} muted />
              <Line label="Session GST (counsellors')" value={currency(stats.money.sessionGstMinor)} muted />
              <View style={styles.rule} />
              <Line label="Refunded" value={currency(stats.money.refundedMinor)} />
              <Text style={styles.footnote}>
                Commission is taken out of the gross, and its GST is contained within it —
                gross equals payouts plus commission.
              </Text>
            </Card>
          </FadeUp>
        </>
      ) : null}
    </AdminShell>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card pad={16} style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {note ? <Text style={styles.statNote}>{note}</Text> : null}
    </Card>
  );
}

function Line({ label, value, strong, muted }: {
  label: string; value: string; strong?: boolean; muted?: boolean;
}) {
  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, muted && styles.lineMuted]}>{label}</Text>
      <Text style={[styles.lineValue, strong && styles.lineStrong, muted && styles.lineMuted]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '46%', gap: 3 },
  statValue: { fontFamily: fonts.extra, fontSize: 26, color: colors.ink },
  statLabel: { fontFamily: fonts.semi, fontSize: 13, color: colors.muted },
  statNote: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 16, color: colors.sub },
  money: { gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5 },
  lineLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  lineValue: { fontFamily: fonts.semi, fontSize: 14, color: colors.ink },
  lineStrong: { fontFamily: fonts.extra, fontSize: 19 },
  lineMuted: { fontSize: 12, color: colors.sub },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: 10 },
  footnote: { marginTop: 10, fontFamily: fonts.sans, fontSize: 11, lineHeight: 17, color: colors.sub },
  callout: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: radius.lg, backgroundColor: colors.yellowTint,
  },
  calloutText: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.amberDeep },
});
