import { Href, Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DiagnosisAnswers, DiagnosisQuestion } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { Button, Chip, ErrorBanner, Field, Press, Spinner } from '@/src/components/ui';
import { BestMatches, DirectionCard, useDiagnosis } from '@/src/diagnosis/view';
import { FadeUp, ScreenIn } from '@/src/motion';
import { homeFor } from '@/src/navigation';
import { colors, fonts, radius, type } from '@/src/theme';

type EditableAnswers = Required<Omit<DiagnosisAnswers, 'other'>> & {
  other: NonNullable<DiagnosisAnswers['other']>;
};
const blank: EditableAnswers = {
  now: '', goal: '', tried: [], stuck: '', barriers: [], other: {},
};
/** The options that ask for a few words of the person's own. */
const OPEN = 'other';

/**
 * The Yoir Diagnosis, the first thing a new job seeker does: five questions, one
 * per screen, then their Yoir Direction.
 *
 * Each answer is kept as it is given, so closing the app part-way loses nothing and
 * it reopens on the question they had reached. Retaking starts from the last
 * answers, and replaces their direction only once it is finished.
 */
export default function DiagnosisScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const {
    questionnaire, record, direction, criteria, loading, saving, error,
    refresh, start, saveStep,
  } = useDiagnosis();
  // `result` opens a finished diagnosis on its direction, to be read again.
  const { result } = useLocalSearchParams<{ result?: string }>();
  // Untouched, the screen opens where they left off, with the answers they gave.
  const [moved, setMoved] = useState<number | null>(null);
  const [edited, setEdited] = useState<EditableAnswers | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (loading || !questionnaire || record !== null || saving || error) return;
    void Promise.resolve().then(start).catch(() => undefined);
  }, [error, loading, questionnaire, record, saving, start]);

  const questions = questionnaire?.steps ?? [];
  const totalSteps = questionnaire?.totalSteps ?? 6;
  const retaking = record?.status === 'answers_complete';
  const step = moved ?? (result && retaking ? questions.length : Math.max(0, (record?.currentStep ?? 1) - 1));
  const answers: EditableAnswers = edited ?? {
    ...blank,
    ...record?.answers,
    other: record?.answers.other ?? {},
  };

  if (!session) return <Redirect href={{ pathname: '/auth/login', params: { role: 'job_seeker' } }} />;
  if (session.user.role !== 'job_seeker') return <Redirect href={homeFor(session.user.role)} />;
  if (loading || (saving && !record) || !questionnaire || !record) {
    return (
      <View style={[styles.screen, styles.centred, styles.loadState]}>
        {error ? (
          <>
            <ErrorBanner message={error} />
            <Button label="Try again" tone="outline" onPress={() => { void refresh(); }} />
          </>
        ) : <Spinner size={28} color={colors.green} />}
      </View>
    );
  }

  const question: DiagnosisQuestion | undefined = questions[step];
  const answered = !question || question.multiple || answers[question.id] !== '';
  const open = question
    ? question.multiple ? (answers[question.id] as string[]).includes(OPEN) : answers[question.id] === OPEN
    : false;

  const choose = (q: DiagnosisQuestion, id: string) => {
    setMissing(false);
    if (!q.multiple) return setEdited({ ...answers, [q.id]: id });
    const chosen = answers[q.id] as string[];
    setEdited({ ...answers, [q.id]: chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id] });
  };

  const go = (to: number) => { setMissing(false); setMoved(to); };

  const next = async () => {
    if (!answered) return setMissing(true);
    if (!question) return;
    try {
      const value = answers[question.id];
      await saveStep(question.id, value, answers.other[question.id] ?? null);
      go(step + 1);
    } catch {
      // The hook exposes the server's safe message and leaves this step on screen.
    }
  };

  const skip = () => router.replace('/job-seeker' as Href);

  return (
    <ScreenIn style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={type.eyebrow}>Yoir Diagnosis</Text>
        {question ? (
          <Press onPress={skip} accessibilityLabel="Skip for now" style={styles.skip}>
            <Text style={styles.skipText}>Skip for now</Text>
          </Press>
        ) : null}
      </View>
      <View style={styles.progress} accessibilityRole="progressbar" accessibilityLabel={`Step ${step + 1} of ${totalSteps}`}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <View key={i} style={[styles.segment, i <= step && styles.segmentDone]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {question ? (
          <FadeUp key={step} style={styles.question}>
            <Text style={styles.stepCount}>Step {step + 1} of {totalSteps}</Text>
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
            {open ? (
              <Field
                label="Tell us a little more (optional)"
                value={answers.other?.[question.id] ?? ''}
                onChangeText={(text) => setEdited({ ...answers, other: { ...answers.other, [question.id]: text } })}
                placeholder="In your own words"
                maxLength={200}
                style={styles.other}
              />
            ) : null}
            {missing ? <Text accessibilityRole="alert" style={styles.missing}>Choose an option to continue.</Text> : null}
            {error ? <ErrorBanner message={error} /> : null}
          </FadeUp>
        ) : (
          <FadeUp style={styles.result}>
            <Text style={styles.stepCount}>Step {totalSteps} of {totalSteps}</Text>
            <Text style={type.display28}>Your Yoir Direction</Text>
            {error ? <ErrorBanner message={error} /> : null}
            {direction ? (
              <>
                <DirectionCard direction={direction} />
                <Text style={type.display24}>Relevant Career Professionals</Text>
                <BestMatches criteria={criteria} limit={3} />
                {/* Pushed, not replaced: coming back from Explore lands on this direction again. */}
                <Button
                  label="View Career Professionals"
                  onPress={() => router.push({ pathname: '/marketplace', params: { match: '1' } })}
                />
              </>
            ) : error ? (
              <Button label="Try again" tone="outline" onPress={() => { void refresh(); }} />
            ) : <Spinner size={28} color={colors.green} />}
            <Button label="Go to my home" tone="outline" onPress={() => router.replace('/job-seeker' as Href)} />
            <Button label="Retake the diagnosis" tone="quiet" height={48} onPress={() => { setEdited({ ...answers }); go(0); }} />
          </FadeUp>
        )}
      </ScrollView>

      {question ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {step > 0 ? <Button label="Back" tone="outline" onPress={() => go(step - 1)} style={styles.back} /> : null}
          <Button
            label={step === questions.length - 1 ? 'See my Yoir Direction' : 'Continue'}
            onPress={() => { void next(); }}
            busy={saving}
            style={styles.continue}
          />
        </View>
      ) : null}
    </ScreenIn>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  centred: { alignItems: 'center', justifyContent: 'center' },
  loadState: { padding: 24, gap: 16 },
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
  other: { marginTop: 6 },
  missing: { fontFamily: fonts.semi, fontSize: 14, lineHeight: 20, color: colors.danger },
  result: { gap: 16 },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: 22, paddingTop: 12 },
  back: { flex: 1 },
  continue: { flex: 2 },
});
