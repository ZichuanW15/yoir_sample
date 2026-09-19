import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, userFacingError } from '@/src/api/client';
import { CounsellorProfile, Service } from '@/src/api/types';
import { BackBar } from '@/src/components/booking';
import { Glyph } from '@/src/components/Glyph';
import { Avatar, Button, Card, ErrorBanner, Spinner, Tag } from '@/src/components/ui';
import { initials, modalityLabel, money } from '@/src/format';
import { FadeUp, ScreenIn } from '@/src/motion';
import { goBack } from '@/src/navigation';
import { colors, fonts, radius, type } from '@/src/theme';

/**
 * A Career Professional's public profile: everything a Job Seeker weighs up before
 * booking — who they are, their qualifications, expertise and languages, their
 * LinkedIn, and the services they offer.
 */
export default function CareerProfessionalScreen() {
  const { counsellorId } = useLocalSearchParams<{ counsellorId: string }>();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<CounsellorProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [found, listed] = await Promise.all([api.getCounsellorProfile(counsellorId), api.listServices()]);
      setProfile(found);
      setServices(listed.filter((service) => service.counsellor.id === counsellorId));
      setError('');
    } catch (value) {
      setError(userFacingError(value));
    }
  }, [counsellorId]);
  useEffect(() => {
    const run = async () => { await load(); };
    void run();
  }, [load]);

  const back = () => goBack('/marketplace');

  if (error) {
    return (
      <ScreenIn style={styles.screen}>
        <BackBar title="Career Professional" onBack={back} />
        <View style={styles.body}>
          <ErrorBanner message={error} />
          <Button label="Try again" tone="outline" height={48} onPress={() => { void load(); }} />
        </View>
      </ScreenIn>
    );
  }
  if (!profile) {
    return (
      <ScreenIn style={styles.screen}>
        <BackBar title="Career Professional" onBack={back} />
        <View style={styles.loading}><Spinner size={28} color={colors.green} /></View>
      </ScreenIn>
    );
  }

  const verified = profile.verificationStatus === 'verified';
  const where = [
    profile.baseLocation ? `${profile.baseLocation.cityOrRegion}, ${profile.baseLocation.state}` : null,
    `${modalityLabel(profile.defaultModality)} sessions`,
  ].filter(Boolean).join(' · ');

  return (
    <ScreenIn style={styles.screen}>
      <BackBar title="Career Professional" onBack={back} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 32 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <FadeUp style={styles.hero}>
          <Avatar initials={initials(profile.displayName)} photo={profile.photoUrl} size={96} ring />
          <Text style={[type.display34, styles.centre]}>{profile.displayName}</Text>
          <View style={styles.heroTags}>
            <Tag
              label={verified ? 'Verified Career Professional' : 'Verification pending'}
              bg={verified ? colors.successBg : colors.yellowTint}
              fg={verified ? colors.successInk : colors.amberDeep}
              icon={verified ? <Glyph name="shieldCheck" size={13} color={colors.successInk} /> : undefined}
            />
            {profile.overallRating !== null ? (
              <Tag label={`★ ${profile.overallRating.toFixed(1)} · ${profile.reviewCount} reviews`} />
            ) : null}
          </View>
          <Text style={[type.small, styles.centre]}>{where}</Text>
          {profile.introduction ? <Text style={[type.body, styles.centre]}>{profile.introduction}</Text> : null}
          {profile.linkedinUrl ? (
            <Button
              label="View LinkedIn profile"
              tone="outline"
              height={48}
              onPress={() => { void Linking.openURL(profile.linkedinUrl); }}
              style={styles.linkedin}
            />
          ) : null}
        </FadeUp>

        <Section title="Qualifications" show={profile.qualifications.length > 0}>
          {profile.qualifications.map((item) => (
            <View key={item} style={styles.qualification}>
              <View style={styles.tick}><Glyph name="check" size={13} color={colors.green} /></View>
              <Text style={[type.bodySm, styles.flex]}>{item}</Text>
            </View>
          ))}
        </Section>

        <Section title="Skills and expertise" show={profile.expertise.length > 0}>
          <View style={styles.tags}>{profile.expertise.map((item) => <Tag key={item} label={item} bg={colors.greenTint} fg={colors.green} />)}</View>
        </Section>

        <Section title="Languages" show={profile.languages.length > 0}>
          <View style={styles.tags}>{profile.languages.map((item) => <Tag key={item} label={item} />)}</View>
        </Section>

        <Section title="Background" show={Boolean(profile.background)}>
          <Text style={type.bodySm}>{profile.background}</Text>
        </Section>

        <Section title="Experience" show={Boolean(profile.experience)}>
          <Text style={type.bodySm}>{profile.experience}</Text>
        </Section>

        <Text style={[type.display24, styles.servicesTitle]}>Services</Text>
        {services.length === 0 ? <Text style={type.body}>No services are listed right now.</Text> : null}
        {services.map((service) => (
          <Card
            key={service.id}
            accessibilityLabel={service.title}
            onPress={() => router.push({ pathname: '/services/[serviceId]', params: { serviceId: service.id } })}
          >
            <Text style={type.display20}>{service.title}</Text>
            <Text style={[type.small, styles.serviceMeta]}>
              {service.durationMinutes} min · {service.modalities.map(modalityLabel).join(' or ')}
            </Text>
            <View style={styles.serviceFoot}>
              <Text style={styles.price}>{money(service.priceMinor)}</Text>
              <Glyph name="chevronRight" size={18} color={colors.sub} />
            </View>
          </Card>
        ))}
      </ScrollView>
    </ScreenIn>
  );
}

function Section({ title, show, children }: { title: string; show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <FadeUp style={styles.section}>
      <Text style={type.groupLabel}>{title}</Text>
      <Card style={styles.sectionCard}>{children}</Card>
    </FadeUp>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  body: { paddingHorizontal: 22, paddingTop: 8, gap: 18 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  heroTags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  centre: { textAlign: 'center' },
  linkedin: { alignSelf: 'stretch', marginTop: 4 },
  section: { gap: 8 },
  sectionCard: { gap: 10 },
  qualification: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tick: {
    width: 22, height: 22, borderRadius: radius.pill, backgroundColor: colors.greenTint,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  flex: { flex: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  servicesTitle: { marginTop: 6 },
  serviceMeta: { marginTop: 4 },
  serviceFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  price: { fontFamily: fonts.extra, fontSize: 18, color: colors.green },
});
