import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, userFacingError } from '@/src/api/client';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { Glyph } from '@/src/components/Glyph';
import { Button, ErrorBanner, Field, Spinner } from '@/src/components/ui';
import { FadeUp, SheetUp } from '@/src/motion';
import { colors, fonts, type } from '@/src/theme';

type Phase = 'working' | 'done' | 'failed';

/**
 * Where the confirmation link in the email lands.
 *
 * Following it signs the person in: they have just proved they own the address, and
 * asking for a password on top of that is a hurdle with nothing behind it. A link
 * that has lapsed offers a new one rather than leaving them at a dead end.
 */
export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const insets = useSafeAreaInsets();
  const { session, adopt } = useAuth();
  const { flash } = useChrome();
  const [phase, setPhase] = useState<Phase>(token ? 'working' : 'failed');
  const [error, setError] = useState(token ? '' : 'That link is missing its confirmation code.');
  const [email, setEmail] = useState(session?.user.email ?? '');
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  // Strict mode mounts effects twice in development, and the token is single-use:
  // the second attempt would fail on a link that had just worked.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    (async () => {
      try {
        const confirmed = await api.verifyEmail(token);
        await adopt(confirmed);
        setPhase('done');
        flash('Your email is confirmed');
      } catch (value) {
        setError(userFacingError(value));
        setPhase('failed');
      }
    })();
  }, [token, adopt, flash]);

  async function resend() {
    if (!email.trim()) {
      setError('Enter the address you signed up with.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.requestEmailVerification(email.trim());
      setResent(true);
    } catch (value) {
      setError(userFacingError(value));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SheetUp duration={500} style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Image source={require('@/assets/images/yoir-wordmark.png')} style={styles.wordmark} resizeMode="contain" accessibilityLabel="Yoir" />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 24 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        {phase === 'working' ? (
          <FadeUp delay={100} style={styles.centred}>
            <Spinner size={28} color={colors.green} />
            <Text style={type.body}>Confirming your email…</Text>
          </FadeUp>
        ) : null}

        {phase === 'done' ? (
          <FadeUp delay={100} style={styles.intro}>
            <View style={styles.badge}>
              <Glyph name="check" size={26} color={colors.green} />
            </View>
            <Text style={type.display36}>You&apos;re confirmed</Text>
            <Text style={type.body}>
              Your email address is verified and you are signed in. You can book sessions now.
            </Text>
            <Button label="Browse Career Professionals" height={56} onPress={() => router.replace('/marketplace')} />
          </FadeUp>
        ) : null}

        {phase === 'failed' ? (
          <FadeUp delay={100} style={styles.intro}>
            <Text style={type.display36}>That link has expired</Text>
            <Text style={type.body}>
              Confirmation links work once and last a day. Tell us the address you signed up
              with and we will send a fresh one.
            </Text>
            {error ? <ErrorBanner message={error} /> : null}
            {resent ? (
              <View style={styles.sent}>
                <Glyph name="check" size={18} color={colors.greenDeep} />
                <Text style={styles.sentText}>
                  If that address has an account, a new link is on its way.
                </Text>
              </View>
            ) : (
              <>
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
                <Button label={busy ? 'Sending' : 'Send me a new link'} busy={busy} height={56} onPress={resend} />
              </>
            )}
            <Button label="Back to sign in" tone="quiet" height={52} onPress={() => router.replace('/auth/login')} />
          </FadeUp>
        ) : null}
      </ScrollView>
    </SheetUp>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  bar: { alignItems: 'center', paddingVertical: 10 },
  wordmark: { width: 64, aspectRatio: 159 / 60 },
  body: { flexGrow: 1, paddingTop: 24, paddingHorizontal: 24, gap: 22 },
  centred: { alignItems: 'center', gap: 14, paddingTop: 60 },
  intro: { gap: 14 },
  badge: {
    width: 56, height: 56, borderRadius: 20, backgroundColor: colors.greenTint,
    alignItems: 'center', justifyContent: 'center',
  },
  sent: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16,
    borderRadius: 20, backgroundColor: colors.greenTint,
  },
  sentText: { flex: 1, fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.greenDeep },
});
