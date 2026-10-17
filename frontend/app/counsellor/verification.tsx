import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, userFacingError } from '@/src/api/client';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { BackBar } from '@/src/components/booking';
import { CounsellorNav } from '@/src/components/CounsellorNav';
import { Glyph } from '@/src/components/Glyph';
import { Button, ErrorBanner, Field, Press, Spinner } from '@/src/components/ui';
import { DesktopPage, PageHeader, useDesktop } from '@/src/desktop';
import { FadeUp, ScreenIn } from '@/src/motion';
import { goBack } from '@/src/navigation';
import { colors, fonts, radius, type } from '@/src/theme';
import { normaliseLinkedIn, verificationCopy, VerificationState, verificationState } from '@/src/verification';

const submitLabel: Record<VerificationState, string> = {
  unsubmitted: 'Submit for verification',
  pending: 'Update my submission',
  rejected: 'Resubmit for verification',
  verified: '',
};

/** How far along each state is: 1 sent, 2 reviewed, 3 verified. */
const reached: Record<VerificationState, number> = { unsubmitted: 0, pending: 1, rejected: 2, verified: 3 };

/**
 * US-31, US-32. Where a Career Professional sends the LinkedIn profile the Platform
 * Owner verifies them from, and reads what came of it.
 *
 * The status shown is only ever the backend's: nothing appears until it has been
 * read, and a submission reads as pending only once the backend has stored it.
 */
export default function VerificationScreen() {
  const { session } = useAuth();
  const { flash } = useChrome();
  const desktop = useDesktop();
  const [state, setState] = useState<VerificationState | null>(null);
  const [submitted, setSubmitted] = useState('');
  const [url, setUrl] = useState('');
  const [invalid, setInvalid] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const profile = await api.getOwnCounsellorProfile(session.user, session.accessToken);
      setState(verificationState(profile));
      setSubmitted(profile.linkedinUrl ?? '');
      setUrl(profile.linkedinUrl ?? '');
      setError('');
    } catch (cause) {
      setError(userFacingError(cause));
    }
  }, [session]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!session || session.user.role !== 'counsellor') return <Redirect href="/" />;

  const submit = async () => {
    if (!url.trim()) return setInvalid('Enter your LinkedIn profile URL.');
    const linkedInUrl = normaliseLinkedIn(url);
    if (!linkedInUrl) return setInvalid('Enter a LinkedIn profile URL, for example https://www.linkedin.com/in/your-name.');

    setInvalid('');
    setError('');
    setBusy(true);
    try {
      const submission = await api.submitVerification(linkedInUrl, session.accessToken);
      setState(submission.status);
      setSubmitted(submission.linkedInUrl);
      setUrl(submission.linkedInUrl);
      flash('Sent to the Platform Owner for review');
    } catch (cause) {
      setError(userFacingError(cause));
    } finally {
      setBusy(false);
    }
  };

  const copy = state ? verificationCopy[state] : null;

  // Desktop: where you stand and how it works on the left, what you send on the right.
  if (desktop) {
    return (
      <DesktopPage>
        <PageHeader eyebrow="Trust" title="Verification" />
        {error ? <ErrorBanner message={error} /> : null}

        {!state || !copy ? (
          error
            ? <Button label="Try again" tone="outline" height={48} onPress={() => { setError(''); void load(); }} style={s.desktopButton} />
            : <View style={s.loading}><Spinner size={26} color={colors.green} /></View>
        ) : (
          <View style={s.desktopColumns}>
            <View style={[s.desktopHalf, s.desktopStack]}>
              <View style={[s.status, s.desktopStatus, { backgroundColor: copy.bg }]}>
                <View style={s.statusTile}>
                  <Glyph name={state === 'rejected' ? 'close' : 'shieldCheck'} size={24} color={copy.fg} />
                </View>
                <Text style={[type.eyebrow, { color: copy.fg }]}>Your status</Text>
                <Text style={[type.display28, { color: copy.fg }]}>{copy.label}</Text>
                <Text style={[type.bodySm, { color: copy.fg }]}>{copy.body}</Text>
              </View>

              <View style={[s.card, s.desktopCard]}>
                <Text style={s.cardTitle}>How verification works</Text>
                <Stage done={reached[state] >= 1} label="You send your LinkedIn profile" />
                <Stage
                  done={reached[state] >= 2}
                  current={state === 'pending'}
                  label={state === 'pending' ? 'The Platform Owner is reviewing it now' : 'The Platform Owner reviews it'}
                />
                <Stage
                  done={state === 'verified'}
                  failed={state === 'rejected'}
                  label={state === 'rejected' ? 'Not verified this time' : 'Your profile carries the verified mark'}
                  last
                />
              </View>
            </View>

            {state === 'verified' ? (
              submitted ? (
                <View style={[s.card, s.desktopCard, s.desktopHalf]}>
                  <Text style={s.cardTitle}>Verified from</Text>
                  <Press accessibilityLabel="Open your LinkedIn profile" style={s.link} onPress={() => { void Linking.openURL(submitted); }}>
                    <Glyph name="briefcase" size={16} color={colors.green} />
                    <Text style={s.linkText} numberOfLines={1}>{submitted}</Text>
                    <Glyph name="chevronRight" size={14} color={colors.green} />
                  </Press>
                </View>
              ) : <View style={s.desktopHalf} />
            ) : (
              <View style={[s.card, s.desktopCard, s.desktopHalf]}>
                <Text style={s.cardTitle}>Your LinkedIn profile</Text>
                <Text style={type.small}>
                  {state === 'rejected'
                    ? 'Fix what the email asked for, then send your profile again.'
                    : 'The Platform Owner opens this link to check who you are. It is all you need to send.'}
                </Text>
                <Field
                  label="LinkedIn profile URL"
                  value={url}
                  onChangeText={(text) => { setUrl(text); setInvalid(''); }}
                  placeholder="https://www.linkedin.com/in/your-name"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                {invalid ? <Text accessibilityRole="alert" style={s.invalid}>{invalid}</Text> : null}
                <Button label={submitLabel[state]} height={50} labelSize={15} busy={busy} onPress={() => { void submit(); }} />
              </View>
            )}
          </View>
        )}
      </DesktopPage>
    );
  }

  return (
    <ScreenIn style={s.screen}>
      <BackBar title="Verification" onBack={() => goBack('/counsellor')} />

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {error ? <ErrorBanner message={error} /> : null}

        {!state || !copy ? (
          error
            ? <Button label="Try again" tone="outline" height={48} onPress={() => { setError(''); void load(); }} />
            : <View style={s.loading}><Spinner size={26} color={colors.green} /></View>
        ) : (
          <>
            <FadeUp style={[s.status, { backgroundColor: copy.bg }]}>
              <View style={s.statusTile}>
                <Glyph name={state === 'rejected' ? 'close' : 'shieldCheck'} size={24} color={copy.fg} />
              </View>
              <Text style={[type.eyebrow, { color: copy.fg }]}>Your status</Text>
              <Text style={[type.display28, { color: copy.fg }]}>{copy.label}</Text>
              <Text style={[type.bodySm, { color: copy.fg }]}>{copy.body}</Text>
            </FadeUp>

            <FadeUp delay={80} style={s.card}>
              <Text style={s.cardTitle}>How verification works</Text>
              <Stage done={reached[state] >= 1} label="You send your LinkedIn profile" />
              <Stage
                done={reached[state] >= 2}
                current={state === 'pending'}
                label={state === 'pending' ? 'The Platform Owner is reviewing it now' : 'The Platform Owner reviews it'}
              />
              <Stage
                done={state === 'verified'}
                failed={state === 'rejected'}
                label={state === 'rejected' ? 'Not verified this time' : 'Your profile carries the verified mark'}
                last
              />
            </FadeUp>

            {state === 'verified' ? (
              submitted ? (
                <FadeUp delay={140} style={s.card}>
                  <Text style={s.cardTitle}>Verified from</Text>
                  <Press accessibilityLabel="Open your LinkedIn profile" style={s.link} onPress={() => { void Linking.openURL(submitted); }}>
                    <Glyph name="briefcase" size={16} color={colors.green} />
                    <Text style={s.linkText} numberOfLines={1}>{submitted}</Text>
                    <Glyph name="chevronRight" size={14} color={colors.green} />
                  </Press>
                </FadeUp>
              ) : null
            ) : (
              <FadeUp delay={140} style={s.card}>
                <Text style={s.cardTitle}>Your LinkedIn profile</Text>
                <Text style={type.small}>
                  {state === 'rejected'
                    ? 'Fix what the email asked for, then send your profile again.'
                    : 'The Platform Owner opens this link to check who you are. It is all you need to send.'}
                </Text>
                <Field
                  label="LinkedIn profile URL"
                  value={url}
                  onChangeText={(text) => { setUrl(text); setInvalid(''); }}
                  placeholder="https://www.linkedin.com/in/your-name"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                {invalid ? <Text accessibilityRole="alert" style={s.invalid}>{invalid}</Text> : null}
                <Button label={submitLabel[state]} busy={busy} onPress={() => { void submit(); }} />
              </FadeUp>
            )}
          </>
        )}
      </ScrollView>
      <CounsellorNav />
    </ScreenIn>
  );
}

/** One line of the three-step track: a filled mark once reached, a ring until then. */
function Stage({ label, done, current, failed, last }: {
  label: string; done: boolean; current?: boolean; failed?: boolean; last?: boolean;
}) {
  const ink = failed ? colors.danger : done ? colors.greenDeep : current ? colors.amberInk : colors.mark;
  return (
    <View style={s.stage}>
      <View style={s.rail}>
        <View style={[s.dot, { borderColor: ink }, (done || failed) && { backgroundColor: ink }]}>
          {done || failed ? <Glyph name={failed ? 'close' : 'check'} size={12} color={colors.white} /> : null}
        </View>
        {last ? null : <View style={s.line} />}
      </View>
      <Text style={[s.stageText, (done || current || failed) && { color: colors.ink }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  body: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 24, gap: 18 },
  loading: { paddingVertical: 60, alignItems: 'center' },

  status: { borderRadius: radius.xxl, padding: 22, gap: 8 },
  statusTile: {
    width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },

  card: { gap: 14, padding: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.xl },
  cardTitle: { ...type.display20, fontSize: 22, lineHeight: 25 },

  stage: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center' },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, height: 16, marginTop: 4, backgroundColor: colors.line },
  stageText: { flex: 1, paddingTop: 1, fontFamily: fonts.semi, fontSize: 14, lineHeight: 20, color: colors.sub },

  link: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: radius.md, backgroundColor: colors.field },
  linkText: { flex: 1, fontFamily: fonts.semi, fontSize: 13, color: colors.green },
  invalid: { marginTop: -6, fontFamily: fonts.semi, fontSize: 13, lineHeight: 19, color: colors.danger },

  desktopColumns: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 22 },
  desktopHalf: { flexGrow: 1, flexShrink: 1, flexBasis: 340 },
  desktopStack: { gap: 18 },
  desktopStatus: { padding: 26 },
  desktopCard: { padding: 24, borderRadius: 22 },
  desktopButton: { alignSelf: 'flex-start', paddingHorizontal: 24 },
});
