import { router, usePathname } from 'expo-router';
import { PropsWithChildren, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/auth/AuthContext';
import { Press, Spinner } from '@/src/components/ui';
import { ScreenIn } from '@/src/motion';
import { colors, fonts, radius, type } from '@/src/theme';

const tabs = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/verifications', label: 'Verifications' },
  { href: '/admin/counsellors', label: 'Counsellors' },
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/payments', label: 'Payments' },
] as const;

/**
 * The frame every administration screen sits in.
 *
 * It also guards the area in the app. That is a convenience, not the protection:
 * the backend refuses each of these endpoints to anyone who is not a Platform
 * Owner, so hiding the tabs is about not showing people doors they cannot open.
 */
export function AdminShell({ title, subtitle, busy, children }: PropsWithChildren<{
  title: string;
  subtitle?: string;
  busy?: boolean;
}>) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { session, restoring } = useAuth();

  useEffect(() => {
    if (restoring) return;
    if (!session) router.replace('/auth/login');
    else if (session.user.role !== 'platform_owner') router.replace('/');
  }, [restoring, session]);

  if (restoring || session?.user.role !== 'platform_owner') {
    return (
      <View style={[styles.screen, styles.centred]}>
        <Spinner size={28} color={colors.green} />
      </View>
    );
  }

  return (
    <ScreenIn duration={420} style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Text style={type.groupLabel}>Yoir administration</Text>
        <Text style={type.display28}>{title}</Text>
        {subtitle ? <Text style={type.small}>{subtitle}</Text> : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
        style={styles.tabStrip}
      >
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Press
              key={tab.href}
              accessibilityLabel={tab.label}
              scaleTo={0.96}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => router.replace(tab.href)}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
            </Press>
          );
        })}
      </ScrollView>

      {busy ? (
        <View style={styles.centred}><Spinner size={26} color={colors.green} /></View>
      ) : (
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 32 + insets.bottom }]}>
          {children}
        </ScrollView>
      )}
    </ScreenIn>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: { paddingHorizontal: 20, paddingTop: 12, gap: 4 },
  tabStrip: { flexGrow: 0, marginTop: 16 },
  tabs: { paddingHorizontal: 20, gap: 8 },
  tab: {
    height: 38, paddingHorizontal: 16, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white,
  },
  tabActive: { backgroundColor: colors.green },
  tabLabel: { fontFamily: fonts.semi, fontSize: 13, color: colors.muted },
  tabLabelActive: { color: colors.white },
  body: { paddingTop: 18, paddingHorizontal: 20, gap: 16 },
});
