import { ReactNode } from 'react';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
import { colors } from '@/src/theme';

/**
 * Bespoke SVG glyphs, following the zeldaLabs (TS_V2) glyph idiom: one shared
 * <Frame> wrapper, a single STROKE preset, a 24x24 grid, and colour taken from
 * `currentColor` so a glyph inherits whatever it is placed on. No icon font and
 * no raster assets — every mark here is drawn.
 */

const STROKE = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const HAIRLINE = { ...STROKE, strokeWidth: 1.4 };

export type GlyphName =
  | 'search' | 'filter' | 'check' | 'close' | 'chevronRight' | 'chevronLeft' | 'chevronDown' | 'arrowRight'
  | 'star' | 'shieldCheck' | 'video' | 'pin' | 'calendar' | 'clock'
  | 'wallet' | 'receipt' | 'seeker' | 'mentor' | 'eye' | 'briefcase'
  | 'plus' | 'pencil' | 'trash' | 'logout' | 'sparkle' | 'lock' | 'refresh'
  | 'home' | 'bell';

function Frame({ size, color, children, viewBox = '0 0 24 24' }: {
  size: number;
  color: string;
  children: ReactNode;
  viewBox?: string;
}) {
  return <Svg width={size} height={size} viewBox={viewBox} color={color}>{children}</Svg>;
}

const paths: Record<GlyphName, ReactNode> = {
  home: (
    <>
      <Path d="M3.5 11.2L12 4l8.5 7.2" {...STROKE} />
      <Path d="M5.8 10.2v9.2h12.4v-9.2" {...STROKE} />
      <Path d="M9.6 19.4v-5.8h4.8v5.8" {...STROKE} />
    </>
  ),
  bell: (
    <>
      <Path d="M6.2 10.4a5.8 5.8 0 0111.6 0c0 4 1.7 5.2 2.2 6.1H4c.5-.9 2.2-2.1 2.2-6.1z" {...STROKE} />
      <Path d="M9.5 19a2.8 2.8 0 005 0" {...STROKE} />
    </>
  ),
  search: (
    <>
      <Circle cx={10.5} cy={10.5} r={6} {...STROKE} />
      <Line x1={15} y1={15} x2={20} y2={20} {...STROKE} />
    </>
  ),
  filter: (
    <>
      <Line x1={4} y1={7} x2={20} y2={7} {...STROKE} />
      <Line x1={4} y1={12} x2={20} y2={12} {...STROKE} />
      <Line x1={4} y1={17} x2={20} y2={17} {...STROKE} />
      <Circle cx={9} cy={7} r={2.2} {...STROKE} fill={colors.white} />
      <Circle cx={15} cy={12} r={2.2} {...STROKE} fill={colors.white} />
      <Circle cx={7.5} cy={17} r={2.2} {...STROKE} fill={colors.white} />
    </>
  ),
  check: <Polyline points="4.5,12.5 9.5,17.5 19.5,6.5" {...STROKE} strokeWidth={2.2} />,
  close: (
    <>
      <Line x1={6} y1={6} x2={18} y2={18} {...STROKE} />
      <Line x1={18} y1={6} x2={6} y2={18} {...STROKE} />
    </>
  ),
  chevronRight: <Polyline points="9.5,5 16.5,12 9.5,19" {...STROKE} strokeWidth={2} />,
  chevronLeft: <Polyline points="14.5,5 7.5,12 14.5,19" {...STROKE} strokeWidth={2} />,
  chevronDown: <Polyline points="5,9.5 12,16.5 19,9.5" {...STROKE} strokeWidth={2} />,
  arrowRight: (
    <>
      <Line x1={4} y1={12} x2={19} y2={12} {...STROKE} />
      <Polyline points="13,6 19,12 13,18" {...STROKE} />
    </>
  ),
  star: <Path d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.75L12 16.9l-5.2 2.7 1-5.75-4.2-4.1 5.8-.85z" {...STROKE} />,
  shieldCheck: (
    <>
      <Path d="M12 3.2l7 2.6v5.4c0 4.3-2.9 7.6-7 9.6-4.1-2-7-5.3-7-9.6V5.8z" {...STROKE} />
      <Polyline points="8.6,11.8 11.1,14.3 15.6,9.6" {...STROKE} />
    </>
  ),
  video: (
    <>
      <Rect x={3} y={6.5} width={12.5} height={11} rx={2.4} {...STROKE} />
      <Path d="M15.5 10.6l5-2.6v8l-5-2.6z" {...STROKE} />
    </>
  ),
  pin: (
    <>
      <Path d="M12 21c4-4.3 6-7.4 6-10a6 6 0 10-12 0c0 2.6 2 5.7 6 10z" {...STROKE} />
      <Circle cx={12} cy={10.8} r={2.4} {...STROKE} />
    </>
  ),
  calendar: (
    <>
      <Rect x={3.5} y={5.5} width={17} height={15} rx={2.6} {...STROKE} />
      <Line x1={3.5} y1={10} x2={20.5} y2={10} {...STROKE} />
      <Line x1={8} y1={3} x2={8} y2={7} {...STROKE} />
      <Line x1={16} y1={3} x2={16} y2={7} {...STROKE} />
      <Circle cx={8.5} cy={14} r={1.1} fill="currentColor" stroke="none" />
      <Circle cx={12} cy={14} r={1.1} fill="currentColor" stroke="none" />
    </>
  ),
  clock: (
    <>
      <Circle cx={12} cy={12} r={8.4} {...STROKE} />
      <Polyline points="12,7 12,12 15.6,14.2" {...STROKE} />
    </>
  ),
  wallet: (
    <>
      <Rect x={3} y={6} width={18} height={13} rx={3} {...STROKE} />
      <Path d="M3 10.5h18" {...HAIRLINE} />
      <Circle cx={16.8} cy={14.8} r={1.4} fill="currentColor" stroke="none" />
    </>
  ),
  receipt: (
    <>
      <Path d="M6 3.4h12v17.2l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6z" {...STROKE} />
      <Line x1={9.2} y1={8.4} x2={14.8} y2={8.4} {...HAIRLINE} />
      <Line x1={9.2} y1={12} x2={14.8} y2={12} {...HAIRLINE} />
    </>
  ),
  seeker: (
    <>
      <Circle cx={12} cy={8} r={3.6} {...STROKE} />
      <Path d="M5.2 20c.7-3.5 3.4-5.4 6.8-5.4s6.1 1.9 6.8 5.4" {...STROKE} />
    </>
  ),
  mentor: (
    <>
      <Circle cx={9} cy={8.2} r={3.2} {...STROKE} />
      <Path d="M3.4 19.6c.6-3.1 2.9-4.8 5.6-4.8s5 1.7 5.6 4.8" {...STROKE} />
      <Path d="M16 5.6a3.2 3.2 0 010 6" {...STROKE} />
      <Path d="M17.6 14.9c1.6.6 2.7 2 3 4.7" {...STROKE} />
    </>
  ),
  eye: (
    <>
      <Path d="M2.6 12S6 6.4 12 6.4 21.4 12 21.4 12 18 17.6 12 17.6 2.6 12 2.6 12z" {...STROKE} />
      <Circle cx={12} cy={12} r={2.8} {...STROKE} />
    </>
  ),
  briefcase: (
    <>
      <Rect x={3} y={7.4} width={18} height={12.6} rx={2.6} {...STROKE} />
      <Path d="M9 7.4V5.8A1.8 1.8 0 0110.8 4h2.4A1.8 1.8 0 0115 5.8v1.6" {...STROKE} />
      <Line x1={3} y1={12.6} x2={21} y2={12.6} {...HAIRLINE} />
    </>
  ),
  plus: (
    <>
      <Line x1={12} y1={5} x2={12} y2={19} {...STROKE} strokeWidth={2} />
      <Line x1={5} y1={12} x2={19} y2={12} {...STROKE} strokeWidth={2} />
    </>
  ),
  pencil: (
    <>
      <Path d="M4.5 19.5l.9-3.6L15.6 5.7a1.9 1.9 0 012.7 2.7L8.1 18.6z" {...STROKE} />
      <Line x1={14.3} y1={7} x2={17} y2={9.7} {...HAIRLINE} />
    </>
  ),
  trash: (
    <>
      <Path d="M5.5 7h13l-1 12.2a2 2 0 01-2 1.8H8.5a2 2 0 01-2-1.8z" {...STROKE} />
      <Path d="M9.5 7V5.4A1.4 1.4 0 0110.9 4h2.2a1.4 1.4 0 011.4 1.4V7" {...STROKE} />
      <Line x1={3.8} y1={7} x2={20.2} y2={7} {...STROKE} />
    </>
  ),
  logout: (
    <>
      <Path d="M14 4.5H6.8A1.8 1.8 0 005 6.3v11.4a1.8 1.8 0 001.8 1.8H14" {...STROKE} />
      <Polyline points="16.5,8.5 20,12 16.5,15.5" {...STROKE} />
      <Line x1={20} y1={12} x2={10.5} y2={12} {...STROKE} />
    </>
  ),
  sparkle: (
    <>
      <Path d="M12 3.6l1.7 4.9 4.9 1.7-4.9 1.7L12 16.8l-1.7-4.9-4.9-1.7 4.9-1.7z" {...STROKE} />
      <Path d="M18.4 15.6l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" {...HAIRLINE} />
    </>
  ),
  lock: (
    <>
      <Rect x={4.8} y={10.4} width={14.4} height={9.6} rx={2.6} {...STROKE} />
      <Path d="M8.4 10.4V7.8a3.6 3.6 0 017.2 0v2.6" {...STROKE} />
      <Circle cx={12} cy={15} r={1.3} fill="currentColor" stroke="none" />
    </>
  ),
  refresh: (
    <>
      <Path d="M20 12a8 8 0 11-2.6-5.9" {...STROKE} />
      <Polyline points="20,4 20,8.4 15.6,8.4" {...STROKE} />
    </>
  ),
};

export function Glyph({ name, size = 20, color = colors.muted }: {
  name: GlyphName;
  size?: number;
  color?: string;
}) {
  return <Frame size={size} color={color}>{paths[name]}</Frame>;
}

/** A filled star, for rating values where the outline reads too lightly. */
export function StarMark({ size = 13, color = colors.amber }: { size?: number; color?: string }) {
  return (
    <Frame size={size} color={color}>
      <Path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill="currentColor" />
    </Frame>
  );
}

/* ── Scene glyphs: larger, illustrative marks for empty and success states ── */

export function EmptySearchScene({ size = 104 }: { size?: number }) {
  return (
    <Frame size={size} color={colors.green} viewBox="0 0 96 96">
      <Rect x={10} y={22} width={44} height={10} rx={5} {...HAIRLINE} stroke={colors.mark} />
      <Rect x={10} y={40} width={34} height={10} rx={5} {...HAIRLINE} stroke={colors.mark} />
      <Rect x={10} y={58} width={40} height={10} rx={5} {...HAIRLINE} stroke={colors.mark} />
      <Circle cx={62} cy={48} r={20} {...STROKE} strokeWidth={2.6} />
      <Line x1={76} y1={62} x2={87} y2={73} {...STROKE} strokeWidth={3.2} />
      <Path d="M55 48h14" {...STROKE} strokeWidth={2.6} stroke={colors.amber} />
    </Frame>
  );
}

export function EmptyServicesScene({ size = 104 }: { size?: number }) {
  return (
    <Frame size={size} color={colors.green} viewBox="0 0 96 96">
      <Rect x={18} y={20} width={54} height={38} rx={7} {...HAIRLINE} stroke={colors.mark} />
      <Rect x={26} y={30} width={54} height={38} rx={7} {...STROKE} strokeWidth={2.2} />
      <Line x1={34} y1={42} x2={62} y2={42} {...HAIRLINE} />
      <Line x1={34} y1={51} x2={54} y2={51} {...HAIRLINE} />
      <Circle cx={70} cy={70} r={14} fill={colors.yellowTint} stroke="none" />
      <Line x1={70} y1={63} x2={70} y2={77} {...STROKE} strokeWidth={2.6} stroke={colors.amber} />
      <Line x1={63} y1={70} x2={77} y2={70} {...STROKE} strokeWidth={2.6} stroke={colors.amber} />
    </Frame>
  );
}

export function EmptyAvailabilityScene({ size = 104 }: { size?: number }) {
  return (
    <Frame size={size} color={colors.green} viewBox="0 0 96 96">
      <Rect x={14} y={20} width={56} height={52} rx={8} {...STROKE} strokeWidth={2.2} />
      <Line x1={14} y1={34} x2={70} y2={34} {...STROKE} strokeWidth={2.2} />
      <Line x1={26} y1={13} x2={26} y2={26} {...STROKE} strokeWidth={2.2} />
      <Line x1={58} y1={13} x2={58} y2={26} {...STROKE} strokeWidth={2.2} />
      <Circle cx={28} cy={46} r={2.6} fill={colors.mark} stroke="none" />
      <Circle cx={42} cy={46} r={2.6} fill={colors.mark} stroke="none" />
      <Circle cx={56} cy={46} r={2.6} fill={colors.mark} stroke="none" />
      <Circle cx={28} cy={60} r={2.6} fill={colors.mark} stroke="none" />
      <Circle cx={68} cy={62} r={17} fill={colors.white} stroke="none" />
      <Circle cx={68} cy={62} r={15} {...STROKE} strokeWidth={2.4} stroke={colors.amber} />
      <Polyline points="68,54 68,62 74,65" {...STROKE} strokeWidth={2.4} stroke={colors.amber} />
    </Frame>
  );
}

/** The paid-and-confirmed mark on the booking confirmation. */
export function SuccessSeal({ size = 88 }: { size?: number }) {
  return (
    <Frame size={size} color={colors.greenDeep} viewBox="0 0 96 96">
      <Circle cx={48} cy={48} r={34} fill={colors.successBg} stroke="none" />
      <Circle cx={48} cy={48} r={26} {...STROKE} strokeWidth={2.4} />
      <Polyline points="37,48.5 45,56.5 60,40" {...STROKE} strokeWidth={4} />
      <Line x1={48} y1={6} x2={48} y2={12} {...STROKE} strokeWidth={2.6} stroke={colors.amber} />
      <Line x1={82} y1={22} x2={77} y2={26} {...STROKE} strokeWidth={2.6} stroke={colors.amber} />
      <Line x1={14} y1={22} x2={19} y2={26} {...STROKE} strokeWidth={2.6} stroke={colors.amber} />
    </Frame>
  );
}
