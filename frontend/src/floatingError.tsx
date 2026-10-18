import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Glyph } from '@/src/components/Glyph';
import { colors, fonts, radius, shadow } from '@/src/theme';

interface FloatingErrorValue {
  show(id: string, message: string): void;
  hide(id: string): void;
}

interface ActiveError {
  id: string;
  message: string;
}

const FloatingErrorContext = createContext<FloatingErrorValue | null>(null);

/**
 * Owns the single page-level error shown above the current route. New errors
 * replace older ones, so a burst of failed requests never creates a toast stack.
 */
export function FloatingErrorProvider({ children }: PropsWithChildren) {
  const [active, setActive] = useState<ActiveError | null>(null);

  const show = useCallback((id: string, message: string) => {
    setActive({ id, message });
  }, []);
  const hide = useCallback((id: string) => {
    setActive((current) => current?.id === id ? null : current);
  }, []);
  const value = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <FloatingErrorContext.Provider value={value}>
      {children}
      {active ? <FloatingError message={active.message} onDismiss={() => hide(active.id)} /> : null}
    </FloatingErrorContext.Provider>
  );
}

/** Returns false outside the root provider, allowing isolated components to keep an inline fallback. */
export function useFloatingError(message: string): boolean {
  const host = useContext(FloatingErrorContext);
  const id = useId();

  useEffect(() => {
    if (!host || !message) return;
    host.show(id, message);
    return () => host.hide(id);
  }, [host, id, message]);

  return host !== null;
}

function FloatingError({ message, onDismiss }: { message: string; onDismiss(): void }) {
  const { width } = useWindowDimensions();
  const desktopWeb = Platform.OS === 'web' && width >= 768;

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        style={[styles.card, shadow.toast, desktopWeb ? styles.desktop : styles.mobile]}
      >
        <Text style={styles.message}>{message}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss error"
          hitSlop={10}
          onPress={onDismiss}
          style={styles.close}
        >
          <Glyph name="close" size={20} color={colors.dangerInk} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 35 },
  card: {
    position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.danger,
    borderRadius: radius.lg, paddingLeft: 16, paddingRight: 8, paddingVertical: 10,
  },
  mobile: { top: 12, left: 12, right: 12 },
  desktop: { right: 24, bottom: 24, width: 440 },
  message: { flex: 1, fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.dangerInk },
  close: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
