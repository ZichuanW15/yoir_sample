import { Href, Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/auth/AuthContext';
import { Button, Chip, Field, Press, Spinner } from '@/src/components/ui';
import { Answers, directionFor, Question, questions } from '@/src/diagnosis/model';
import { BestMatches, DirectionCard, finishedAnswers, useDiagnosis } from '@/src/diagnosis/view';
import { FadeUp, ScreenIn } from '@/src/motion';
import { homeFor } from '@/src/navigation';
import { colors, fonts, radius, type } from '@/src/theme';

const STEPS = questions.length + 1;
const blank: Answers = { now: '', goal: '', tried: [], stuck: '', barriers: [] };
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
  const { record, save } = useDiagnosis();
  // `result` opens a finished diagnosis on its direction, to be read again.
  const { result } = useLocalSearchParams<{ result?: string }>();
  // Untouched, the screen opens where they left off, with the answers they gave.
  const [moved, setMoved] = useState<number | null>(null);
  const [edited, setEdited] = useState<Answers | null>(null);
  const [missing, setMissing] = useState(false);

  const retaking = Boolean(finishedAnswers(record));
  const step = moved ?? (result && retaking ? questions.length : record?.step ?? 0);
  const answers = edited ?? record?.answers ?? blank;
  const direction = useMemo(() => directionFor(answers), [answers]);

  if (!session) return <Redirect href={{ pathname: '/auth/login', params: { role: 'job_seeker' } }} />;
  if (session.user.role !== 'job_seeker') return <Redirect href={homeFor(session.user.role)} />;
  if (record === undefined) {
    return <View style={[styles.screen, styles.centred]}><Spinner size={28} color={colors.green} /></View>;
  }

  const question: Question | undefined = questions[step];
  const answered = !question || question.multiple || answers[question.id] !== '';
  const open = question
    ? question.multiple ? (answers[question.id] as string[]).includes(OPEN) : answers[question.id] === OPEN
    : false;

  const choose = (q: Question, id: string) => {
    setMissing(false);
    if (!q.multiple) return setEdited({ ...answers, [q.id]: id });
    const chosen = answers[q.id] as string[];
    setEdited({ ...answers, [q.id]: chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id] });
  };

  const go = (to: number) => { setMissing(false); setMoved(to); };

  const next = async () => {
    if (!answered) return setMissing(true);
    // The answer is stored before the next question shows, and going back to change
    // one never moves the place they resume at. A retake is stored only when it is
    // finished: until then their last direction stands.
    if (step === questions.length - 1) await save({ answers });
    else if (!retaking) await save({ answers, step: Math.max(step + 1, record?.step ?? 0) });
    go(step + 1);
  };

  const skip = async () => {
    // Leaving part-way keeps what they have answered, to pick up later. Skipping a
    // retake keeps the direction they already have.
    if (!retaking) await save(answers.now ? { answers, step: Math.max(step, record?.step ?? 0) } : { answers: null });
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

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
          </FadeUp>
        ) : (
          <FadeUp style={styles.result}>
            <Text style={styles.stepCount}>Step {STEPS} of {STEPS}</Text>
            <Text style={type.display28}>Your Yoir Direction</Text>
            <DirectionCard direction={direction} />
            <Text style={type.display24}>Relevant Career Professionals</Text>
            <BestMatches direction={direction} limit={3} />
            {/* Pushed, not replaced: coming back from Explore lands on this direction again. */}
            <Button
              label="View Career Professionals"
              onPress={() => router.push({ pathname: '/marketplace', params: { match: '1' } })}
            />
            <Button label="Go to my home" tone="outline" onPress={() => router.replace('/job-seeker' as Href)} />
            <Button label="Retake the diagnosis" tone="quiet" height={48} onPress={() => go(0)} />
          </FadeUp>
        )}
      </ScrollView>

      {question ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {step > 0 ? <Button label="Back" tone="outline" onPress={() => go(step - 1)} style={styles.back} /> : null}
          <Button
            label={step === questions.length - 1 ? 'See my Yoir Direction' : 'Continue'}
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
  centred: { alignItems: 'center', justifyContent: 'center' },
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
