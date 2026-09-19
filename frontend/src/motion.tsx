import { PropsWithChildren, useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleProp, ViewStyle } from 'react-native';

/**
 * The prototype's keyframes, ported to React Native's Animated. One easing curve
 * throughout — cubic-bezier(.2,0,0,1) — and the same durations and delays.
 */
const EASE = Easing.bezier(0.2, 0, 0, 1);

/**
 * The native driver runs an animation off the JS thread, which only exists on a
 * device. react-native-web has no such thread and warns on every animation that
 * asks for one, so the answer is platform-dependent rather than a constant. Web
 * animations are unaffected — they were always running on the main thread.
 */
export const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** A stable Animated.Value for the life of the component. */
export function useAnimatedValue(initial = 0) {
  const [value] = useState(() => new Animated.Value(initial));
  return value;
}

function useEntrance(delay: number, duration: number) {
  const t = useAnimatedValue(0);
  useEffect(() => {
    const anim = Animated.timing(t, { toValue: 1, duration, delay, easing: EASE, useNativeDriver: USE_NATIVE_DRIVER });
    anim.start();
    return () => anim.stop();
  }, [t, delay, duration]);
  return t;
}

/** fadeUp: opacity 0→1, translateY 14→0. */
export function FadeUp({ children, delay = 0, duration = 500, style }: PropsWithChildren<{ delay?: number; duration?: number; style?: StyleProp<ViewStyle> }>) {
  const t = useEntrance(delay, duration);
  return (
    <Animated.View style={[style, { opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** screenIn: opacity 0→1, translateX 28→0. */
export function ScreenIn({ children, style, duration = 450 }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; duration?: number }>) {
  const t = useEntrance(0, duration);
  return (
    <Animated.View style={[style, { opacity: t, transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** sheetUp: slides a full screen or sheet up from the bottom. */
export function SheetUp({ children, style, distance = 60, duration = 450 }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; distance?: number; duration?: number }>) {
  const t = useEntrance(0, duration);
  return (
    <Animated.View style={[style, { opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** pop: scale .4 → 1.12 → 1 with a fade in. */
export function Pop({ children, delay = 0, duration = 600, style }: PropsWithChildren<{ delay?: number; duration?: number; style?: StyleProp<ViewStyle> }>) {
  const t = useEntrance(delay, duration);
  return (
    <Animated.View
      style={[style, {
        opacity: t.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.4, 1.12, 1] }) }],
      }]}
    >
      {children}
    </Animated.View>
  );
}

function useLoop(duration: number, delay: number) {
  const t = useAnimatedValue(0);
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: duration / 2, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(t, { toValue: 0, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [t, duration, delay]);
  return t;
}

/** float: drifts up and back, forever. */
export function Float({ children, distance = 9, duration = 5000, delay = 0, style }: PropsWithChildren<{ distance?: number; duration?: number; delay?: number; style?: StyleProp<ViewStyle> }>) {
  const t = useLoop(duration, delay);
  return (
    <Animated.View style={[style, { transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -distance] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** pulse: scale 1 → 1.18 with a slight opacity lift. */
export function Pulse({ children, duration = 4000, style }: PropsWithChildren<{ duration?: number; style?: StyleProp<ViewStyle> }>) {
  const t = useLoop(duration, 0);
  return (
    <Animated.View
      style={[style, {
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }],
      }]}
    >
      {children}
    </Animated.View>
  );
}

/** wiggle: rocks between -6° and 6°, used on the empty-search mark. */
export function Wiggle({ children, duration = 2400, style }: PropsWithChildren<{ duration?: number; style?: StyleProp<ViewStyle> }>) {
  const t = useLoop(duration, 0);
  return (
    <Animated.View style={[style, { transform: [{ rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** spin: the button busy indicator. */
export function useSpin(active: boolean) {
  const t = useAnimatedValue(0);
  useEffect(() => {
    if (!active) return;
    t.setValue(0);
    const anim = Animated.loop(Animated.timing(t, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: USE_NATIVE_DRIVER }));
    anim.start();
    return () => anim.stop();
  }, [t, active]);
  return t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
}
