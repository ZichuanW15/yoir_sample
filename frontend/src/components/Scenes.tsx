import { useEffect } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polyline, Rect } from 'react-native-svg';
import { createAnimatedSvg } from '@/src/components/animatedSvg';
import { Float, Pop, Pulse, Wiggle, useAnimatedValue } from '@/src/motion';
import { colors, fonts } from '@/src/theme';

const ACircle = createAnimatedSvg(Circle);
const APath = createAnimatedSvg(Path);
const APolyline = createAnimatedSvg(Polyline);
const AG = createAnimatedSvg(G);
const EASE = Easing.bezier(0.2, 0, 0, 1);

/** Draws a dashed stroke on, from fully hidden to fully drawn. */
function useDraw(length: number, duration: number, delay: number) {
  const t = useAnimatedValue(length);
  useEffect(() => {
    const anim = Animated.timing(t, { toValue: 0, duration, delay, easing: EASE, useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [t, length, duration, delay]);
  return t;
}

/* ── Entry: the journey from job seeker to counsellor ─────────────────────── */

const JOURNEY = 'M30 168 C 90 168, 105 86, 168 96 S 250 156, 306 66';

/** Sampled points along JOURNEY, so the travelling dot can follow it. */
const cubic = (p0: number[], p1: number[], p2: number[], p3: number[], t: number) => {
  const u = 1 - t;
  return [0, 1].map((i) => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]);
};
const JOURNEY_POINTS = (() => {
  const first = [[30, 168], [90, 168], [105, 86], [168, 96]];
  const second = [[168, 96], [231, 106], [250, 156], [306, 66]];
  const pts: number[][] = [];
  for (let i = 0; i <= 12; i++) pts.push(cubic(first[0], first[1], first[2], first[3], i / 12));
  for (let i = 1; i <= 12; i++) pts.push(cubic(second[0], second[1], second[2], second[3], i / 12));
  return pts;
})();

function TravellingDot() {
  const t = useAnimatedValue(0);
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(2600),
        Animated.timing(t, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: false }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [t]);
  const range = JOURNEY_POINTS.map((_, i) => i / (JOURNEY_POINTS.length - 1));
  return (
    <ACircle
      r={6}
      fill={colors.yellow}
      cx={t.interpolate({ inputRange: range, outputRange: JOURNEY_POINTS.map((p) => p[0]) })}
      cy={t.interpolate({ inputRange: range, outputRange: JOURNEY_POINTS.map((p) => p[1]) })}
      opacity={t.interpolate({ inputRange: [0, 0.08, 0.92, 1], outputRange: [0, 1, 1, 0] })}
    />
  );
}

/** Scales a group about its own centre, matching the prototype's `pop` keyframe. */
function PopGroup({ x, y, delay, duration = 700, children }: { x: number; y: number; delay: number; duration?: number; children: React.ReactNode }) {
  const t = useAnimatedValue(0);
  useEffect(() => {
    const anim = Animated.timing(t, { toValue: 1, duration, delay, easing: EASE, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [t, delay, duration]);
  return (
    // Scaling about (x, y) written as translate -> scale -> translate back, rather
    // than with originX/originY: react-native-svg turns those into a kebab-case
    // `transform-origin` DOM attribute that React rejects on web. The nesting is the
    // same transform, expressed only in props that survive both platforms.
    <AG opacity={t.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] })}>
      <G x={x} y={y}>
        <AG scale={t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.4, 1.12, 1] })}>
          <G x={-x} y={-y}>{children}</G>
        </AG>
      </G>
    </AG>
  );
}

/** A looping scale about a fixed centre, matching `pulse`. */
function PulseCircle({ cx, cy, r, fill, opacity, duration = 4000 }: { cx: number; cy: number; r: number; fill: string; opacity?: number; duration?: number }) {
  const t = useAnimatedValue(0);
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(t, { toValue: 0, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [t, duration]);
  return (
    // Scaling a circle about its own centre is exactly a change of radius, so the
    // group transform is unnecessary here — and with it goes the transform-origin.
    <ACircle
      cx={cx}
      cy={cy}
      r={t.interpolate({ inputRange: [0, 1], outputRange: [r, r * 1.18] })}
      fill={fill}
      opacity={opacity}
    />
  );
}

/** A looping vertical drift, matching `float`. */
function FloatGroup({ distance = 9, duration = 5000, delay = 0, children }: { distance?: number; duration?: number; delay?: number; children: React.ReactNode }) {
  const t = useAnimatedValue(0);
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: duration / 2, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(t, { toValue: 0, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [t, distance, duration, delay]);
  return <AG y={t.interpolate({ inputRange: [0, 1], outputRange: [0, -distance] })}>{children}</AG>;
}

export function EntryScene() {
  const draw = useDraw(470, 2400, 300);
  return (
    <View style={scene.entryCard}>
      <Svg viewBox="0 0 340 210" width="100%" height={210}>
        <PulseCircle cx={282} cy={52} r={40} fill={colors.yellow} opacity={0.18} />
        <FloatGroup duration={5000}><Circle cx={282} cy={52} r={16} fill={colors.yellow} /></FloatGroup>
        <Path d={JOURNEY} fill="none" stroke={colors.amber} strokeOpacity={0.45} strokeWidth={2.5} strokeDasharray="5 9" />
        <APath d={JOURNEY} fill="none" stroke={colors.green} strokeWidth={3} strokeLinecap="round" strokeDasharray="470" strokeDashoffset={draw} />
        <TravellingDot />
        <PopGroup x={30} y={168} delay={200}>
          <Circle cx={30} cy={168} r={22} fill={colors.greenTint} />
          <Circle cx={30} cy={162} r={6} fill={colors.green} />
          <Path d="M19 180c2-6 6-9 11-9s9 3 11 9" fill="none" stroke={colors.green} strokeWidth={3} strokeLinecap="round" />
        </PopGroup>
        <PopGroup x={169} y={95} delay={1500}>
          <Rect x={146} y={72} width={46} height={46} rx={12} fill={colors.greenTint} />
          <Line x1={146} y1={86} x2={192} y2={86} stroke={colors.green} strokeWidth={2.5} />
          <Circle cx={160} cy={98} r={3} fill={colors.mark} />
          <Circle cx={170} cy={98} r={3} fill={colors.mark} />
          <Circle cx={180} cy={98} r={3} fill={colors.amber} />
          <Circle cx={160} cy={108} r={3} fill={colors.mark} />
          <Circle cx={170} cy={108} r={3} fill={colors.mark} />
        </PopGroup>
        <PopGroup x={306} y={66} delay={2700}>
          <Circle cx={306} cy={66} r={22} fill={colors.yellow} />
          <Circle cx={306} cy={60} r={6} fill={colors.green} />
          <Path d="M295 78c2-6 6-9 11-9s9 3 11 9" fill="none" stroke={colors.green} strokeWidth={3} strokeLinecap="round" />
        </PopGroup>
        <PopGroup x={330} y={44} delay={3300} duration={600}>
          <Circle cx={330} cy={44} r={11} fill={colors.green} />
          <Path d="M324.5 44.5l3.5 3.5 7-7.5" fill="none" stroke={colors.yellow} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        </PopGroup>
        <Circle cx={70} cy={60} r={5} fill={colors.green} opacity={0.25} />
        <Circle cx={240} cy={180} r={4} fill={colors.yellow} opacity={0.7} />
        <Circle cx={110} cy={190} r={3} fill={colors.green} opacity={0.2} />
      </Svg>
    </View>
  );
}

/* ── Welcome: the role you picked, with orbiting badges ───────────────────── */

export function WelcomeScene() {
  return (
    <View style={scene.welcome}>
      <Pulse style={scene.welcomeHalo}><View style={scene.welcomeHaloFill} /></Pulse>
      <Pop delay={100} style={scene.welcomeDisc}>
        <Svg width={64} height={64} viewBox="0 0 24 24">
          <Circle cx={12} cy={8} r={3.6} fill="none" stroke={colors.white} strokeWidth={1.6} />
          <Path d="M5.2 20c.7-3.5 3.4-5.4 6.8-5.4s6.1 1.9 6.8 5.4" fill="none" stroke={colors.white} strokeWidth={1.6} strokeLinecap="round" />
        </Svg>
      </Pop>
      <Float duration={4000} style={scene.welcomeBadgeTop}>
        <View style={[scene.badge, { backgroundColor: colors.yellow }]}>
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Rect x={3.5} y={5.5} width={17} height={15} rx={2.6} fill="none" stroke={colors.green} strokeWidth={2} />
            <Line x1={3.5} y1={10} x2={20.5} y2={10} stroke={colors.green} strokeWidth={2} />
          </Svg>
        </View>
      </Float>
      <Float duration={5000} delay={1000} style={scene.welcomeBadgeBottom}>
        <View style={[scene.badge, scene.badgeSmall, { backgroundColor: colors.white }]}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Polyline points="4.5,12.5 9.5,17.5 19.5,6.5" fill="none" stroke={colors.greenDeep} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
      </Float>
    </View>
  );
}

/* ── Register: two people connected ───────────────────────────────────────── */

export function RegisterScene() {
  return (
    <View style={scene.registerCard}>
      <Svg viewBox="0 0 320 120" width="100%" height={120}>
        <FloatGroup duration={5000}>
          <Circle cx={60} cy={60} r={26} fill={colors.green} />
          <Circle cx={60} cy={53} r={7} fill={colors.white} />
          <Path d="M47 74c2-7 7-10 13-10s11 3 13 10" fill="none" stroke={colors.white} strokeWidth={3} strokeLinecap="round" />
        </FloatGroup>
        <Path d="M92 60 H 228" stroke={colors.green} strokeWidth={2.5} strokeDasharray="4 8" />
        <FloatGroup duration={5000} delay={1200}>
          <Circle cx={260} cy={60} r={26} fill={colors.yellow} />
          <Circle cx={260} cy={53} r={7} fill={colors.green} />
          <Path d="M247 74c2-7 7-10 13-10s11 3 13 10" fill="none" stroke={colors.green} strokeWidth={3} strokeLinecap="round" />
        </FloatGroup>
        <PopGroup x={160} y={37} delay={800} duration={600}>
          <Rect x={142} y={22} width={36} height={30} rx={9} fill={colors.white} />
          <Line x1={150} y1={33} x2={170} y2={33} stroke={colors.green} strokeWidth={2.5} strokeLinecap="round" />
          <Line x1={150} y1={41} x2={164} y2={41} stroke={colors.mark} strokeWidth={2.5} strokeLinecap="round" />
        </PopGroup>
        <PopGroup x={160} y={92} delay={1600} duration={600}>
          <Circle cx={160} cy={92} r={14} fill={colors.white} />
          <Path d="M153 92l5 5 9-10" fill="none" stroke={colors.greenDeep} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        </PopGroup>
      </Svg>
    </View>
  );
}

/* ── Checkout: the hold countdown ring ────────────────────────────────────── */

export function CountdownRing({ remaining, total, label }: { remaining: number; total: number; label: string }) {
  const progress = Math.max(0, Math.min(1, remaining / total));
  const offset = 264 * (1 - progress);
  const stroke = remaining < 120000 ? colors.danger : colors.amber;
  return (
    <View style={scene.ring}>
      <Svg width={84} height={84} viewBox="0 0 96 96" style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={48} cy={48} r={42} fill="none" stroke={colors.yellowTint} strokeWidth={7} />
        <Circle cx={48} cy={48} r={42} fill="none" stroke={stroke} strokeWidth={7} strokeLinecap="round" strokeDasharray="264" strokeDashoffset={offset} />
      </Svg>
      <View style={scene.ringLabel}><Text style={scene.ringText}>{label}</Text></View>
    </View>
  );
}

/* ── Confirmation: the drawn success seal ─────────────────────────────────── */

export function SuccessSeal() {
  const ring = useDraw(190, 1000, 300);
  const tick = useDraw(40, 500, 1000);
  return (
    <Svg width={120} height={120} viewBox="0 0 96 96">
      <PopGroup x={48} y={48} delay={0} duration={600}><Circle cx={48} cy={48} r={40} fill={colors.successBg} /></PopGroup>
      <ACircle
        cx={48} cy={48} r={30} fill="none" stroke={colors.greenDeep} strokeWidth={2.6}
        strokeDasharray="190" strokeDashoffset={ring} transform="rotate(-90 48 48)"
      />
      <APolyline
        points="35,48.5 44,57.5 61,39" fill="none" stroke={colors.greenDeep} strokeWidth={4.5}
        strokeLinecap="round" strokeLinejoin="round" strokeDasharray="40" strokeDashoffset={tick}
      />
      <Circle cx={48} cy={6} r={3.5} fill={colors.yellow} />
      <Circle cx={84} cy={20} r={3} fill={colors.yellow} />
      <Circle cx={12} cy={20} r={3} fill={colors.yellow} />
      <Circle cx={88} cy={60} r={2.5} fill={colors.amber} />
      <Circle cx={8} cy={62} r={2.5} fill={colors.amber} />
    </Svg>
  );
}

/* ── Marketplace: nothing found ───────────────────────────────────────────── */

export function EmptySearchMark() {
  return (
    <Wiggle>
      <View style={scene.emptyMark}>
        <Svg width={34} height={34} viewBox="0 0 24 24">
          <Circle cx={10.5} cy={10.5} r={6} fill="none" stroke={colors.green} strokeWidth={1.8} />
          <Line x1={15} y1={15} x2={20} y2={20} stroke={colors.green} strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
      </View>
    </Wiggle>
  );
}

const scene = StyleSheet.create({
  entryCard: { backgroundColor: colors.white, borderRadius: 32, paddingTop: 18, paddingHorizontal: 10, paddingBottom: 6, overflow: 'hidden' },
  welcome: { width: 180, height: 180, alignSelf: 'center' },
  welcomeHalo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  welcomeHaloFill: { flex: 1, borderRadius: 999, backgroundColor: colors.greenTint },
  welcomeDisc: { position: 'absolute', top: 22, left: 22, right: 22, bottom: 22, borderRadius: 999, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  welcomeBadgeTop: { position: 'absolute', right: 6, top: 14 },
  welcomeBadgeBottom: { position: 'absolute', left: 4, bottom: 20 },
  badge: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  badgeSmall: { width: 34, height: 34 },
  registerCard: { backgroundColor: colors.greenTint, borderRadius: 28, paddingTop: 14, paddingHorizontal: 12, paddingBottom: 4, overflow: 'hidden' },
  ring: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  ringLabel: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringText: { fontFamily: fonts.extra, fontSize: 15, color: colors.ink },
  emptyMark: { width: 80, height: 80, borderRadius: 999, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' },
});
