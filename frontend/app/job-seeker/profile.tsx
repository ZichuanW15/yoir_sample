import * as ImagePicker from 'expo-image-picker';
import { Href, Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, userFacingError } from '@/src/api/client';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { BackBar } from '@/src/components/booking';
import { Glyph } from '@/src/components/Glyph';
import { Avatar, Button, Card, ErrorBanner, Field, Press, Spinner } from '@/src/components/ui';
import { initials } from '@/src/format';
import { ScreenIn } from '@/src/motion';
import { goBack, homeFor } from '@/src/navigation';
import { setProfilePhoto } from '@/src/profilePhoto';
import { colors, fonts, type } from '@/src/theme';

/** Matches the backend's limit on a stored photo. */
const MAX_PHOTO_LENGTH = 2_000_000;
const WEB_PHOTO_SIZE = 480;

/**
 * The photo as a data URI, since there is no file storage to upload it to. On a
 * device the picker crops and compresses it; the web picker does neither, so a
 * phone photo would arrive full size — it is cropped square and scaled down here.
 */
async function photoDataUri(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  if (Platform.OS !== 'web') return `data:image/jpeg;base64,${asset.base64}`;
  const image = new window.Image();
  image.src = asset.uri;
  await image.decode();
  const side = Math.min(image.width, image.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(side, WEB_PHOTO_SIZE);
  canvas.getContext('2d')?.drawImage(
    image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height,
  );
  return canvas.toDataURL('image/jpeg', 0.85);
}

export default function JobSeekerProfileScreen() {
  const insets = useSafeAreaInsets();
  const { session, adopt } = useAuth();
  const { flash } = useChrome();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [headline, setHeadline] = useState('');
  const [goals, setGoals] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const token = session?.accessToken;
  const userId = session?.user.id;
  const load = useCallback(async () => {
    if (!token || !userId) return;
    try {
      const profile = await api.getJobSeekerProfile(token);
      setLoadError('');
      setName(profile.name);
      setHeadline(profile.headline);
      setGoals(profile.careerGoals);
      setPhoto(profile.photoUrl);
      setProfilePhoto(userId, profile.photoUrl);
      setLoaded(true);
    } catch (value) {
      setLoadError(userFacingError(value));
    }
  }, [token, userId]);
  useEffect(() => {
    const run = async () => { await load(); };
    void run();
  }, [load]);

  if (!session) return <Redirect href={{ pathname: '/auth/login', params: { role: 'job_seeker' } }} />;
  if (session.user.role !== 'job_seeker') return <Redirect href={homeFor(session.user.role)} />;

  const pickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        flash('Allow photo access to add a profile photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: Platform.OS !== 'web',
      });
      if (result.canceled || !result.assets[0]) return;
      const uri = await photoDataUri(result.assets[0]);
      if (uri.length > MAX_PHOTO_LENGTH) {
        flash('That photo is too large. Try a smaller one.');
        return;
      }
      setPhoto(uri);
    } catch {
      flash('The photo library is unavailable.');
    }
  };

  const save = async () => {
    if (!name.trim()) {
      setError('Add your name.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saved = await api.updateJobSeekerProfile(
        { name: name.trim(), photoUrl: photo, headline: headline.trim(), careerGoals: goals.trim() },
        session.accessToken,
      );
      setProfilePhoto(session.user.id, saved.photoUrl);
      // The name is also on the session, which is what the rest of the app greets them by.
      if (saved.name !== session.user.name) await adopt({ ...session, user: { ...session.user, name: saved.name } });
      flash('Profile saved');
    } catch (value) {
      setError(userFacingError(value));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenIn style={styles.screen}>
      <BackBar title="Edit profile" onBack={() => goBack('/job-seeker' as Href)} />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: 30 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        {loadError ? (
          <View style={styles.gap}>
            <ErrorBanner message={loadError} />
            <Button label="Try again" tone="outline" height={48} onPress={() => { void load(); }} />
          </View>
        ) : !loaded ? (
          <View style={styles.loading}><Spinner size={26} color={colors.green} /></View>
        ) : (
          <Card style={styles.gap}>
            <View style={styles.photoRow}>
              <Press onPress={() => { void pickPhoto(); }} scaleTo={0.94} accessibilityLabel={photo ? 'Change profile photo' : 'Add profile photo'}>
                <Avatar initials={initials(name || session.user.name)} photo={photo} size={84} ring />
                <View style={styles.photoBadge}><Glyph name="pencil" size={13} color={colors.white} /></View>
              </Press>
              <View style={styles.photoCopy}>
                <Text style={type.display24}>{name || session.user.name}</Text>
                <Text style={type.small}>{session.user.email}</Text>
                <View style={styles.photoActions}>
                  <Press onPress={() => { void pickPhoto(); }} accessibilityLabel={photo ? 'Change photo' : 'Add a photo'}>
                    <Text style={styles.link}>{photo ? 'Change photo' : 'Add a photo'}</Text>
                  </Press>
                  {photo ? (
                    <Press onPress={() => setPhoto(null)} accessibilityLabel="Remove photo">
                      <Text style={styles.link}>Remove</Text>
                    </Press>
                  ) : null}
                </View>
              </View>
            </View>
            <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" />
            <Field label="Current role or study" value={headline} onChangeText={setHeadline} placeholder="e.g. Final-year engineering student" maxLength={200} />
            <Field label="Career goals" value={goals} onChangeText={setGoals} multiline placeholder="What would you like help with?" maxLength={2000} />
            <Button label="Profile privacy" tone="outline" height={48} onPress={() => router.push('/settings/privacy' as Href)} />
            {error ? <ErrorBanner message={error} /> : null}
            <Button label="Save profile" busy={busy} onPress={() => { void save(); }} />
          </Card>
        )}
      </ScrollView>
    </ScreenIn>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  body: { padding: 22, gap: 20 },
  gap: { gap: 16 },
  loading: { paddingVertical: 40, alignItems: 'center' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  photoBadge: {
    position: 'absolute', right: 0, bottom: 0, width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.green, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  photoCopy: { flex: 1, gap: 3 },
  photoActions: { flexDirection: 'row', gap: 16, marginTop: 6 },
  link: { fontFamily: fonts.bold, fontSize: 14, color: colors.green },
});
