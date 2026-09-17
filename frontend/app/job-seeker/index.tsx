import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, userFacingError } from '@/src/api/client';
import { Service, TriageSubmission } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { Glyph } from '@/src/components/Glyph';
import { JobSeekerNav } from '@/src/components/JobSeekerNav';
import { Button, Card, Chip, ErrorBanner, Tag } from '@/src/components/ui';
import { money } from '@/src/format';
import { FadeUp, ScreenIn } from '@/src/motion';
import { colors, fonts, type } from '@/src/theme';

const stageOptions: { label: string; value: TriageSubmission['careerStage'] }[] = [
  { label: 'Student', value: 'student' }, { label: 'Early career', value: 'early_career' },
  { label: 'Changing career', value: 'career_change' }, { label: 'Returning to work', value: 'returning' },
];
const goalOptions: { label: string; value: TriageSubmission['goal'] }[] = [
  { label: 'Find direction', value: 'direction' }, { label: 'Improve my resume', value: 'resume' },
  { label: 'Prepare for interviews', value: 'interview' }, { label: 'Plan a career change', value: 'career_change' },
];

export default function JobSeekerHomeScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [answers, setAnswers] = useState<TriageSubmission>({ careerStage: 'early_career', goal: 'direction', modality: 'any' });
  const [result, setResult] = useState<{ summary: string; services: Service[]; source: 'live' | 'preview' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true); setError('');
    try { setResult(await api.getTriageRecommendations(answers, session?.accessToken)); }
    catch (value) { setError(userFacingError(value)); }
    finally { setBusy(false); }
  };

  return (
    <ScreenIn style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <FadeUp style={styles.heading}>
          <Text style={type.eyebrow}>Your next step</Text>
          <Text style={type.display34}>{session ? `Welcome back, ${session.user.name.split(' ')[0]}` : 'Find your best match'}</Text>
          <Text style={type.body}>Answer three quick questions and we will suggest the most useful place to start.</Text>
        </FadeUp>

        <Card style={styles.triageCard}>
          <View style={styles.cardTitleRow}>
            <View style={styles.spark}><Glyph name="sparkle" size={22} color={colors.amberInk} /></View>
            <View style={styles.cardTitleCopy}>
              <Text style={type.display24}>Quick career triage</Text>
              <Text style={type.small}>A preview of personalised matching</Text>
            </View>
          </View>

          <Question label="1. Where are you now?">
            {stageOptions.map((option) => <Chip key={option.value} label={option.label} selected={answers.careerStage === option.value} onPress={() => setAnswers((a) => ({ ...a, careerStage: option.value }))} />)}
          </Question>
          <Question label="2. What would help most?">
            {goalOptions.map((option) => <Chip key={option.value} label={option.label} selected={answers.goal === option.value} onPress={() => setAnswers((a) => ({ ...a, goal: option.value }))} />)}
          </Question>
          <Question label="3. How would you like to meet?">
            <Chip label="No preference" selected={answers.modality === 'any'} onPress={() => setAnswers((a) => ({ ...a, modality: 'any' }))} />
            <Chip label="Online" selected={answers.modality === 'online'} onPress={() => setAnswers((a) => ({ ...a, modality: 'online' }))} />
            <Chip label="In person" selected={answers.modality === 'in_person'} onPress={() => setAnswers((a) => ({ ...a, modality: 'in_person' }))} />
          </Question>
          {error ? <ErrorBanner message={error} /> : null}
          <Button label="Show my matches" busy={busy} onPress={submit} icon={<Glyph name="sparkle" size={18} color={colors.white} />} />
        </Card>

        {result ? (
          <FadeUp style={styles.results}>
            <View style={styles.resultHeading}>
              <Text style={type.display28}>Recommended for you</Text>
              {result.source === 'preview' ? <Tag label="Preview matching" bg={colors.yellowTint} fg={colors.amberInk} /> : null}
            </View>
            <Text style={type.body}>{result.summary}</Text>
            {result.services.map((service) => (
              <Card key={service.id} onPress={() => router.push({ pathname: '/services/[serviceId]', params: { serviceId: service.id } })}>
                <Text style={type.display20}>{service.title}</Text>
                <Text style={type.small}>{service.counsellor.displayName}</Text>
                <View style={styles.serviceFoot}>
                  <View style={styles.tags}>{service.modalities.map((m) => <Tag key={m} label={m === 'in_person' ? 'In person' : 'Online'} />)}</View>
                  <Text style={styles.price}>{money(service.priceMinor)}</Text>
                </View>
              </Card>
            ))}
            <Button label="Explore all services" tone="outline" onPress={() => router.replace('/marketplace')} />
          </FadeUp>
        ) : null}
      </ScrollView>
      <JobSeekerNav />
    </ScreenIn>
  );
}

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.question}><Text style={type.label}>{label}</Text><View style={styles.options}>{children}</View></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.field },
  body: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 30, gap: 20 },
  heading: { gap: 8 },
  triageCard: { gap: 20 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  spark: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.yellowTint, alignItems: 'center', justifyContent: 'center' },
  cardTitleCopy: { flex: 1, gap: 2 },
  question: { gap: 10 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  results: { gap: 14 },
  resultHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  serviceFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  price: { fontFamily: fonts.extra, fontSize: 18, color: colors.green },
});
