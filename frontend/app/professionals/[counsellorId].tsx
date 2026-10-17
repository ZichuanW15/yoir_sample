import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, userFacingError } from '@/src/api/client';
import { CounsellorProfile, Service } from '@/src/api/types';
import { BackBar } from '@/src/components/booking';
import { Glyph } from '@/src/components/Glyph';
import { Avatar, Button, Card, ErrorBanner, Spinner, Tag } from '@/src/components/ui';
import { BackPill, DesktopPage, desktopCard, useDesktop } from '@/src/desktop';
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
  const desktop = useDesktop();
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
    if (desktop) {
      return (
        <DesktopPage>
          <BackPill label="Back" onPress={back} />
          <View style={styles.desktopFailed}>
            <ErrorBanner message={error} />
            <Button label="Try again" tone="outline" height={48} onPress={() => { void load(); }} />
          </View>
        </DesktopPage>
      );
    }
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
    if (desktop) {
      return (
        <DesktopPage>
          <BackPill label="Back" onPress={back} />
          <View style={styles.desktopLoading}><Spinner size={28} color={colors.green} /></View>
        </DesktopPage>
      );
    }
    return (
      <ScreenIn style={styles.screen}>
        <BackBar title="Career Professional" onBack={back} />
        <View style={styles.loading}><Spinner size={28} color={colors.green} /></View>
      </ScreenIn>
    );
  }

  // US-28: the backend decides which fields are permitted; the client never
  // reconstructs hidden data from listings. A restricted response gets a clear,
  // non-error state instead of a suspiciously empty profile.
  if (profile.restricted || profile.visibility === 'restricted') {
    if (desktop) {
      return (
        <DesktopPage>
          <BackPill label="Back" onPress={back} />
          <View style={styles.desktopRestricted}>
            <View style={[styles.restrictedMark, styles.desktopRestrictedMark]}><Glyph name="lock" size={28} color={colors.green} /></View>
            <Text style={[styles.desktopRestrictedTitle, styles.centre]}>This profile is restricted</Text>
            <Text style={[type.body, styles.centre, styles.desktopRestrictedBody]}>
              This Career Professional has chosen not to share their profile details.
            </Text>
            <Button label="Back to Explore" tone="outline" height={48} onPress={back} />
          </View>
        </DesktopPage>
      );
    }
    return (
      <ScreenIn style={styles.screen}>
        <BackBar title="Career Professional" onBack={back} />
        <View style={styles.restrictedBody}>
          <View style={styles.restrictedMark}><Glyph name="lock" size={28} color={colors.green} /></View>
          <Text style={[type.display24, styles.centre]}>This profile is restricted</Text>
          <Text style={[type.body, styles.centre]}>
            This Career Professional has chosen not to share their profile details.
          </Text>
          <Button label="Back to Explore" tone="outline" height={48} onPress={back} />
        </View>
      </ScreenIn>
    );
  }

  const verified = profile.verificationStatus === 'verified';
  const where = [
    profile.baseLocation ? `${profile.baseLocation.cityOrRegion}, ${profile.baseLocation.state}` : null,
    `${modalityLabel(profile.defaultModality)} sessions`,
  ].filter(Boolean).join(' · ');

  // Desktop: the person and their credentials on the left, the services to book in a
  // column beside them.
  if (desktop) {
    return (
      <DesktopPage>
        <BackPill label="Back" onPress={back} />
        <View style={styles.desktopRow}>
          <View style={styles.desktopMain}>
            <View style={[desktopCard, styles.desktopHero]}>
              <View style={styles.desktopAvatarRing}>
                <Avatar initials={initials(profile.displayName)} photo={profile.photoUrl} size={92} />
              </View>
              <View style={styles.desktopHeroCopy}>
                <Text style={styles.desktopName}>{profile.displayName}</Text>
                <View style={styles.tags}>
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
                <Text style={type.small}>{where}</Text>
                {profile.introduction ? <Text style={type.body}>{profile.introduction}</Text> : null}
                {profile.linkedinUrl ? (
                  <Button
                    label="View LinkedIn profile"
                    tone="outline"
                    height={44}
                    labelSize={14}
                    onPress={() => { void Linking.openURL(profile.linkedinUrl); }}
                    style={styles.desktopLinkedin}
                  />
                ) : null}
              </View>
            </View>

            <View style={styles.desktopSections}>
              <DesktopSection title="Qualifications" show={(profile.qualifications ?? []).length > 0} grid>
                {(profile.qualifications ?? []).map((item) => (
                  <View key={item} style={styles.qualification}>
                    <View style={styles.tick}><Glyph name="check" size={13} color={colors.green} /></View>
                    <Text style={[type.bodySm, styles.flex]}>{item}</Text>
                  </View>
                ))}
              </DesktopSection>
              <DesktopSection title="Skills and expertise" show={(profile.expertise ?? []).length > 0} grid>
                <View style={styles.tags}>{(profile.expertise ?? []).map((item) => <Tag key={item} label={item} bg={colors.greenTint} fg={colors.green} />)}</View>
              </DesktopSection>
              <DesktopSection title="Languages" show={(profile.languages ?? []).length > 0} grid>
                <View style={styles.tags}>{(profile.languages ?? []).map((item) => <Tag key={item} label={item} />)}</View>
              </DesktopSection>
            </View>

            <DesktopSection title="Background" show={Boolean(profile.background)}>
              <Text style={type.bodySm}>{profile.background}</Text>
            </DesktopSection>
            <DesktopSection title="Experience" show={Boolean(profile.experience)}>
              <Text style={type.bodySm}>{profile.experience}</Text>
            </DesktopSection>
          </View>

          <View style={styles.desktopAside}>
            <Text style={styles.desktopHeading}>Services</Text>
            {services.length === 0 ? <Text style={type.body}>No services are listed right now.</Text> : null}
            {services.map((service) => (
              <Card
                key={service.id}
                accessibilityLabel={service.title}
                onPress={() => router.push({ pathname: '/services/[serviceId]', params: { serviceId: service.id } })}
                style={styles.desktopService}
              >
                <Text style={type.display20}>{service.title}</Text>
                <Text style={type.small}>
                  {service.durationMinutes} min · {service.modalities.map(modalityLabel).join(' or ')}
                </Text>
                <View style={styles.serviceFoot}>
                  <Text style={styles.price}>{money(service.priceMinor)}</Text>
                  <Glyph name="chevronRight" size={18} color={colors.sub} />
                </View>
              </Card>
            ))}
          </View>
        </View>
      </DesktopPage>
    );
  }

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

        <Section title="Qualifications" show={(profile.qualifications ?? []).length > 0}>
          {(profile.qualifications ?? []).map((item) => (
            <View key={item} style={styles.qualification}>
              <View style={styles.tick}><Glyph name="check" size={13} color={colors.green} /></View>
              <Text style={[type.bodySm, styles.flex]}>{item}</Text>
            </View>
          ))}
        </Section>

        <Section title="Skills and expertise" show={(profile.expertise ?? []).length > 0}>
          <View style={styles.tags}>{(profile.expertise ?? []).map((item) => <Tag key={item} label={item} bg={colors.greenTint} fg={colors.green} />)}</View>
        </Section>

        <Section title="Languages" show={(profile.languages ?? []).length > 0}>
          <View style={styles.tags}>{(profile.languages ?? []).map((item) => <Tag key={item} label={item} />)}</View>
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

/** Desktop: a profile section as its own white card, the label inside it. */
function DesktopSection({ title, show, grid = false, children }: { title: string; show: boolean; grid?: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <View style={[styles.desktopSection, grid && styles.desktopSectionCell]}>
      <Text style={type.groupLabel}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  body: { paddingHorizontal: 22, paddingTop: 8, gap: 18 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  restrictedBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 30 },
  restrictedMark: { width: 60, height: 60, borderRadius: 22, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' },
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

  desktopLoading: { paddingVertical: 80, alignItems: 'center' },
  desktopFailed: { gap: 14, maxWidth: 560 },
  desktopRestricted: { alignItems: 'center', gap: 14, paddingVertical: 80, paddingHorizontal: 20 },
  desktopRestrictedMark: { width: 64, height: 64 },
  desktopRestrictedTitle: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 31, color: colors.ink },
  desktopRestrictedBody: { maxWidth: 420 },
  desktopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  desktopMain: { flex: 1, minWidth: 0, gap: 18 },
  desktopAside: { width: 300, gap: 12 },
  desktopHero: { flexDirection: 'row', alignItems: 'flex-start', gap: 26, padding: 32, borderRadius: 28 },
  desktopAvatarRing: { padding: 3, borderRadius: radius.pill, borderWidth: 3, borderColor: colors.yellow, backgroundColor: colors.white },
  desktopHeroCopy: { flex: 1, minWidth: 0, gap: 10 },
  desktopName: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 38, letterSpacing: -0.4, color: colors.ink },
  desktopLinkedin: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 20 },
  desktopSections: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  desktopSection: { gap: 10, padding: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: 22 },
  desktopSectionCell: { flexGrow: 1, flexBasis: 300 },
  desktopHeading: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 29, color: colors.ink, marginBottom: 4 },
  desktopService: { gap: 6, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: 22 },
});
