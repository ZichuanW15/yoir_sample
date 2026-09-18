import { Href, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
  // Four tiles to a row once there is room for them; two on a phone, as before.
  const wide = useWindowDimensions().width >= 860;

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
              <Stat wide={wide} label="Job seekers" value={stats.jobSeekers} />
              <Stat wide={wide} label="Counsellors" value={stats.counsellors} href="/admin/counsellors" />
              <Stat
                wide={wide}
                label="Awaiting review"
                value={stats.counsellorsPendingVerification}
                href="/admin/verifications"
              />
              <Stat
                wide={wide}
                label="Cannot be paid"
                value={stats.counsellorsAwaitingPayouts}
                note="Verified, but payouts not set up — nothing they list can be booked."
                href="/admin/counsellors"
                alert
              />
            </View>
          </FadeUp>

          <FadeUp delay={180} style={styles.section}>
            <Text style={type.groupLabel}>Activity</Text>
            <View style={styles.grid}>
              <Stat wide={wide} label="Active services" value={stats.servicesActive} />
              <Stat
                wide={wide}
                label="Holds awaiting payment"
                value={stats.ordersAwaitingPayment}
                href="/admin/payments"
              />
              {bookingOrder
                .filter((status) => stats.bookingsByStatus[status])
                .map((status) => (
                  <Stat
                    key={status}
                    wide={wide}
                    label={`${bookingLabel[status]} bookings`}
                    value={stats.bookingsByStatus[status]}
                    href="/admin/bookings"
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

/**
 * One number on the dashboard.
 *
 * A nought is greyed and a figure that wants attention is tinted, so the numbers
 * asking for a decision are the ones the eye lands on first. `alert` marks the two
 * counts that mean somebody is stuck — it only colours the tile once it is not nought.
 */
function Stat({ label, value, note, href, alert, wide }: {
  label: string; value: number; note?: string; href?: Href; alert?: boolean; wide?: boolean;
}) {
  const warn = Boolean(alert) && value > 0;
  return (
    <Card
      pad={16}
      accessibilityLabel={href ? `${label}: ${value}` : undefined}
      onPress={href ? () => router.replace(href) : undefined}
      style={[styles.stat, wide && styles.statWide, warn && styles.statWarn]}
    >
      <View style={styles.statTop}>
        <Text style={[styles.statValue, value === 0 && styles.statZero, warn && styles.statWarnInk]}>
          {value}
        </Text>
        {href ? <Glyph name="chevronRight" size={14} color={warn ? colors.amberInk : colors.mark} /> : null}
      </View>
      <Text style={[styles.statLabel, warn && styles.statWarnInk]}>{label}</Text>
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
  statWide: { flexBasis: '22%', maxWidth: 280 },
  statWarn: { backgroundColor: colors.yellowTint },
  statWarnInk: { color: colors.amberDeep },
  statTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statValue: { fontFamily: fonts.extra, fontSize: 26, color: colors.ink },
  statZero: { color: colors.mark },
  statLabel: { fontFamily: fonts.semi, fontSize: 13, color: colors.muted },
  statNote: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 16, color: colors.sub },
  money: { gap: 2, width: '100%', maxWidth: 620 },
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
