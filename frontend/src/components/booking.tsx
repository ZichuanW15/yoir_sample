import { Fragment } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import { Glyph } from '@/src/components/Glyph';
import { IconButton } from '@/src/components/ui';
import { colors, fonts, radius } from '@/src/theme';

const STEPS = ['Time', 'Payment', 'Confirmed'];

/** The purchase indicator carried unchanged across slots, checkout and confirmation. */
export function BookingSteps({ step }: { step: 0 | 1 | 2 }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
      style={s.steps}
    >
      {STEPS.map((label, index) => (
        <Fragment key={label}>
          {index > 0 ? <View style={[s.link, index <= step && s.linkDone]} /> : null}
          <View style={s.step}>
            <View style={[s.dot, index <= step && s.dotFilled]}>
              {index < step
                ? <Glyph name="check" size={13} color={colors.white} />
                : <Text style={[s.dotText, index <= step && s.dotTextOn]}>{index + 1}</Text>}
            </View>
            <Text style={[s.stepLabel, index === step && s.stepLabelOn]}>{label}</Text>
          </View>
        </Fragment>
      ))}
    </View>
  );
}

/** The 44px round back control with the screen title centred beside it. */
export function BackBar({ title, onBack }: { title: string; onBack(): void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.bar, { paddingTop: insets.top + 10 }]}>
      <IconButton tone="white" label="Go back" onPress={onBack}>
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Polyline
            points="14.5,5 7.5,12 14.5,19"
            fill="none" stroke={colors.green} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          />
        </Svg>
      </IconButton>
      <Text style={s.barTitle}>{title}</Text>
      <View style={s.barSpacer} />
    </View>
  );
}

/**
 * Reserving and paying hold their busy state for a fixed beat, as the prototype
 * does, so the buyer sees the work happen rather than a flicker. The beat runs
 * alongside the request, so a slow API is never delayed on top of it.
 */
export const RESERVE_MS = 700;
export const PAY_MS = 1100;

export const beat = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** References are read aloud over the phone, so they are set in a fixed pitch. */
export const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const s = StyleSheet.create({
  steps: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  step: { alignItems: 'center', gap: 6 },
  link: { flex: 1, height: 2, borderRadius: 2, marginBottom: 18, backgroundColor: colors.line },
  linkDone: { backgroundColor: colors.green },
  dot: {
    width: 28, height: 28, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  dotFilled: { backgroundColor: colors.green, borderColor: colors.green },
  dotText: { fontFamily: fonts.extra, fontSize: 12, color: colors.sub },
  dotTextOn: { color: colors.white },
  stepLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.sub },
  stepLabelOn: { color: colors.green },

  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  barTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  barSpacer: { width: 44 },
});
