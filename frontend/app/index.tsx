import { Redirect, router } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/auth/AuthContext';
import { Glyph, GlyphName } from '@/src/components/Glyph';
import { EntryScene } from '@/src/components/Scenes';
import { Card, Press } from '@/src/components/ui';
import { desktopAuthBody, useDesktop } from '@/src/desktop';
import { FadeUp, ScreenIn } from '@/src/motion';
import { homeFor } from '@/src/navigation';
import { colors, fonts, radius, shadow, type } from '@/src/theme';

type PublicRole = 'job_seeker' | 'counsellor';

const roles: { role: PublicRole; glyph: GlyphName; holder: string; ink: string; title: string; description: string }[] = [
  {
    role: 'job_seeker',
    glyph: 'seeker',
    holder: colors.greenTint,
    ink: colors.green,
    title: 'I am a Job Seeker',
    description: 'Find a Career Professional, book a session and pay securely.',
  },
  {
    role: 'counsellor',
    glyph: 'mentor',
    holder: colors.yellowTint,
    ink: colors.amberInk,
    title: 'I am a Career Professional',
    description: 'Publish services, set availability and take bookings.',
  },
];

/** The first screen: pick the role you are here for, or browse without an account. */
export default function EntryScreen() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();

  if (session) return <Redirect href={homeFor(session.user.role)} />;

  return (
    <ScreenIn duration={500} style={[styles.screen, { paddingTop: insets.top }, desktop && styles.desktopScreen]}>
      <ScrollView
        showsVerticalScrollIndicator={!desktop}
        contentContainerStyle={[styles.body, { paddingBottom: 24 + insets.bottom }, desktop && styles.desktopBody]}
      >
        {/* Desktop: the brand panel beside this column already carries the wordmark,
            the headline and the introduction, so the column only asks the question. */}
        {desktop ? (
          <FadeUp duration={500} style={styles.desktopHead}>
            <Text style={type.eyebrow}>Get started</Text>
            <Text style={styles.desktopTitle}>Who are you here as?</Text>
          </FadeUp>
        ) : (
          <>
            <View style={styles.wordmarkRow}>
              <Image source={require('@/assets/images/yoir-wordmark.png')} style={styles.wordmark} resizeMode="contain" accessibilityLabel="Yoir" />
            </View>

            <View style={[styles.sceneHolder, shadow.card]}>
              <EntryScene />
            </View>

            <FadeUp delay={150} duration={600} style={styles.headlineBlock}>
              <Text style={type.display40}>
                Career guidance <Text style={styles.headlineAccent}>that fits you</Text>
              </Text>
              <Text style={type.body}>
                Yoir connects job seekers with verified Career Professionals. Tell us how you will use it.
              </Text>
            </FadeUp>
          </>
        )}

        <FadeUp delay={300} duration={600} style={styles.roleList}>
          {roles.map((entry) => (
            <Card
              key={entry.role}
              pad={18}
              style={styles.roleCard}
              accessibilityLabel={entry.title}
              onPress={() => router.push({ pathname: '/auth/welcome', params: { role: entry.role } })}
            >
              <View style={[styles.roleHolder, { backgroundColor: entry.holder }]}>
                <Glyph name={entry.glyph} size={26} color={entry.ink} />
              </View>
              <View style={styles.roleCopy}>
                <Text style={styles.roleTitle}>{entry.title}</Text>
                <Text style={type.small}>{entry.description}</Text>
              </View>
              <Glyph name="chevronRight" size={18} color={colors.mark} />
            </Card>
          ))}
        </FadeUp>

        <FadeUp delay={450} duration={600} style={styles.guestBlock}>
          <Press
            scaleTo={0.96}
            style={[styles.guestPill, desktop && styles.desktopGuestPill]}
            accessibilityLabel="Just looking? Browse as a guest"
            onPress={() => router.replace('/marketplace')}
          >
            <Glyph name="eye" size={18} color={colors.green} />
            <Text style={styles.guestLabel}>Just looking? Browse as a guest</Text>
          </Press>

          {/* The two cards above are for people choosing a role, which someone who
              already has an account has done once. It is also the only way in for a
              Platform Owner, whose role is never offered here and never registered. */}
          <Press
            scaleTo={0.96}
            style={styles.signIn}
            accessibilityLabel="Already have an account? Log in"
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.signInLabel}>
              Already have an account? <Text style={styles.signInAccent}>Log in</Text>
            </Text>
          </Press>
        </FadeUp>
      </ScrollView>
    </ScreenIn>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  body: { paddingTop: 12, paddingHorizontal: 24, gap: 22 },
  wordmarkRow: { alignItems: 'center', paddingTop: 8 },
  wordmark: { width: 92, aspectRatio: 159 / 60 },
  // EntryScene paints its own 32-radius white card; this carries the card shadow behind it.
  sceneHolder: { backgroundColor: colors.white, borderRadius: radius.hero },
  headlineBlock: { gap: 10 },
  headlineAccent: { fontFamily: fonts.serifItalic, color: colors.greenDeep },
  roleList: { gap: 12 },
  roleCard: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  roleHolder: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  roleCopy: { flex: 1, gap: 3 },
  roleTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  guestBlock: { alignItems: 'center', gap: 8, paddingTop: 6 },
  guestPill: {
    height: 48, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line,
    paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  guestLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.green },
  signIn: { paddingVertical: 8, paddingHorizontal: 10 },
  signInLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  signInAccent: { fontFamily: fonts.bold, color: colors.green },
  // Desktop: the screen fills the panel beside the brand panel and scrolls as a whole;
  // its content is the centred 460px column, bar included.
  desktopScreen: { flex: 1, backgroundColor: 'transparent' },
  desktopBody: { ...desktopAuthBody, gap: 14 },
  desktopHead: { gap: 14, marginBottom: 10 },
  desktopTitle: { fontFamily: fonts.serif, fontSize: 32, lineHeight: 37, letterSpacing: -0.4, color: colors.ink },
  desktopGuestPill: { backgroundColor: colors.white },
});
