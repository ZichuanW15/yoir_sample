import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '@/src/navigation';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import { WelcomeScene } from '@/src/components/Scenes';
import { Button, IconButton } from '@/src/components/ui';
import { desktopAuthBody, useDesktop } from '@/src/desktop';
import { FadeUp, ScreenIn } from '@/src/motion';
import { colors, fonts, radius, type } from '@/src/theme';

type PublicRole = 'job_seeker' | 'counsellor';

const copy: Record<PublicRole, { label: string; headline: string; body: string }> = {
  job_seeker: {
    label: 'Job Seeker',
    headline: 'Book your next session',
    body: 'Log in to book and pay for a session, or create an account in under a minute.',
  },
  counsellor: {
    label: 'Career Professional',
    headline: 'Take bookings on Yoir',
    body: 'Log in to manage your profile, services and availability, or create an account to start.',
  },
};

/** Second step of the entry flow: log in, create an account, or keep browsing. */
export default function WelcomeScreen() {
  const { role } = useLocalSearchParams<{ role?: PublicRole }>();
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const chosen: PublicRole = role === 'counsellor' ? 'counsellor' : 'job_seeker';
  const { label, headline, body } = copy[chosen];

  // Desktop: the bar scrolls with the form, so the column is one centred group
  // and the whole panel is what scrolls (see desktopAuthBody).
  const bar = (
    <View style={[styles.bar, desktop && styles.desktopBar]}>
      <IconButton tone="white" label="Back" onPress={() => goBack('/')}>
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Polyline points="14.5,5 7.5,12 14.5,19" fill="none" stroke={colors.green} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </IconButton>
    </View>
  );

  return (
    <ScreenIn style={[styles.screen, { paddingTop: insets.top }, desktop && styles.desktopScreen]}>
      {desktop ? null : bar}

      <ScrollView
        showsVerticalScrollIndicator={!desktop}
        contentContainerStyle={[styles.body, { paddingBottom: 24 + insets.bottom }, desktop && styles.desktopBody]}
      >
        {desktop ? bar : null}
        {/* Desktop: the brand panel beside the column stands in for the illustration. */}
        {desktop ? null : <WelcomeScene />}

        <FadeUp delay={150} duration={600} style={styles.intro}>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{label}</Text>
          </View>
          <Text style={type.display36}>{headline}</Text>
          <Text style={type.body}>{body}</Text>
        </FadeUp>

        <FadeUp delay={300} duration={600} style={styles.actions}>
          <Button
            label="Log in"
            height={56}
            onPress={() => router.push({ pathname: '/auth/login', params: { role: chosen } })}
          />
          <Button
            label="Create an account"
            tone="outline"
            height={56}
            onPress={() => router.push({ pathname: '/auth/register', params: { role: chosen } })}
          />
          {/* Guest browsing is a buyer's path: a counsellor needs an account to publish anything. */}
          {chosen === 'job_seeker' ? (
            <Button label="Continue as a guest" tone="quiet" height={48} labelSize={14} onPress={() => router.replace('/marketplace')} />
          ) : null}
        </FadeUp>
      </ScrollView>
    </ScreenIn>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  bar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  body: { paddingTop: 8, paddingHorizontal: 24, gap: 24 },
  intro: { gap: 12 },
  rolePill: {
    alignSelf: 'flex-start', backgroundColor: colors.yellowTint, borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  rolePillText: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.amberInk },
  actions: { gap: 12 },
  // Desktop: the screen fills the panel beside the brand panel and scrolls as a whole;
  // its content is the centred 460px column, bar included.
  desktopScreen: { flex: 1, backgroundColor: 'transparent' },
  desktopBar: { paddingHorizontal: 0 },
  desktopBody: { ...desktopAuthBody, gap: 16 },
});
