import { Href, Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/auth/AuthContext';
import { Button, Chip, Press } from '@/src/components/ui';
import { Answers, directionFor, Question, questions } from '@/src/diagnosis/model';
import { BestMatches, DirectionCard, useDiagnosis } from '@/src/diagnosis/view';
import { FadeUp, ScreenIn } from '@/src/motion';
import { homeFor } from '@/src/navigation';
import { colors, fonts, radius, type } from '@/src/theme';

const STEPS = questions.length + 1;
const blank: Answers = { now: '', goal: '', tried: [], stuck: '', barriers: [] };

/**
 * The Yoir Diagnosis, the first thing a new job seeker does: five questions, one
 * per screen, then their Yoir Direction. Retaking it starts from the last answers.
 */
export default function DiagnosisScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { record, save } = useDiagnosis();
  const [step, setStep] = useState(0);
  // Untouched, a retake starts from the answers they gave last time.
  const [edited, setEdited] = useState<Answers | null>(null);
  const answers = edited ?? record?.answers ?? blank;
  const direction = useMemo(() => directionFor(answers), [answers]);

  if (!session) return <Redirect href={{ pathname: '/auth/login', params: { role: 'job_seeker' } }} />;
  if (session.user.role !== 'job_seeker') return <Redirect href={homeFor(session.user.role)} />;

  const question: Question | undefined = questions[step];
  const answered = !question || question.multiple || answers[question.id] !== '';

  const choose = (q: Question, id: string) => {
    if (!q.multiple) return setEdited({ ...answers, [q.id]: id });
    const chosen = answers[q.id] as string[];
    setEdited({ ...answers, [q.id]: chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id] });
  };

  const next = async () => {
    if (step === questions.length - 1) await save({ answers });
    setStep(step + 1);
  };

  const skip = async () => {
    // Skipping a retake keeps the direction they already have.
    if (!record?.answers) await save({ answers: null });
    router.replace('/job-seeker' as Href);
  };

  return (
    <ScreenIn style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={type.eyebrow}>Yoir Diagnosis</Text>
        {question ? (
          <Press onPress={() => { void skip(); }} accessibilityLabel="Skip for now" style={styles.skip}>
            <Text style={styles.skipText}>Skip for now</Text>
          </Press>
        ) : null}
      </View>
      <View style={styles.progress} accessibilityRole="progressbar" accessibilityLabel={`Step ${step + 1} of ${STEPS}`}>
        {Array.from({ length: STEPS }, (_, i) => (
          <View key={i} style={[styles.segment, i <= step && styles.segmentDone]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {question ? (
          <FadeUp key={step} style={styles.question}>
            <Text style={styles.stepCount}>Step {step + 1} of {STEPS}</Text>
            <Text style={type.display28}>{question.title}</Text>
            <Text style={type.body}>{question.hint}</Text>
            <View style={styles.options}>
              {question.options.map((option) => (
                <Chip
                  key={option.id}
                  label={option.label}
                  role={question.multiple ? 'checkbox' : 'radio'}
                  selected={question.multiple
                    ? (answers[question.id] as string[]).includes(option.id)
                    : answers[question.id] === option.id}
                  onPress={() => choose(question, option.id)}
                />
              ))}
            </View>
          </FadeUp>
        ) : (
          <FadeUp style={styles.result}>
            <Text style={styles.stepCount}>Step {STEPS} of {STEPS}</Text>
            <Text style={type.display28}>Your Yoir Direction</Text>
            <DirectionCard direction={direction} />
            <Text style={type.display24}>Relevant Career Professionals</Text>
            <BestMatches direction={direction} limit={3} />
            <Button label="View Career Professionals" onPress={() => router.replace('/marketplace')} />
            <Button label="Go to my home" tone="outline" onPress={() => router.replace('/job-seeker' as Href)} />
            <Button label="Retake the diagnosis" tone="quiet" height={48} onPress={() => setStep(0)} />
          </FadeUp>
        )}
      </ScrollView>

      {question ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {step > 0 ? <Button label="Back" tone="outline" onPress={() => setStep(step - 1)} style={styles.back} /> : null}
          <Button
            label={step === questions.length - 1 ? 'See my Yoir Direction' : 'Continue'}
            disabled={!answered}
            onPress={() => { void next(); }}
            style={styles.continue}
          />
        </View>
      ) : null}
    </ScreenIn>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 14, minHeight: 48 },
  skip: { paddingVertical: 8, paddingHorizontal: 4 },
  skipText: { fontFamily: fonts.bold, fontSize: 14, color: colors.sub },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: 22, paddingTop: 8 },
  segment: { flex: 1, height: 5, borderRadius: radius.pill, backgroundColor: colors.line },
  segmentDone: { backgroundColor: colors.green },
  body: { flexGrow: 1, padding: 22, paddingBottom: 30 },
  question: { gap: 12 },
  stepCount: { fontFamily: fonts.semi, fontSize: 13, color: colors.sub },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  result: { gap: 16 },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: 22, paddingTop: 12 },
  back: { flex: 1 },
  continue: { flex: 2 },
});
