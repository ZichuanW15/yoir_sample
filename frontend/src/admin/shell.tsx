import { router, usePathname } from 'expo-router';
import { PropsWithChildren, useEffect } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { initials } from '@/src/format';
import { Avatar, Press, Spinner } from '@/src/components/ui';
import { Glyph, GlyphName } from '@/src/components/Glyph';
import { ScreenIn } from '@/src/motion';
import { colors, fonts, radius, shadow, type } from '@/src/theme';

const tabs: { href: '/admin' | '/admin/verifications' | '/admin/counsellors' | '/admin/bookings' | '/admin/payments'; label: string; glyph: GlyphName }[] = [
  { href: '/admin', label: 'Overview', glyph: 'eye' },
  { href: '/admin/verifications', label: 'Verify', glyph: 'shieldCheck' },
  { href: '/admin/counsellors', label: 'Counsellors', glyph: 'mentor' },
  { href: '/admin/bookings', label: 'Bookings', glyph: 'calendar' },
  { href: '/admin/payments', label: 'Payments', glyph: 'wallet' },
];

const BAR_HEIGHT = 62;

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
  const { openSheet } = useChrome();

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

  const name = session.user.name;
  // The bar floats over the page, so the last card needs room to clear it.
  const bodyClearance = BAR_HEIGHT + 24 + Math.max(insets.bottom, 12);

  return (
    <ScreenIn duration={420} style={styles.screen}>
      {/* The same wordmark-and-avatar bar the marketplace and the counsellor workspace
          carry. The avatar is also the only way out: logging out lives in the account
          sheet it opens, and without this bar an administrator had no way to reach it. */}
      <View style={[styles.frame, styles.topBar, { paddingTop: insets.top + 12 }]}>
        <Image source={require('@/assets/images/yoir-wordmark.png')} style={styles.wordmark} accessibilityLabel="Yoir" />
        <Press onPress={openSheet} scaleTo={0.92} accessibilityLabel={`Account, ${name}`} style={styles.avatarRing}>
          <Avatar initials={initials(name)} size={42} />
        </Press>
      </View>

      <View style={[styles.frame, styles.head]}>
        <Text style={type.groupLabel}>Yoir administration</Text>
        <Text style={type.display28}>{title}</Text>
        {subtitle ? <Text style={type.small}>{subtitle}</Text> : null}
      </View>

      {busy ? (
        <View style={styles.centred}><Spinner size={26} color={colors.green} /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.frame, styles.body, { paddingBottom: bodyClearance }]}
        >
          {children}
        </ScrollView>
      )}

      {/* Five sections is one too many to read as a row of pills, and a scrolling strip
          hid the last of them. A bar pinned to the thumb shows all five at once and
          never moves between screens. Administration only: no other role has sections. */}
      <View
        pointerEvents="box-none"
        style={[styles.navHost, { paddingBottom: Math.max(insets.bottom, 12) }]}
      >
        <View style={[styles.nav, shadow.card]}>
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Press
                key={tab.href}
                accessibilityLabel={tab.label}
                scaleTo={0.94}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => router.replace(tab.href)}
              >
                <Glyph name={tab.glyph} size={19} color={active ? colors.green : colors.sub} />
                <Text numberOfLines={1} style={[styles.navLabel, active && styles.navLabelActive]}>
                  {tab.label}
                </Text>
              </Press>
            );
          })}
        </View>
      </View>
    </ScreenIn>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // The administration screens are the only part of Yoir people read on a desktop.
  // Without a cap the cards stretch the full width of the window and a two-digit
  // number sits alone in a metre of white; this holds the page to a readable column.
  frame: { width: '100%', maxWidth: 1080, alignSelf: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 6 },
  wordmark: { width: 66, height: 25, resizeMode: 'contain' },
  avatarRing: {
    width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: colors.yellow,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  head: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, gap: 4 },
  body: { paddingHorizontal: 20, gap: 16 },

  navHost: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.canvas,
  },
  nav: {
    width: '100%', maxWidth: 560, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', height: BAR_HEIGHT,
    backgroundColor: colors.white, borderRadius: radius.xxl, paddingHorizontal: 6,
  },
  navItem: { flex: 1, height: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navItemActive: { backgroundColor: colors.greenTint },
  navLabel: { fontFamily: fonts.semi, fontSize: 10, color: colors.sub },
  navLabelActive: { fontFamily: fonts.extra, color: colors.green },
});
