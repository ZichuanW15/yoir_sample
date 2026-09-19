import { Href, router } from 'expo-router';
import { useEffect } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppNotification } from '@/src/api/types';
import { Glyph } from '@/src/components/Glyph';
import { Press } from '@/src/components/ui';
import { useAnimatedValue, USE_NATIVE_DRIVER } from '@/src/motion';
import { ago, useNotifications } from '@/src/notifications';
import { colors, fonts, radius, shadow } from '@/src/theme';

/** The dropdown under the top bar's bell. Tapping anywhere outside it closes it. */
export function NotificationsPanel({ onClose }: { onClose(): void }) {
  const insets = useSafeAreaInsets();
  const { items, unread, refresh, markRead } = useNotifications();
  const t = useAnimatedValue(0);

  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 220, easing: Easing.bezier(0.2, 0, 0, 1), useNativeDriver: USE_NATIVE_DRIVER }).start();
    void refresh();
  }, [t, refresh]);

  const open = (notification: AppNotification) => {
    markRead([notification.id]);
    if (!notification.href) return;
    onClose();
    router.push(notification.href as Href);
  };

  return (
    <View style={styles.host}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close notifications" style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.panel, shadow.card,
          { top: insets.top + 64, opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] },
        ]}
      >
        <View style={styles.head}>
          <Text style={styles.title}>Notifications</Text>
          {unread > 0 ? (
            <Press onPress={() => markRead(items.filter((n) => !n.read).map((n) => n.id))} accessibilityLabel="Mark all as read">
              <Text style={styles.link}>Mark all as read</Text>
            </Press>
          ) : null}
        </View>

        {items.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyMark}><Glyph name="bell" size={22} color={colors.green} /></View>
            <Text style={styles.emptyTitle}>You are all caught up</Text>
            <Text style={styles.emptyBody}>Booking updates and messages from your Career Professionals will appear here.</Text>
          </View>
        ) : (
          <ScrollView style={styles.list}>
            {items.map((notification) => (
              <Press
                key={notification.id}
                onPress={() => open(notification)}
                accessibilityLabel={`${notification.read ? '' : 'Unread: '}${notification.title}`}
                style={[styles.item, !notification.read && styles.itemUnread]}
              >
                <View style={[styles.dot, notification.read && styles.dotRead]} />
                <View style={styles.itemCopy}>
                  <Text style={styles.itemTitle}>{notification.title}</Text>
                  <Text style={styles.itemBody} numberOfLines={2}>{notification.body}</Text>
                </View>
                <Text style={styles.time}>{ago(notification.createdAt)}</Text>
              </Press>
            ))}
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 45 },
  panel: {
    position: 'absolute', right: 16, width: 340, maxWidth: '92%', maxHeight: 460,
    backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineSoft, overflow: 'hidden',
  },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft,
  },
  title: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink },
  link: { fontFamily: fonts.bold, fontSize: 13, color: colors.green },
  empty: { alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 28 },
  emptyMark: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  emptyBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.muted, textAlign: 'center' },
  list: { flexGrow: 0 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  itemUnread: { backgroundColor: colors.field },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber, marginTop: 6 },
  dotRead: { backgroundColor: 'transparent' },
  itemCopy: { flex: 1, gap: 3 },
  itemTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  itemBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, color: colors.muted },
  time: { fontFamily: fonts.medium, fontSize: 11, color: colors.sub, marginTop: 2 },
});
