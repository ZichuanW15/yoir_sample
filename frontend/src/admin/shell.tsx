import { router, usePathname } from 'expo-router';
import { PropsWithChildren, useEffect } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { initials } from '@/src/format';
import { Avatar, Button, ErrorBanner, Press, Spinner } from '@/src/components/ui';
import { BottomNav } from '@/src/components/BottomNav';
import { Glyph, GlyphName } from '@/src/components/Glyph';
import { ScreenIn } from '@/src/motion';
import { colors, fonts, type } from '@/src/theme';

const tabs: { href: '/admin' | '/admin/verifications' | '/admin/counsellors' | '/admin/bookings' | '/admin/payments'; label: string; glyph: GlyphName }[] = [
  { href: '/admin', label: 'Overview', glyph: 'eye' },
  { href: '/admin/verifications', label: 'Verify', glyph: 'shieldCheck' },
  { href: '/admin/counsellors', label: 'Users', glyph: 'mentor' },
  { href: '/admin/bookings', label: 'Bookings', glyph: 'calendar' },
  { href: '/admin/payments', label: 'Payments', glyph: 'wallet' },
];

/**
 * The frame every administration screen sits in.
 *
 * It also guards the area in the app. That is a convenience, not the protection:
 * the backend refuses each of these endpoints to anyone who is not a Platform
 * Owner, so hiding the tabs is about not showing people doors they cannot open.
 */
export function AdminShell({ title, subtitle, busy, back, children }: PropsWithChildren<{
  title: string;
  subtitle?: string;
  busy?: boolean;
  /** A detail screen names the list it came from; the label is that list's name. */
  back?: { label: string; onPress(): void };
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
        {back ? (
          <Press onPress={back.onPress} accessibilityLabel={`Back to ${back.label}`} style={styles.back}>
            <View style={styles.backMark}><Glyph name="chevronRight" size={14} color={colors.green} /></View>
            <Text style={styles.backText}>{back.label}</Text>
          </Press>
        ) : <Text style={type.groupLabel}>Yoir administration</Text>}
        <Text style={type.display28}>{title}</Text>
        {subtitle ? <Text style={type.small}>{subtitle}</Text> : null}
      </View>

      {busy ? (
        <View style={styles.centred}><Spinner size={26} color={colors.green} /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.frame, styles.body]}
        >
          {children}
        </ScrollView>
      )}

      {/* Five sections is one too many to read as a row of pills, and a scrolling strip
          hid the last of them. A bar pinned to the thumb shows all five at once and
          never moves between screens. The job seeker's sections use the same bar. */}
      <BottomNav
        tabs={tabs.map((tab) => ({
          label: tab.label,
          glyph: tab.glyph,
          // A detail screen keeps its section lit.
          active: pathname === tab.href || (tab.href !== '/admin' && pathname.startsWith(`${tab.href}/`)),
          onPress: () => router.replace(tab.href),
        }))}
      />
    </ScreenIn>
  );
}

/** Backend values made readable: `refunded_slot_taken` reads "Refunded slot taken". */
export const readable = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');

/** An order's money to the cent, as its receipt shows it. */
export const currency = (minor: number) =>
  `$${(minor / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const paymentTone: Record<string, { bg: string; fg: string }> = {
  paid: { bg: colors.greenTint, fg: colors.greenDeep },
  not_started: { bg: colors.chip, fg: colors.muted },
  failed: { bg: colors.dangerBg, fg: colors.dangerInk },
  refunded: { bg: colors.yellowTint, fg: colors.amberInk },
  partially_refunded: { bg: colors.yellowTint, fg: colors.amberInk },
};

/** A failed read: the reason and a way to ask again, never an empty list posing as the answer. */
export function LoadFailed({ message, onRetry }: { message: string; onRetry(): void }) {
  return (
    <View style={styles.failed}>
      <ErrorBanner message={message} />
      <Button label="Try again" tone="outline" height={48} onPress={onRetry} />
    </View>
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
  body: { paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, alignSelf: 'flex-start' },
  backMark: { transform: [{ rotate: '180deg' }] },
  backText: { fontFamily: fonts.bold, fontSize: 13, color: colors.green },
  failed: { gap: 12 },
});
