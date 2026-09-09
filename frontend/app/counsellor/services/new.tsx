import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import { api, userFacingError } from '@/src/api/client';
import { Modality } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { Glyph } from '@/src/components/Glyph';
import { Button, Chip, ErrorBanner, Field, IconButton, Press } from '@/src/components/ui';
import { modalityLabel, STATES } from '@/src/format';
import { FadeUp, Pop, ScreenIn } from '@/src/motion';
import { colors, fonts, radius, shadow, type } from '@/src/theme';

const OPTIONS: Modality[] = ['online', 'in_person'];

export default function NewServiceScreen() {
  const { session } = useAuth();
  const { flash } = useChrome();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [modalities, setModalities] = useState<Modality[]>(['online']);
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  if (!session || session.user.role !== 'counsellor') return <Redirect href="/" />;

  const inPerson = modalities.includes('in_person');
  const toggle = (option: Modality) =>
    setModalities((current) => (current.includes(option) ? current.filter((item) => item !== option) : [...current, option]));

  // A listing is what a buyer commits money against, so each rule below states
  // the missing piece rather than a generic "invalid form".
  const publish = async () => {
    const minor = Math.round(Number(price.replace(/[^0-9.]/g, '')) * 100);
    if (title.trim().length < 5) return setFormError('Give the service a clear title of at least 5 characters.');
    if (description.trim().length < 30) return setFormError('Describe what the buyer gets in at least 30 characters.');
    if (!price.trim() || !Number.isFinite(minor) || minor <= 0) return setFormError('Enter a price greater than zero.');
    if (minor > 10000000) return setFormError('Enter a price under $100,000.');
    if (!modalities.length) return setFormError('Choose at least one way you deliver this service.');
    if (inPerson && (!state || !city.trim())) return setFormError('In-person delivery needs the state and city where you meet.');

    setFormError('');
    setBusy(true);
    try {
      await api.createService(session.user.id, {
        title: title.trim(),
        description: description.trim(),
        priceMinor: minor,
        currency: 'AUD',
        modalities,
        location: inPerson ? { state, cityOrRegion: city.trim() } : null,
      }, session.accessToken);
      router.replace('/counsellor');
      flash('Service published');
    } catch (cause) {
      setFormError(userFacingError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenIn style={s.screen}>
      <View style={[s.topBar, { paddingTop: insets.top + 10 }]}>
        <IconButton onPress={() => router.back()} tone="white" label="Back">
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Polyline points="14.5,5 7.5,12 14.5,19" fill="none" stroke={colors.green} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </IconButton>
        <Text style={s.topTitle}>New service</Text>
        <View style={s.topSpacer} />
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <FadeUp style={s.intro}>
          <Text style={type.display34}>What are you offering?</Text>
          <Text style={s.introBody}>This is what a Job Seeker sees in the Marketplace before they book.</Text>
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
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 22 }]}>
        <Button label="Publish service" height={58} busy={busy} onPress={() => { void publish(); }} style={shadow.toast} />
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
  priceHint: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.sub },

  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1.5 },
  optionLabel: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  optionMark: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  footer: { paddingHorizontal: 22, paddingTop: 14, backgroundColor: colors.white },
});
