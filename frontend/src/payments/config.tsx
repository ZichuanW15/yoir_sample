import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/src/api/client';
import { PaymentConfig } from '@/src/api/types';

/**
 * How this build takes money, read from the backend rather than bundled.
 *
 * The publishable key lives on the server so that rotating it, or moving between
 * Stripe test and live, does not need a new build in the app stores. Until the
 * answer arrives the app does not know whether it can take a card, so screens wait
 * on `loading` rather than guessing.
 */
interface PaymentConfigState {
  config: PaymentConfig | null;
  loading: boolean;
  /** Set when the config could not be fetched at all; checkout says so plainly. */
  error: string;
}

const FALLBACK: PaymentConfigState = { config: null, loading: false, error: '' };

const PaymentConfigContext = createContext<PaymentConfigState>(FALLBACK);

export function PaymentConfigProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<PaymentConfigState>({ config: null, loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const config = await api.getPaymentConfig();
        if (!cancelled) setState({ config, loading: false, error: '' });
      } catch {
        // A backend too old to publish /payments/config has no Stripe either, so
        // this degrades to the stub rather than blocking the booking journey.
        if (!cancelled) {
          setState({ config: null, loading: false, error: 'Payment settings are unavailable.' });
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const value = useMemo(() => state, [state]);
  return <PaymentConfigContext.Provider value={value}>{children}</PaymentConfigContext.Provider>;
}

export function usePaymentConfig(): PaymentConfigState {
  return useContext(PaymentConfigContext);
}
