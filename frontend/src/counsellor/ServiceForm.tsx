import { router } from 'expo-router';
import { goBack } from '@/src/navigation';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import { api, userFacingError } from '@/src/api/client';
import { Modality, Service } from '@/src/api/types';
import { useChrome } from '@/src/chrome';
import { Glyph } from '@/src/components/Glyph';
import { Button, Chip, ErrorBanner, Field, IconButton, Press } from '@/src/components/ui';
import { modalityLabel, STATES } from '@/src/format';
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
});
