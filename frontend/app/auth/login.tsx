import { router, useLocalSearchParams } from 'expo-router';
import { goBack, homeFor } from '@/src/navigation';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { userFacingError } from '@/src/api/client';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { Glyph } from '@/src/components/Glyph';
import { Button, ErrorBanner, Field, IconButton, Press } from '@/src/components/ui';
import { FadeUp, Pop, SheetUp } from '@/src/motion';
import { colors, fonts, type } from '@/src/theme';

type PublicRole = 'job_seeker' | 'counsellor';

export default function LoginScreen() {
  const { serviceId, role, email: prefill } = useLocalSearchParams<{ serviceId?: string; role?: PublicRole; email?: string }>();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const { flash } = useChrome();
  const [email, setEmail] = useState(prefill ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      // The role picked on the entry screen decides which app an unrecognised email opens.
      const session = await login(email.trim(), password, role);
      // US-06: a counsellor cannot buy, so a booking held over the log in returns them to the listing.
      if (serviceId) {
        router.replace(
          session.user.role === 'job_seeker'
            ? { pathname: '/services/[serviceId]/timeslots', params: { serviceId } }
            : { pathname: '/services/[serviceId]', params: { serviceId } },
        );
      } else {
        router.replace(homeFor(session.user.role));
      }
      flash(`Welcome, ${session.user.name.split(' ')[0]}`);
    } catch (value) {
      // US-07: whatever failed, the message never says which credential was wrong.
      setError(userFacingError(value));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SheetUp duration={500} style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <IconButton label="Close" onPress={() => goBack('/auth/welcome')}>
          <Glyph name="close" size={18} color={colors.green} />
        </IconButton>
        <Image source={require('@/assets/images/yoir-wordmark.png')} style={styles.wordmark} resizeMode="contain" accessibilityLabel="Yoir" />
        <View style={styles.spacer} />
      </View>

      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: 24 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
        >
          <FadeUp delay={100} style={styles.intro}>
            <Text style={type.display36}>Welcome back</Text>
            <Text style={type.body}>
              {serviceId
                ? 'Log in to choose a time and complete your booking.'
                : 'Log in to book services and manage your Yoir activity.'}
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
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              secureTextEntry
              autoComplete="current-password"
            />
          </FadeUp>

          <FadeUp delay={300} style={styles.actions}>
            <Button label={busy ? 'Logging in' : 'Log in'} busy={busy} height={56} onPress={submit} />
            <Press
              accessibilityLabel="Forgot your password?"
              scaleTo={0.96}
              onPress={() => router.push({ pathname: '/auth/forgot', params: email.trim() ? { email: email.trim() } : {} })}
            >
              <Text style={styles.forgot}>Forgot your password?</Text>
            </Press>
          </FadeUp>

          <FadeUp delay={400} style={styles.switchRow}>
            <Text style={styles.switchText}>New to Yoir? </Text>
            <Press
              accessibilityLabel="Create an account"
              scaleTo={0.96}
              onPress={() => router.push({
                pathname: '/auth/register',
                params: { ...(serviceId ? { serviceId } : {}), ...(role ? { role } : {}) },
              })}
            >
              <Text style={styles.switchLink}>Create an account</Text>
            </Press>
          </FadeUp>
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
  intro: { gap: 10 },
  form: { gap: 16 },
  actions: { gap: 14 },
  forgot: { fontFamily: fonts.bold, fontSize: 14, color: colors.green, textAlign: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  switchText: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  switchLink: { fontFamily: fonts.bold, fontSize: 14, color: colors.green },
});
