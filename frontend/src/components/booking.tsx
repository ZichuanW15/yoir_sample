import { Fragment, useState } from 'react';
import { Platform, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import { BookableStart } from '@/src/api/types';
import { Glyph } from '@/src/components/Glyph';
import { IconButton, Press } from '@/src/components/ui';
import { desktopCard, useDesktop } from '@/src/desktop';
import { duration, fmtDay, timeRange } from '@/src/format';
import { Pop } from '@/src/motion';
import { colors, fonts, radius } from '@/src/theme';

const STEPS = ['Time', 'Payment', 'Confirmed'];

/** The purchase indicator carried unchanged across slots, checkout and confirmation. */
export function BookingSteps({ step }: { step: 0 | 1 | 2 }) {
  // Desktop sets each label beside its dot, with short fixed links between them.
  const desktop = useDesktop();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
      style={s.steps}
    >
      {STEPS.map((label, index) => (
        <Fragment key={label}>
          {index > 0 ? <View style={[s.link, index <= step && s.linkDone, desktop && s.desktopLink]} /> : null}
          <View style={[s.step, desktop && s.desktopStep]}>
            <View style={[s.dot, index <= step && s.dotFilled]}>
              {index < step
                ? <Glyph name="check" size={13} color={colors.white} />
                : <Text style={[s.dotText, index <= step && s.dotTextOn]}>{index + 1}</Text>}
            </View>
            <Text style={[s.stepLabel, index === step && s.stepLabelOn, desktop && s.desktopStepLabel]}>{label}</Text>
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

/**
 * Desktop: the open times as a grid of cards under each day. The column count is
 * worked out from the measured width — at least 200px a card, as the redesign's
 * auto-fill grid — so the last row keeps the same card width instead of stretching.
 */
export function DesktopSlotDays({ days, selected, onSelect }: {
  days: BookableStart[][]; selected: string; onSelect(startsAt: string): void;
}) {
  const [width, setWidth] = useState(0);
  const columns = Math.max(1, Math.floor((width + GRID_GAP) / (200 + GRID_GAP)));
  const cell = width ? (width - GRID_GAP * (columns - 1)) / columns : 200;
  return (
    <View style={s.desktopDays} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {days.map((day) => (
        <View key={day[0].startsAt} style={s.desktopDay}>
          <View style={s.dayHeading}>
            <View style={s.dayDot} />
            <Text style={s.dayLabel}>{fmtDay(day[0].startsAt)}</Text>
          </View>
          <View style={s.desktopGrid}>
            {day.map((slot) => {
              const on = slot.startsAt === selected;
              return (
                <Press
                  key={slot.startsAt}
                  onPress={() => onSelect(slot.startsAt)}
                  scaleTo={0.98}
                  accessibilityRole="radio"
                  accessibilityLabel={`${fmtDay(slot.startsAt)}, ${timeRange(slot.startsAt, slot.endsAt)}, ${duration(slot.startsAt, slot.endsAt)}`}
                  accessibilityState={{ selected: on, checked: on }}
                  style={[s.desktopSlot, { width: cell }, on ? s.desktopSlotOn : s.desktopSlotOff]}
                >
                  <View style={[s.desktopMark, on ? s.desktopMarkOn : s.desktopMarkOff]}>
                    {on ? <Pop duration={300}><Glyph name="check" size={12} color={colors.green} /></Pop> : null}
                  </View>
                  {/* Stacked rather than side by side, so a time range never wraps in a 200px card. */}
                  <View style={s.desktopSlotCopy}>
                    <Text style={[s.desktopSlotTime, on && s.desktopSlotTimeOn]}>{timeRange(slot.startsAt, slot.endsAt)}</Text>
                    <Text style={[s.desktopSlotDuration, on && s.desktopSlotDurationOn]}>{duration(slot.startsAt, slot.endsAt)}</Text>
                  </View>
                </Press>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const GRID_GAP = 10;

/**
 * Desktop: the summary card beside the main column. It stays in view while the
 * page scrolls — react-native-web passes `sticky` through to CSS, which React
 * Native's own types do not list.
 */
export const desktopAside = {
  ...desktopCard, width: 300, alignSelf: 'flex-start', position: 'sticky', top: 0,
} as unknown as ViewStyle;

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

  desktopStep: { flexDirection: 'row', gap: 8 },
  desktopLink: { flex: 0, width: 44, marginBottom: 0 },
  desktopStepLabel: { fontSize: 12 },

  desktopDays: { gap: 22 },
  desktopDay: { gap: 10 },
  dayHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber },
  dayLabel: { fontFamily: fonts.extra, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.muted },
  desktopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  desktopSlot: { minHeight: 58, paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1.5 },
  desktopSlotOn: { backgroundColor: colors.green, borderColor: colors.green },
  desktopSlotOff: { backgroundColor: colors.white, borderColor: colors.line },
  desktopMark: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  desktopMarkOn: { borderColor: colors.yellow, backgroundColor: colors.yellow },
  desktopMarkOff: { borderColor: colors.mark, backgroundColor: colors.white },
  desktopSlotCopy: { flex: 1, gap: 2 },
  desktopSlotTime: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  desktopSlotTimeOn: { color: colors.white },
  desktopSlotDuration: { fontFamily: fonts.sans, fontSize: 12, color: colors.sub },
  desktopSlotDurationOn: { color: colors.onDarkMuted },
});
