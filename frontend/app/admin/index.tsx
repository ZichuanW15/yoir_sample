import { Href, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, Text, TextStyle, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { api, userFacingError } from '@/src/api/client';
import { PlatformStats } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { AdminShell, LoadFailed } from '@/src/admin/shell';
import { Card, Press } from '@/src/components/ui';
import { Glyph, GlyphName } from '@/src/components/Glyph';
import { FadeUp, Pop, Pulse, USE_NATIVE_DRIVER, useAnimatedValue } from '@/src/motion';
import { colors, fonts, radius, type } from '@/src/theme';

const currency = (minor: number) =>
  `$${(minor / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const bookingOrder = ['confirmed', 'completed', 'paid_out', 'cancelled', 'refunded'];
const bookingLabel: Record<string, string> = {
  confirmed: 'Confirmed', completed: 'Completed', paid_out: 'Paid out',
  cancelled: 'Cancelled', refunded: 'Refunded',
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * The Platform Owner's first screen. It leads with what Yoir exists to do — Job
 * Seekers reach Career Professionals and book sessions, and money moves — then
 * what is waiting on a decision, then the detail.
 */
export default function AdminOverviewScreen() {
  const { session } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [error, setError] = useState('');
  // Side by side once there is room; stacked on a phone.
  const wide = useWindowDimensions().width >= 860;

  const load = useCallback(async () => {
    if (!session) return;
    try {
      setStats(await api.getPlatformStats(session.accessToken));
      setError('');
    } catch (value) {
      setError(userFacingError(value));
    }
  }, [session]);

  useEffect(() => {
    const run = async () => { await load(); };
    void run();
  }, [load]);

  const bookings = stats ? bookingOrder.filter((status) => stats.bookingsByStatus[status]) : [];
  const sessions = stats ? Object.values(stats.bookingsByStatus).reduce((total, count) => total + count, 0) : 0;
  // Gross with no split recorded against it. Shown as its own part, so the bar always adds up to the gross.
  const unsplit = stats
    ? Math.max(stats.money.grossMinor - stats.money.counsellorPayoutMinor - stats.money.platformFeeMinor, 0)
    : 0;

  return (
    <AdminShell
      title="Overview"
      subtitle="People, sessions and money, as Yoir holds them now."
      busy={!stats && !error}
    >
      {error ? <LoadFailed message={error} onRetry={() => { setError(''); void load(); }} /> : null}

      {stats ? (
        <>
          <FadeUp delay={60} style={styles.hero}>
            <Pulse style={styles.heroGlow} duration={5000}>
              <Svg width={220} height={220}>
                <Defs>
                  <RadialGradient id="overviewGlow" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={colors.yellow} stopOpacity={0.26} />
                    <Stop offset="0.7" stopColor={colors.yellow} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle cx={110} cy={110} r={110} fill="url(#overviewGlow)" />
              </Svg>
            </Pulse>

            <Text style={[type.eyebrow, styles.heroEyebrow]}>Taken through Yoir</Text>
            <CountUp value={stats.money.grossMinor} format={currency} style={styles.heroFigure} />
            <Text style={styles.heroNote}>
              {sessions ? `Across ${plural(sessions, 'session', 'sessions')} booked on the platform.` : 'No session has been booked yet.'}
            </Text>

            {/* What the platform does, left to right, with the live count at each step. */}
            <View style={[styles.flow, wide && styles.flowWide]}>
              <Step
                glyph="seeker" label="Job Seekers" value={stats.jobSeekers}
                href={{ pathname: '/admin/counsellors', params: { role: 'job_seeker' } }}
              />
              <Arrow delay={0} />
              <Step glyph="mentor" label="Career Professionals" value={stats.counsellors} href="/admin/counsellors" />
              <Arrow delay={350} />
              <Step glyph="calendar" label="Sessions booked" value={sessions} href="/admin/bookings" />
            </View>
          </FadeUp>

          <FadeUp delay={140} style={styles.section}>
            <Text style={type.groupLabel}>Needs you</Text>
            <Card pad={6} style={styles.needs}>
              {stats.counsellorsPendingVerification > 0 ? (
                <Need
                  glyph="shieldCheck"
                  label="Review pending verifications"
                  text={`${plural(stats.counsellorsPendingVerification, 'Career Professional', 'Career Professionals')} waiting on a decision`}
                  href="/admin/verifications"
                />
              ) : null}
              {stats.counsellorsAwaitingPayouts > 0 ? (
                <Need
                  glyph="lock"
                  label="Verified but cannot be paid"
                  text={`${plural(stats.counsellorsAwaitingPayouts, 'Career Professional is', 'Career Professionals are')} verified but cannot be paid`}
                  note="Payouts are not set up, so nothing they list can be booked."
                  href="/admin/counsellors"
                />
              ) : null}
              {stats.counsellorsPendingVerification + stats.counsellorsAwaitingPayouts === 0 ? (
                <View style={styles.need}>
                  <View style={[styles.needMark, styles.calmMark]}><Glyph name="check" size={18} color={colors.greenDeep} /></View>
                  <Text style={styles.needText}>Nothing is waiting on you.</Text>
                </View>
              ) : null}
            </Card>
          </FadeUp>

          <View style={[styles.duo, wide && styles.duoWide]}>
            <FadeUp delay={200} style={[styles.section, wide && styles.half]}>
              <Text style={type.groupLabel}>Activity</Text>
              <View style={styles.grid}>
                <Stat glyph="briefcase" label="Active services" value={stats.servicesActive} />
                <Stat glyph="clock" label="Holds awaiting payment" value={stats.ordersAwaitingPayment} href="/admin/payments" />
              </View>
              <Card
                pad={20}
                style={styles.panel}
                accessibilityLabel="Sessions by status. Open bookings"
                onPress={() => router.replace('/admin/bookings')}
              >
                <View style={styles.panelHead}>
                  <Text style={type.display20}>Sessions by status</Text>
                  <Glyph name="chevronRight" size={16} color={colors.mark} />
                </View>
                {bookings.length ? (
                  <Bars rows={bookings.map((status) => ({ label: bookingLabel[status], count: stats.bookingsByStatus[status] }))} />
                ) : (
                  <Text style={type.small}>Nothing has been booked yet.</Text>
                )}
              </Card>
            </FadeUp>

            <FadeUp delay={260} style={[styles.section, wide && styles.half]}>
              <Text style={type.groupLabel}>Money</Text>
              <Card pad={20} style={styles.panel}>
                <Text style={type.display20}>Where it went</Text>
                <Split
                  parts={[
                    { label: 'Career Professional payouts', minor: stats.money.counsellorPayoutMinor, color: colors.greenDeep },
                    { label: 'Yoir commission', minor: stats.money.platformFeeMinor, color: colors.eyebrow },
                    ...(unsplit ? [{ label: 'No split recorded', minor: unsplit, color: colors.mark }] : []),
                  ]}
                />
                <View style={styles.rule} />
                <Line label="Commission GST, within the commission" value={currency(stats.money.platformFeeGstMinor)} />
                <Line label="Session GST (Career Professionals')" value={currency(stats.money.sessionGstMinor)} />
                <Line label="Refunded" value={currency(stats.money.refundedMinor)} />
                <Text style={styles.footnote}>
                  Read from the breakdown frozen on each order when it was paid, never recalculated.
                </Text>
              </Card>
            </FadeUp>
          </View>
        </>
      ) : null}
    </AdminShell>
  );
}

/** Runs 0 → 1 once, for marks that grow to their size. */
function useGrow(delay: number) {
  const t = useAnimatedValue(0);
  useEffect(() => {
    // Width is laid out, not composited, so this one cannot use the native driver.
    const anim = Animated.timing(t, { toValue: 1, duration: 900, delay, easing: Easing.bezier(0.2, 0, 0, 1), useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [t, delay]);
  return t;
}

/** A figure that counts up to its value, so the screen arrives rather than appears. */
function CountUp({ value, format = String, style }: {
  value: number; format?: (value: number) => string; style?: StyleProp<TextStyle>;
}) {
  const t = useAnimatedValue(0);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const listener = t.addListener((at) => setShown(Math.round(at.value)));
    const anim = Animated.timing(t, { toValue: value, duration: 900, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    anim.start();
    return () => { anim.stop(); t.removeListener(listener); };
  }, [t, value]);
  return <Text style={style}>{format(shown)}</Text>;
}

/** One stage of what Yoir does, with how many are at it. Tapping it opens them. */
function Step({ glyph, label, value, href }: { glyph: GlyphName; label: string; value: number; href: Href }) {
  return (
    <Press onPress={() => router.replace(href)} scaleTo={0.94} accessibilityLabel={`${label}: ${value}`} style={styles.step}>
      <Pop delay={250}>
        <View style={styles.stepMark}>
          <View style={styles.stepWash} />
          <Glyph name={glyph} size={22} color={colors.yellow} />
        </View>
      </Pop>
      <CountUp value={value} style={styles.stepValue} />
      <Text style={styles.stepLabel}>{label}</Text>
    </Press>
  );
}

/**
 * The way from one stage to the next. A dot runs along it, over and over, each
 * arrow a beat behind the one before, so the row reads as one movement left to right.
 */
function Arrow({ delay }: { delay: number }) {
  const t = useAnimatedValue(0);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(t, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: USE_NATIVE_DRIVER }),
      // The same total for every arrow, so they stay a beat apart for good.
      Animated.delay(1200 - delay),
    ]));
    anim.start();
    return () => anim.stop();
  }, [t, delay]);

  return (
    <View style={styles.arrow} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={styles.arrowLine} />
      <Animated.View
        style={[styles.arrowDot, {
          opacity: t.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(width - 18, 0)] }) }],
        }]}
      />
      <Glyph name="chevronRight" size={14} color={colors.yellow} />
    </View>
  );
}

/** Something that is stuck until the Platform Owner acts. Always an icon and words, never colour alone. */
function Need({ glyph, label, text, note, href }: { glyph: GlyphName; label: string; text: string; note?: string; href: Href }) {
  return (
    <Press onPress={() => router.replace(href)} scaleTo={0.98} accessibilityLabel={label} style={styles.need}>
      <View style={styles.needMark}><Glyph name={glyph} size={18} color={colors.amberInk} /></View>
      <View style={styles.needCopy}>
        <Text style={styles.needText}>{text}</Text>
        {note ? <Text style={styles.needNote}>{note}</Text> : null}
      </View>
      <Glyph name="chevronRight" size={16} color={colors.mark} />
    </Press>
  );
}

/** One number, with the mark that says what it counts. A nought is greyed so real figures stand out. */
function Stat({ glyph, label, value, href }: { glyph: GlyphName; label: string; value: number; href?: Href }) {
  return (
    <Card
      pad={16}
      accessibilityLabel={href ? `${label}: ${value}` : undefined}
      onPress={href ? () => router.replace(href) : undefined}
      style={styles.stat}
    >
      <View style={styles.statTop}>
        <View style={styles.statMark}><Glyph name={glyph} size={18} color={colors.green} /></View>
        {href ? <Glyph name="chevronRight" size={14} color={colors.mark} /> : null}
      </View>
      <CountUp value={value} style={[styles.statValue, value === 0 && styles.statZero]} />
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

/** Counts side by side: one hue, the longest bar is the largest count, the figure at the end of each. */
function Bars({ rows }: { rows: { label: string; count: number }[] }) {
  const t = useGrow(350);
  const most = Math.max(...rows.map((row) => row.count), 1);
  return (
    <View style={styles.bars}>
      {rows.map((row) => (
        <View key={row.label} style={styles.barRow}>
          <Text style={styles.barLabel}>{row.label}</Text>
          <View style={styles.barTrack}>
            <Animated.View
              style={[styles.bar, { width: t.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${(row.count / most) * 100}%`] }) }]}
            />
          </View>
          <Text style={styles.barValue}>{row.count}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * How the gross divides. The two parts are told apart by the gap between them and
 * by the key beneath, which names each and gives its amount in plain ink.
 */
function Split({ parts }: { parts: { label: string; minor: number; color: string }[] }) {
  const t = useGrow(450);
  const drawn = parts.filter((part) => part.minor > 0);
  return (
    <View style={styles.split}>
      <View style={[styles.splitTrack, !drawn.length && styles.splitEmpty]}>
        <Animated.View style={[styles.splitFill, { width: t.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}>
          {drawn.map((part, index) => (
            <View key={part.label} style={{ flex: part.minor, backgroundColor: part.color, marginLeft: index ? 2 : 0 }} />
          ))}
        </Animated.View>
      </View>
      {parts.map((part) => (
        <View key={part.label} style={styles.keyRow}>
          <View style={[styles.swatch, { backgroundColor: part.color }]} />
          <Text style={styles.keyLabel}>{part.label}</Text>
          <Text style={styles.keyValue}>{currency(part.minor)}</Text>
        </View>
      ))}
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  duo: { gap: 16 },
  duoWide: { flexDirection: 'row', alignItems: 'flex-start' },
  half: { flex: 1 },

  // The brand block, as on the Job Seeker's home: the logo's green, gold and cream.
  hero: { overflow: 'hidden', backgroundColor: colors.green, borderRadius: radius.hero, padding: 22, gap: 6 },
  heroGlow: { position: 'absolute', right: -70, top: -80 },
  heroEyebrow: { color: colors.yellow },
  // The one large figure on the screen, in the same sans as every other number.
  heroFigure: { fontFamily: fonts.extra, fontSize: 48, lineHeight: 54, letterSpacing: -1, color: colors.canvas },
  heroNote: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.onDarkMuted },

  flow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 18 },
  flowWide: { maxWidth: 620 },
  step: { flex: 1, alignItems: 'center', gap: 4 },
  stepMark: { width: 48, height: 48, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  stepWash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.white, opacity: 0.14 },
  stepValue: { marginTop: 4, fontFamily: fonts.extra, fontSize: 22, color: colors.canvas },
  stepLabel: { fontFamily: fonts.semi, fontSize: 12, lineHeight: 16, color: colors.onDarkMuted, textAlign: 'center' },
  // As tall as the step's mark, so the arrow runs between the marks' centres.
  arrow: { width: 34, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  arrowLine: { position: 'absolute', left: 0, right: 12, height: 1.5, borderRadius: 1, backgroundColor: colors.onDarkMuted, opacity: 0.45 },
  arrowDot: { position: 'absolute', left: 0, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.yellow },

  needs: { gap: 0 },
  need: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  needMark: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.yellowTint, alignItems: 'center', justifyContent: 'center' },
  calmMark: { backgroundColor: colors.greenTint },
  needCopy: { flex: 1, gap: 2 },
  needText: { flex: 1, fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: colors.ink },
  needNote: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, color: colors.muted },

  grid: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, gap: 4 },
  statTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  statMark: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontFamily: fonts.extra, fontSize: 26, color: colors.ink },
  statZero: { color: colors.mark },
  statLabel: { fontFamily: fonts.semi, fontSize: 13, lineHeight: 18, color: colors.muted },

  panel: { gap: 14 },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  bars: { gap: 12 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 82, fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  barTrack: { flex: 1, height: 10, justifyContent: 'center' },
  // Square where it starts, rounded where the count ends.
  bar: { height: 10, minWidth: 4, backgroundColor: colors.greenDeep, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  barValue: { width: 28, textAlign: 'right', fontFamily: fonts.bold, fontSize: 13, color: colors.ink },

  split: { gap: 10 },
  splitTrack: { height: 14, borderRadius: 4, overflow: 'hidden' },
  splitEmpty: { backgroundColor: colors.chip },
  splitFill: { height: 14, flexDirection: 'row', borderRadius: 4, overflow: 'hidden' },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  keyLabel: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  keyValue: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },

  rule: { height: 1, backgroundColor: colors.line },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  lineLabel: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.sub },
  lineValue: { fontFamily: fonts.semi, fontSize: 13, color: colors.muted },
  footnote: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 17, color: colors.sub },
});
