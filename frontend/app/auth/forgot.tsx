import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, userFacingError } from '@/src/api/client';
import { goBack } from '@/src/navigation';
import { Glyph } from '@/src/components/Glyph';
import { Button, ErrorBanner, Field, IconButton } from '@/src/components/ui';
import { FadeUp, Pop, SheetUp } from '@/src/motion';
import { colors, type } from '@/src/theme';

/**
 * US-70. Asks for a reset link.
 *
 * The confirmation says the same thing whether or not the address has an account,
 * because the server answers the same way for both — otherwise this screen would be
 * a way of finding out who has registered with Yoir.
 */
export default function ForgotPasswordScreen() {
  const { email: prefill } = useLocalSearchParams<{ email?: string }>();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState(prefill ?? '');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim()) {
      setError('Enter the email you signed up with.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.requestPasswordReset(email.trim());
      setSent(true);
    } catch (value) {
      setError(userFacingError(value));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SheetUp duration={500} style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <IconButton label="Back" onPress={() => goBack('/auth/login')}>
          <Glyph name="close" size={18} color={colors.green} />
        </IconButton>
        <Image source={require('@/assets/images/yoir-wordmark.png')} style={styles.wordmark} resizeMode="contain" accessibilityLabel="Yoir" />
        <View style={styles.spacer} />
      </View>

      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 24 + insets.bottom }]} keyboardShouldPersistTaps="handled">
          {sent ? (
            <FadeUp delay={100} style={styles.intro}>
              <View style={styles.badge}>
                <Glyph name="check" size={26} color={colors.green} />
              </View>
              <Text style={type.display36}>Check your inbox</Text>
              <Text style={type.body}>
                If {email.trim()} has a Yoir account, a reset link is on its way. It works
                once and lasts two hours.
              </Text>
              <Button label="Back to sign in" height={56} onPress={() => router.replace('/auth/login')} />
            </FadeUp>
          ) : (
            <>
              <FadeUp delay={100} style={styles.intro}>
                <Text style={type.display36}>Forgot your password?</Text>
                <Text style={type.body}>
                  Tell us the address you signed up with and we will email you a link to
                  choose a new one.
                </Text>
              </FadeUp>

              {error ? <Pop duration={300}><ErrorBanner message={error} /></Pop> : null}

              <FadeUp delay={200} style={styles.form}>
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
                <Button label={busy ? 'Sending' : 'Email me a link'} busy={busy} height={56} onPress={submit} />
              </FadeUp>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SheetUp>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  fill: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 16 },
  wordmark: { width: 64, aspectRatio: 159 / 60 },
  spacer: { width: 44 },
  body: { flexGrow: 1, paddingTop: 12, paddingHorizontal: 24, gap: 22 },
  intro: { gap: 14 },
  form: { gap: 16 },
  badge: {
    width: 56, height: 56, borderRadius: 20, backgroundColor: colors.greenTint,
    alignItems: 'center', justifyContent: 'center',
  },
});
