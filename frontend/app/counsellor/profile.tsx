import { Redirect, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, userFacingError } from '@/src/api/client';
import { Modality } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { CounsellorNav } from '@/src/components/CounsellorNav';
import { Glyph } from '@/src/components/Glyph';
import { TopBar } from '@/src/components/TopBar';
import { Avatar, Button, Chip, ErrorBanner, Field, Press, Tag } from '@/src/components/ui';
import { initials, modalityLabel, STATES } from '@/src/format';
import { FadeUp, Pop, ScreenIn } from '@/src/motion';
import { colors, fonts, radius, shadow, type } from '@/src/theme';

/**
 * US-31 — the Platform Owner verifies a counsellor from their LinkedIn profile,
 * so the link is mandatory and asked for first. Anything whose host is
 * linkedin.com (or a subdomain of it) is accepted, typed with or without the
 * scheme, and normalised to a full https:// URL before it is sent.
 */
function normaliseLinkedIn(raw: string): string | null {
  const match = /^(?:https?:\/\/)?([^/?#\s]+)([/?#]\S*)?$/i.exec(raw.trim());
  if (!match) return null;
  const host = match[1].toLowerCase().replace(/\.$/, '');
  if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) return null;
  return `https://${host}${match[2] ?? ''}`;
}

/** A typed list back into items: trimmed, no blanks, no repeats. */
function listOf(text: string, separator: string): string[] {
  return [...new Set(text.split(separator).map((item) => item.trim()).filter(Boolean))];
}

export default function CounsellorProfileScreen() {
  const { session } = useAuth();
  const { flash } = useChrome();
  const insets = useSafeAreaInsets();

  const [photo, setPhoto] = useState('');
  const [photoUrlOpen, setPhotoUrlOpen] = useState(false);
  const [linkedin, setLinkedin] = useState('');
  const [intro, setIntro] = useState('');
  const [background, setBackground] = useState('');
  const [experience, setExperience] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [expertise, setExpertise] = useState('');
  const [languages, setLanguages] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [modality, setModality] = useState<Modality>('online');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const profile = await api.getOwnCounsellorProfile(session.user, session.accessToken);
      setPhoto(profile.photoUrl ?? '');
      // A profile saved before verification existed loads without a link: leave
      // the field empty so the counsellor has to supply one.
      setLinkedin(profile.linkedinUrl ?? '');
      setIntro(profile.introduction);
      setBackground(profile.background);
      setExperience(profile.experience);
      setQualifications((profile.qualifications ?? []).join('\n'));
      setExpertise((profile.expertise ?? []).join(', '));
      setLanguages((profile.languages ?? []).join(', '));
      setState(profile.baseLocation?.state ?? '');
      setCity(profile.baseLocation?.cityOrRegion ?? '');
      setModality(profile.defaultModality);
      setVerified(profile.verificationStatus === 'verified');
    } catch (cause) {
      setFormError(userFacingError(cause));
    }
  }, [session]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!session || session.user.role !== 'counsellor') return <Redirect href="/" />;

  const photoUri = photo.trim();

  // Expo Go cannot upload a local file, so the library is the fast path and the
  // pasted URL below it is the one that survives a reload.
  const pickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        flash('Allow photo access, or paste an image URL instead.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;
      const picked = result.assets[0]?.uri;
      if (picked) setPhoto(picked);
    } catch {
      flash('The photo library is unavailable — paste an image URL instead.');
    }
  };

  // Every message below is the prototype's, word for word — they are the product
  // copy for what a listing needs before a buyer will trust it.
  const save = async () => {
    if (!linkedin.trim()) return setFormError('Add your LinkedIn profile URL so the Platform Owner can verify you.');
    const linkedinUrl = normaliseLinkedIn(linkedin);
    if (!linkedinUrl) return setFormError('Enter a LinkedIn profile URL, for example https://www.linkedin.com/in/your-name.');
    if (intro.trim().length < 20) return setFormError('Write at least 20 characters so buyers know who they are booking.');
    if (!background.trim()) return setFormError('Describe your professional background.');
    if (!experience.trim()) return setFormError('Describe the experience you bring to a session.');
    if (modality === 'in_person' && (!state || !city.trim())) {
      return setFormError('An in-person default needs the state and city you usually meet clients in.');
    }
    if (state && !city.trim()) return setFormError('Add the city or region for the state you chose.');

    setFormError('');
    setToast('');
    setBusy(true);
    try {
      await api.updateOwnCounsellorProfile(session.user.id, {
        photoUrl: photoUri || null,
        linkedinUrl,
        introduction: intro.trim(),
        background: background.trim(),
        experience: experience.trim(),
        qualifications: listOf(qualifications, '\n'),
        expertise: listOf(expertise, ','),
        languages: listOf(languages, ','),
        baseLocation: state ? { state, cityOrRegion: city.trim() } : null,
        defaultModality: modality,
      }, session.accessToken);
      setLinkedin(linkedinUrl);
      setToast('Your profile is saved and visible on your listings.');
    } catch (cause) {
      setFormError(userFacingError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenIn style={s.screen}>
      <TopBar />

      <ScrollView contentContainerStyle={[s.body, { paddingBottom: 24 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={s.pageTitle}>Professional profile</Text>

        <FadeUp style={s.identity}>
          <View style={s.photoWrap}>
            <View style={s.avatarRing}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={s.avatarImage} accessible accessibilityLabel={`${session.user.name}, profile photo`} />
              ) : (
                <Avatar initials={initials(session.user.name)} size={96} bg={colors.greenTint} fg={colors.green} />
              )}
            </View>
            <Press onPress={() => { void pickPhoto(); }} scaleTo={0.9} accessibilityLabel="Edit profile photo" style={s.editHit}>
              <View style={s.editBadge}><Glyph name="pencil" size={16} color={colors.white} /></View>
            </Press>
          </View>
          <Text style={s.name}>{session.user.name}</Text>
          <Tag
            label={verified ? 'Verified Career Professional' : 'Verification pending'}
            bg={verified ? colors.successBg : colors.yellowTint}
            fg={verified ? colors.successInk : colors.amberDeep}
          />

          <View style={s.photoActions}>
            {photoUri ? (
              <Press onPress={() => setPhoto('')} accessibilityLabel="Remove photo" style={s.linkBtn}>
                <Text style={s.linkText}>Remove photo</Text>
              </Press>
            ) : null}
            <Press
              onPress={() => setPhotoUrlOpen(!photoUrlOpen)}
              accessibilityLabel={photoUrlOpen ? 'Hide image URL' : 'Paste an image URL instead'}
              accessibilityState={{ expanded: photoUrlOpen }}
              style={s.linkBtn}
            >
              <Text style={s.linkText}>{photoUrlOpen ? 'Hide image URL' : 'Paste an image URL instead'}</Text>
              <Glyph name={photoUrlOpen ? 'close' : 'plus'} size={13} color={colors.green} />
            </Press>
          </View>

          {photoUrlOpen ? (
            <FadeUp duration={320} style={s.urlField}>
              <Field
                label="Image URL"
                value={photo}
                onChangeText={setPhoto}
                placeholder="https://…"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </FadeUp>
          ) : null}
        </FadeUp>

        {toast ? (
          <Pop duration={300}>
            <View style={s.toast}>
              <Glyph name="check" size={16} color={colors.successInk} />
              <Text style={s.toastText}>{toast}</Text>
            </View>
          </Pop>
        ) : null}

        {formError ? <Pop duration={300}><ErrorBanner message={formError} /></Pop> : null}

        <FadeUp delay={100} style={s.card}>
          <Text style={s.cardTitle}>How you introduce yourself</Text>
          <Field
            label="LinkedIn profile URL"
            value={linkedin}
            onChangeText={setLinkedin}
            placeholder="https://www.linkedin.com/in/your-name"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <View style={s.helper}>
            <Glyph name="shieldCheck" size={15} color={colors.greenDeep} />
            <Text style={s.helperText}>The Platform Owner opens this link to verify you before your listings go live.</Text>
          </View>
          <Field label="Introduction" value={intro} onChangeText={setIntro} placeholder="One or two sentences a Job Seeker reads first." multiline />
          <Field label="Background" value={background} onChangeText={setBackground} placeholder="Where you have worked and what you did there." multiline />
          <Field label="Experience" value={experience} onChangeText={setExperience} placeholder="The kind of clients you work with and the results you help them get." multiline />
        </FadeUp>

        <FadeUp delay={140} style={s.card}>
          <Text style={s.cardTitle}>What Job Seekers check before booking</Text>
          <Field label="Qualifications" value={qualifications} onChangeText={setQualifications} placeholder={'One per line, e.g.\nMaster of Career Development'} multiline />
          <Field label="Skills and expertise" value={expertise} onChangeText={setExpertise} placeholder="Separate with commas, e.g. Interview preparation, Resume writing" multiline />
          <Field label="Languages you work in" value={languages} onChangeText={setLanguages} placeholder="Separate with commas, e.g. English, Hindi" />
        </FadeUp>

        <FadeUp delay={180} style={s.card}>
          <Text style={s.cardTitle}>Default delivery</Text>
          <Text style={s.cardBody}>New services start with this delivery method. You can change it per service.</Text>
          <View style={s.chipRow}>
            {(['online', 'in_person'] as Modality[]).map((option) => (
              <Chip key={option} label={modalityLabel(option)} selected={modality === option} onPress={() => setModality(option)} />
            ))}
          </View>
        </FadeUp>

        <FadeUp delay={260} style={s.card}>
          <Text style={s.cardTitle}>Where you are based</Text>
          <View style={s.chipWrap}>
            {STATES.map((option) => (
              <Chip
                key={option}
                label={option}
                selected={state === option}
                onPress={() => setState(state === option ? '' : option)}
              />
            ))}
          </View>
          <Field label="City or region" value={city} onChangeText={setCity} placeholder="Melbourne" />
        </FadeUp>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 22 }]}>
        <Button label="Save profile" height={58} busy={busy} onPress={() => { void save(); }} style={shadow.toast} />
      </View>
      <CounsellorNav />
    </ScreenIn>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },

  body: { paddingHorizontal: 22, paddingTop: 6, gap: 20 },
  pageTitle: { ...type.display34 },

  identity: { alignItems: 'center', gap: 12, paddingVertical: 8 },
  // 116 wide so the 44pt pencil target stays inside its parent and stays tappable on Android.
  photoWrap: { width: 116, height: 116, alignItems: 'center', justifyContent: 'center' },
  avatarRing: { width: 108, height: 108, borderRadius: 54, borderWidth: 3, borderColor: colors.yellow, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.greenTint },
  editHit: { position: 'absolute', right: 0, bottom: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  editBadge: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.green, borderWidth: 3, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  name: { ...type.display24, fontSize: 26, lineHeight: 29 },

  photoActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' },
  linkBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10 },
  linkText: { fontFamily: fonts.bold, fontSize: 13, color: colors.green },
  urlField: { alignSelf: 'stretch' },

  toast: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.successBg, borderRadius: radius.md, padding: 14 },
  toastText: { flex: 1, fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.successInk },

  card: { gap: 14, padding: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.xl },
  cardTitle: { ...type.display20, fontSize: 22, lineHeight: 25 },
  cardBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: colors.muted },
  helper: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: -6 },
  helperText: { flex: 1, fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.muted },
  chipRow: { flexDirection: 'row', gap: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  footer: { paddingHorizontal: 22, paddingTop: 14, backgroundColor: colors.white },
});
