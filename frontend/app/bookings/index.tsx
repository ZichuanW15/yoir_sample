import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, userFacingError } from '@/src/api/client';
import { Booking } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { Glyph } from '@/src/components/Glyph';
import { BackBar } from '@/src/components/booking';
import { JobSeekerNav } from '@/src/components/JobSeekerNav';
import { TopBar } from '@/src/components/TopBar';
import { Button, Card, ErrorBanner, Press, Spinner, Tag } from '@/src/components/ui';
import { fmtLong, initials, modalityLabel, money, timeRange } from '@/src/format';
import { goBack } from '@/src/navigation';
import { FadeUp, ScreenIn } from '@/src/motion';
import { colors, fonts, radius, type } from '@/src/theme';

/** A session still to happen, and not called off. */
function isUpcoming(booking: Booking): boolean {
  if (booking.status === 'cancelled' || booking.status === 'refunded') return false;
  return new Date(booking.startsAt).getTime() > Date.now();
}

const statusTone: Record<string, { bg: string; fg: string }> = {
  confirmed: { bg: colors.greenTint, fg: colors.greenDeep },
  completed: { bg: colors.greenTint, fg: colors.greenDeep },
  paid_out: { bg: colors.greenTint, fg: colors.greenDeep },
  cancelled: { bg: colors.chip, fg: colors.muted },
  refunded: { bg: colors.yellowTint, fg: colors.amberInk },
};

const statusLabel: Record<string, string> = {
  confirmed: 'Confirmed',
  completed: 'Completed',
  paid_out: 'Paid out',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

/**
 * One screen for both roles: `GET /me/bookings` already returns every booking the
 * caller is a party to, and a counsellor's list of sessions to deliver differs from
 * a job seeker's list of sessions to attend only in who the other person is.
 */
export default function MyBookingsScreen() {
  const insets = useSafeAreaInsets();
  const { session, restoring } = useAuth();
  const { flash, confirm } = useChrome();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    try {
      setBookings(await api.listMyBookings(session.accessToken));
      setError('');
    } catch (value) {
      setError(userFacingError(value));
      setBookings([]);
    }
  }, [session]);

  useEffect(() => {
    if (!restoring && !session) router.replace('/auth/login');
  }, [restoring, session]);

  useEffect(() => {
    const run = async () => { await load(); };
    void run();
  }, [load]);

  const { upcoming, past } = useMemo(() => {
    const rows = bookings ?? [];
    return {
      // Soonest first among what is still to come, which is the one people scan for.
      upcoming: rows.filter(isUpcoming).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      past: rows.filter((row) => !isUpcoming(row)),
    };
  }, [bookings]);

  async function cancel(booking: Booking) {
    const ok = await confirm({
      title: 'Cancel this session?',
      message: 'Cancelling more than 24 hours before the session refunds it in full.',
      confirmLabel: 'Cancel session',
      cancelLabel: 'Keep it',
    });
    if (!ok || !session) return;
    setCancelling(booking.id);
    try {
      const result = await api.cancelBooking(booking.id, null, session.accessToken);
      flash(result.refundedMinor > 0 ? `Cancelled — ${money(result.refundedMinor)} refunded` : 'Session cancelled');
      await load();
    } catch (value) {
      setError(userFacingError(value));
    } finally {
      setCancelling('');
    }
  }

  if (restoring || bookings === null) {
    return (
      <View style={[styles.screen, styles.centred]}>
        <Spinner size={28} color={colors.green} />
      </View>
    );
  }

  return (
    <ScreenIn duration={450} style={styles.screen}>
      {/* A tab for a job seeker; a page off the workspace for a counsellor. */}
      {session?.user.role === 'job_seeker' ? <TopBar /> : (
        <BackBar title="My sessions" onBack={() => goBack('/counsellor')} />
      )}

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: 32 + insets.bottom }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.green}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
          />
        }
      >
        {session?.user.role === 'job_seeker' ? <Text style={type.display34}>My sessions</Text> : null}
        {error ? <ErrorBanner message={error} /> : null}

        {upcoming.length === 0 && past.length === 0 ? (
          <FadeUp delay={100} style={styles.empty}>
            <View style={styles.emptyBadge}>
              <Glyph name="calendar" size={26} color={colors.green} />
            </View>
            <Text style={type.display24}>Nothing booked yet</Text>
            <Text style={type.body}>
              {session?.user.role === 'counsellor'
                ? 'Sessions job seekers book with you will appear here.'
                : 'Find a Career Professional and book a session; it will appear here.'}
            </Text>
            {session?.user.role === 'job_seeker' ? (
              <Button label="Browse Career Professionals" height={52} onPress={() => router.push('/marketplace')} />
            ) : null}
          </FadeUp>
        ) : null}

        {upcoming.length > 0 ? (
          <FadeUp delay={100} style={styles.section}>
            <Text style={type.groupLabel}>Coming up</Text>
            {upcoming.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                busy={cancelling === booking.id}
                onCancel={() => cancel(booking)}
              />
            ))}
          </FadeUp>
        ) : null}

        {past.length > 0 ? (
          <FadeUp delay={200} style={styles.section}>
            <Text style={type.groupLabel}>Past</Text>
            {past.map((booking) => <BookingCard key={booking.id} booking={booking} past />)}
          </FadeUp>
        ) : null}
      </ScrollView>
      <JobSeekerNav />
    </ScreenIn>
  );
}

function BookingCard({ booking, past = false, busy = false, onCancel }: {
  booking: Booking;
  past?: boolean;
  busy?: boolean;
  onCancel?(): void;
}) {
  const tone = statusTone[booking.status] ?? statusTone.cancelled;
  const other = booking.counterpartyName || 'Yoir';

  return (
    <Card style={styles.card} pad={18}>
      <View style={styles.cardHead}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(other)}</Text></View>
        <View style={styles.cardCopy}>
          <Text style={styles.cardTitle}>{booking.serviceTitle}</Text>
          <Text style={type.small}>
            {booking.counterpartyRole === 'counsellor' ? 'With ' : 'For '}{other}
          </Text>
        </View>
        <Tag label={statusLabel[booking.status] ?? booking.status} bg={tone.bg} fg={tone.fg} />
      </View>

      <View style={styles.when}>
        <Glyph name="calendar" size={16} color={colors.muted} />
        <Text style={styles.whenText}>
          {fmtLong(booking.startsAt)} · {timeRange(booking.startsAt, booking.endsAt)}
        </Text>
      </View>
      <View style={styles.when}>
        <Glyph name={booking.modality === 'online' ? 'video' : 'pin'} size={16} color={colors.muted} />
        <Text style={styles.whenText}>
          {modalityLabel(booking.modality)}
          {booking.meetingArea ? ` · ${booking.meetingArea}` : ''}
          {booking.amountMinor ? ` · ${money(booking.amountMinor)}` : ''}
        </Text>
      </View>

      {!past && booking.meetingUrl ? (
        <Press
          accessibilityLabel="Join the session"
          scaleTo={0.97}
          style={styles.join}
          onPress={() => { void Linking.openURL(booking.meetingUrl as string); }}
        >
          <Glyph name="video" size={18} color={colors.white} />
          <Text style={styles.joinLabel}>Join the session</Text>
        </Press>
      ) : null}

      {!past && booking.modality === 'in_person' ? (
        <Text style={styles.note}>
          Your Career Professional confirms the exact meeting point before the session.
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button
          label="View receipt"
          tone="soft"
          height={44}
          labelSize={14}
          style={styles.action}
          onPress={() => router.push({ pathname: '/bookings/receipt', params: { bookingId: booking.id } })}
        />
        {!past && onCancel ? (
          <Button
            label={busy ? 'Cancelling' : 'Cancel'}
            tone="quiet"
            height={44}
            labelSize={14}
            busy={busy}
            style={styles.action}
            onPress={onCancel}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  centred: { alignItems: 'center', justifyContent: 'center' },
  body: { paddingTop: 12, paddingHorizontal: 20, gap: 26 },
  section: { gap: 12 },
  card: { gap: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 16, backgroundColor: colors.greenTint,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 14, color: colors.green },
  cardCopy: { flex: 1, gap: 2 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  when: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  whenText: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  join: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: radius.pill, backgroundColor: colors.green,
  },
  joinLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  note: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.sub },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
  empty: { alignItems: 'center', gap: 12, paddingTop: 60 },
  emptyBadge: {
    width: 56, height: 56, borderRadius: 20, backgroundColor: colors.greenTint,
    alignItems: 'center', justifyContent: 'center',
  },
});
