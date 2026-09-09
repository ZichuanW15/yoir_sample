import { Platform, TextStyle, ViewStyle } from 'react-native';

/**
 * Yoir design tokens, taken verbatim from the approved redesign prototype
 * (Downloads/Mobile app redesign/Yoir App.dc.html). Every value here appears in
 * that file — do not invent new ones.
 */
export const colors = {
  green: '#1E3A27',
  greenHover: '#16301F',
  greenTint: '#E4EEE6',
  greenDeep: '#2E6B4F',

  yellow: '#F2C35B',
  yellowTint: '#FBF0D6',
  amber: '#E3A63A',
  amberInk: '#8A5A0B',
  amberDeep: '#5A3D12',
  eyebrow: '#B07C30',

  line: '#E8E4DA',
  lineSoft: '#EEEBE3',
  mark: '#C7BDAC',

  ink: '#12241A',
  muted: '#66756B',
  sub: '#7A8880',
  onDarkMuted: '#A9BEAF',

  white: '#FFFFFF',
  field: '#FAF9F5',
  chip: '#F3F1EA',
  canvas: '#EFEDE6',

  successBg: '#DFEEE6',
  successInk: '#12301F',
  dangerBg: '#F8E5E1',
  dangerInk: '#4C120C',
  danger: '#A33A2E',

  scrim: 'rgba(18,36,26,.45)',
} as const;

export const radius = { sm: 14, md: 16, lg: 20, xl: 24, xxl: 28, hero: 32, pill: 999 } as const;

/** Two typefaces: Instrument Serif for display, Manrope for everything else. */
export const fonts = {
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  sans: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semi: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extra: 'Manrope_800ExtraBold',
} as const;

export const type = {
  display40: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 41, letterSpacing: -0.5, color: colors.ink } as TextStyle,
  display36: { fontFamily: fonts.serif, fontSize: 36, lineHeight: 38, letterSpacing: -0.4, color: colors.ink } as TextStyle,
  display34: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 36, letterSpacing: -0.3, color: colors.ink } as TextStyle,
  display28: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 31, color: colors.ink } as TextStyle,
  display24: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 27, color: colors.ink } as TextStyle,
  display20: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 24, color: colors.ink } as TextStyle,

  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, color: colors.muted } as TextStyle,
  bodySm: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.muted } as TextStyle,
  small: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.muted } as TextStyle,
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink } as TextStyle,
  strong: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink } as TextStyle,
  eyebrow: { fontFamily: fonts.extra, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.eyebrow } as TextStyle,
  groupLabel: { fontFamily: fonts.extra, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.sub } as TextStyle,
} as const;

/** The floating-card shadow used across the redesign. */
export const shadow = {
  card: Platform.select({
    ios: { shadowColor: '#1E3A27', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 12 } },
    android: { elevation: 4 },
    default: { boxShadow: '0 1px 2px rgba(30,58,39,.04),0 14px 34px -18px rgba(30,58,39,.25)' },
  }) as ViewStyle,
  soft: Platform.select({
    ios: { shadowColor: '#1E3A27', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    android: { elevation: 2 },
    default: { boxShadow: '0 1px 3px rgba(30,58,39,.08)' },
  }) as ViewStyle,
  toast: Platform.select({
    ios: { shadowColor: '#1E3A27', shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
    android: { elevation: 8 },
    default: { boxShadow: '0 14px 30px -12px rgba(30,58,39,.6)' },
  }) as ViewStyle,
} as const;

/** The prototype's single easing curve, and the delays it staggers content on. */
export const EASE = { x1: 0.2, y1: 0, x2: 0, y2: 1 } as const;
export const HOLD_MS = 15 * 60 * 1000;
