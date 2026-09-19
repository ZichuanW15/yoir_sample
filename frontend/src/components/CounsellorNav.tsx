import { Href, router, usePathname } from 'expo-router';
import { useAuth } from '@/src/auth/AuthContext';
import { BottomNav } from '@/src/components/BottomNav';
import { GlyphName } from '@/src/components/Glyph';

type NavItem = { label: string; glyph: GlyphName; href: Href; match: string };

const items: NavItem[] = [
  { label: 'Workspace', glyph: 'briefcase', href: '/counsellor' as Href, match: '/counsellor' },
  { label: 'Bookings', glyph: 'calendar', href: '/bookings', match: '/bookings' },
  { label: 'Profile', glyph: 'seeker', href: '/counsellor/profile', match: '/counsellor/profile' },
];

/**
 * The Career Professional's sections, in the same shape as the Job Seeker's:
 * their workspace, the sessions booked with them, and their public profile.
 */
export function CounsellorNav() {
  const pathname = usePathname();
  const { session } = useAuth();

  if (session?.user.role !== 'counsellor') return null;

  const navigate = (item: NavItem) => router.replace(item.href);

  return (
    <BottomNav
      tabs={items.map((item) => ({
        label: item.label,
        glyph: item.glyph,
        // '/counsellor' alone must not read as active on its own sub-pages
        // (availability, services/new, …), so only that one tab is an exact match.
        active: item.match === '/counsellor' ? pathname === item.match : pathname.startsWith(item.match),
        onPress: () => navigate(item),
      }))}
    />
  );
}
