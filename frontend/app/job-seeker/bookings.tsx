import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/auth/AuthContext';
import { Glyph } from '@/src/components/Glyph';
import { JobSeekerNav } from '@/src/components/JobSeekerNav';
import { Button, Card, Tag } from '@/src/components/ui';
import { ScreenIn } from '@/src/motion';
import { colors, type } from '@/src/theme';

export default function JobSeekerBookingsScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  if (!session) return <Redirect href={{ pathname: '/auth/login', params: { role: 'job_seeker' } }} />;
  if (session.user.role !== 'job_seeker') return <Redirect href="/counsellor" />;

  return (
    <ScreenIn style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.heading}><Text style={type.eyebrow}>My schedule</Text><Text style={type.display34}>Bookings</Text></View>
        <Card style={styles.empty}>
          <View style={styles.mark}><Glyph name="calendar" size={34} color={colors.green} /></View>
          <Tag label="Frontend preview" bg={colors.yellowTint} fg={colors.amberInk} />
          <Text style={type.display24}>Your confirmed sessions will appear here.</Text>
          <Text style={[type.body, styles.center]}>The payment flow already returns a booking. The list endpoint will connect this screen to saved bookings when the backend adds <Text style={styles.code}>GET /me/bookings</Text>.</Text>
          <Button label="Explore services" onPress={() => router.replace('/marketplace')} />
        </Card>
      </ScrollView>
      <JobSeekerNav />
    </ScreenIn>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.field }, body: { flexGrow: 1, padding: 22, gap: 24 }, heading: { gap: 7 },
  empty: { alignItems: 'center', marginTop: 20 }, mark: { width: 76, height: 76, borderRadius: 26, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' }, code: { color: colors.green },
});
