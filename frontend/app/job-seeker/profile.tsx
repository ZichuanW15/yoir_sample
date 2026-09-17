import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { JobSeekerNav } from '@/src/components/JobSeekerNav';
import { Avatar, Button, Card, Field, Tag } from '@/src/components/ui';
import { initials } from '@/src/format';
import { ScreenIn } from '@/src/motion';
import { colors, type } from '@/src/theme';

export default function JobSeekerProfileScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { flash } = useChrome();
  const [name, setName] = useState(session?.user.name ?? '');
  const [headline, setHeadline] = useState('');
  const [goals, setGoals] = useState('');
  if (!session) return <Redirect href={{ pathname: '/auth/login', params: { role: 'job_seeker' } }} />;
  if (session.user.role !== 'job_seeker') return <Redirect href="/counsellor" />;

  return (
    <ScreenIn style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.heading}><Text style={type.eyebrow}>Your account</Text><Text style={type.display34}>Profile</Text></View>
        <Card>
          <View style={styles.identity}><Avatar initials={initials(session.user.name)} size={64} ring /><View style={styles.identityCopy}><Text style={type.display24}>{session.user.name}</Text><Text style={type.small}>{session.user.email}</Text></View></View>
          <Tag label="Local profile preview" bg={colors.yellowTint} fg={colors.amberInk} />
          <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" />
          <Field label="Current role or study" value={headline} onChangeText={setHeadline} placeholder="e.g. Final-year engineering student" />
          <Field label="Career goals" value={goals} onChangeText={setGoals} multiline placeholder="What would you like help with?" />
          <Button label="Save profile preview" onPress={() => flash('Profile saved in preview only')} />
          <Text style={styles.contract}>Reserved backend contract: GET/PATCH /me/job-seeker-profile.</Text>
        </Card>
      </ScrollView>
      <JobSeekerNav />
    </ScreenIn>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.field }, body: { padding: 22, paddingBottom: 30, gap: 20 }, heading: { gap: 7 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 }, identityCopy: { flex: 1, gap: 3 },
  contract: { ...type.small, textAlign: 'center' },
});
