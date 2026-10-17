import { Platform, PressableStateCallbackType, useWindowDimensions } from 'react-native';

/**
 * The desktop layout is a browser at desktop width and nothing else: the iOS and
 * Android apps and phone browsers never meet this. Kept apart from src/desktop.tsx,
 * which imports the chrome, so the chrome can ask without an import cycle.
 */
export const DESKTOP_MIN_WIDTH = 1024;

export function useDesktop(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH;
}

/** react-native-web reports hover on Pressable; React Native's types do not know it. */
export const hovered = (state: PressableStateCallbackType) => Boolean((state as { hovered?: boolean }).hovered);
