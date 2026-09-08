import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { api, userFacingError } from '@/src/api/client';
import { AvailabilitySlot, CounsellorProfile, Service } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { Glyph } from '@/src/components/Glyph';
import { Avatar, ErrorBanner, Eyebrow, Press, Tag } from '@/src/components/ui';
import { fmtDay, initials, modalityLabel, money } from '@/src/format';
import { FadeUp, Float, Pop, Pulse, ScreenIn } from '@/src/motion';
import { colors, fonts, radius, type } from '@/src/theme';

const ACircle = Animated.createAnimatedComponent(Circle);
/** LinkedIn URL, introduction, background, experience, base location. */
const TOTAL_SECTIONS = 5;
const RING = 264;

interface Workspace {
  profile: CounsellorProfile;
  services: Service[];
  slots: AvailabilitySlot[];
}

export default function CounsellorWorkspace() {
  const { session } = useAuth();
  const { openSheet } = useChrome();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const [profile, services, slots] = await Promise.all([
        api.getOwnCounsellorProfile(session.user, session.accessToken),
        api.listOwnServices(session.user.id, session.accessToken),
        api.listOwnAvailabilitySlots(session.user.id, session.accessToken),
      ]);
      setData({ profile, services, slots });
      setError('');
    } catch (cause) {
      setError(userFacingError(cause));
    }
  }, [session]);

  // The workspace is the hub every counsellor screen returns to, so it re-reads
  // its data on focus rather than only on mount.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!session || session.user.role !== 'counsellor') return <Redirect href="/" />;

  const name = session.user.name;
  const firstName = name.split(' ')[0];
  const verified = data?.profile.verificationStatus === 'verified';
  const done = data
    ? [data.profile.linkedinUrl, data.profile.introduction, data.profile.background, data.profile.experience, data.profile.baseLocation?.state]
      .filter(Boolean).length
    : 0;
  const services = data?.services ?? [];
  const openSlots = (data?.slots ?? [])
    .filter((slot) => slot.status === 'open')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    <ScreenIn style={s.screen}>
      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <Image source={require('@/assets/images/yoir-wordmark.png')} style={s.wordmark} accessibilityLabel="Yoir" />
        <Press onPress={openSheet} scaleTo={0.92} accessibilityLabel={`Account, ${name}`} style={s.avatarRing}>
          <Avatar initials={initials(name)} size={42} />
        </Press>
      </View>

      <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <FadeUp style={s.greeting}>
          <Eyebrow>Your workspace</Eyebrow>
          <Text style={type.display34}>Good to see you, {firstName}</Text>
        </FadeUp>

        {error ? <ErrorBanner message={error} /> : null}

        <FadeUp delay={80} style={s.verify}>
          <Pulse style={s.verifyGlow} duration={5000}>
            <Svg width={120} height={120}>
              <Defs>
                <RadialGradient id="verifyGlow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={colors.yellow} stopOpacity={0.28} />
                  <Stop offset="0.7" stopColor={colors.yellow} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={60} cy={60} r={60} fill="url(#verifyGlow)" />
            </Svg>
          </Pulse>
          <Float style={s.verifyDot} distance={9} duration={4000}><View style={s.verifyDotFill} /></Float>
          <Pop delay={300}>
            <View style={s.verifyTile}>
              <View style={s.verifyTileWash} />
              <Glyph name="shieldCheck" size={26} color={colors.yellow} />
            </View>
          </Pop>
          <View style={s.verifyCopy}>
            <Text style={s.verifyEyebrow}>Verification</Text>
            <Text style={s.verifyTitle}>{verified ? 'Verified counsellor' : 'Verification pending'}</Text>
            <Text style={s.verifyBody}>
              {verified
                ? 'Your profile carries the verified mark across the Marketplace.'
                : data?.profile.linkedinUrl
                  ? 'Your LinkedIn profile is with the Platform Owner for review.'
                  : 'Add your LinkedIn profile URL so the Platform Owner can verify you.'}
            </Text>
          </View>
        </FadeUp>

        <FadeUp delay={160}>
          <Press
            onPress={() => router.push('/counsellor/profile')}
            scaleTo={0.98}
            accessibilityLabel="Professional profile"
            style={s.profileCard}
          >
            <ProfileRing done={done} />
            <View style={s.profileCopy}>
              <Text style={s.rowTitle}>Professional profile</Text>
              <Text style={s.rowSub}>
                {done === TOTAL_SECTIONS ? 'All sections complete. Looking sharp.' : `${done} of ${TOTAL_SECTIONS} sections complete.`}
              </Text>
            </View>
            <View style={s.profilePill}><Text style={s.profilePillText}>{done ? 'Edit' : 'Set up'}</Text></View>
          </Press>
        </FadeUp>

        <FadeUp delay={220} style={s.sectionHead}>
          <View style={s.sectionCopy}>
            <Eyebrow style={s.sectionEyebrow}>My services</Eyebrow>
            <Text style={type.display24}>{services.length ? `${services.length} published` : 'No services yet'}</Text>
          </View>
          <Press onPress={() => router.push('/counsellor/services/new')} scaleTo={0.95} accessibilityLabel="New" style={s.newPill}>
            <Glyph name="plus" size={14} color={colors.white} />
            <Text style={s.newPillText}>New</Text>
          </Press>
        </FadeUp>

        {services.map((service, index) => (
          <FadeUp key={service.id} delay={240 + index * 60}>
            <View style={s.serviceCard}>
              <View style={s.serviceHead}>
                <View style={s.serviceTile}><Glyph name="briefcase" size={18} color={colors.green} /></View>
                <Text style={s.serviceTitle}>{service.title}</Text>
                <Text style={s.servicePrice}>{money(service.priceMinor)}</Text>
              </View>
              <Text style={s.serviceBody} numberOfLines={2}>{service.description}</Text>
              <View style={s.tagRow}>
                {service.modalities.map((modality) => (
                  <Tag key={modality} label={modalityLabel(modality)} />
                ))}
                {service.location ? (
                  <Tag
                    label={`${service.location.cityOrRegion}, ${service.location.state}`}
                    bg={colors.yellowTint}
                    fg={colors.amberDeep}
                  />
                ) : null}
                <Tag
                  label={`${(data?.slots ?? []).filter((slot) => slot.serviceId === service.id && slot.status === 'open').length} open slots`}
                  bg={colors.greenTint}
                  fg={colors.successInk}
                />
              </View>
            </View>
          </FadeUp>
        ))}

        {data && !services.length ? (
          <Press
            onPress={() => router.push('/counsellor/services/new')}
            scaleTo={0.98}
            accessibilityLabel="Publish your first service"
            style={s.emptyServices}
          >
            <Float style={s.emptyMark} distance={9} duration={4000}>
              <View style={s.emptyMarkFill}><Glyph name="plus" size={24} color={colors.eyebrow} /></View>
            </Float>
            <Text style={s.emptyTitle}>Publish your first service</Text>
            <Text style={s.emptyBody}>Describe what you offer, set a price and say how you deliver it.</Text>
          </Press>
        ) : null}

        <FadeUp delay={300}>
          <Press
            onPress={() => router.push('/counsellor/availability')}
            scaleTo={0.98}
            accessibilityLabel="Availability"
            style={s.availCard}
          >
            <View style={s.availTile}><Glyph name="calendar" size={22} color={colors.green} /></View>
            <View style={s.availCopy}>
              <Text style={s.availTitle}>Availability</Text>
              <Text style={s.availHint}>
                {openSlots.length
                  ? `${openSlots.length} open slots. Next on ${fmtDay(openSlots[0].startsAt)}.`
                  : 'No open slots. Add availability so buyers can choose a time.'}
              </Text>
            </View>
            <Glyph name="chevronRight" size={18} color={colors.amberInk} />
          </Press>
        </FadeUp>

      </ScrollView>
    </ScreenIn>
  );
}

/** The four-section completeness ring: it sweeps to its share on entry. */
function ProfileRing({ done }: { done: number }) {
  const [offset] = useState(() => new Animated.Value(RING));
  useEffect(() => {
    const anim = Animated.timing(offset, {
      toValue: RING * (1 - done / TOTAL_SECTIONS),
      duration: 1200,
      delay: 300,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [offset, done]);

  return (
    <View style={s.ring}>
      <Svg width={64} height={64} viewBox="0 0 96 96" style={s.ringSvg}>
        <Circle cx={48} cy={48} r={42} fill="none" stroke={colors.greenTint} strokeWidth={8} />
        <ACircle
          cx={48} cy={48} r={42} fill="none" stroke={colors.greenDeep} strokeWidth={8}
          strokeLinecap="round" strokeDasharray="264" strokeDashoffset={offset}
        />
      </Svg>
      <View style={s.ringLabel}><Text style={s.ringText}>{done}/{TOTAL_SECTIONS}</Text></View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingBottom: 6 },
  wordmark: { width: 66, height: 25, resizeMode: 'contain' },
  avatarRing: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: colors.yellow, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },

  body: { paddingHorizontal: 22, paddingTop: 8, gap: 18 },
  greeting: { gap: 8 },

  verify: { position: 'relative', overflow: 'hidden', backgroundColor: colors.green, borderRadius: radius.xxl, padding: 22, flexDirection: 'row', alignItems: 'center', gap: 16 },
  verifyGlow: { position: 'absolute', right: -20, top: -20 },
  verifyDot: { position: 'absolute', right: 24, bottom: 18 },
  verifyDotFill: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.yellow },
  verifyTile: { width: 52, height: 52, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  verifyTileWash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.white, opacity: 0.14 },
  verifyCopy: { flex: 1, gap: 4 },
  verifyEyebrow: { fontFamily: fonts.extra, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.yellow },
  verifyTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.white },
  verifyBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: colors.onDarkMuted },

  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.xl },
  ring: { width: 64, height: 64 },
  ringSvg: { transform: [{ rotate: '-90deg' }] },
  ringLabel: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringText: { fontFamily: fonts.extra, fontSize: 14, color: colors.ink },
  profileCopy: { flex: 1, gap: 3 },
  rowTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  rowSub: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.muted },
  profilePill: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' },
  profilePillText: { fontFamily: fonts.bold, fontSize: 13, color: colors.green },

  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionCopy: { gap: 4 },
  sectionEyebrow: { letterSpacing: 1.2 },
  newPill: { height: 40, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.green, flexDirection: 'row', alignItems: 'center', gap: 6 },
  newPillText: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },

  serviceCard: { gap: 12, padding: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.xl },
  serviceHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  serviceTile: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' },
  serviceTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 16, lineHeight: 19, color: colors.ink },
  servicePrice: { fontFamily: fonts.extra, fontSize: 17, color: colors.green },
  serviceBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: colors.muted },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  emptyServices: { alignItems: 'center', gap: 10, paddingVertical: 28, paddingHorizontal: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.mark, borderRadius: radius.xl },
  emptyMark: { alignItems: 'center' },
  emptyMarkFill: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.yellowTint, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  emptyBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: colors.muted, textAlign: 'center' },

  availCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, backgroundColor: colors.yellowTint, borderRadius: radius.xl },
  availTile: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  availCopy: { flex: 1, gap: 3 },
  availTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.amberDeep },
  availHint: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.amberInk },

});
