import { Redirect } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/auth/AuthContext';
import { Glyph } from '@/src/components/Glyph';
import { JobSeekerNav } from '@/src/components/JobSeekerNav';
import { Card, Tag } from '@/src/components/ui';
import { ScreenIn } from '@/src/motion';
import { colors, fonts, type } from '@/src/theme';

export default function JobSeekerNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  if (!session) return <Redirect href={{ pathname: '/auth/login', params: { role: 'job_seeker' } }} />;
  if (session.user.role !== 'job_seeker') return <Redirect href="/counsellor" />;

  return (
    <ScreenIn style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.titleRow}><View><Text style={type.eyebrow}>Stay up to date</Text><Text style={type.display34}>Notifications</Text></View><View style={styles.bell}><Glyph name="bell" size={25} color={colors.green} /></View></View>
        <Tag label="Preview data" bg={colors.yellowTint} fg={colors.amberInk} />
        <Card>
          <View style={styles.noticeHead}><View style={styles.dot} /><Text style={styles.noticeTitle}>Booking confirmed</Text><Text style={styles.time}>Just now</Text></View>
          <Text style={type.bodySm}>Your session is confirmed. The final backend will populate the service, counsellor, and appointment time here.</Text>
        </Card>
        <Card>
          <View style={styles.noticeHead}><View style={[styles.dot, styles.dotMuted]} /><Text style={styles.noticeTitle}>Schedule changes</Text><Text style={styles.time}>Example</Text></View>
          <Text style={type.bodySm}>If a confirmed booking changes, you will receive an in-app notification with the previous and updated time.</Text>
        </Card>
        <Text style={styles.contract}>Planned backend contract: GET /me/notifications and PATCH /me/notifications/:id/read.</Text>
      </ScrollView>
      <JobSeekerNav />
    </ScreenIn>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.field }, body: { flexGrow: 1, padding: 22, gap: 14 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bell: { width: 50, height: 50, borderRadius: 18, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' },
  noticeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber },
  dotMuted: { backgroundColor: colors.mark }, noticeTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.ink }, time: { fontFamily: fonts.medium, fontSize: 11, color: colors.sub },
  contract: { ...type.small, textAlign: 'center', marginTop: 10 },
});
