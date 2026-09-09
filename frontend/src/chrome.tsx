import { router } from 'expo-router';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/auth/AuthContext';
import { initials } from '@/src/format';
import { Button } from '@/src/components/ui';
import { Glyph } from '@/src/components/Glyph';
import { useAnimatedValue } from '@/src/motion';
import { colors, fonts, radius, shadow, type } from '@/src/theme';

interface ChromeValue {
  flash(message: string): void;
  openSheet(): void;
  closeSheet(): void;
}

const ChromeContext = createContext<ChromeValue | undefined>(undefined);

export function useChrome() {
  const value = useContext(ChromeContext);
  if (!value) throw new Error('useChrome must be used within ChromeProvider.');
  return value;
}

/** Toast and the account sheet live above every screen, as in the prototype. */
export function ChromeProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState('');
  const [sheet, setSheet] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(message);
    timer.current = setTimeout(() => setToast(''), 2400);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const value = useMemo<ChromeValue>(
    () => ({ flash, openSheet: () => setSheet(true), closeSheet: () => setSheet(false) }),
    [flash],
  );

  return (
    <ChromeContext.Provider value={value}>
      {children}
      {toast ? <Toast message={toast} /> : null}
      {sheet ? <AccountSheet onClose={() => setSheet(false)} /> : null}
    </ChromeContext.Provider>
  );
}

function Toast({ message }: { message: string }) {
  const insets = useSafeAreaInsets();
  const t = useAnimatedValue(0);
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 400, easing: Easing.bezier(0.2, 0, 0, 1), useNativeDriver: true }).start();
  }, [t]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        toastS.box, shadow.toast,
        { top: insets.top + 14, opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] },
      ]}
    >
      <View style={toastS.dot} />
      <Text style={toastS.text}>{message}</Text>
    </Animated.View>
  );
}

const toastS = StyleSheet.create({
  box: {
    position: 'absolute', alignSelf: 'center', zIndex: 50, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.green, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.pill,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.yellow },
  text: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
});

function AccountSheet({ onClose }: { onClose(): void }) {
  const insets = useSafeAreaInsets();
  const { session, logout } = useAuth();
  const { flash } = useChrome();
  const t = useAnimatedValue(0);

  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 450, easing: Easing.bezier(0.2, 0, 0, 1), useNativeDriver: true }).start();
  }, [t]);

  if (!session) return null;
  const counsellor = session.user.role === 'counsellor';

  return (
    <View style={sheetS.host}>
      <Animated.View style={[sheetS.scrim, { opacity: t }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          sheetS.sheet,
          { paddingBottom: insets.bottom + 34, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }] },
        ]}
      >
        <View style={sheetS.grip} />
        <View style={sheetS.identity}>
          <View style={sheetS.avatarRing}>
            <View style={sheetS.avatar}><Text style={sheetS.avatarText}>{initials(session.user.name)}</Text></View>
          </View>
          <View style={sheetS.identityCopy}>
            <Text style={type.display24}>{session.user.name}</Text>
            <View style={sheetS.roleTag}>
              <Text style={sheetS.roleText}>{counsellor ? 'Career Counsellor' : 'Job Seeker'}</Text>
            </View>
          </View>
        </View>

        {counsellor ? (
          <Button label="Open my workspace" tone="soft" height={52} onPress={() => { onClose(); router.replace('/counsellor'); }} />
        ) : null}

        <Button
          label="Log out"
          tone="danger"
          height={52}
          icon={<Glyph name="logout" size={18} color={colors.danger} />}
          onPress={() => { onClose(); logout(); router.replace('/'); flash('Logged out'); }}
        />
      </Animated.View>
    </View>
  );
}

const sheetS = StyleSheet.create({
  host: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 40, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.white, borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingTop: 14, paddingHorizontal: 24, gap: 18,
  },
  grip: { width: 40, height: 5, borderRadius: radius.pill, backgroundColor: colors.line, alignSelf: 'center' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarRing: { width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.extra, fontSize: 22, color: colors.white },
  identityCopy: { flex: 1, gap: 5 },
  roleTag: { alignSelf: 'flex-start', backgroundColor: colors.yellowTint, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  roleText: { fontFamily: fonts.bold, fontSize: 12, color: colors.amberInk },
});
