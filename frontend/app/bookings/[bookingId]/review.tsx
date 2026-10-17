import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, userFacingError } from '@/src/api/client';
import { Booking } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { BackBar } from '@/src/components/booking';
import { StarMark } from '@/src/components/Glyph';
import { Button, Card, ErrorBanner, Field, Press, Spinner } from '@/src/components/ui';
import { BackPill, DesktopPage, useDesktop } from '@/src/desktop';
import { goBack, homeFor } from '@/src/navigation';
import { ScreenIn } from '@/src/motion';
import { colors, fonts, radius, type } from '@/src/theme';

/** US-53 — review entry is reachable only from an eligible completed booking. */
export default function ReviewBookingScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const { session } = useAuth();
  const { flash } = useChrome();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session || !bookingId) return;
    let live = true;
    api.getBooking(bookingId, session.accessToken)
      .then((found) => { if (live) setBooking(found); })
      .catch((cause) => { if (live) setError(userFacingError(cause)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [bookingId, session]);

  if (!session) return <Redirect href="/auth/login" />;
  if (session.user.role !== 'job_seeker') return <Redirect href={homeFor(session.user.role)} />;

  const eligible = booking && (booking.status === 'completed' || booking.status === 'paid_out') && !booking.review;
  const submit = async () => {
    if (!booking) return;
    if (rating < 1 || rating > 5) return setError('Choose a star rating from 1 to 5.');
    if (!comment.trim()) return setError('Write a short review before submitting.');
    setSaving(true);
    setError('');
    try {
      await api.createReview(booking.id, { rating, comment: comment.trim() }, session.accessToken);
      flash('Review submitted');
      router.replace({ pathname: '/services/[serviceId]', params: { serviceId: booking.serviceId } });
    } catch (cause) {
      setError(userFacingError(cause));
    } finally {
      setSaving(false);
    }
  };

  // Shared by the mobile and desktop layouts; desktop only frames it differently.
  const content = loading ? <View style={styles.loading}><Spinner size={28} color={colors.green} /></View> : !booking ? (
    <ErrorBanner message={error || 'That booking is not available.'} />
  ) : !eligible ? (
    <Card style={styles.card}>
      <Text style={type.display24}>{booking.review ? 'Review already submitted' : 'This session is not ready to review'}</Text>
      <Text style={type.body}>{booking.review ? 'Each completed booking can be reviewed once.' : 'Reviews become available after the session is completed.'}</Text>
      <Button label="Back to My sessions" tone="outline" onPress={() => router.replace('/bookings')} />
    </Card>
  ) : (
    <Card style={styles.card}>
      <View style={styles.heading}>
        <Text style={type.eyebrow}>Completed session</Text>
        <Text style={type.display24}>{booking.serviceTitle}</Text>
        <Text style={type.body}>How was your session with {booking.counterpartyName || 'your Career Professional'}?</Text>
      </View>
      <View style={styles.ratingGroup}>
        <Text style={styles.label}>Star rating</Text>
        <View accessibilityRole="radiogroup" style={styles.stars}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Press
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
              accessibilityState={{ checked: rating === value, selected: rating === value }}
              onPress={() => setRating(value)}
              style={[styles.star, rating >= value && styles.starSelected]}
            >
              <StarMark size={24} color={rating >= value ? colors.amber : colors.line} />
            </Press>
          ))}
        </View>
      </View>
      <Field label="Your review" value={comment} onChangeText={setComment} multiline maxLength={2000} placeholder="What was useful about the session?" />
      {error ? <ErrorBanner message={error} /> : null}
      <Button label="Submit review" busy={saving} onPress={() => { void submit(); }} />
    </Card>
  );

  if (desktop) {
    return (
      <DesktopPage>
        <BackPill label="My sessions" accessibilityLabel="Go back" onPress={() => goBack('/bookings')} />
        <View style={styles.desktopColumn}>{content}</View>
      </DesktopPage>
    );
  }

  return (
    <ScreenIn style={styles.screen}>
      <BackBar title="Review your session" onBack={() => goBack('/bookings')} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 28 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        {content}
      </ScrollView>
    </ScreenIn>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  body: { padding: 22 },
  loading: { paddingVertical: 50, alignItems: 'center' },
  card: { gap: 20 },
  heading: { gap: 8 },
  ratingGroup: { gap: 9 },
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  stars: { flexDirection: 'row', gap: 8 },
  star: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  starSelected: { borderColor: colors.amber, backgroundColor: colors.yellowTint },

  desktopColumn: { width: '100%', maxWidth: 640 },
});
