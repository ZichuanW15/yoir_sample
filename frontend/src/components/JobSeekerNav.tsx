import { Href, router, usePathname } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/auth/AuthContext';
import { Glyph, GlyphName } from '@/src/components/Glyph';
import { Press } from '@/src/components/ui';
import { colors, fonts, shadow } from '@/src/theme';

type NavItem = { label: string; glyph: GlyphName; href: Href; match: string };

const items: NavItem[] = [
  { label: 'Home', glyph: 'home', href: '/job-seeker' as Href, match: '/job-seeker' },
  { label: 'Explore', glyph: 'search', href: '/marketplace', match: '/marketplace' },
  { label: 'Bookings', glyph: 'calendar', href: '/job-seeker/bookings' as Href, match: '/job-seeker/bookings' },
  { label: 'Notifications', glyph: 'bell', href: '/job-seeker/notifications' as Href, match: '/job-seeker/notifications' },
  { label: 'Profile', glyph: 'seeker', href: '/job-seeker/profile' as Href, match: '/job-seeker/profile' },
];

/** Shared mobile navigation for the Job Seeker experience. */
export function JobSeekerNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  if (session?.user.role === 'counsellor' || session?.user.role === 'platform_owner') return null;

  const navigate = (item: NavItem) => {
    const protectedDestination = item.label === 'Bookings' || item.label === 'Notifications' || item.label === 'Profile';
    if (protectedDestination && !session) {
      router.push({ pathname: '/auth/login', params: { role: 'job_seeker' } });
      return;
    }
    router.replace(item.href);
  };

  return (
    <View style={[styles.host, shadow.soft, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      {items.map((item) => {
        const active = item.match === '/job-seeker'
          ? pathname === item.match
          : pathname.startsWith(item.match);
        return (
          <Press
            key={item.label}
            onPress={() => navigate(item)}
            scaleTo={0.94}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            style={styles.item}
          >
            <View style={[styles.iconHolder, active && styles.iconHolderActive]}>
              <Glyph name={item.glyph} size={21} color={active ? colors.green : colors.sub} />
            </View>
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>{item.label}</Text>
            {active ? <View style={styles.activeMark} /> : null}
          </Press>
        );
      })}
    </View>
  );
}

export const JOB_SEEKER_NAV_HEIGHT = 76;

const styles = StyleSheet.create({
  host: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.white,
    borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingTop: 8, paddingHorizontal: 6,
  },
  item: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2, paddingVertical: 3 },
  iconHolder: { width: 36, height: 28, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  iconHolderActive: { backgroundColor: colors.yellowTint },
  label: { fontFamily: fonts.semi, fontSize: 10, color: colors.sub },
  labelActive: { fontFamily: fonts.extra, color: colors.green },
  activeMark: { width: 22, height: 3, borderRadius: 2, backgroundColor: colors.yellow, marginTop: 2 },
});
