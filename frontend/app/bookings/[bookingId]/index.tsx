import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, userFacingError } from '@/src/api/client';
import { Booking } from '@/src/api/types';
import { isUpcoming, statusLabel, statusTone } from '@/app/bookings';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { Glyph } from '@/src/components/Glyph';
import { BackBar } from '@/src/components/booking';
import { Button, Card, ErrorBanner, Field, Press, Spinner, Tag } from '@/src/components/ui';
import { BackPill, DesktopPage, useDesktop } from '@/src/desktop';
import { deviceTimezone, fmtLong, initials, modalityLabel, timeRange } from '@/src/format';
import { FadeUp, ScreenIn } from '@/src/motion';
import { colors, fonts, radius, type } from '@/src/theme';

/** Trimmed to null, the way the backend itself normalises it. */
const toSend = (value: string) => value.trim() || null;

export default function BookingDetailScreen() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { session, restoring } = useAuth();
  const { flash } = useChrome();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState('');
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressDraft, setAddressDraft] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState('');

  const load = useCallback(async () => {
    if (!session || !bookingId) return;
    try {
      const found = await api.getBooking(bookingId, session.accessToken);
      setBooking(found);
      setError('');
    } catch (value) {
      setError(userFacingError(value));
    }
  }, [session, bookingId]);

  useEffect(() => {
    const run = async () => { await load(); };
    void run();
  }, [load]);

  if (!restoring && !session) return <Redirect href="/auth/login" />;
  if (restoring || (booking === null && !error)) {
    return (
      <View style={[styles.screen, styles.centred]}>
        <Spinner size={28} color={colors.green} />
      </View>
    );
  }

  const startEditing = () => {
    setAddressDraft(booking?.meetingAddress ?? '');
    setAddressError('');
    setEditingAddress(true);
  };

  const saveAddress = async () => {
    if (!session || !booking) return;
    setSavingAddress(true);
    setAddressError('');
    try {
      const updated = await api.updateBookingMeetingAddress(booking.id, toSend(addressDraft), session.accessToken);
      setBooking(updated);
      setEditingAddress(false);
      flash('Meeting address saved');
    } catch (value) {
      setAddressError(userFacingError(value));
    } finally {
      setSavingAddress(false);
    }
  };

  const isCounsellor = session?.user.role === 'counsellor';
  // The other party, from the AC's own wording: "shows the participants" — the
  // viewer trivially knows who they are, so this names who they are with.
  const other = booking?.counterpartyName || 'Yoir';
  const tone = booking ? (statusTone[booking.status] ?? statusTone.cancelled) : statusTone.cancelled;
  const upcoming = booking ? isUpcoming(booking) : false;
  const canEditAddress = isCounsellor && upcoming && booking?.modality === 'in_person';

  // Shared by the mobile and desktop layouts, which differ only in where these sit.
  const summaryCard = booking ? (
    <Card style={styles.gap} pad={20}>
      <View style={styles.head}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(other)}</Text></View>
        <View style={styles.headCopy}>
          <Text style={type.display24}>{booking.serviceTitle}</Text>
          <Text style={type.small}>{booking.counterpartyRole === 'counsellor' ? 'With ' : 'For '}{other}</Text>
        </View>
        <Tag label={statusLabel[booking.status] ?? booking.status} bg={tone.bg} fg={tone.fg} />
      </View>

      <View style={styles.row}>
        <Glyph name="calendar" size={16} color={colors.muted} />
        <Text style={styles.rowText}>
          {fmtLong(booking.startsAt)} · {timeRange(booking.startsAt, booking.endsAt)} · {deviceTimezone()}
        </Text>
      </View>
      <View style={styles.row}>
        <Glyph name={booking.modality === 'online' ? 'video' : 'pin'} size={16} color={colors.muted} />
        <Text style={styles.rowText}>{modalityLabel(booking.modality)}</Text>
      </View>

      {upcoming && booking.status === 'confirmed' ? (
        <Button
          label="Reschedule"
          tone="outline"
          height={46}
          style={desktop ? styles.desktopInline : undefined}
          onPress={() => router.push({ pathname: '/bookings/[bookingId]/reschedule', params: { bookingId: booking.id } })}
        />
      ) : null}
    </Card>
  ) : null;

  const briefCard = booking?.preSessionBrief ? (
    <Card style={styles.gap} pad={20}>
      <Text style={type.groupLabel}>Before the session</Text>
      <Text style={type.body}>{booking.preSessionBrief}</Text>
    </Card>
  ) : null;

  const meetCard = booking ? (
    <Card style={styles.gap} pad={20}>
      <Text style={type.groupLabel}>{booking.modality === 'online' ? 'Joining online' : 'Where to meet'}</Text>

      {booking.modality === 'online' ? (
        booking.meetingUrl ? (
          <Press
            accessibilityLabel="Join the session"
            scaleTo={0.97}
            style={styles.join}
            onPress={() => { void Linking.openURL(booking.meetingUrl as string); }}
          >
            <Glyph name="video" size={18} color={colors.white} />
            <Text style={styles.joinLabel}>Join the session</Text>
          </Press>
        ) : (
          <Text style={type.body}>A meeting link hasn&apos;t been set up yet.</Text>
        )
      ) : (
        <>
          {booking.meetingArea ? <Text style={type.small}>General area: {booking.meetingArea}</Text> : null}
          {booking.meetingAddress ? (
            <Text style={type.body}>{booking.meetingAddress}</Text>
          ) : (
            <Text style={type.body}>
              {isCounsellor
                ? "You haven't added a specific meeting address yet."
                : "Your Career Professional hasn't added a specific address yet."}
            </Text>
          )}

          {canEditAddress && !editingAddress ? (
            <Button
              label={booking.meetingAddress ? 'Edit address' : 'Add address'}
              tone="outline"
              height={48}
              onPress={startEditing}
            />
          ) : null}

          {canEditAddress && editingAddress ? (
            <View style={styles.gap}>
              <Field
                label="Meeting address"
                value={addressDraft}
                onChangeText={setAddressDraft}
                placeholder="e.g. Level 4, 123 Collins St, Melbourne"
                maxLength={300}
              />
              {addressError ? <ErrorBanner message={addressError} /> : null}
              <View style={styles.editActions}>
                <Button
                  label="Cancel"
                  tone="quiet"
                  height={44}
                  style={styles.editAction}
                  onPress={() => { setEditingAddress(false); setAddressError(''); }}
                />
                <Button
                  label="Save address"
                  height={44}
                  busy={savingAddress}
                  style={styles.editAction}
                  onPress={() => { void saveAddress(); }}
                />
              </View>
            </View>
          ) : null}
        </>
      )}
    </Card>
  ) : null;

  if (desktop) {
    return (
      <DesktopPage>
        <BackPill label="My sessions" accessibilityLabel="Go back" onPress={() => router.replace('/bookings')} />
        {error ? (
          <View style={styles.gap}>
            <ErrorBanner message={error} />
            <Button label="Try again" tone="outline" height={48} onPress={() => { void load(); }} />
          </View>
        ) : booking ? (
          <View style={styles.desktopColumns}>
            <View style={styles.desktopColumn}>
              {summaryCard}
              {briefCard}
            </View>
            <View style={styles.desktopColumn}>{meetCard}</View>
          </View>
        ) : null}
      </DesktopPage>
    );
  }

  return (
    <ScreenIn style={styles.screen}>
      <BackBar title="Booking details" onBack={() => router.replace('/bookings')} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 30 + insets.bottom }]}>
        {error ? (
          <View style={styles.gap}>
            <ErrorBanner message={error} />
            <Button label="Try again" tone="outline" height={48} onPress={() => { void load(); }} />
          </View>
        ) : booking ? (
          <FadeUp style={styles.gap}>
            {summaryCard}

            {briefCard}

            {meetCard}
          </FadeUp>
        ) : null}
      </ScrollView>
    </ScreenIn>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  centred: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: 22, gap: 16 },
  gap: { gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48, height: 48, borderRadius: 16, backgroundColor: colors.greenTint,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 15, color: colors.green },
  headCopy: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowText: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  join: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: radius.pill, backgroundColor: colors.green,
  },
  joinLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  editActions: { flexDirection: 'row', gap: 10 },
  editAction: { flex: 1 },

  desktopColumns: { flexDirection: 'row', alignItems: 'flex-start', gap: 22 },
  desktopColumn: { flex: 1, minWidth: 0, gap: 18 },
  desktopInline: { alignSelf: 'flex-start' },
});
