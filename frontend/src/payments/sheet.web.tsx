import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '@/src/theme';
import { usePaymentConfig } from './config';
import { PaymentSheetOutcome, PaymentSheetRequest } from './types';

/**
 * Card payment on the web, via Stripe.js and the Payment Element.
 *
 * `@stripe/stripe-react-native` wraps the iOS and Android SDKs and has no web
 * build, which is why Metro resolves this file instead of `sheet.tsx` here. That
 * is a limitation of the React Native SDK, not of Stripe: the same PaymentIntent
 * is confirmed here through Stripe.js, so a browser takes cards just as the app
 * does. Apple Pay and Google Pay are the genuinely platform-specific part and stay
 * on the native sheet.
 *
 * Card details are entered in Stripe's own cross-origin iframes and never touch
 * this page's JavaScript, so the browser path carries the same PCI position as the
 * native one.
 */

interface Pending {
  request: PaymentSheetRequest;
  settle: (outcome: PaymentSheetOutcome) => void;
}

interface PaymentSheetApi {
  present: (request: PaymentSheetRequest) => Promise<PaymentSheetOutcome>;
  supported: boolean;
}

const PaymentSheetContext = createContext<PaymentSheetApi>({
  present: async () => ({ outcome: 'unsupported', message: 'Card payments are not set up.' }),
  supported: false,
});

/** Stripe.js is one script for the whole page, so it is loaded once per key. */
let loadedKey = '';
let loaded: Promise<Stripe | null> | null = null;

function stripeFor(publishableKey: string): Promise<Stripe | null> {
  if (!loaded || loadedKey !== publishableKey) {
    loadedKey = publishableKey;
    loaded = loadStripe(publishableKey);
  }
  return loaded;
}

export function PaymentSheetHost({ children }: PropsWithChildren) {
  const { config } = usePaymentConfig();
  const [pending, setPending] = useState<Pending | null>(null);
  const publishableKey = config?.publishableKey ?? '';

  const present = useCallback(
    (request: PaymentSheetRequest): Promise<PaymentSheetOutcome> => {
      if (!publishableKey) {
        return Promise.resolve({
          outcome: 'unsupported',
          message: 'Card payments are not set up on this server.',
        });
      }
      // Resolved by the form below, so the caller awaits the person's decision
      // exactly as it awaits the native sheet.
      return new Promise<PaymentSheetOutcome>((settle) => setPending({ request, settle }));
    },
    [publishableKey],
  );

  const finish = useCallback(
    (outcome: PaymentSheetOutcome) => {
      if (!pending) return;
      pending.settle(outcome);
      setPending(null);
    },
    [pending],
  );

  const api = useMemo<PaymentSheetApi>(
    () => ({ present, supported: !!publishableKey }),
    [present, publishableKey],
  );

  return (
    <PaymentSheetContext.Provider value={api}>
      {children}
      {pending ? (
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.title}>Pay by card</Text>
            <Elements
              stripe={stripeFor(publishableKey)}
              options={{
                clientSecret: pending.request.clientSecret,
                appearance: { theme: 'flat', variables: { colorPrimary: colors.green } },
              }}
            >
              <CardForm customerName={pending.request.customerName} onDone={finish} />
            </Elements>
          </View>
        </View>
      ) : null}
    </PaymentSheetContext.Provider>
  );
}

function CardForm({
  customerName,
  onDone,
}: {
  customerName?: string;
  onDone: (outcome: PaymentSheetOutcome) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pay() {
    if (!stripe || !elements) return;
    setBusy(true);
    setError('');
    const { error: failure, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Only used by methods that leave the page, such as a bank's 3D Secure
        // step. Cards finish in place, which `if_required` below keeps them doing.
        return_url: `${window.location.origin}/bookings/confirmation`,
        payment_method_data: customerName
          ? { billing_details: { name: customerName } }
          : undefined,
      },
      redirect: 'if_required',
    });

    if (failure) {
      // A declined card or a mistyped number is something to correct here, so the
      // sheet stays open with the reason rather than failing the whole checkout.
      setError(failure.message ?? 'That payment could not be completed.');
      setBusy(false);
      return;
    }
    if (paymentIntent && ['succeeded', 'processing'].includes(paymentIntent.status)) {
      onDone({ outcome: 'paid' });
      return;
    }
    setError('That payment could not be completed.');
    setBusy(false);
  }

  return (
    <View style={s.form}>
      <PaymentElement onReady={() => setReady(true)} />
      {!ready ? <ActivityIndicator color={colors.green} style={s.loading} /> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={!ready || busy}
        onPress={pay}
        style={[s.pay, (!ready || busy) && s.payDisabled]}
      >
        <Text style={s.payText}>{busy ? 'Paying…' : 'Pay now'}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => onDone({ outcome: 'cancelled' })}
        style={s.cancel}
      >
        <Text style={s.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

export function usePaymentSheet(): PaymentSheetApi {
  return useContext(PaymentSheetContext);
}

const s = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(17,24,20,0.45)', padding: 20,
  },
  sheet: {
    width: '100%', maxWidth: 460, padding: 24, gap: 16,
    backgroundColor: colors.white, borderRadius: radius.xl,
  },
  title: { fontFamily: fonts.serif, fontSize: 24, color: colors.ink },
  form: { gap: 14 },
  loading: { paddingVertical: 12 },
  error: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: colors.dangerInk },
  pay: {
    height: 52, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.green, borderRadius: radius.md,
  },
  payDisabled: { opacity: 0.5 },
  payText: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
  cancel: { height: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: fonts.bold, fontSize: 15, color: colors.muted },
});
