import { Redirect, useFocusEffect } from 'expo-router';
import { goBack } from '@/src/navigation';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, fieldErrors, userFacingError } from '@/src/api/client';
import { PayoutStatus } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';
import { useChrome } from '@/src/chrome';
import { BackBar } from '@/src/components/booking';
import { Glyph } from '@/src/components/Glyph';
import { Button, Chip, ErrorBanner, Field, Tag } from '@/src/components/ui';
import { FadeUp, Pop, ScreenIn } from '@/src/motion';
import { usePaymentConfig } from '@/src/payments';
import { onboardingReturnTo, openOnboarding } from '@/src/payments/onboarding';
import { payoutActionLabel, payoutStage, payoutStageTitle } from '@/src/payments/payoutStage';
import { waitForPayouts } from '@/src/payments/waitForPayouts';
import { colors, fonts, radius, shadow, type } from '@/src/theme';

/** An ABN is eleven digits; people write it in groups, so only the digits are kept. */
const abnDigits = (raw: string) => raw.replace(/\D/g, '').slice(0, 11);
const formatAbn = (digits: string) =>
  digits.replace(/^(\d{2})(\d{0,3})(\d{0,3})(\d{0,3}).*$/, (_m, a, b, c, d) =>
    [a, b, c, d].filter(Boolean).join(' '));

/**
 * US-47 — where a counsellor sets up being paid.
 *
 * Two separate things live here, and the screen keeps them apart because they fail
 * for different reasons: Stripe's own onboarding, which decides whether money can
 * reach them at all, and their ABN and GST answers, which decide what their
 * receipts say. Someone can be paid without an ABN; they just cannot issue a tax
 * invoice.
 */
export default function CounsellorPayoutsScreen() {
  const { session } = useAuth();
  const { flash } = useChrome();
  const insets = useSafeAreaInsets();
  const { config } = usePaymentConfig();

  const [status, setStatus] = useState<PayoutStatus | null>(null);
  const [abn, setAbn] = useState('');
  const [gstRegistered, setGstRegistered] = useState(false);
  const [abnError, setAbnError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const loaded = await api.getPayoutStatus(session.accessToken);
      setStatus(loaded);
      setAbn(loaded.abn ?? '');
      setGstRegistered(loaded.gstRegistered);
      setError('');
    } catch (cause) {
      setError(userFacingError(cause));
    }
  }, [session]);

  // Onboarding happens in a browser, so the screen re-reads on focus: the answer
  // arrives while the counsellor is away from the app.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  /**
   * Stripe decides readiness on its own side and tells the backend over a webhook,
   * so the single read above lands before the answer as often as after it. While an
   * account exists but cannot yet be paid, keep asking for a short while rather than
   * leaving "Payouts pending" on screen until the person thinks to reload.
   */
  const accountId = status?.stripeAccountId ?? null;
  const needsOnboarding = status?.onboardingRequired ?? false;
  useFocusEffect(useCallback(() => {
    if (!session || !accountId || !needsOnboarding) return;
    let gone = false;
    setChecking(true);
    void waitForPayouts(session.accessToken, setStatus, { cancelled: () => gone })
      .finally(() => { if (!gone) setChecking(false); });
    return () => { gone = true; };
  }, [session, accountId, needsOnboarding]));

  async function setUpPayouts() {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      // Always a fresh link: Account Links are single-use and expire in minutes.
      // The return target is this platform's, not a hard-coded deep link, so the
      // web build is not handed a `yoir://` URL a browser cannot follow.
      const onboarding = await api.startStripeOnboarding(session.accessToken, onboardingReturnTo());
      await openOnboarding(onboarding.url);
      // Coming back is not proof of anything — Stripe may still be verifying — so
      // the readiness flags are re-read from the server rather than assumed.
      await load();
    } catch (cause) {
      setError(userFacingError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function saveTaxDetails() {
    if (!session) return;
    const digits = abnDigits(abn);
    if (digits && digits.length !== 11) {
      setAbnError('An ABN is 11 digits.');
      return;
    }
    if (gstRegistered && !digits) {
      setAbnError('Required when you are registered for GST.');
      return;
    }
    setSaving(true);
    setAbnError('');
    setError('');
    try {
      setStatus(await api.updateTaxDetails(
        { abn: digits || null, gstRegistered }, session.accessToken,
      ));
      flash('Tax details saved');
    } catch (cause) {
      setAbnError(fieldErrors(cause).abn ?? '');
      setError(userFacingError(cause));
    } finally {
      setSaving(false);
    }
  }

  if (!session || session.user.role !== 'counsellor') return <Redirect href="/" />;

  // The server decides readiness: it needs a connected account as well as the
  // payouts flag, so the screen must not infer it from the flag alone.
  const stage = payoutStage(status);
  const ready = stage === 'ready';
  const started = stage !== 'not_started';
  const feeNote = config?.provider === 'stripe'
    ? 'Yoir takes its commission from each session; the rest is transferred to you.'
    : 'This build is not connected to Stripe, so no real payouts are made yet.';

  return (
    <ScreenIn style={s.screen}>
      <BackBar title="Payouts" onBack={() => goBack('/counsellor')} />

      <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <FadeUp style={s.intro}>
          <Text style={type.display34}>Getting paid</Text>
          <Text style={type.body}>
            Job seekers pay Yoir when they book. After each session takes place, your share is
            transferred to your own account.
          </Text>
        </FadeUp>

        {error ? <Pop duration={300}><ErrorBanner message={error} /></Pop> : null}

        <FadeUp delay={80} style={[s.card, ready ? s.cardReady : s.cardPending]}>
          <View style={s.cardHeading}>
            <Glyph name={ready ? 'shieldCheck' : 'lock'} size={20} color={ready ? colors.green : colors.amberInk} />
            <Text style={[s.cardTitle, ready ? s.readyInk : s.pendingInk]}>
              {started && !ready && checking ? 'Confirming with Stripe\u2026' : payoutStageTitle(stage)}
            </Text>
          </View>
          <Text style={[s.cardBody, ready ? s.readyInk : s.pendingInk]}>
            {ready
              ? 'Stripe has verified your details. Your services can be booked and your payouts will arrive automatically.'
              : started
                ? checking
                  ? 'Checking with Stripe. This usually takes a few seconds — you can stay on this page.'
                  : 'Stripe still needs something from you. Until it is done, your services stay hidden from Explore.'
                : 'Stripe handles your identity and bank details directly — Yoir never sees them. Your services stay hidden from Explore until this is done.'}
          </Text>
          <View style={s.flags}>
            <Tag
              label={status?.chargesEnabled ? 'Charges enabled' : 'Charges pending'}
              bg={status?.chargesEnabled ? colors.greenTint : colors.chip}
              fg={status?.chargesEnabled ? colors.successInk : colors.muted}
            />
            <Tag
              label={ready ? 'Payouts enabled' : 'Payouts pending'}
              bg={ready ? colors.greenTint : colors.chip}
              fg={ready ? colors.successInk : colors.muted}
            />
          </View>
          <Button
            label={payoutActionLabel(stage)}
            height={52}
            busy={busy}
            onPress={setUpPayouts}
            tone={ready ? 'outline' : 'primary'}
            style={shadow.toast}
          />
        </FadeUp>

        <FadeUp delay={160} style={s.form}>
          <Text style={type.groupLabel}>Tax details</Text>
          <Text style={s.formBody}>
            Receipts are issued in your name, because you are the one supplying the session.
            These answers decide what those receipts say. {feeNote}
          </Text>

          <Field
            label="ABN (optional)"
            value={formatAbn(abnDigits(abn))}
            onChangeText={(text) => { setAbn(abnDigits(text)); setAbnError(''); }}
            keyboardType="number-pad"
            placeholder="12 345 678 901"
            maxLength={14}
          />
          {abnError ? <Text style={s.fieldError}>{abnError}</Text> : null}

          <Text style={s.toggleLabel}>Are you registered for GST?</Text>
          <View style={s.toggleRow}>
            <Chip label="Not registered" selected={!gstRegistered} onPress={() => setGstRegistered(false)} />
            <Chip label="Registered" selected={gstRegistered} onPress={() => setGstRegistered(true)} />
          </View>
          <Text style={s.hint}>
            {gstRegistered
              ? 'Your receipts will be tax invoices showing your ABN and the GST inside the price.'
              : 'Your receipts will show no GST, because none is charged on your sessions.'}
          </Text>

          <Button label="Save tax details" height={52} busy={saving} onPress={saveTaxDetails} />
        </FadeUp>
      </ScrollView>
    </ScreenIn>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  body: { paddingTop: 6, paddingHorizontal: 22, gap: 20 },
  intro: { gap: 8 },

  card: { padding: 20, gap: 14, borderRadius: radius.xl },
  cardReady: { backgroundColor: colors.greenTint },
  cardPending: { backgroundColor: colors.yellowTint },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 16 },
  cardBody: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21 },
  readyInk: { color: colors.ink },
  pendingInk: { color: colors.amberDeep },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  form: { padding: 20, gap: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.xl },
  formBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: colors.muted },
  fieldError: { fontFamily: fonts.sans, fontSize: 13, color: colors.dangerInk },
  toggleLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, marginTop: 4 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  hint: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: colors.muted },
});
