import { render, screen, waitFor } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { api } from '@/src/api/client';
import { PaymentConfig } from '@/src/api/types';
import { PaymentConfigProvider, usePaymentConfig } from '@/src/payments/config';

jest.mock('@/src/api/client', () => ({ api: { getPaymentConfig: jest.fn() } }));

const getPaymentConfig = api.getPaymentConfig as jest.MockedFunction<typeof api.getPaymentConfig>;

const stripeConfig: PaymentConfig = {
  provider: 'stripe', publishableKey: 'pk_test_123', merchantDisplayName: 'Yoir',
  merchantCountryCode: 'AU', currency: 'AUD', slotHoldMinutes: 15,
  cancellationFullRefundHours: 24, cancellationLateRefundPercent: 0,
};

function ConfigProbe() {
  const { config, loading, error } = usePaymentConfig();
  return (
    <View>
      <Text>{loading ? 'loading' : `provider ${config?.provider ?? 'none'}`}</Text>
      <Text>{`key ${config?.publishableKey ?? 'none'}`}</Text>
      <Text>{`error ${error || 'none'}`}</Text>
    </View>
  );
}

const renderProbe = () =>
  render(<PaymentConfigProvider><ConfigProbe /></PaymentConfigProvider>);

describe('payment configuration', () => {
  beforeEach(() => getPaymentConfig.mockReset());

  test('is read from the backend once, not bundled into the app', async () => {
    getPaymentConfig.mockResolvedValue(stripeConfig);

    renderProbe();

    expect(screen.getByText('loading')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('provider stripe')).toBeTruthy());
    expect(screen.getByText('key pk_test_123')).toBeTruthy();
    expect(getPaymentConfig).toHaveBeenCalledTimes(1);
  });

  test('a backend without the endpoint degrades to the stub rather than blocking booking', async () => {
    getPaymentConfig.mockRejectedValue(new Error('404'));

    renderProbe();

    await waitFor(() => expect(screen.getByText('provider none')).toBeTruthy());
    // No card can be taken, but the rest of the journey is still walkable.
    expect(screen.getByText(/^error .+/)).toBeTruthy();
    expect(screen.queryByText('loading')).toBeNull();
  });

  test('a component outside the provider still renders, with no payment settings', () => {
    render(<ConfigProbe />);

    expect(screen.getByText('provider none')).toBeTruthy();
    expect(getPaymentConfig).not.toHaveBeenCalled();
  });
});
