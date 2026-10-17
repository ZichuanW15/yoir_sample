import { Href, router, usePathname } from 'expo-router';
import { PropsWithChildren, ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useAuth } from '@/src/auth/AuthContext';
import { roleLabel, useChrome } from '@/src/chrome';
import { Glyph, GlyphName } from '@/src/components/Glyph';
import { Avatar } from '@/src/components/ui';
import { initials } from '@/src/format';
import { FadeUp } from '@/src/motion';
import { useNotifications } from '@/src/notifications';
import { useProfilePhoto } from '@/src/profilePhoto';
import { hovered, useDesktop } from '@/src/responsive';
import { colors, fonts, radius, shadow, type } from '@/src/theme';

/**
 * The desktop layout (Downloads/Desktop frontend redesign/Yoir Desktop.dc.html).
 *
 * Screens branch on `useDesktop()` for layout only; data, state and actions are
 * shared, and everywhere that is not a desktop browser keeps the mobile layout.
 */
export { DESKTOP_MIN_WIDTH, hovered, useDesktop } from '@/src/responsive';

/** `/`, and the log in, register and password screens, sit beside the brand panel. */
const isAuthPath = (pathname: string) => pathname === '/' || pathname.startsWith('/auth/');

/**
 * Wraps the router: brand panel beside the auth screens, the sidebar beside the rest.
 * The router keeps its place in the tree either way, so resizing across the
 * breakpoint never remounts the open screen and loses what was typed into it.
 */
export function DesktopFrame({ children }: PropsWithChildren) {
  const desktop = useDesktop();
  return (
    <View style={desktop ? frame.row : frame.fill}>
      {desktop ? <DesktopAside /> : null}
      <View style={desktop ? frame.main : frame.fill}>{children}</View>
    </View>
  );
}

function DesktopAside() {
  const pathname = usePathname();
  return isAuthPath(pathname) ? <BrandPanel /> : <Sidebar pathname={pathname} />;
}

/** A soft gold glow, the radial gradient the redesign lays behind its dark green panels. */
export function Glow({ size, style, strength = 0.28 }: { size: number; style?: StyleProp<ViewStyle>; strength?: number }) {
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="yoirGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.yellow} stopOpacity={strength} />
            <Stop offset="0.7" stopColor={colors.yellow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#yoirGlow)" />
      </Svg>
    </View>
  );
}

function BrandPanel() {
  const chips: { glyph: GlyphName; label: string }[] = [
    { glyph: 'shieldCheck', label: 'Verified professionals' },
    { glyph: 'lock', label: 'Secure payment through Yoir' },
    { glyph: 'video', label: 'Online or in person' },
  ];
  return (
    <View style={brand.panel}>
      <Glow size={460} style={{ right: -140, top: -140 }} />
      <View style={brand.dot} />
      <Image source={require('@/assets/images/yoir-wordmark-light.png')} style={brand.wordmark} resizeMode="contain" accessibilityLabel="Yoir" />
      <View style={brand.fill} />
      <View style={brand.copy}>
        <Text style={[type.eyebrow, brand.eyebrow]}>Career guidance</Text>
        <Text style={brand.headline}>
          Career guidance <Text style={brand.accent}>that fits you</Text>
        </Text>
        <Text style={brand.body}>Yoir connects job seekers with verified Career Professionals. Tell us how you will use it.</Text>
        <View style={brand.chips}>
          {chips.map((chip) => (
            <View key={chip.label} style={brand.chip}>
              <Glyph name={chip.glyph} size={16} color={colors.yellow} />
              <Text style={brand.chipText}>{chip.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

type NavItem = { label: string; glyph: GlyphName; active: boolean; onPress(): void; badge?: number };

function Sidebar({ pathname }: { pathname: string }) {
  const { session } = useAuth();
  const { openSheet, openNotifications } = useChrome();
  const { unread } = useNotifications();
  const photo = useProfilePhoto();
  const role = session?.user.role;

  const on = (...prefixes: string[]) => prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const go = (href: Href) => () => router.replace(href);
  const checkingOut = on('/bookings/checkout', '/bookings/confirmation');

  let heading: string;
  let items: NavItem[];
  if (!session) {
    heading = 'Browsing as a guest';
    items = [
      { label: 'Explore', glyph: 'search', active: on('/marketplace', '/services', '/professionals'), onPress: go('/marketplace') },
      { label: 'My sessions', glyph: 'calendar', active: false, onPress: () => router.push({ pathname: '/auth/login', params: { role: 'job_seeker' } }) },
    ];
  } else if (role === 'job_seeker') {
    heading = 'Job Seeker';
    items = [
      { label: 'Home', glyph: 'home', active: pathname === '/job-seeker' || on('/job-seeker/diagnosis'), onPress: go('/job-seeker' as Href) },
      { label: 'Explore', glyph: 'search', active: on('/marketplace', '/services', '/professionals') || checkingOut, onPress: go('/marketplace') },
      { label: 'My sessions', glyph: 'calendar', active: on('/bookings') && !checkingOut, onPress: go('/bookings') },
      { label: 'Notifications', glyph: 'bell', active: false, onPress: openNotifications, badge: unread },
    ];
  } else if (role === 'counsellor') {
    heading = 'Career Professional';
    items = [
      { label: 'Workspace', glyph: 'briefcase', active: pathname === '/counsellor' || on('/counsellor/onboarding', '/counsellor/services'), onPress: go('/counsellor' as Href) },
      { label: 'My sessions', glyph: 'calendar', active: on('/bookings'), onPress: go('/bookings') },
      { label: 'Availability', glyph: 'clock', active: on('/counsellor/availability'), onPress: go('/counsellor/availability') },
      { label: 'Profile', glyph: 'seeker', active: on('/counsellor/profile', '/settings/privacy'), onPress: go('/counsellor/profile') },
      { label: 'Payouts', glyph: 'wallet', active: on('/counsellor/payouts'), onPress: go('/counsellor/payouts') },
      { label: 'Verification', glyph: 'shieldCheck', active: on('/counsellor/verification'), onPress: go('/counsellor/verification') },
    ];
  } else {
    heading = 'Platform Owner';
    items = [
      { label: 'Overview', glyph: 'eye', active: pathname === '/admin', onPress: go('/admin') },
      { label: 'Verifications', glyph: 'shieldCheck', active: on('/admin/verifications'), onPress: go('/admin/verifications') },
      { label: 'Users', glyph: 'mentor', active: on('/admin/counsellors'), onPress: go('/admin/counsellors') },
      { label: 'Bookings', glyph: 'calendar', active: on('/admin/bookings'), onPress: go('/admin/bookings') },
      { label: 'Payments', glyph: 'wallet', active: on('/admin/payments'), onPress: go('/admin/payments') },
    ];
  }

  return (
    <View style={side.bar}>
      <Image source={require('@/assets/images/yoir-wordmark-light.png')} style={side.wordmark} resizeMode="contain" accessibilityLabel="Yoir" />
      <Text style={[type.eyebrow, side.heading]}>{heading}</Text>
      {/* Links, not buttons: they lead to places, and a page's own "Availability"
          button must stay the only button with that name. */}
      <View style={side.nav} role="navigation">
        {items.map((item) => {
          const ink = item.active ? colors.yellow : colors.onDarkMuted;
          return (
            <Pressable
              key={item.label}
              onPress={item.onPress}
              accessibilityRole="link"
              accessibilityLabel={item.badge ? `${item.label}, ${item.badge} unread` : item.label}
              accessibilityState={{ selected: item.active }}
              style={(state) => [side.item, item.active ? side.itemActive : hovered(state) && side.itemHover]}
            >
              <Glyph name={item.glyph} size={20} color={ink} />
              <Text style={[side.itemText, { color: ink }]}>{item.label}</Text>
              {item.badge ? <View style={side.badge}><Text style={side.badgeText}>{item.badge > 9 ? '9+' : item.badge}</Text></View> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={side.fill} />
      {session ? (
        <Pressable
          onPress={openSheet}
          accessibilityRole="button"
          accessibilityLabel={`Account, ${session.user.name}`}
          style={(state) => [side.account, hovered(state) && side.accountHover]}
        >
          <Avatar initials={initials(session.user.name)} photo={photo} size={40} bg={colors.greenDeep} ring />
          <View style={side.accountCopy}>
            <Text numberOfLines={1} style={side.accountName}>{session.user.name}</Text>
            <Text style={side.accountRole}>{roleLabel[session.user.role]}</Text>
          </View>
          <Glyph name="chevronDown" size={16} color={colors.onDarkMuted} />
        </Pressable>
      ) : (
        <View style={side.guest}>
          <Pressable
            onPress={() => router.push({ pathname: '/auth/login', params: { role: 'job_seeker' } })}
            accessibilityRole="button"
            accessibilityLabel="Log in"
            style={(state) => [side.guestLogin, hovered(state) && { backgroundColor: colors.amber }]}
          >
            <Text style={side.guestLoginText}>Log in</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/auth/register', params: { role: 'job_seeker' } })}
            accessibilityRole="button"
            accessibilityLabel="Create an account"
            style={(state) => [side.guestRegister, hovered(state) && side.itemHover]}
          >
            <Text style={side.guestRegisterText}>Create an account</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** The scrolling page beside the sidebar: a 1280px column, as the redesign's <main>. */
export function DesktopPage({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return (
    <ScrollView style={page.scroll} contentContainerStyle={page.outer} keyboardShouldPersistTaps="handled">
      <FadeUp duration={450} style={[page.inner, style]}>{children}</FadeUp>
    </ScrollView>
  );
}

/** Eyebrow, serif title and a line of context, with an optional control on the right. */
export function PageHeader({ eyebrow, title, subtitle, right }: { eyebrow?: string; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={page.header}>
      <View style={page.headerCopy}>
        {eyebrow ? <Text style={type.eyebrow}>{eyebrow}</Text> : null}
        <Text style={page.title}>{title}</Text>
        {subtitle ? <Text style={page.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** The white pill that leads back to the list a detail screen came from. */
export function BackPill({ label, onPress, accessibilityLabel }: { label: string; onPress(): void; accessibilityLabel?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={(state) => [page.back, hovered(state) && { borderColor: colors.green }]}
    >
      <Glyph name="chevronLeft" size={16} color={colors.green} />
      <Text style={page.backText}>{label}</Text>
    </Pressable>
  );
}

/**
 * The redesign's card: white, hairline border, the shared floating shadow.
 * Registered through StyleSheet so a screen's own style later in the array can
 * override it; a plain object is inlined on the web and would always win.
 */
export const desktopCard = StyleSheet.create({
  card: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: 22, padding: 22, gap: 14,
    ...shadow.card,
  },
}).card;

/**
 * An auth screen's scroll content: a column centred in the whole panel beside the
 * brand panel, as the redesign's <section>. The panel is what scrolls, and only
 * when the window is too short, so no scrollbar sits beside the column.
 */
export const desktopAuthBody: ViewStyle = {
  // 460px of content plus a 24px gutter each side, room for the cards' shadows.
  flexGrow: 1, width: '100%', maxWidth: 508, alignSelf: 'center', justifyContent: 'center',
  paddingTop: 32, paddingBottom: 32, paddingHorizontal: 24,
};

const frame = StyleSheet.create({
  fill: { flex: 1 },
  row: { flex: 1, flexDirection: 'row', backgroundColor: colors.canvas },
  // Beside the 256px sidebar it takes the rest; beside the brand panel (flex 4) it is the 6 of 4fr/6fr.
  main: { flex: 6, minWidth: 0 },
});

const brand = StyleSheet.create({
  panel: { flex: 4, minWidth: 300, backgroundColor: colors.green, paddingVertical: 40, paddingHorizontal: 52, overflow: 'hidden' },
  dot: { position: 'absolute', right: 56, top: 64, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.yellow },
  wordmark: { height: 36, width: 36 * (159 / 60) },
  fill: { flex: 1 },
  copy: { gap: 18, maxWidth: 520 },
  eyebrow: { color: colors.yellow },
  headline: { fontFamily: fonts.serif, fontSize: 56, lineHeight: 58, letterSpacing: -0.8, color: colors.canvas },
  accent: { fontFamily: fonts.serifItalic, color: colors.yellow },
  body: { fontFamily: fonts.sans, fontSize: 17, lineHeight: 27, color: colors.onDarkMuted, maxWidth: 440 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,.08)' },
  chipText: { fontFamily: fonts.semi, fontSize: 13, color: colors.canvas },
});

const side = StyleSheet.create({
  bar: { width: 256, backgroundColor: colors.green, paddingTop: 26, paddingHorizontal: 16, paddingBottom: 18 },
  wordmark: { height: 30, width: 30 * (159 / 60), marginLeft: 10, marginBottom: 24 },
  heading: { color: colors.yellow, letterSpacing: 1.2, marginBottom: 10, paddingHorizontal: 12 },
  nav: { gap: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 44, paddingHorizontal: 12, borderRadius: radius.sm },
  itemActive: { backgroundColor: 'rgba(255,255,255,.1)' },
  itemHover: { backgroundColor: 'rgba(255,255,255,.08)' },
  itemText: { flex: 1, fontFamily: fonts.bold, fontSize: 14 },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: radius.pill, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.extra, fontSize: 11, color: colors.green },
  fill: { flex: 1 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,.06)' },
  accountHover: { backgroundColor: 'rgba(255,255,255,.1)' },
  accountCopy: { flex: 1, minWidth: 0, gap: 2 },
  accountName: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  accountRole: { fontFamily: fonts.semi, fontSize: 12, color: colors.onDarkMuted },
  guest: { gap: 8 },
  guestLogin: { height: 44, borderRadius: radius.pill, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  guestLoginText: { fontFamily: fonts.bold, fontSize: 14, color: colors.green },
  guestRegister: { height: 44, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.onDarkMuted, alignItems: 'center', justifyContent: 'center' },
  guestRegisterText: { fontFamily: fonts.bold, fontSize: 14, color: colors.canvas },
});

const page = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.canvas },
  outer: { flexGrow: 1 },
  inner: { width: '100%', maxWidth: 1280, alignSelf: 'center', paddingTop: 36, paddingHorizontal: 48, paddingBottom: 72, gap: 22 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 },
  headerCopy: { flexShrink: 1, gap: 8 },
  title: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 39, letterSpacing: -0.4, color: colors.ink },
  subtitle: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, color: colors.muted },
  back: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingLeft: 10, paddingRight: 14,
    borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white,
  },
  backText: { fontFamily: fonts.bold, fontSize: 13, color: colors.green },
});
