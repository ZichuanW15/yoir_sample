import { Href, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, userFacingError } from '@/src/api/client';
import { Booking } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { Glyph } from '@/src/components/Glyph';
import { BackBar } from '@/src/components/booking';
import { CounsellorNav } from '@/src/components/CounsellorNav';
import { JobSeekerNav } from '@/src/components/JobSeekerNav';
import { TopBar } from '@/src/components/TopBar';
import { Button, Card, ErrorBanner, Press, Spinner, Tag } from '@/src/components/ui';
import { deviceTimezone, fmtLong, initials, modalityLabel, money, timeRange } from '@/src/format';
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
  // Both sections stay reachable even when one is empty, so "no past sessions" reads
  // as a confirmed fact rather than a section that silently never showed up.
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

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
      {/* A tab for both a job seeker and a counsellor now — the same three-section
          bottom nav shape, just with different destinations either side of it. */}
      {session?.user.role === 'job_seeker' || session?.user.role === 'counsellor' ? <TopBar /> : (
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
        {session?.user.role === 'job_seeker' || session?.user.role === 'counsellor' ? <Text style={type.display34}>My sessions</Text> : null}
        {error ? <ErrorBanner message={error} /> : null}

        <View style={styles.tabs} accessibilityRole="tablist">
          <Press
            onPress={() => setTab('upcoming')}
            accessibilityRole="tab"
            accessibilityLabel="Coming up"
            accessibilityState={{ selected: tab === 'upcoming' }}
            style={[styles.tab, tab === 'upcoming' && styles.tabActive]}
          >
            <Text style={[styles.tabLabel, tab === 'upcoming' && styles.tabLabelActive]}>Coming up</Text>
          </Press>
          <Press
            onPress={() => setTab('past')}
            accessibilityRole="tab"
            accessibilityLabel="Past"
            accessibilityState={{ selected: tab === 'past' }}
            style={[styles.tab, tab === 'past' && styles.tabActive]}
          >
            <Text style={[styles.tabLabel, tab === 'past' && styles.tabLabelActive]}>Past</Text>
          </Press>
        </View>

        {tab === 'upcoming' ? (
          upcoming.length > 0 ? (
            <FadeUp delay={80} style={styles.section}>
              {upcoming.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  busy={cancelling === booking.id}
                  onCancel={() => cancel(booking)}
                />
              ))}
            </FadeUp>
          ) : (
            <FadeUp delay={80} style={styles.empty}>
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
          )
        ) : past.length > 0 ? (
          <FadeUp delay={80} style={styles.section}>
            {past.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                past
                canReview={session?.user.role === 'job_seeker' && ['completed', 'paid_out'].includes(booking.status) && !booking.review}
              />
            ))}
          </FadeUp>
        ) : (
          <FadeUp delay={80} style={styles.empty}>
            <View style={styles.emptyBadge}>
              <Glyph name="calendar" size={26} color={colors.green} />
            </View>
            <Text style={type.display24}>No past sessions</Text>
            <Text style={type.body}>Sessions you&apos;ve completed will appear here.</Text>
          </FadeUp>
        )}
      </ScrollView>
      <JobSeekerNav />
      <CounsellorNav />
    </ScreenIn>
  );
}

function BookingCard({ booking, past = false, busy = false, canReview = false, onCancel }: {
  booking: Booking;
  past?: boolean;
  busy?: boolean;
  canReview?: boolean;
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
          {fmtLong(booking.startsAt)} · {timeRange(booking.startsAt, booking.endsAt)} · {deviceTimezone()}
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

      {!past && booking.counterpartyRole === 'job_seeker' && booking.preSessionBrief ? (
        <View style={styles.brief}>
          <Text style={styles.briefLabel}>Before the session</Text>
          <Text style={styles.briefText}>{booking.preSessionBrief}</Text>
        </View>
      ) : null}

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
        {canReview ? (
          <Button
            label="Write a review"
            tone="outline"
            height={44}
            labelSize={14}
            style={styles.action}
            onPress={() => router.push(`/bookings/${booking.id}/review` as Href)}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  centred: { alignItems: 'center', justifyContent: 'center' },
  body: { paddingTop: 12, paddingHorizontal: 20, gap: 20 },
  tabs: { flexDirection: 'row', gap: 4, backgroundColor: colors.chip, borderRadius: radius.pill, padding: 4 },
  tab: { flex: 1, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.white },
  tabLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
  tabLabelActive: { color: colors.ink },
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
  brief: { gap: 4, padding: 12, borderRadius: radius.md, backgroundColor: colors.greenTint },
  briefLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.greenDeep },
  briefText: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.ink },
  note: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.sub },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
  empty: { alignItems: 'center', gap: 12, paddingTop: 60 },
  emptyBadge: {
    width: 56, height: 56, borderRadius: 20, backgroundColor: colors.greenTint,
    alignItems: 'center', justifyContent: 'center',
  },
});
