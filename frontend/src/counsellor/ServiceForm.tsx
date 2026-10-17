import { router } from 'expo-router';
import { goBack } from '@/src/navigation';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import { api, userFacingError } from '@/src/api/client';
import { Modality, Service, VerificationStatus } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { Glyph, StarMark } from '@/src/components/Glyph';
import { Avatar, Button, Chip, ErrorBanner, Field, IconButton, Press, Tag } from '@/src/components/ui';
import { BackPill, DesktopPage, desktopCard, PageHeader, useDesktop } from '@/src/desktop';
import { initials, modalityLabel, money, STATES } from '@/src/format';
import { FadeUp, Pop, ScreenIn } from '@/src/motion';
import { colors, fonts, radius, shadow, type } from '@/src/theme';

const OPTIONS: Modality[] = ['online', 'in_person'];

/** Quarter-hour steps, matching the granularity the calendar offers. */
const DURATIONS = [15, 30, 45, 60, 90, 120];

interface ServiceFormProps {
  counsellorId: string;
  accessToken: string;
  /** Present when editing an existing service; absent when publishing a new one. */
  service?: Service;
}

/**
 * The "what are you offering" form, shared by both creation (US-34/35/37/38) and
 * editing an already-published service. Editing opens with the same fields already
 * filled in, and additionally offers to delete (deactivate) the service.
 */
export default function ServiceForm({ counsellorId, accessToken, service }: ServiceFormProps) {
  const { flash, confirm } = useChrome();
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const { session } = useAuth();
  const editing = Boolean(service);

  const [title, setTitle] = useState(service?.title ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [price, setPrice] = useState(service ? String(service.priceMinor / 100) : '');
  // Duration belongs to the service, not to the counsellor's calendar: it decides
  // which start times can be offered inside their availability.
  const [duration, setDuration] = useState(service?.durationMinutes ?? 60);
  const [modalities, setModalities] = useState<Modality[]>(service?.modalities ?? ['online']);
  const [state, setState] = useState(service?.location?.state ?? '');
  const [city, setCity] = useState(service?.location?.cityOrRegion ?? '');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState('');
  // Desktop previews the listing as Explore shows it, and Explore shows the
  // counsellor's verification. Only read there; a failed read just leaves it out.
  const [verified, setVerified] = useState<VerificationStatus | null>(null);

  useEffect(() => {
    if (!desktop || !session) return;
    let live = true;
    api.getOwnCounsellorProfile(session.user, accessToken)
      .then((profile) => { if (live) setVerified(profile.verificationStatus); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [desktop, session, accessToken]);

  const inPerson = modalities.includes('in_person');
  const toggle = (option: Modality) =>
    setModalities((current) => (current.includes(option) ? current.filter((item) => item !== option) : [...current, option]));

  // A listing is what a buyer commits money against, so each rule below states
  // the missing piece rather than a generic "invalid form".
  const submit = async () => {
    const minor = Math.round(Number(price.replace(/[^0-9.]/g, '')) * 100);
    if (title.trim().length < 5) return setFormError('Give the service a clear title of at least 5 characters.');
    if (description.trim().length < 30) return setFormError('Describe what the buyer gets in at least 30 characters.');
    if (!price.trim() || !Number.isFinite(minor) || minor <= 0) return setFormError('Enter a price greater than zero.');
    if (minor > 10000000) return setFormError('Enter a price under $100,000.');
    if (!modalities.length) return setFormError('Choose at least one way you deliver this service.');
    if (inPerson && (!state || !city.trim())) return setFormError('In-person delivery needs the state and city where you meet.');

    const draft = {
      title: title.trim(),
      description: description.trim(),
      priceMinor: minor,
      durationMinutes: duration,
      currency: 'AUD' as const,
      modalities,
      location: inPerson ? { state, cityOrRegion: city.trim() } : null,
    };

    setFormError('');
    setBusy(true);
    try {
      if (editing && service) {
        await api.updateService(service.id, draft, accessToken);
      } else {
        await api.createService(counsellorId, draft, accessToken);
      }
      router.replace('/counsellor');
      flash(editing ? 'Service updated' : 'Service published');
    } catch (cause) {
      setFormError(userFacingError(cause));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!service) return;
    const sure = await confirm({
      title: 'Delete this service?',
      message: 'It will no longer appear in Explore or in your own list. Bookings already made against it are not affected.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!sure) return;

    setFormError('');
    setDeleting(true);
    try {
      await api.deleteService(service.id, accessToken);
      router.replace('/counsellor');
      flash('Service deleted');
    } catch (cause) {
      setFormError(userFacingError(cause));
      setDeleting(false);
    }
  };

  // Desktop: the form on the left, a live preview of the Explore card on the right,
  // and the submit button at the foot of the form rather than pinned to the screen.
  if (desktop) {
    const minor = Math.round(Number(price.replace(/[^0-9.]/g, '')) * 100);
    const name = session?.user.name ?? '';
    const durationLabel = (minutes: number) => (minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} hr` : `${minutes} min`);
    return (
      <DesktopPage>
        <BackPill label="Workspace" accessibilityLabel="Back to workspace" onPress={() => goBack('/counsellor')} />
        <PageHeader
          eyebrow={editing ? 'Edit service' : 'New service'}
          title={editing ? 'Update your listing' : 'What are you offering?'}
          subtitle="This is what a Job Seeker sees in Explore before they book."
        />

        {formError ? <Pop duration={300}><ErrorBanner message={formError} /></Pop> : null}

        <View style={s.desktopColumns}>
          <View style={s.desktopMain}>
            <View style={[s.card, s.desktopCard]}>
              <Text style={s.cardTitle}>The session</Text>
              <Field label="Service title" value={title} onChangeText={setTitle} placeholder="Interview confidence coaching" />
              <Field
                label="Description"
                value={description}
                onChangeText={setDescription}
                placeholder="What happens in the session, and what the buyer walks away with."
                multiline
              />
            </View>

            <View style={[s.card, s.desktopCard]}>
              <Text style={s.cardTitle}>What it costs</Text>
              <View style={[s.price, s.desktopPrice]}>
                <Text style={s.priceLabel}>Price (AUD)</Text>
                <View style={s.priceBox}>
                  <Text style={s.priceSymbol}>$</Text>
                  <TextInput
                    accessibilityLabel="Price (AUD)"
                    value={price}
                    onChangeText={setPrice}
                    placeholder="95"
                    placeholderTextColor={colors.sub}
                    inputMode="decimal"
                    style={s.priceInput}
                  />
                </View>
                <Text style={s.priceHint}>The full price of one session, in Australian dollars.</Text>
              </View>
              <Text style={[s.durationLabel, s.desktopDurationLabel]}>How long is a session?</Text>
              <View style={[s.durationRow, s.desktopDurationRow]}>
                {DURATIONS.map((option) => (
                  <Chip key={option} label={durationLabel(option)} selected={duration === option} onPress={() => setDuration(option)} />
                ))}
              </View>
              <Text style={s.priceHint}>Job seekers are offered start times that fit this length inside your availability.</Text>
            </View>

            <View style={[s.card, s.desktopCard]}>
              <Text style={s.cardTitle}>How do you deliver it?</Text>
              <Text style={s.cardBody}>Choose one or both. In-person services need a meeting area.</Text>
              <View style={s.desktopOptions}>
                {OPTIONS.map((option) => {
                  const selected = modalities.includes(option);
                  return (
                    <Press
                      key={option}
                      onPress={() => toggle(option)}
                      scaleTo={0.98}
                      accessibilityRole="checkbox"
                      accessibilityLabel={modalityLabel(option)}
                      accessibilityState={{ checked: selected }}
                      style={[s.option, s.desktopOption, { borderColor: selected ? colors.green : colors.line, backgroundColor: selected ? colors.greenTint : colors.field }]}
                    >
                      <Text style={s.optionLabel}>{modalityLabel(option)}</Text>
                      <View style={[s.optionMark, { borderColor: selected ? colors.green : colors.mark, backgroundColor: selected ? colors.green : colors.white }]}>
                        {selected ? <Pop duration={300}><Glyph name="check" size={13} color={colors.white} /></Pop> : null}
                      </View>
                    </Press>
                  );
                })}
              </View>
              {inPerson ? (
                <FadeUp duration={400} style={s.desktopWhere}>
                  <Text style={s.durationLabel}>Where you meet</Text>
                  <View style={s.chipWrap}>
                    {STATES.map((option) => (
                      <Chip key={option} label={option} selected={state === option} onPress={() => setState(state === option ? '' : option)} />
                    ))}
                  </View>
                  <Field label="City or region" value={city} onChangeText={setCity} placeholder="Melbourne" style={s.desktopCity} />
                </FadeUp>
              ) : null}
            </View>

            <View style={s.desktopActions}>
              {editing ? (
                <Press onPress={() => { void remove(); }} disabled={deleting} scaleTo={0.98} accessibilityLabel="Delete service" style={[s.deleteRow, s.desktopDelete]}>
                  <Glyph name="trash" size={16} color={colors.danger} />
                  <Text style={s.deleteText}>{deleting ? 'Deleting…' : 'Delete this service'}</Text>
                </Press>
              ) : null}
              <View style={s.desktopFill} />
              <Button
                label={editing ? 'Save changes' : 'Publish service'}
                height={54}
                labelSize={15}
                busy={busy}
                disabled={deleting}
                onPress={() => { void submit(); }}
                style={[shadow.toast, s.desktopSubmit]}
              />
            </View>
          </View>

          <View style={s.desktopAside}>
            <Text style={type.groupLabel}>How it appears in Explore</Text>
            <View style={[desktopCard, s.desktopPreview]}>
              <View style={s.desktopPreviewHead}>
                <Avatar initials={initials(name)} size={44} bg={colors.greenTint} fg={colors.ink} />
                <View style={s.desktopPreviewWho}>
                  <Text style={s.desktopPreviewName}>{name}</Text>
                  {verified ? (
                    <View style={s.desktopPreviewVerify}>
                      {verified === 'verified' ? <Glyph name="shieldCheck" size={13} color={colors.greenDeep} /> : null}
                      <Text style={[s.desktopPreviewVerifyText, { color: verified === 'verified' ? colors.greenDeep : colors.amberInk }]}>
                        {verified === 'verified' ? 'Verified' : 'Verification pending'}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={s.desktopPreviewPrice}>{minor > 0 ? money(minor) : '$—'}</Text>
              </View>
              <Text style={type.display24}>{title.trim() || 'Your service title'}</Text>
              <Text numberOfLines={2} style={s.desktopPreviewBody}>
                {description.trim() || 'What happens in the session, and what the buyer walks away with.'}
              </Text>
              <View style={s.desktopPreviewFoot}>
                <View style={s.chipWrap}>
                  {modalities.map((option) => <Tag key={option} label={modalityLabel(option)} />)}
                  {inPerson && state ? <Tag label={`${city.trim() || 'City'}, ${state}`} bg={colors.yellowTint} fg={colors.amberDeep} /> : null}
                  <Tag label={durationLabel(duration)} />
                </View>
                <View style={s.desktopPreviewRating}>
                  <StarMark size={14} />
                  <Text style={s.desktopPreviewNew}>New</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </DesktopPage>
    );
  }

  return (
    <ScreenIn style={s.screen}>
      <View style={[s.topBar, { paddingTop: insets.top + 10 }]}>
        <IconButton onPress={() => goBack('/counsellor')} tone="white" label="Back">
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Polyline points="14.5,5 7.5,12 14.5,19" fill="none" stroke={colors.green} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </IconButton>
        <Text style={s.topTitle}>{editing ? 'Edit service' : 'New service'}</Text>
        <View style={s.topSpacer} />
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <FadeUp style={s.intro}>
          <Text style={type.display34}>{editing ? 'Update your listing' : 'What are you offering?'}</Text>
          <Text style={s.introBody}>This is what a Job Seeker sees in Explore before they book.</Text>
        </FadeUp>

        {formError ? <Pop duration={300}><ErrorBanner message={formError} /></Pop> : null}

        <FadeUp delay={100} style={s.card}>
          <Text style={s.cardTitle}>The session</Text>
          <Field label="Service title" value={title} onChangeText={setTitle} placeholder="Interview confidence coaching" />
          <Field
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="What happens in the session, and what the buyer walks away with."
            multiline
          />
        </FadeUp>

        <FadeUp delay={180} style={s.card}>
          <Text style={s.cardTitle}>What it costs</Text>
          <View style={s.price}>
            <Text style={s.priceLabel}>Price (AUD)</Text>
            <View style={s.priceBox}>
              <Text style={s.priceSymbol}>$</Text>
              <TextInput
                accessibilityLabel="Price (AUD)"
                value={price}
                onChangeText={setPrice}
                placeholder="95"
                placeholderTextColor={colors.sub}
                inputMode="decimal"
                style={s.priceInput}
              />
            </View>
            <Text style={s.priceHint}>The full price of one session, in Australian dollars.</Text>
          </View>

          <Text style={s.durationLabel}>How long is a session?</Text>
          <View style={s.durationRow}>
            {DURATIONS.map((option) => (
              <Chip
                key={option}
                label={option >= 60 && option % 60 === 0 ? `${option / 60} hr` : `${option} min`}
                selected={duration === option}
                onPress={() => setDuration(option)}
              />
            ))}
          </View>
          <Text style={s.priceHint}>
            Job seekers are offered start times that fit this length inside your availability.
          </Text>
        </FadeUp>

        <FadeUp delay={260} style={s.card}>
          <Text style={s.cardTitle}>How do you deliver it?</Text>
          <Text style={s.cardBody}>Choose one or both. In-person services need a meeting area.</Text>
          {OPTIONS.map((option) => {
            const selected = modalities.includes(option);
            return (
              <Press
                key={option}
                onPress={() => toggle(option)}
                scaleTo={0.98}
                accessibilityRole="checkbox"
                accessibilityLabel={modalityLabel(option)}
                accessibilityState={{ checked: selected }}
                style={[s.option, { borderColor: selected ? colors.green : colors.line, backgroundColor: selected ? colors.greenTint : colors.field }]}
              >
                <Text style={s.optionLabel}>{modalityLabel(option)}</Text>
                <View style={[s.optionMark, { borderColor: selected ? colors.green : colors.mark, backgroundColor: selected ? colors.green : colors.white }]}>
                  {selected ? <Pop duration={300}><Glyph name="check" size={13} color={colors.white} /></Pop> : null}
                </View>
              </Press>
            );
          })}
        </FadeUp>

        {inPerson ? (
          <FadeUp duration={400} style={s.card}>
            <Text style={s.cardTitle}>Where you meet</Text>
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
        ) : null}

        {editing ? (
          <Press onPress={() => { void remove(); }} disabled={deleting} scaleTo={0.98} accessibilityLabel="Delete service" style={s.deleteRow}>
            <Glyph name="trash" size={16} color={colors.danger} />
            <Text style={s.deleteText}>{deleting ? 'Deleting…' : 'Delete this service'}</Text>
          </Press>
        ) : null}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 22 }]}>
        <Button
          label={editing ? 'Save changes' : 'Publish service'}
          height={58}
          busy={busy}
          disabled={deleting}
          onPress={() => { void submit(); }}
          style={shadow.toast}
        />
      </View>
    </ScreenIn>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  topTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  topSpacer: { width: 44 },

  body: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 24, gap: 20 },
  intro: { gap: 8 },
  introBody: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, color: colors.muted },

  card: { gap: 14, padding: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.xl },
  cardTitle: { ...type.display20, fontSize: 22, lineHeight: 25 },
  cardBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: colors.muted },

  price: { gap: 7 },
  priceLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  priceBox: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 54, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.field, paddingHorizontal: 16 },
  priceSymbol: { fontFamily: fonts.extra, fontSize: 16, color: colors.green },
  priceInput: { flex: 1, height: '100%', fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  durationLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, marginTop: 14 },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  priceHint: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.sub },

  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1.5 },
  optionLabel: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  optionMark: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  deleteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48 },
  deleteText: { fontFamily: fonts.bold, fontSize: 14, color: colors.danger },

  footer: { paddingHorizontal: 22, paddingTop: 14, backgroundColor: colors.white },

  desktopColumns: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 28 },
  desktopMain: { flexGrow: 999, flexShrink: 1, flexBasis: 0, minWidth: '60%', gap: 18 },
  desktopAside: { flexGrow: 1, flexShrink: 1, flexBasis: 300, gap: 10 },
  desktopCard: { padding: 24, borderRadius: 22 },
  desktopPrice: { maxWidth: 260 },
  desktopDurationLabel: { marginTop: 6 },
  desktopDurationRow: { marginTop: 0 },
  desktopOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  desktopOption: { flexGrow: 1, flexShrink: 1, flexBasis: 200 },
  desktopWhere: { gap: 12, marginTop: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.lineSoft },
  desktopCity: { maxWidth: 320 },
  desktopActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  desktopDelete: { paddingHorizontal: 14, borderRadius: radius.pill },
  desktopFill: { flex: 1 },
  desktopSubmit: { paddingHorizontal: 28 },
  desktopPreview: { padding: 20, gap: 12 },
  desktopPreviewHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  desktopPreviewWho: { flex: 1, minWidth: 0, gap: 2 },
  desktopPreviewName: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  desktopPreviewVerify: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  desktopPreviewVerifyText: { fontFamily: fonts.semi, fontSize: 12 },
  desktopPreviewPrice: { fontFamily: fonts.extra, fontSize: 20, letterSpacing: -0.3, color: colors.green },
  desktopPreviewBody: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.muted },
  desktopPreviewFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  desktopPreviewRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  desktopPreviewNew: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
});
