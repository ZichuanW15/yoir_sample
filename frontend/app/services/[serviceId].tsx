import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '@/src/navigation';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, Polyline, RadialGradient, Stop } from 'react-native-svg';
import { api, userFacingError } from '@/src/api/client';
import { Review, Service } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { Glyph } from '@/src/components/Glyph';
import { Avatar, Button, ErrorBanner, IconButton, Press, Spinner } from '@/src/components/ui';
import { initials, modalityLabel, money } from '@/src/format';
import { FadeUp, Float, Pop, Pulse, ScreenIn } from '@/src/motion';
import { colors, fonts, radius, shadow, type } from '@/src/theme';

/**
 * The hero's tag wash and the footer fade are the prototype's only translucent fills.
 * Both are derived from theme tokens rather than written as fresh colour literals.
 */
const HERO_TAG_BG = `${colors.canvas}24`;
const FADE_OUT = `${colors.white}00`;

/** US-46 — the three purchase steps, in the buyer's own words. */
const bookingSteps = [
  "Choose a time that suits you from the Career Professional's open slots.",
  'Pay through Yoir — this build uses a clearly labelled test payment.',
  'Get a confirmation with the reference, time and delivery details.',
];

export default function ServiceDetailScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [serviceError, setServiceError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!serviceId) return;
    let live = true;
    api.getService(serviceId)
      .then((found) => { if (live) setService(found); })
      .catch((value) => { if (live) setLoadError(userFacingError(value)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [serviceId, attempt]);

  const reload = () => {
    setLoading(true);
    setLoadError('');
    setAttempt((n) => n + 1);
  };

  // US-06 — an anonymous visitor logs in first and comes straight back to this booking;
  // a counsellor is told plainly that buying is not theirs to do.
  function bookService() {
    if (!service) return;
    if (!session) {
      router.push({ pathname: '/auth/login', params: { serviceId: service.id } });
      return;
    }
    if (session.user.role !== 'job_seeker') {
      setServiceError('Only Job Seekers can book a service.');
      return;
    }
    setServiceError('');
    router.push({ pathname: '/services/[serviceId]/timeslots', params: { serviceId: service.id } });
  }

  const counsellor = service?.counsellor;
  const verified = counsellor?.verificationStatus === 'verified';
  const modalities = service?.modalities ?? [];
  const heroTags = service
    ? [
      ...modalities.map(modalityLabel),
      service.averageRating !== null
        ? `★ ${service.averageRating.toFixed(1)} · ${service.reviewCount} reviews`
        : 'New on Yoir',
    ]
    : [];
  const deliveryCopy = `${modalities.map(modalityLabel).join(' or ')}${
    modalities.includes('online') ? '. Joining details are shared with your confirmation.' : '.'
  }`;
  const counsellorRating = counsellor && counsellor.overallRating !== null
    ? `${counsellor.overallRating.toFixed(1)} · ${counsellor.reviewCount} reviews`
    : 'No reviews yet';

  return (
    <ScreenIn style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <IconButton label="Back" tone="white" onPress={() => goBack('/marketplace')}>
          <BackChevron />
        </IconButton>
        <Text style={styles.barTitle}>Service details</Text>
        <View style={styles.spacer} />
      </View>

      {loading ? (
        <View style={styles.centre}><Spinner size={26} color={colors.green} /></View>
      ) : !service ? (
        <View style={styles.centreBody}>
          <ErrorBanner message={loadError || 'That service is no longer available.'} />
          <Press onPress={reload} scaleTo={0.96} accessibilityLabel="Try again" style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </Press>
        </View>
      ) : (
        <>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <FadeUp style={styles.hero}>
              <Pulse duration={5000} style={styles.heroGlow}><HeroGlow /></Pulse>
              <Float duration={4000} style={styles.heroDot}><View style={styles.dot} /></Float>

              <Text style={styles.heroEyebrow}>Career service</Text>
              <Text style={styles.heroTitle}>{service.title}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.heroPrice}>{money(service.priceMinor)}</Text>
                <Text style={styles.perSession}>per session</Text>
              </View>
              <View style={styles.heroTags}>
                {heroTags.map((tag) => (
                  <View key={tag} style={styles.heroTag}><Text style={styles.heroTagText}>{tag}</Text></View>
                ))}
              </View>
            </FadeUp>

            {serviceError ? <Pop duration={300}><ErrorBanner message={serviceError} /></Pop> : null}

            <FadeUp delay={100} style={styles.about}>
              <Text style={type.display24}>About this service</Text>
              <Text style={styles.aboutBody}>{service.description}</Text>
            </FadeUp>

            <FadeUp delay={180} style={styles.counsellorCard}>
              <View style={styles.counsellorRow}>
                <View style={styles.avatarRing}>
                  <Avatar initials={initials(counsellor?.displayName ?? '')} size={56} bg={colors.greenTint} fg={colors.ink} />
                </View>
                <View style={styles.counsellorWho}>
                  <Text style={styles.counsellorName}>{counsellor?.displayName}</Text>
                  <View style={[styles.verifyPill, { backgroundColor: verified ? colors.successBg : colors.yellowTint }]}>
                    <Text style={[styles.verifyText, { color: verified ? colors.successInk : colors.amberDeep }]}>
                      {verified ? 'Verified Career Professional' : 'Verification pending'}
                    </Text>
                  </View>
                </View>
              </View>
              {counsellor?.introduction ? <Text style={styles.counsellorIntro}>{counsellor.introduction}</Text> : null}
              <View style={styles.counsellorRating}>
                <Star />
                <Text style={styles.counsellorRatingText}>{counsellorRating}</Text>
              </View>
              {counsellor ? (
                <Press
                  onPress={() => router.push({ pathname: '/professionals/[counsellorId]', params: { counsellorId: counsellor.id } })}
                  accessibilityLabel={`View ${counsellor.displayName}'s full profile`}
                  style={styles.profileLink}
                >
                  <Text style={styles.profileLinkText}>View full profile</Text>
                  <Glyph name="chevronRight" size={16} color={colors.green} />
                </Press>
              ) : null}
            </FadeUp>

            <FadeUp delay={260} style={styles.delivery}>
              <Text style={type.display24}>How it is delivered</Text>
              <View style={styles.deliveryRow}>
                <View style={styles.deliveryMark}><Glyph name="video" size={16} color={colors.green} /></View>
                <Text style={styles.deliveryCopy}>{deliveryCopy}</Text>
              </View>
              {service.location ? (
                <View style={styles.locationRow}>
                  <Text style={styles.locationLabel}>In-person area</Text>
                  <Text style={styles.locationValue}>{`${service.location.cityOrRegion}, ${service.location.state}`}</Text>
                </View>
              ) : null}
            </FadeUp>

            <FadeUp delay={300} style={styles.reviews}>
              <View style={styles.reviewsHead}>
                <Text style={type.display24}>Reviews</Text>
                <Text style={styles.reviewsSummary}>
                  {service.averageRating === null ? 'No reviews yet' : `${service.averageRating.toFixed(1)} · ${service.reviewCount}`}
                </Text>
              </View>
              {(service.reviews ?? []).length ? (
                (service.reviews ?? []).map((review) => <ReviewRow key={review.id} review={review} />)
              ) : (
                <View style={styles.noReviews}>
                  <Glyph name="star" size={22} color={colors.amber} />
                  <Text style={styles.noReviewsText}>No written reviews yet.</Text>
                </View>
              )}
            </FadeUp>

            <FadeUp delay={340} style={styles.steps}>
              <Text style={styles.stepsTitle}>Booking this service</Text>
              {bookingSteps.map((copy, index) => (
                <View key={copy} style={styles.stepRow}>
                  <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View>
                  <Text style={styles.stepCopy}>{copy}</Text>
                </View>
              ))}
            </FadeUp>
          </ScrollView>

          <LinearGradient
            colors={[FADE_OUT, colors.white, colors.white]}
            locations={[0, 0.3, 1]}
            style={[styles.footer, { paddingBottom: 22 + insets.bottom }]}
          >
            <Button
              label="Book this service"
              height={58}
              onPress={bookService}
              icon={<Glyph name="calendar" size={18} color={colors.white} />}
              style={shadow.toast}
            />
          </LinearGradient>
        </>
      )}
    </ScreenIn>
  );
}

function ReviewRow({ review }: { review: Review }) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHead}>
        <Text style={styles.reviewAuthor}>{review.authorName || 'Yoir member'}</Text>
        <View style={styles.reviewRating}><Star /><Text style={styles.reviewRatingText}>{review.rating}/5</Text></View>
      </View>
      <Text style={styles.reviewComment}>{review.comment}</Text>
      <Text style={styles.reviewDate}>{new Date(review.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
    </View>
  );
}

function BackChevron() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Polyline
        points="14.5,5 7.5,12 14.5,19"
        fill="none"
        stroke={colors.green}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** The hero's soft yellow bloom, drawn as a radial gradient the way the prototype does. */
function HeroGlow() {
  return (
    <Svg width={150} height={150} viewBox="0 0 150 150">
      <Defs>
        <RadialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors.yellow} stopOpacity={0.3} />
          <Stop offset="0.7" stopColor={colors.yellow} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={75} cy={75} r={75} fill="url(#heroGlow)" />
    </Svg>
  );
}

function Star() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill={colors.amber} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 16 },
  barTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  spacer: { width: 44 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centreBody: { flex: 1, gap: 14, paddingHorizontal: 22, paddingTop: 24 },
  retry: { alignSelf: 'flex-start', height: 40, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontFamily: fonts.bold, fontSize: 13, color: colors.green },

  scroll: { flex: 1 },
  body: { paddingTop: 6, paddingHorizontal: 22, paddingBottom: 24, gap: 20 },

  hero: { overflow: 'hidden', backgroundColor: colors.green, borderRadius: radius.xxl, paddingVertical: 26, paddingHorizontal: 24, gap: 14 },
  heroGlow: { position: 'absolute', right: -20, top: -20 },
  heroDot: { position: 'absolute', right: 26, top: 26 },
  dot: { width: 14, height: 14, borderRadius: radius.pill, backgroundColor: colors.yellow },
  heroEyebrow: { ...type.eyebrow, color: colors.yellow },
  heroTitle: { fontFamily: fonts.serif, fontSize: 32, lineHeight: 34, letterSpacing: -0.3, color: colors.white, paddingRight: 30 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  heroPrice: { fontFamily: fonts.extra, fontSize: 30, letterSpacing: -0.5, color: colors.white },
  perSession: { fontFamily: fonts.sans, fontSize: 13, color: colors.onDarkMuted },
  heroTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  heroTag: { paddingVertical: 7, paddingHorizontal: 11, borderRadius: radius.pill, backgroundColor: HERO_TAG_BG },
  heroTagText: { fontFamily: fonts.semi, fontSize: 12, color: colors.white },

  about: { gap: 8 },
  aboutBody: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 24, color: colors.muted },

  counsellorCard: { gap: 14, padding: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.xl },
  counsellorRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarRing: { padding: 2, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.yellow, backgroundColor: colors.white },
  counsellorWho: { flex: 1, gap: 4 },
  counsellorName: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
  verifyPill: { alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 9, borderRadius: radius.pill },
  verifyText: { fontFamily: fonts.bold, fontSize: 12 },
  counsellorIntro: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 22, color: colors.muted },
  counsellorRating: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  counsellorRatingText: { fontFamily: fonts.bold, fontSize: 13, color: colors.amberDeep },
  profileLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.lineSoft,
  },
  profileLinkText: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.green },

  delivery: { gap: 10 },
  deliveryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  deliveryMark: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' },
  deliveryCopy: { flex: 1, fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, color: colors.muted },
  locationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  locationLabel: { fontFamily: fonts.semi, fontSize: 14, color: colors.muted },
  locationValue: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },

  reviews: { gap: 12 },
  reviewsHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  reviewsSummary: { fontFamily: fonts.bold, fontSize: 13, color: colors.amberDeep },
  noReviews: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 16, borderRadius: radius.lg, backgroundColor: colors.yellowTint },
  noReviewsText: { fontFamily: fonts.sans, fontSize: 14, color: colors.amberDeep },
  reviewCard: { gap: 8, padding: 16, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.lg, backgroundColor: colors.white },
  reviewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  reviewAuthor: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  reviewRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reviewRatingText: { fontFamily: fonts.bold, fontSize: 13, color: colors.amberDeep },
  reviewComment: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 22, color: colors.muted },
  reviewDate: { fontFamily: fonts.medium, fontSize: 12, color: colors.sub },

  steps: { gap: 14, padding: 20, backgroundColor: colors.yellowTint, borderRadius: radius.xl },
  stepsTitle: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 25, color: colors.amberDeep },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNumber: { width: 30, height: 30, borderRadius: radius.pill, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontFamily: fonts.extra, fontSize: 13, color: colors.green },
  stepCopy: { flex: 1, paddingTop: 5, fontFamily: fonts.sans, fontSize: 14, lineHeight: 22, color: colors.amberDeep },

  footer: { paddingTop: 14, paddingHorizontal: 22 },
});
