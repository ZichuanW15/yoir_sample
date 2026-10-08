import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, userFacingError } from '@/src/api/client';
import { ProfileVisibility } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { BackBar } from '@/src/components/booking';
import { Button, Card, ErrorBanner, Press, Spinner } from '@/src/components/ui';
import { goBack, homeFor } from '@/src/navigation';
import { ScreenIn } from '@/src/motion';
import { colors, fonts, radius, type } from '@/src/theme';

const options: { value: ProfileVisibility; title: string; description: string }[] = [
  { value: 'public', title: 'Public', description: 'People can see your complete profile.' },
  { value: 'partial', title: 'Partially visible', description: 'People see your name and summary, while personal details stay hidden.' },
  { value: 'restricted', title: 'Restricted', description: 'People see only that this profile is restricted.' },
];

/** US-27 — one shared privacy control for both member roles. */
export default function PrivacySettingsScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { flash } = useChrome();
  const [saved, setSaved] = useState<ProfileVisibility | null>(null);
  const [selected, setSelected] = useState<ProfileVisibility | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    let live = true;
    api.getPrivacySettings(session.accessToken)
      .then(({ visibility }) => { if (live) { setSaved(visibility); setSelected(visibility); } })
      .catch((cause) => { if (live) setError(userFacingError(cause)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [session]);

  if (!session) return <Redirect href="/auth/login" />;
  if (session.user.role === 'platform_owner') return <Redirect href={homeFor(session.user.role)} />;

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      const result = await api.updateProfileVisibility(selected, session.accessToken);
      setSaved(result.visibility);
      setSelected(result.visibility);
      flash('Privacy settings saved');
    } catch (cause) {
      setError(userFacingError(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenIn style={styles.screen}>
      <BackBar title="Profile privacy" onBack={() => goBack(homeFor(session.user.role))} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 28 + insets.bottom }]}>
        <View style={styles.intro}>
          <Text style={type.display34}>Who can see your profile?</Text>
          <Text style={type.body}>Choose how your profile appears to other Yoir members. You can change this at any time.</Text>
        </View>
        {loading ? <View style={styles.loading}><Spinner size={28} color={colors.green} /></View> : (
          <Card style={styles.options}>
            {options.map((option) => {
              const checked = selected === option.value;
              return (
                <Press
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityLabel={option.title}
                  accessibilityState={{ checked, selected: checked }}
                  onPress={() => setSelected(option.value)}
                  style={[styles.option, checked && styles.optionSelected]}
                >
                  <View style={[styles.radio, checked && styles.radioSelected]}>{checked ? <View style={styles.radioDot} /> : null}</View>
                  <View style={styles.optionCopy}>
                    <Text style={styles.optionTitle}>{option.title}</Text>
                    <Text style={styles.optionDescription}>{option.description}</Text>
                  </View>
                </Press>
              );
            })}
          </Card>
        )}
        {error ? <ErrorBanner message={error} /> : null}
        {!loading ? <Button label="Save privacy settings" busy={saving} disabled={!selected || selected === saved} onPress={() => { void save(); }} /> : null}
      </ScrollView>
    </ScreenIn>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  body: { padding: 22, gap: 18 },
  intro: { gap: 8 },
  loading: { paddingVertical: 48, alignItems: 'center' },
  options: { gap: 10 },
  option: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: 14, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.lg },
  optionSelected: { borderColor: colors.green, backgroundColor: colors.greenTint },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  radioSelected: { borderColor: colors.green },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green },
  optionCopy: { flex: 1, gap: 4 },
  optionTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  optionDescription: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: colors.muted },
});
