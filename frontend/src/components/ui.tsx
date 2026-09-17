import { PropsWithChildren, ReactNode } from 'react';
import {
  Animated, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle,
} from 'react-native';
import { Pop, useAnimatedValue, useSpin } from '@/src/motion';
import { colors, fonts, radius, shadow, type } from '@/src/theme';

const APressable = Animated.createAnimatedComponent(Pressable);

/** Every tappable surface in the redesign dips to scale(.97) while held. */
export function Press({ onPress, children, style, scaleTo = 0.97, disabled, accessibilityLabel, accessibilityRole = 'button', accessibilityState }: PropsWithChildren<{
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'radio' | 'checkbox' | 'tab';
  accessibilityState?: object;
}>) {
  const s = useAnimatedValue(1);
  const to = (v: number) => Animated.spring(s, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  return (
    // The Pressable itself is animated so layout styles (flex, width) reach the
    // touch target rather than an inner view the parent cannot size.
    <APressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      disabled={disabled || !onPress}
      onPress={onPress}
      onPressIn={() => to(scaleTo)}
      onPressOut={() => to(1)}
      style={[style, { transform: [{ scale: s }] }]}
    >
      {children}
    </APressable>
  );
}

export function Spinner({ size = 20, color = colors.white }: { size?: number; color?: string }) {
  const spin = useSpin(true);
  return (
    <Animated.View
      style={{
        width: size, height: size, borderRadius: size / 2, borderWidth: 2.5,
        borderColor: 'rgba(255,255,255,.3)', borderTopColor: color, transform: [{ rotate: spin }],
      }}
    />
  );
}

type ButtonTone = 'primary' | 'outline' | 'soft' | 'quiet' | 'danger';

export function Button({ label, onPress, tone = 'primary', busy = false, disabled = false, height = 56, labelSize = 16, icon, style }: {
  label: string;
  onPress?: () => void;
  tone?: ButtonTone;
  busy?: boolean;
  disabled?: boolean;
  height?: number;
  labelSize?: number;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const ink = tones[tone].color;
  return (
    <Press
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      style={[btn.base, { height }, tones[tone].box, (disabled || busy) && btn.dim, style]}
    >
      <View style={btn.row}>
        {busy ? <Spinner color={ink} /> : icon}
        <Text style={[btn.label, { color: ink, fontSize: labelSize }]}>{label}</Text>
      </View>
    </Press>
  );
}

const btn = StyleSheet.create({
  base: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontFamily: fonts.bold, fontSize: 16 },
  dim: { opacity: 0.55 },
});

const tones: Record<ButtonTone, { box: ViewStyle; color: string }> = {
  primary: { box: { backgroundColor: colors.green }, color: colors.white },
  outline: { box: { borderWidth: 1.5, borderColor: colors.green, backgroundColor: 'transparent' }, color: colors.green },
  soft: { box: { backgroundColor: colors.greenTint }, color: colors.green },
  quiet: { box: { backgroundColor: 'transparent' }, color: colors.muted },
  danger: { box: { backgroundColor: 'transparent' }, color: colors.danger },
};

/** The round 44px control used for back and close. */
export function IconButton({ onPress, children, tone = 'chip', label }: PropsWithChildren<{ onPress(): void; tone?: 'chip' | 'white'; label: string }>) {
  return (
    <Press onPress={onPress} scaleTo={0.92} accessibilityLabel={label} style={[icons.base, tone === 'white' ? [icons.white, shadow.soft] : icons.chip]}>
      {children}
    </Press>
  );
}

const icons = StyleSheet.create({
  base: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  chip: { backgroundColor: colors.chip },
  white: { backgroundColor: colors.white },
});

export function Field({ label, style, ...props }: TextInputProps & { label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 7 }, style]}>
      <Text style={field.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.sub}
        {...props}
        style={[field.input, props.multiline && field.multiline]}
      />
    </View>
  );
}

const field = StyleSheet.create({
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  input: {
    height: 54, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md,
    paddingHorizontal: 16, fontSize: 16, fontFamily: fonts.sans, color: colors.ink, backgroundColor: colors.field,
  },
  multiline: { height: 116, paddingTop: 15, textAlignVertical: 'top' },
});

/** A filter/option chip: 38px pill that fills green when selected. */
export function Chip({ label, selected, onPress, role = 'radio' }: { label: string; selected: boolean; onPress(): void; role?: 'radio' | 'checkbox' }) {
  return (
    <Press
      onPress={onPress}
      scaleTo={0.94}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
      style={[chipS.base, { backgroundColor: selected ? colors.green : colors.white, borderColor: selected ? colors.green : colors.line }]}
    >
      <Text style={[chipS.text, { color: selected ? colors.white : colors.muted }]}>{label}</Text>
    </Press>
  );
}

const chipS = StyleSheet.create({
  base: { height: 38, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: fonts.semi, fontSize: 13 },
});

/** A read-only pill: modality, location, slot status. */
export function Tag({ label, bg = colors.chip, fg = colors.muted, icon }: { label: string; bg?: string; fg?: string; icon?: ReactNode }) {
  return (
    <View style={[tagS.base, { backgroundColor: bg }]}>
      {icon}
      <Text style={[tagS.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const tagS = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  text: { fontFamily: fonts.semi, fontSize: 12 },
});

/** A white floating card. */
export function Card({ children, style, onPress, accessibilityLabel, pad = 20, round = radius.xl }: PropsWithChildren<{
  style?: StyleProp<ViewStyle>; onPress?(): void; accessibilityLabel?: string; pad?: number; round?: number;
}>) {
  const base: StyleProp<ViewStyle> = [{ backgroundColor: colors.white, borderRadius: round, padding: pad, gap: 14 }, shadow.card, style];
  if (onPress) return <Press onPress={onPress} scaleTo={0.98} accessibilityLabel={accessibilityLabel} style={base}>{children}</Press>;
  return <View style={base}>{children}</View>;
}

export function Avatar({ initials, size = 44, bg = colors.green, fg = colors.white, ring = false }: {
  initials: string; size?: number; bg?: string; fg?: string; ring?: boolean;
}) {
  return (
    <View style={[
      { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' },
      ring && { borderWidth: 2, borderColor: colors.yellow },
    ]}>
      <Text style={{ fontFamily: fonts.extra, fontSize: size * 0.32, color: fg }}>{initials}</Text>
    </View>
  );
}

/** The inline error banner used by every form. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <Pop duration={300}>
      <View accessibilityRole="alert" style={banner.box}>
        <Text style={banner.text}>{message}</Text>
      </View>
    </Pop>
  );
}

const banner = StyleSheet.create({
  box: { backgroundColor: colors.dangerBg, borderRadius: radius.md, padding: 14 },
  text: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.dangerInk },
});

export function Eyebrow({ children, style }: PropsWithChildren<{ style?: StyleProp<TextStyle> }>) {
  return <Text style={[type.eyebrow, style]}>{children}</Text>;
}
