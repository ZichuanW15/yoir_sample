import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, userFacingError } from '@/src/api/client';
import { OnboardingState } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { Glyph, GlyphName } from '@/src/components/Glyph';
import { Avatar, Button, ErrorBanner, Press, Spinner, Tag } from '@/src/components/ui';
import { DesktopPage, PageHeader, useDesktop } from '@/src/desktop';
import { initials } from '@/src/format';
import { FadeUp, ScreenIn } from '@/src/motion';
import { colors, fonts, radius, shadow, type } from '@/src/theme';

/**
 * US-05. Where a first-login Career Professional lands instead of the regular
 * workspace: professional-profile setup (US-30) and LinkedIn verification
 * submission (US-31), presented as the two required steps, with no route to
 * service creation until both are done.
 *
 * Deliberately no CounsellorNav here — this is a gate, not a tab, and the
 * workspace it would otherwise open from the bar just bounces back to this
 * same screen for as long as either step is outstanding.
 */
export default function CounsellorOnboardingScreen() {
  const { session } = useAuth();
  const { openSheet } = useChrome();
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    try {
      setState(await api.getOnboardingState(session.accessToken));
      setError('');
    } catch (cause) {
      setError(userFacingError(cause));
    }
  }, [session]);

  // Re-checked on every focus: completing a step pushes to /counsellor/profile or
  // /counsellor/verification and back, not through this screen, so the only way it
  // learns a step finished is by asking again when the counsellor returns to it.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!session || session.user.role !== 'counsellor') return <Redirect href="/" />;

  // Both steps done: nothing left for this screen to gate, so it sends the
  // counsellor straight on rather than making them notice and tap something.
  if (state?.complete) return <Redirect href="/counsellor" />;

  const name = session.user.name;

  // Desktop: the same two steps in a readable column beside the sidebar.
  if (desktop) {
    return (
      <DesktopPage>
        <View style={s.desktopColumn}>
          <PageHeader
            eyebrow="Before you publish"
            title="Finish setting up your workspace"
            subtitle="Complete your professional profile and submit your LinkedIn profile for verification. Both are required before you can publish a service."
          />
          {error ? <ErrorBanner message={error} /> : null}
          {!state && !error ? <View style={s.loading}><Spinner size={26} color={colors.green} /></View> : null}
          {state ? (
            <View style={s.steps}>
              <OnboardingStep
                glyph="seeker"
                title="Professional profile"
                body={
                  state.profileComplete
                    ? 'Saved — your introduction, background and experience are on file.'
                    : 'Tell buyers who you are: your introduction, background and experience.'
                }
                done={state.profileComplete}
                onPress={() => router.push('/counsellor/profile')}
              />
              <OnboardingStep
                glyph="shieldCheck"
                title="Verification submission"
                body={
                  state.verificationSubmitted
                    ? 'Sent — your LinkedIn profile is with the Platform Owner.'
                    : 'Submit your LinkedIn profile so the Platform Owner can verify you.'
                }
                done={state.verificationSubmitted}
                onPress={() => router.push('/counsellor/verification')}
              />
            </View>
          ) : null}
          {error ? (
            <Button label="Try again" tone="outline" height={48} onPress={() => { setError(''); void load(); }} style={s.desktopRetry} />
          ) : null}
        </View>
      </DesktopPage>
    );
  }

  return (
    <ScreenIn style={s.screen}>
      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <Image source={require('@/assets/images/yoir-wordmark.png')} style={s.wordmark} accessibilityLabel="Yoir" />
        <Press onPress={openSheet} scaleTo={0.92} accessibilityLabel={`Account, ${name}`} style={s.avatarRing}>
          <Avatar initials={initials(name)} size={42} />
        </Press>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <FadeUp style={s.intro}>
          <Text style={type.eyebrow}>Before you publish</Text>
          <Text style={type.display34}>Finish setting up your workspace</Text>
          <Text style={type.bodySm}>
            Complete your professional profile and submit your LinkedIn profile for verification.
            Both are required before you can publish a service.
          </Text>
        </FadeUp>

        {error ? <ErrorBanner message={error} /> : null}

        {!state && !error ? (
          <View style={s.loading}><Spinner size={26} color={colors.green} /></View>
        ) : null}

        {state ? (
          <FadeUp delay={80} style={s.steps}>
            <OnboardingStep
              glyph="seeker"
              title="Professional profile"
              body={
                state.profileComplete
                  ? 'Saved — your introduction, background and experience are on file.'
                  : 'Tell buyers who you are: your introduction, background and experience.'
              }
              done={state.profileComplete}
              onPress={() => router.push('/counsellor/profile')}
            />
            <OnboardingStep
              glyph="shieldCheck"
              title="Verification submission"
              body={
                state.verificationSubmitted
                  ? 'Sent — your LinkedIn profile is with the Platform Owner.'
                  : 'Submit your LinkedIn profile so the Platform Owner can verify you.'
              }
              done={state.verificationSubmitted}
              onPress={() => router.push('/counsellor/verification')}
            />
          </FadeUp>
        ) : null}

        {error ? (
          <Button label="Try again" tone="outline" height={48} onPress={() => { setError(''); void load(); }} />
        ) : null}
      </ScrollView>
    </ScreenIn>
  );
}

function OnboardingStep({ glyph, title, body, done, onPress }: {
  glyph: GlyphName; title: string; body: string; done: boolean; onPress(): void;
}) {
  const desktop = useDesktop();
  return (
    <Press onPress={onPress} scaleTo={0.98} accessibilityLabel={`${title}, ${done ? 'done' : 'not done'}`} style={[s.step, desktop && s.desktopStep]}>
      <View style={[s.stepTile, done && s.stepTileDone]}>
        <Glyph name={glyph} size={20} color={done ? colors.green : colors.amberInk} />
      </View>
      <View style={s.stepCopy}>
        <Text style={s.stepTitle}>{title}</Text>
        <Text style={s.stepBody}>{body}</Text>
      </View>
      <Tag
        label={done ? 'Done' : 'Not done'}
        bg={done ? colors.greenTint : colors.yellowTint}
        fg={done ? colors.greenDeep : colors.amberInk}
      />
      {desktop ? <Glyph name="chevronRight" size={16} color={colors.mark} /> : null}
    </Press>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingBottom: 6 },
  wordmark: { width: 66, height: 25, resizeMode: 'contain' },
  avatarRing: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: colors.yellow, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },

  body: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 24, gap: 18 },
  intro: { gap: 8 },

  loading: { paddingVertical: 48, alignItems: 'center' },

  steps: { gap: 12 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.xl },
  stepTile: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.yellowTint, alignItems: 'center', justifyContent: 'center' },
  stepTileDone: { backgroundColor: colors.greenTint },
  stepCopy: { flex: 1, gap: 3 },
  stepTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  stepBody: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.muted },

  desktopColumn: { maxWidth: 760, gap: 22 },
  desktopStep: { padding: 20, gap: 16, ...shadow.card },
  desktopRetry: { alignSelf: 'flex-start', paddingHorizontal: 28 },
});
