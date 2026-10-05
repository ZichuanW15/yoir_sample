import { router } from 'expo-router';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/auth/AuthContext';
import { initials } from '@/src/format';
import { Avatar, Button } from '@/src/components/ui';
import { Glyph } from '@/src/components/Glyph';
import { NotificationsPanel } from '@/src/components/NotificationsPanel';
import { useAnimatedValue, USE_NATIVE_DRIVER } from '@/src/motion';
import { useProfilePhoto } from '@/src/profilePhoto';
import { colors, fonts, radius, shadow, type } from '@/src/theme';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as a destructive action (red), for things like deletion. */
  destructive?: boolean;
}

interface ChromeValue {
  flash(message: string): void;
  openSheet(): void;
  closeSheet(): void;
  /** The notifications dropdown under the top bar's bell. */
  openNotifications(): void;
  /**
   * A custom confirmation sheet, resolving true/false.
   *
   * `Alert.alert` is not an option here: react-native-web ships it as a bare no-op
   * (`static alert() {}`), so on web it would silently do nothing at all — no dialog,
   * no error, the tap just goes nowhere. This is the cross-platform replacement, built
   * the same way as the account sheet below so it actually works on every platform.
   */
  confirm(options: ConfirmOptions): Promise<boolean>;
}

const ChromeContext = createContext<ChromeValue | undefined>(undefined);

export function useChrome() {
  const value = useContext(ChromeContext);
  if (!value) throw new Error('useChrome must be used within ChromeProvider.');
  return value;
}

interface PendingConfirm {
  options: ConfirmOptions;
  resolve(value: boolean): void;
}

const roleLabel: Record<string, string> = {
  job_seeker: 'Job Seeker',
  counsellor: 'Career Professional',
  platform_owner: 'Platform Owner',
};

/** Toast, the account sheet and the confirm sheet live above every screen, as in the prototype. */
export function ChromeProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState('');
  const [sheet, setSheet] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(message);
    timer.current = setTimeout(() => setToast(''), 2400);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPendingConfirm({ options, resolve })),
    [],
  );

  const settleConfirm = useCallback((value: boolean) => {
    setPendingConfirm((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  const value = useMemo<ChromeValue>(
    () => ({
      flash, openSheet: () => setSheet(true), closeSheet: () => setSheet(false),
      openNotifications: () => setNotifications(true), confirm,
    }),
    [flash, confirm],
  );

  return (
    <ChromeContext.Provider value={value}>
      {children}
      {toast ? <Toast message={toast} /> : null}
      {sheet ? <AccountSheet onClose={() => setSheet(false)} /> : null}
      {notifications ? <NotificationsPanel onClose={() => setNotifications(false)} /> : null}
      {pendingConfirm ? (
        <ConfirmSheet
          options={pendingConfirm.options}
          onCancel={() => settleConfirm(false)}
          onConfirm={() => settleConfirm(true)}
        />
      ) : null}
    </ChromeContext.Provider>
  );
}

function Toast({ message }: { message: string }) {
  const insets = useSafeAreaInsets();
  const t = useAnimatedValue(0);
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 400, easing: Easing.bezier(0.2, 0, 0, 1), useNativeDriver: USE_NATIVE_DRIVER }).start();
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
  const photo = useProfilePhoto();
  const t = useAnimatedValue(0);

  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 450, easing: Easing.bezier(0.2, 0, 0, 1), useNativeDriver: USE_NATIVE_DRIVER }).start();
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
            <Avatar initials={initials(session.user.name)} photo={photo} size={60} />
          </View>
          <View style={sheetS.identityCopy}>
            <Text style={type.display24}>{session.user.name}</Text>
            <View style={sheetS.roleTag}>
              <Text style={sheetS.roleText}>{roleLabel[session.user.role]}</Text>
            </View>
          </View>
        </View>

        {counsellor ? (
          <Button label="Open my workspace" tone="soft" height={52} onPress={() => { onClose(); router.replace('/counsellor'); }} />
        ) : null}

        {counsellor ? (
          <Button
            label="Verification"
            tone="outline"
            height={52}
            icon={<Glyph name="shieldCheck" size={18} color={colors.green} />}
            onPress={() => { onClose(); router.push('/counsellor/verification'); }}
          />
        ) : null}

        {session.user.role === 'job_seeker' ? (
          <Button
            label="Edit profile"
            tone="soft"
            height={52}
            icon={<Glyph name="pencil" size={18} color={colors.green} />}
            onPress={() => { onClose(); router.push('/job-seeker/profile'); }}
          />
        ) : null}

        {session.user.role === 'platform_owner' ? null : (
          <Button
            label="My sessions"
            tone="outline"
            height={52}
            icon={<Glyph name="calendar" size={18} color={colors.green} />}
            onPress={() => { onClose(); router.push('/bookings'); }}
          />
        )}

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

function ConfirmSheet({ options, onCancel, onConfirm }: { options: ConfirmOptions; onCancel(): void; onConfirm(): void }) {
  const insets = useSafeAreaInsets();
  const t = useAnimatedValue(0);

  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 350, easing: Easing.bezier(0.2, 0, 0, 1), useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [t]);

  return (
    <View style={sheetS.host}>
      <Animated.View style={[sheetS.scrim, { opacity: t }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel" style={StyleSheet.absoluteFill} onPress={onCancel} />
      </Animated.View>
      <Animated.View
        style={[
          sheetS.sheet,
          { paddingBottom: insets.bottom + 24, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }] },
        ]}
      >
        <View style={sheetS.grip} />
        <Text style={type.display24}>{options.title}</Text>
        <Text style={confirmS.message}>{options.message}</Text>
        <Button
          label={options.confirmLabel ?? 'Confirm'}
          tone={options.destructive ? 'danger' : 'primary'}
          height={52}
          onPress={onConfirm}
          style={options.destructive ? confirmS.destructiveButton : undefined}
        />
        <Button label={options.cancelLabel ?? 'Cancel'} tone="quiet" height={48} onPress={onCancel} />
      </Animated.View>
    </View>
  );
}

const confirmS = StyleSheet.create({
  message: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.muted },
  destructiveButton: { backgroundColor: colors.dangerBg },
});

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
  identityCopy: { flex: 1, gap: 5 },
  roleTag: { alignSelf: 'flex-start', backgroundColor: colors.yellowTint, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  roleText: { fontFamily: fonts.bold, fontSize: 12, color: colors.amberInk },
});
