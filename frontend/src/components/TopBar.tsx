import { router } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { Glyph } from '@/src/components/Glyph';
import { Avatar, Press } from '@/src/components/ui';
import { initials } from '@/src/format';
import { useNotifications } from '@/src/notifications';
import { useProfilePhoto } from '@/src/profilePhoto';
import { colors, fonts, radius } from '@/src/theme';

/**
 * The wordmark bar over the job seeker's screens and Explore. The avatar opens the
 * account sheet — edit profile, sessions, log out — and the bell a job seeker's
 * notifications dropdown, so neither takes a place in the bottom navigation.
 */
export function TopBar() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { openSheet, openNotifications } = useChrome();
  const photo = useProfilePhoto();
  const { unread } = useNotifications();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 12 }]}>
      <Image source={require('@/assets/images/yoir-wordmark.png')} style={styles.wordmark} resizeMode="contain" accessibilityLabel="Yoir" />
      {session ? (
        <View style={styles.actions}>
          {session.user.role === 'job_seeker' ? (
            <Press
              onPress={openNotifications}
              scaleTo={0.92}
              accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
              style={styles.bell}
            >
              <Glyph name="bell" size={21} color={colors.green} />
              {unread ? <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View> : null}
            </Press>
          ) : null}
          <Press onPress={openSheet} scaleTo={0.92} accessibilityLabel={`Account, ${session.user.name}`} style={styles.avatarRing}>
            <Avatar initials={initials(session.user.name)} photo={photo} size={42} />
          </Press>
        </View>
      ) : (
        <Press onPress={() => router.push('/auth/login')} scaleTo={0.96} accessibilityLabel="Log in" style={styles.loginPill}>
          <Text style={styles.loginPillText}>Log in</Text>
        </Press>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6, paddingHorizontal: 22 },
  wordmark: { width: 66, height: 25 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bell: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.line,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.extra, fontSize: 9, color: colors.white },
  avatarRing: { padding: 2, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.yellow, backgroundColor: colors.white },
  loginPill: { height: 40, paddingHorizontal: 18, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  loginPillText: { fontFamily: fonts.bold, fontSize: 14, color: colors.green },
});
