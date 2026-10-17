import { Href, Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/src/auth/AuthContext';
import { Glyph } from '@/src/components/Glyph';
import { JobSeekerNav } from '@/src/components/JobSeekerNav';
import { TopBar } from '@/src/components/TopBar';
import { Button, ErrorBanner, Press, Spinner } from '@/src/components/ui';
import { BestMatches, useDiagnosis } from '@/src/diagnosis/view';
import { FadeUp, ScreenIn } from '@/src/motion';
import { homeFor } from '@/src/navigation';
import { colors, fonts, radius, type } from '@/src/theme';

/** The job seeker's home: the Career Professionals best matched to their Yoir Direction. */
export default function JobSeekerHomeScreen() {
  const { session } = useAuth();
  const { questionnaire, record, direction, criteria, loading, error, refresh } = useDiagnosis();
  // Set while a diagnosis was left part-way: the question it picks up at.
  const resumeAt = record?.status === 'in_progress' ? Math.max(0, record.currentStep - 1) : undefined;

  if (session && session.user.role !== 'job_seeker') return <Redirect href={homeFor(session.user.role)} />;
  if (session && loading) {
    return <View style={[styles.screen, styles.centred]}><Spinner size={28} color={colors.green} /></View>;
  }
  if (session && error) {
    return (
      <View style={[styles.screen, styles.centred, styles.error]}>
        <ErrorBanner message={error} />
        <Button label="Try again" tone="outline" onPress={() => { void refresh(); }} />
      </View>
    );
  }
  // Someone who has never been through the diagnosis starts there: it is the onboarding.
  if (session && record === null) return <Redirect href={'/job-seeker/diagnosis' as Href} />;

  const firstName = session?.user.name.split(' ')[0];
  const retake = () => router.push('/job-seeker/diagnosis' as Href);
  const steps = questionnaire?.totalSteps ?? 6;

  return (
    <ScreenIn style={styles.screen}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <FadeUp style={styles.hero}>
          <Text style={[type.eyebrow, styles.heroEyebrow]}>{firstName ? `Welcome back, ${firstName}` : 'Welcome to Yoir'}</Text>
          <Text style={[type.display34, styles.heroTitle]}>
            {direction ? 'Your best matches' : resumeAt !== undefined ? 'Pick up where you left off' : 'Find the right Career Professional'}
          </Text>
          <Text style={[type.bodySm, styles.heroBody]}>
            {direction
              ? 'Career Professionals matched to your Yoir Direction.'
              : resumeAt !== undefined
                ? `You are on step ${resumeAt + 1} of ${steps} of your Yoir Diagnosis. Your answers so far are saved.`
                : session
                  ? 'Five quick questions, about two minutes, and we match you with the right people.'
                  : 'Create a free account to take the Yoir Diagnosis and get matched with the right people.'}
          </Text>
          {direction ? (
            <View style={styles.heroFoot}>
              {/* The direction's advice stays one tap away, without taking the diagnosis again. */}
              <Press
                onPress={() => router.push({ pathname: '/job-seeker/diagnosis', params: { result: '1' } } as Href)}
                accessibilityLabel={`View my Yoir Direction: ${direction.area}`}
                style={styles.heroPill}
              >
                <Glyph name="sparkle" size={14} color={colors.green} />
                <Text style={styles.heroPillText}>{direction.area}</Text>
                <Glyph name="chevronRight" size={13} color={colors.green} />
              </Press>
              <Press onPress={retake} accessibilityLabel="Retake diagnosis" style={styles.heroButton}>
                <Glyph name="refresh" size={14} color={colors.canvas} />
                <Text style={styles.heroButtonText}>Retake diagnosis</Text>
              </Press>
            </View>
          ) : resumeAt !== undefined ? (
            <>
              <View style={styles.heroProgress} accessibilityRole="progressbar" accessibilityLabel={`Step ${resumeAt + 1} of ${steps}`}>
                {Array.from({ length: steps }, (_, i) => (
                  <View key={i} style={[styles.heroSegment, i < resumeAt && styles.heroSegmentDone]} />
                ))}
              </View>
              <Button label="Continue the Yoir Diagnosis" tone="soft" height={50} onPress={retake} />
            </>
          ) : session ? (
            <Button label="Take the Yoir Diagnosis" tone="soft" height={50} onPress={retake} />
          ) : (
            <Button
              label="Create an account"
              tone="soft"
              height={50}
              onPress={() => router.push({ pathname: '/auth/register', params: { role: 'job_seeker' } })}
            />
          )}
        </FadeUp>

        {direction ? null : <Text style={type.display24}>Top rated Career Professionals</Text>}

        <BestMatches criteria={criteria} limit={5} />
        <Button label="View all Career Professionals" tone="outline" onPress={() => router.replace('/marketplace')} />
      </ScrollView>
      <JobSeekerNav />
    </ScreenIn>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  centred: { alignItems: 'center', justifyContent: 'center' },
  error: { padding: 24, gap: 16 },
  body: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 24, gap: 16 },
  // The brand block: the logo's green, with its gold and cream.
  hero: { backgroundColor: colors.green, borderRadius: radius.hero, padding: 22, gap: 10, marginBottom: 6 },
  heroEyebrow: { color: colors.yellow },
  heroTitle: { color: colors.canvas },
  heroBody: { color: colors.onDarkMuted },
  heroFoot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 4 },
  heroPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1,
    backgroundColor: colors.yellow, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8,
  },
  heroPillText: { fontFamily: fonts.bold, fontSize: 13, color: colors.green, flexShrink: 1 },
  heroButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill,
    borderWidth: 1.5, borderColor: colors.onDarkMuted, paddingHorizontal: 14, paddingVertical: 7,
  },
  heroButtonText: { fontFamily: fonts.bold, fontSize: 13, color: colors.canvas },
  heroProgress: { flexDirection: 'row', gap: 6, marginVertical: 4 },
  heroSegment: { flex: 1, height: 5, borderRadius: radius.pill, backgroundColor: colors.greenDeep },
  heroSegmentDone: { backgroundColor: colors.yellow },
});
