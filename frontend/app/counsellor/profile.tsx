import { Href, Redirect, router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, userFacingError } from '@/src/api/client';
import { CounsellorProfile, CounsellorProfileUpdate, Modality } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { CounsellorNav } from '@/src/components/CounsellorNav';
import { Glyph, GlyphName } from '@/src/components/Glyph';
import { TopBar } from '@/src/components/TopBar';
import { DesktopPage, desktopCard, PageHeader, useDesktop } from '@/src/desktop';
import { Avatar, Button, Chip, ErrorBanner, Field, Press, Spinner } from '@/src/components/ui';
import { initials, modalityLabel, STATES } from '@/src/format';
import { FadeUp, ScreenIn } from '@/src/motion';
import { colors, fonts, radius, type } from '@/src/theme';
import { normaliseLinkedIn, VerificationState, verificationState, VerificationTag } from '@/src/verification';

/** How long after the last change the profile is saved. */
const SAVE_AFTER_MS = 800;

/** The form as typed. Lists are kept as the text the person edits. */
interface Draft {
  photo: string;
  linkedin: string;
  intro: string;
  background: string;
  experience: string;
  qualifications: string;
  expertise: string;
  languages: string;
  state: string;
  city: string;
  modality: Modality;
}

const blank: Draft = {
  photo: '', linkedin: '', intro: '', background: '', experience: '',
  qualifications: '', expertise: '', languages: '', state: '', city: '', modality: 'online',
};

const toDraft = (profile: CounsellorProfile): Draft => ({
  photo: profile.photoUrl ?? '',
  // A profile saved before verification existed loads without a link: leave
  // the field empty so the counsellor has to supply one.
  linkedin: profile.linkedinUrl ?? '',
  intro: profile.introduction,
  background: profile.background,
  experience: profile.experience,
  qualifications: (profile.qualifications ?? []).join('\n'),
  expertise: (profile.expertise ?? []).join(', '),
  languages: (profile.languages ?? []).join(', '),
  state: profile.baseLocation?.state ?? '',
  city: profile.baseLocation?.cityOrRegion ?? '',
  modality: profile.defaultModality,
});

/** A typed list back into items: trimmed, no blanks, no repeats. */
function listOf(text: string, separator: string): string[] {
  return [...new Set(text.split(separator).map((item) => item.trim()).filter(Boolean))];
}

/**
 * What a draft still needs before it can be saved, or the update to send.
 *
 * Every message is the prototype's, word for word — they are the product copy
 * for what a listing needs before a buyer will trust it.
 */
function check(draft: Draft): { problem: string } | { update: CounsellorProfileUpdate } {
  const { state, modality } = draft;
  const city = draft.city.trim();
  if (!draft.linkedin.trim()) return { problem: 'Add your LinkedIn profile URL so the Platform Owner can verify you.' };
  const linkedinUrl = normaliseLinkedIn(draft.linkedin);
  if (!linkedinUrl) return { problem: 'Enter a LinkedIn profile URL, for example https://www.linkedin.com/in/your-name.' };
  if (draft.intro.trim().length < 20) return { problem: 'Write at least 20 characters so buyers know who they are booking.' };
  if (!draft.background.trim()) return { problem: 'Describe your professional background.' };
  if (!draft.experience.trim()) return { problem: 'Describe the experience you bring to a session.' };
  if (modality === 'in_person' && (!state || !city)) {
    return { problem: 'An in-person default needs the state and city you usually meet clients in.' };
  }
  if (state && !city) return { problem: 'Add the city or region for the state you chose.' };

  return {
    update: {
      photoUrl: draft.photo.trim() || null,
      linkedinUrl,
      introduction: draft.intro.trim(),
      background: draft.background.trim(),
      experience: draft.experience.trim(),
      qualifications: listOf(draft.qualifications, '\n'),
      expertise: listOf(draft.expertise, ','),
      languages: listOf(draft.languages, ','),
      baseLocation: state ? { state, cityOrRegion: city } : null,
      defaultModality: modality,
    },
  };
}

/** Where the profile stands against the backend. `blocked` and `failed` say why it is not saved. */
type Saving = { kind: 'idle' | 'saving' | 'saved' } | { kind: 'blocked' | 'failed'; message: string };

const savingLook: Record<Saving['kind'], { bg: string; fg: string; glyph: GlyphName; title?: string }> = {
  idle: { bg: colors.chip, fg: colors.muted, glyph: 'refresh' },
  saving: { bg: colors.chip, fg: colors.muted, glyph: 'refresh' },
  saved: { bg: colors.successBg, fg: colors.successInk, glyph: 'check' },
  blocked: { bg: colors.yellowTint, fg: colors.amberDeep, glyph: 'pencil', title: 'Not saved yet' },
  failed: { bg: colors.dangerBg, fg: colors.dangerInk, glyph: 'close', title: 'Could not save' },
};

/**
 * US-30. The professional profile saves itself: a pause after any change sends it,
 * and the bar at the foot of the screen says where it stands. A profile that is
 * not yet complete is held back, and the bar says what it still needs.
 */
export default function CounsellorProfileScreen() {
  const { session } = useAuth();
  const { flash } = useChrome();
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();

  const [draft, setDraft] = useState<Draft>(blank);
  const [photoUrlOpen, setPhotoUrlOpen] = useState(false);
  // Undefined until the backend answers, null if it could not: no status is guessed.
  const [verification, setVerification] = useState<VerificationState | null>();
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState<Saving>({ kind: 'idle' });

  const snapshot = JSON.stringify(draft);
  // What the backend holds: the draft last read or saved. Null until it has been
  // read, so a blank form is never saved over a profile that failed to load.
  const saved = useRef<string | null>(null);
  const latest = useRef(snapshot);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (!session) return;
    // Edits not yet saved are never replaced by what the backend last had.
    if (inFlight.current || (saved.current !== null && latest.current !== saved.current)) return;
    try {
      const profile = await api.getOwnCounsellorProfile(session.user, session.accessToken);
      const loaded = toDraft(profile);
      saved.current = JSON.stringify(loaded);
      latest.current = saved.current;
      setDraft(loaded);
      setVerification(verificationState(profile));
      setLoadError('');
    } catch (cause) {
      setLoadError(userFacingError(cause));
      setVerification(null);
    }
  }, [session]);

  const save = useCallback(async () => {
    if (!session || inFlight.current || saved.current === null) return;
    if (latest.current === saved.current) {
      // Back to what the backend already holds: nothing to send, and nothing left to complain about.
      return setSaving((current) => (current.kind === 'idle' ? current : { kind: 'saved' }));
    }
    inFlight.current = true;
    try {
      // Edits made while a save is in flight are sent next, so the last one always wins.
      while (latest.current !== saved.current) {
        const sending: string = latest.current;
        const checked = check(JSON.parse(sending) as Draft);
        if ('problem' in checked) return setSaving({ kind: 'blocked', message: checked.problem });
        setSaving({ kind: 'saving' });
        await api.updateOwnCounsellorProfile(session.user.id, checked.update, session.accessToken);
        saved.current = sending;
      }
      setSaving({ kind: 'saved' });
    } catch (cause) {
      setSaving({ kind: 'failed', message: userFacingError(cause) });
    } finally {
      inFlight.current = false;
    }
  }, [session]);

  useEffect(() => {
    latest.current = snapshot;
    if (saved.current === null) return;
    const timer = setTimeout(() => { void save(); }, SAVE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [snapshot, save]);

  useFocusEffect(useCallback(() => {
    void load();
    // Leaving within the pause after a change must not lose that change.
    return () => { void save(); };
  }, [load, save]));

  if (!session || session.user.role !== 'counsellor') return <Redirect href="/" />;

  const set = <K extends keyof Draft>(key: K) => (value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    // A reason already on show stays until the next check replaces it.
    setSaving((current) => ('message' in current ? current : { kind: 'saving' }));
  };

  const photoUri = draft.photo.trim();
  const look = savingLook[saving.kind];

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
      if (picked) set('photo')(picked);
    } catch {
      flash('The photo library is unavailable — paste an image URL instead.');
    }
  };

  // Desktop shows the same save status under the identity card instead of in a footer.
  const savingBar = (
    <View accessibilityLiveRegion="polite" style={[s.saving, s.desktopSaving, { backgroundColor: look.bg }]}>
      {saving.kind === 'saving'
        ? <Spinner size={16} color={colors.green} />
        : <Glyph name={look.glyph} size={16} color={look.fg} />}
      <View style={s.savingCopy}>
        {look.title ? <Text style={[s.savingTitle, { color: look.fg }]}>{look.title}</Text> : null}
        <Text style={[s.savingText, { color: look.fg }]}>
          {'message' in saving
            ? saving.message
            : saving.kind === 'saving'
              ? 'Saving…'
              : saving.kind === 'saved'
                ? 'Your profile is saved and visible on your listings.'
                : 'Changes save automatically.'}
        </Text>
      </View>
      {saving.kind === 'failed' ? (
        <Press onPress={() => { void save(); }} accessibilityLabel="Try again" style={s.retry}>
          <Text style={s.retryText}>Try again</Text>
        </Press>
      ) : null}
    </View>
  );

  // Desktop: who you are and whether it is saved in a rail on the left, the
  // profile's sections beside it, with paired fields side by side.
  if (desktop) {
    return (
      <DesktopPage>
        <PageHeader eyebrow="Public profile" title="Professional profile" />

        {loadError ? (
          <View style={[s.loadFailed, s.desktopLoadFailed]}>
            <ErrorBanner message={loadError} />
            <Button label="Try again" tone="outline" height={48} onPress={() => { void load(); }} />
          </View>
        ) : null}

        <View style={s.desktopColumns}>
          <View style={s.desktopRail}>
            <View style={[desktopCard, s.desktopIdentity]}>
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
              <Press onPress={() => router.push('/counsellor/verification')} accessibilityLabel="Verification">
                <VerificationTag state={verification} />
              </Press>
              <View style={s.photoActions}>
                {photoUri ? (
                  <Press onPress={() => set('photo')('')} accessibilityLabel="Remove photo" style={s.linkBtn}>
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
                    value={draft.photo}
                    onChangeText={set('photo')}
                    placeholder="https://…"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                </FadeUp>
              ) : null}
              <Button
                label="Profile privacy"
                tone="outline"
                height={46}
                labelSize={14}
                onPress={() => router.push('/settings/privacy' as Href)}
                style={s.privacyButton}
              />
            </View>
            {savingBar}
          </View>

          <View style={s.desktopMain}>
            <View style={[s.card, s.desktopCard]}>
              <Text style={s.cardTitle}>How you introduce yourself</Text>
              <Field
                label="LinkedIn profile URL"
                value={draft.linkedin}
                onChangeText={set('linkedin')}
                placeholder="https://www.linkedin.com/in/your-name"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <View style={s.helper}>
                <Glyph name="shieldCheck" size={15} color={colors.greenDeep} />
                <Text style={s.helperText}>The Platform Owner opens this link to verify you before your listings go live.</Text>
              </View>
              <Field label="Introduction" value={draft.intro} onChangeText={set('intro')} placeholder="One or two sentences a Job Seeker reads first." multiline />
              <View style={s.desktopPair}>
                <Field style={s.desktopHalf} label="Background" value={draft.background} onChangeText={set('background')} placeholder="Where you have worked and what you did there." multiline />
                <Field style={s.desktopHalf} label="Experience" value={draft.experience} onChangeText={set('experience')} placeholder="The kind of clients you work with and the results you help them get." multiline />
              </View>
            </View>

            <View style={[s.card, s.desktopCard]}>
              <Text style={s.cardTitle}>What Job Seekers check before booking</Text>
              <View style={s.desktopPair}>
                <Field style={s.desktopHalf} label="Qualifications" value={draft.qualifications} onChangeText={set('qualifications')} placeholder={'One per line, e.g.\nMaster of Career Development'} multiline />
                <Field style={s.desktopHalf} label="Skills and expertise" value={draft.expertise} onChangeText={set('expertise')} placeholder="Separate with commas, e.g. Interview preparation, Resume writing" multiline />
              </View>
              <Field label="Languages you work in" value={draft.languages} onChangeText={set('languages')} placeholder="Separate with commas, e.g. English, Hindi" />
            </View>

            <View style={s.desktopPair}>
              <View style={[s.card, s.desktopCard, s.desktopHalf]}>
                <Text style={s.cardTitle}>Default delivery</Text>
                <Text style={s.cardBody}>New services start with this delivery method. You can change it per service.</Text>
                <View style={s.chipRow}>
                  {(['online', 'in_person'] as Modality[]).map((option) => (
                    <Chip key={option} label={modalityLabel(option)} selected={draft.modality === option} onPress={() => set('modality')(option)} />
                  ))}
                </View>
              </View>
              <View style={[s.card, s.desktopCard, s.desktopHalf]}>
                <Text style={s.cardTitle}>Where you are based</Text>
                <View style={s.chipWrap}>
                  {STATES.map((option) => (
                    <Chip
                      key={option}
                      label={option}
                      selected={draft.state === option}
                      onPress={() => set('state')(draft.state === option ? '' : option)}
                    />
                  ))}
                </View>
                <Field label="City or region" value={draft.city} onChangeText={set('city')} placeholder="Melbourne" />
              </View>
            </View>
          </View>
        </View>
      </DesktopPage>
    );
  }

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
          <Press onPress={() => router.push('/counsellor/verification')} accessibilityLabel="Verification">
            <VerificationTag state={verification} />
          </Press>

          <View style={s.photoActions}>
            {photoUri ? (
              <Press onPress={() => set('photo')('')} accessibilityLabel="Remove photo" style={s.linkBtn}>
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
                value={draft.photo}
                onChangeText={set('photo')}
                placeholder="https://…"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </FadeUp>
          ) : null}

          <Button
            label="Profile privacy"
            tone="outline"
            height={48}
            onPress={() => router.push('/settings/privacy' as Href)}
            style={s.privacyButton}
          />
        </FadeUp>

        {loadError ? (
          <View style={s.loadFailed}>
            <ErrorBanner message={loadError} />
            <Button label="Try again" tone="outline" height={48} onPress={() => { void load(); }} />
          </View>
        ) : null}

        <FadeUp delay={100} style={s.card}>
          <Text style={s.cardTitle}>How you introduce yourself</Text>
          <Field
            label="LinkedIn profile URL"
            value={draft.linkedin}
            onChangeText={set('linkedin')}
            placeholder="https://www.linkedin.com/in/your-name"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <View style={s.helper}>
            <Glyph name="shieldCheck" size={15} color={colors.greenDeep} />
            <Text style={s.helperText}>The Platform Owner opens this link to verify you before your listings go live.</Text>
          </View>
          <Field label="Introduction" value={draft.intro} onChangeText={set('intro')} placeholder="One or two sentences a Job Seeker reads first." multiline />
          <Field label="Background" value={draft.background} onChangeText={set('background')} placeholder="Where you have worked and what you did there." multiline />
          <Field label="Experience" value={draft.experience} onChangeText={set('experience')} placeholder="The kind of clients you work with and the results you help them get." multiline />
        </FadeUp>

        <FadeUp delay={140} style={s.card}>
          <Text style={s.cardTitle}>What Job Seekers check before booking</Text>
          <Field label="Qualifications" value={draft.qualifications} onChangeText={set('qualifications')} placeholder={'One per line, e.g.\nMaster of Career Development'} multiline />
          <Field label="Skills and expertise" value={draft.expertise} onChangeText={set('expertise')} placeholder="Separate with commas, e.g. Interview preparation, Resume writing" multiline />
          <Field label="Languages you work in" value={draft.languages} onChangeText={set('languages')} placeholder="Separate with commas, e.g. English, Hindi" />
        </FadeUp>

        <FadeUp delay={180} style={s.card}>
          <Text style={s.cardTitle}>Default delivery</Text>
          <Text style={s.cardBody}>New services start with this delivery method. You can change it per service.</Text>
          <View style={s.chipRow}>
            {(['online', 'in_person'] as Modality[]).map((option) => (
              <Chip key={option} label={modalityLabel(option)} selected={draft.modality === option} onPress={() => set('modality')(option)} />
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
                selected={draft.state === option}
                onPress={() => set('state')(draft.state === option ? '' : option)}
              />
            ))}
          </View>
          <Field label="City or region" value={draft.city} onChangeText={set('city')} placeholder="Melbourne" />
        </FadeUp>
      </ScrollView>

      {/* Where the Save button was: the same place to look, now for whether it is saved. */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 14 }]}>
        <View accessibilityLiveRegion="polite" style={[s.saving, { backgroundColor: look.bg }]}>
          {saving.kind === 'saving'
            ? <Spinner size={16} color={colors.green} />
            : <Glyph name={look.glyph} size={16} color={look.fg} />}
          <View style={s.savingCopy}>
            {look.title ? <Text style={[s.savingTitle, { color: look.fg }]}>{look.title}</Text> : null}
            <Text style={[s.savingText, { color: look.fg }]}>
              {'message' in saving
                ? saving.message
                : saving.kind === 'saving'
                  ? 'Saving…'
                  : saving.kind === 'saved'
                    ? 'Your profile is saved and visible on your listings.'
                    : 'Changes save automatically.'}
            </Text>
          </View>
          {saving.kind === 'failed' ? (
            <Press onPress={() => { void save(); }} accessibilityLabel="Try again" style={s.retry}>
              <Text style={s.retryText}>Try again</Text>
            </Press>
          ) : null}
        </View>
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
  privacyButton: { alignSelf: 'stretch' },

  loadFailed: { gap: 12 },

  card: { gap: 14, padding: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.xl },
  cardTitle: { ...type.display20, fontSize: 22, lineHeight: 25 },
  cardBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: colors.muted },
  helper: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: -6 },
  helperText: { flex: 1, fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.muted },
  chipRow: { flexDirection: 'row', gap: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  footer: { paddingHorizontal: 22, paddingTop: 10, backgroundColor: colors.white },
  saving: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.md },
  savingCopy: { flex: 1, gap: 1 },
  savingTitle: { fontFamily: fonts.bold, fontSize: 13 },
  savingText: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
  retry: { minHeight: 36, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontFamily: fonts.bold, fontSize: 13, color: colors.dangerInk },

  desktopLoadFailed: { maxWidth: 520 },
  desktopColumns: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 24 },
  desktopRail: { flexGrow: 1, flexShrink: 1, flexBasis: 280, gap: 14 },
  desktopIdentity: { alignItems: 'center', padding: 24, gap: 12 },
  desktopSaving: { minHeight: 52, paddingVertical: 12 },
  desktopMain: { flexGrow: 999, flexShrink: 1, flexBasis: 0, minWidth: '60%', gap: 18 },
  desktopCard: { padding: 24, borderRadius: 22 },
  desktopPair: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  desktopHalf: { flexGrow: 1, flexShrink: 1, flexBasis: 260 },
});
