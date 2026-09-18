import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import * as Linking from 'expo-linking';
import { PropsWithChildren, useCallback } from 'react';
import { usePaymentConfig } from './config';
import { PaymentSheetOutcome, PaymentSheetRequest } from './types';

/**
 * The native PaymentSheet. Metro picks `sheet.web.tsx` instead when bundling for
 * web, so the Stripe native SDK never reaches the web bundle the backend serves.
 */

/**
 * Wraps the app so `useStripe` has a publishable key to work with.
 *
 * Rendered even before the key arrives — children must not be unmounted and
 * remounted when it does, or every screen would lose its state mid-journey.
 */
export function PaymentSheetHost({ children }: PropsWithChildren) {
  const { config } = usePaymentConfig();
  if (!config?.publishableKey) return <>{children}</>;
  return (
    <StripeProvider
      publishableKey={config.publishableKey}
      // Apple Pay will not appear without a merchant id registered with Apple; it
      // must match the one in app.json.
      merchantIdentifier="merchant.au.edu.unimelb.yoir"
      // Lets a bank's 3D Secure page return to the app rather than stranding the
      // payment in the browser.
      urlScheme={Linking.createURL('/').split(':')[0]}
    >
      {/* A fragment, because StripeProvider types its children as an element
          rather than as arbitrary ReactNode. */}
      <>{children}</>
    </StripeProvider>
  );
}

export function usePaymentSheet() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { config } = usePaymentConfig();

  const present = useCallback(
    async (request: PaymentSheetRequest): Promise<PaymentSheetOutcome> => {
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: config?.merchantDisplayName ?? 'Yoir',
        paymentIntentClientSecret: request.clientSecret,
        returnURL: Linking.createURL('/bookings/confirmation'),
        applePay: { merchantCountryCode: config?.merchantCountryCode ?? 'AU' },
        // Cards and Apple Pay settle immediately. Methods that confirm days later
        // would have the session booked before the money arrives, so they are off.
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: request.customerName ? { name: request.customerName } : undefined,
      });
      if (initError) return { outcome: 'failed', message: initError.message };

      const { error: payError } = await presentPaymentSheet();
      if (payError) {
        // Closing the sheet is a decision, not a failure, and must not be shown as one.
        if (payError.code === 'Canceled') return { outcome: 'cancelled' };
        return { outcome: 'failed', message: payError.message };
      }
      return { outcome: 'paid' };
    },
    [config, initPaymentSheet, presentPaymentSheet],
  );

  return { present, supported: true };
}
