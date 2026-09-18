import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glyph, GlyphName } from '@/src/components/Glyph';
import { Press } from '@/src/components/ui';
import { colors, fonts, radius, shadow } from '@/src/theme';

export type BottomNavTab = { label: string; glyph: GlyphName; active: boolean; onPress: () => void };

/**
 * The floating tab bar pinned to the thumb, shared by every role that has sections.
 *
 * It sits below the page rather than over it, so no screen has to pad its last card
 * clear of it, and its host is transparent so it takes on each screen's background.
 */
export function BottomNav({ tabs }: { tabs: BottomNavTab[] }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.host, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={[styles.nav, shadow.card]} accessibilityRole="tablist">
        {tabs.map((tab) => (
          <Press
            key={tab.label}
            onPress={tab.onPress}
            scaleTo={0.94}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: tab.active }}
            style={[styles.item, tab.active && styles.itemActive]}
          >
            <Glyph name={tab.glyph} size={19} color={tab.active ? colors.green : colors.sub} />
            <Text numberOfLines={1} style={[styles.label, tab.active && styles.labelActive]}>{tab.label}</Text>
          </Press>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { paddingHorizontal: 20, paddingTop: 12 },
  nav: {
    width: '100%', maxWidth: 560, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', height: 62,
    backgroundColor: colors.white, borderRadius: radius.xxl, paddingHorizontal: 6,
  },
  item: { flex: 1, height: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: 3 },
  itemActive: { backgroundColor: colors.greenTint },
  label: { fontFamily: fonts.semi, fontSize: 10, color: colors.sub },
  labelActive: { fontFamily: fonts.extra, color: colors.green },
});
