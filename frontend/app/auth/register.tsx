import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '@/src/navigation';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, userFacingError } from '@/src/api/client';
import { Glyph } from '@/src/components/Glyph';
import { RegisterScene } from '@/src/components/Scenes';
import { Button, ErrorBanner, Field, IconButton, Press } from '@/src/components/ui';
import { FadeUp, Pop, SheetUp } from '@/src/motion';
import { colors, fonts, radius, type } from '@/src/theme';

type PublicRole = 'job_seeker' | 'counsellor';

const roleOptions: { value: PublicRole; title: string; description: string }[] = [
  { value: 'job_seeker', title: 'Job Seeker', description: 'Browse counsellors, book a session and pay through Yoir.' },
  { value: 'counsellor', title: 'Career Counsellor', description: 'Publish services, set your availability and take bookings.' },
];

export default function RegisterScreen() {
  const { serviceId, role: initialRole } = useLocalSearchParams<{ serviceId?: string; role?: PublicRole }>();
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<PublicRole>(initialRole === 'counsellor' ? 'counsellor' : 'job_seeker');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  function toLogin() {
    router.replace({
      pathname: '/auth/login',
      params: { ...(serviceId ? { serviceId } : {}), role, ...(success ? { email: email.trim() } : {}) },
    });
  }

  async function submit() {
    if (!name.trim() || !email.trim() || !password || !confirmation) {
      setError('Complete all required fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.register({ name: name.trim(), email: email.trim(), password, passwordConfirmation: confirmation, role });
      setSuccess(true);
    } catch (value) {
      // US-03: a rejected registration (a duplicate email, say) stays on the form with its reason.
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
          <RegisterScene />

          <FadeUp delay={100} style={styles.intro}>
            <Text style={type.display34}>Create your account</Text>
            <Text style={type.body}>Choose the role that matches how you will use Yoir.</Text>
          </FadeUp>

          {error ? <Pop duration={300}><ErrorBanner message={error} /></Pop> : null}

          {success ? (
            <FadeUp style={styles.success}>
              <Pop style={styles.successDisc}>
                <Glyph name="check" size={34} color={colors.greenDeep} />
              </Pop>
              <Text style={styles.successTitle}>Your account is ready</Text>
              <Button label="Continue to log in" height={56} style={styles.fullWidth} onPress={toLogin} />
            </FadeUp>
          ) : (
            <>
              <FadeUp delay={200} style={styles.roles}>
                <Text style={styles.groupLabel}>Account role</Text>
                {roleOptions.map((option) => {
                  const selected = role === option.value;
                  return (
                    <Press
                      key={option.value}
                      scaleTo={0.98}
                      accessibilityRole="radio"
                      accessibilityLabel={option.title}
                      accessibilityState={{ selected, checked: selected }}
                      onPress={() => setRole(option.value)}
                      style={[
                        styles.roleCard,
                        { backgroundColor: selected ? colors.greenTint : colors.white, borderColor: selected ? colors.green : colors.line },
                      ]}
                    >
                      <View style={[styles.roleHolder, { backgroundColor: selected ? colors.white : colors.greenTint }]}>
                        <Glyph name="seeker" size={22} color={colors.green} />
                      </View>
                      <View style={styles.roleCopy}>
                        <Text style={styles.roleTitle}>{option.title}</Text>
                        <Text style={styles.roleDescription}>{option.description}</Text>
                      </View>
                      <View style={[
                        styles.mark,
                        { borderColor: selected ? colors.yellow : colors.mark, backgroundColor: selected ? colors.yellow : colors.white },
                      ]}>
                        {selected ? <Pop duration={300}><Glyph name="check" size={13} color={colors.green} /></Pop> : null}
                      </View>
                    </Press>
                  );
                })}
              </FadeUp>

              <FadeUp delay={300} style={styles.form}>
                <Field label="Full name" value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" />
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
                  placeholder="At least 8 characters"
                  secureTextEntry
                  autoComplete="new-password"
                />
                <Field label="Confirm password" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" />
              </FadeUp>

              <Button label="Create account" busy={busy} height={56} onPress={submit} />
            </>
          )}

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Already registered? </Text>
            <Press accessibilityLabel="Log in" scaleTo={0.96} onPress={toLogin}>
              <Text style={styles.switchLink}>Log in</Text>
            </Press>
          </View>
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
  body: { paddingTop: 8, paddingHorizontal: 24, gap: 22 },
  intro: { gap: 8 },
  success: { alignItems: 'center', gap: 16, paddingVertical: 20 },
  successDisc: { width: 72, height: 72, borderRadius: radius.pill, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink, textAlign: 'center' },
  fullWidth: { alignSelf: 'stretch' },
  roles: { gap: 10 },
  groupLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  roleCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.lg, borderWidth: 1.5 },
  roleHolder: { width: 44, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  roleCopy: { flex: 1, gap: 2 },
  roleTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  roleDescription: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, color: colors.muted },
  mark: { width: 24, height: 24, borderRadius: radius.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  form: { gap: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  switchText: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  switchLink: { fontFamily: fonts.bold, fontSize: 14, color: colors.green },
});
