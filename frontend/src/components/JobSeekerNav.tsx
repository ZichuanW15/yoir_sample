import { Href, router, usePathname } from 'expo-router';
import { useAuth } from '@/src/auth/AuthContext';
import { BottomNav } from '@/src/components/BottomNav';
import { GlyphName } from '@/src/components/Glyph';

type NavItem = { label: string; glyph: GlyphName; href: Href; match: string };

const items: NavItem[] = [
  { label: 'Home', glyph: 'home', href: '/job-seeker' as Href, match: '/job-seeker' },
  { label: 'Explore', glyph: 'search', href: '/marketplace', match: '/marketplace' },
  { label: 'Bookings', glyph: 'calendar', href: '/bookings', match: '/bookings' },
];

/**
 * The Job Seeker's sections. Notifications and the profile live in the top bar,
 * as in any app, rather than taking a place here.
 */
export function JobSeekerNav() {
  const pathname = usePathname();
  const { session } = useAuth();

  if (session?.user.role === 'counsellor' || session?.user.role === 'platform_owner') return null;

  const navigate = (item: NavItem) => {
    if (item.label === 'Bookings' && !session) {
      router.push({ pathname: '/auth/login', params: { role: 'job_seeker' } });
      return;
    }
    router.replace(item.href);
  };

  return (
    <BottomNav
      tabs={items.map((item) => ({
        label: item.label,
        glyph: item.glyph,
        active: item.match === '/job-seeker' ? pathname === item.match : pathname.startsWith(item.match),
        onPress: () => navigate(item),
      }))}
    />
  );
}
