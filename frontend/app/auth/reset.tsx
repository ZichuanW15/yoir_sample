import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, fieldErrors, userFacingError } from '@/src/api/client';
import { useChrome } from '@/src/chrome';
import { desktopAuthBody, useDesktop } from '@/src/desktop';
import { Glyph } from '@/src/components/Glyph';
import { Button, ErrorBanner, Field } from '@/src/components/ui';
import { FadeUp, Pop, SheetUp } from '@/src/motion';
import { colors, fonts, type } from '@/src/theme';

/**
 * Where the reset link in the email lands (US-70).
 *
 * Unlike confirming an address, this does not sign anyone in: the new password is
 * what proves them, and every existing session — including any an attacker holds —
 * is ended by the reset. They sign in again with what they have just chosen.
 */
export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const { flash } = useChrome();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!token) {
      setError('That link is missing its reset code. Ask for a new one.');
      return;
    }
    if (password !== confirmation) {
      setFields({ passwordConfirmation: 'Does not match the new password.' });
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    setFields({});
    try {
      await api.resetPassword(token, password, confirmation);
      flash('Your password has been changed');
      router.replace('/auth/login');
    } catch (value) {
      setError(userFacingError(value));
      setFields(fieldErrors(value));
    } finally {
      setBusy(false);
    }
  }

  // Desktop: the bar scrolls with the form, so the column is one centred group
  // and the whole panel is what scrolls (see desktopAuthBody).
  const bar = (
    <View style={[styles.bar, desktop && styles.desktopBar]}>
      <Image source={require('@/assets/images/yoir-wordmark.png')} style={styles.wordmark} resizeMode="contain" accessibilityLabel="Yoir" />
    </View>
  );

  return (
    <SheetUp duration={500} style={[styles.screen, { paddingTop: insets.top }, desktop && styles.desktopScreen]}>
      {desktop ? null : bar}

      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={!desktop}
          contentContainerStyle={[styles.body, { paddingBottom: 24 + insets.bottom }, desktop && styles.desktopBody]}
          keyboardShouldPersistTaps="handled"
        >
          {desktop ? bar : null}
          <FadeUp delay={100} style={styles.intro}>
            <Text style={type.display36}>Choose a new password</Text>
            <Text style={type.body}>At least eight characters. Pick something you do not use elsewhere.</Text>
          </FadeUp>

          {error ? <Pop duration={300}><ErrorBanner message={error} /></Pop> : null}

          <FadeUp delay={200} style={styles.form}>
            <Field
              label="New password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least eight characters"
              secureTextEntry
              autoComplete="new-password"
            />
            {fields.password ? <Text style={styles.fieldError}>{fields.password}</Text> : null}
            <Field
              label="Confirm new password"
              value={confirmation}
              onChangeText={setConfirmation}
              placeholder="Type it again"
              secureTextEntry
              autoComplete="new-password"
            />
            {fields.passwordConfirmation ? <Text style={styles.fieldError}>{fields.passwordConfirmation}</Text> : null}
          </FadeUp>

          <FadeUp delay={300} style={styles.notice}>
            <Glyph name="shieldCheck" size={18} color={colors.greenDeep} />
            <Text style={styles.noticeText}>
              This signs you out everywhere else, on every device. That is deliberate: if
              somebody else asked for this reset, it ends their access too.
            </Text>
          </FadeUp>

          <FadeUp delay={400}>
            <Button label={busy ? 'Saving' : 'Save new password'} busy={busy} height={56} onPress={submit} />
          </FadeUp>
        </ScrollView>
      </KeyboardAvoidingView>
    </SheetUp>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  fill: { flex: 1 },
  bar: { alignItems: 'center', paddingVertical: 10 },
  wordmark: { width: 64, aspectRatio: 159 / 60 },
  body: { flexGrow: 1, paddingTop: 12, paddingHorizontal: 24, gap: 22 },
  intro: { gap: 10 },
  form: { gap: 16 },
  fieldError: { marginTop: -8, fontFamily: fonts.sans, fontSize: 12, color: colors.danger },
  notice: {
    flexDirection: 'row', gap: 10, padding: 16, borderRadius: 20, backgroundColor: colors.greenTint,
  },
  noticeText: { flex: 1, fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.greenDeep },
  // Desktop: the screen fills the panel beside the brand panel and scrolls as a whole;
  // its content is the centred 460px column, bar included.
  desktopScreen: { flex: 1, backgroundColor: 'transparent' },
  desktopBar: { paddingHorizontal: 0 },
  desktopBody: desktopAuthBody,
});
