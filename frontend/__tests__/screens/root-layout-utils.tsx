/** Component evidence only: fonts, splash and router are mocked boundaries.
 * The root layout and providers are real; this is neither a browser render nor a
 * device launch. Native-only assertions run under the explicit native presets.
 */
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import RootLayout from '@/app/_layout';

jest.mock('@/src/auth/sessionStore', () => ({
  readSession: jest.fn(async () => null), writeSession: jest.fn(async () => undefined), clearSession: jest.fn(async () => undefined),
}));
jest.mock('@/src/api/client', () => {
  const actual = jest.requireActual('@/src/api/client');
  return { ...actual, api: { ...actual.api, getPaymentConfig: jest.fn(async () => ({ provider: 'stub', publishableKey: null, merchantDisplayName: 'Yoir', merchantCountryCode: 'AU', currency: 'AUD', slotHoldMinutes: 10, cancellationFullRefundHours: 24, cancellationLateRefundPercent: 0 })) } };
});
jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('@/src/payments/sheet', () => ({
  PaymentSheetHost: ({ children }: import('react').PropsWithChildren) => children,
  usePaymentSheet: () => ({ present: jest.fn(), supported: false }),
}));
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  function ApplicationBoundaryProbe() {
    const { useAuth } = jest.requireActual<typeof import('@/src/auth/AuthContext')>('@/src/auth/AuthContext');
    const { useChrome } = jest.requireActual<typeof import('@/src/chrome')>('@/src/chrome');
    const { session } = useAuth();
    const { flash } = useChrome();
    return React.createElement(View, null,
      React.createElement(Text, null, session ? 'Authenticated application' : 'Guest application'),
      React.createElement(Pressable, {
        accessibilityRole: 'button', accessibilityLabel: 'Show startup notice',
        onPress: () => flash('Application is ready'),
      }, React.createElement(Text, null, 'Show startup notice')),
    );
  }
  const StackBoundary = Object.assign(
    ({ children }: import('react').PropsWithChildren) => React.createElement(View, { testID: 'application-stack' },
      React.createElement(ApplicationBoundaryProbe), children,
    ),
    { Screen: jest.fn(({ name }: { name: string }) => React.createElement(Text, null, name)) },
  );
  return { Stack: StackBoundary, router: { replace: jest.fn() } };
});

export { RootLayout, SplashScreen };
export const fontsMock = jest.mocked(useFonts);
export const routeRegistration = jest.mocked(Stack.Screen);
export const nativeQaPlatform = (globalThis as typeof globalThis & {
  __QA_NATIVE_PLATFORM__?: 'ios' | 'android';
}).__QA_NATIVE_PLATFORM__;
// The production module calls this before the first render. Capture that event
// before Jest's per-test clearMocks resets module-initialisation call history.
export const autoHideCallsOnImport = jest.mocked(SplashScreen.preventAutoHideAsync).mock.calls.length;

beforeEach(() => {
  jest.useFakeTimers();
  fontsMock.mockReset().mockReturnValue([false, null]);
});
afterEach(() => { jest.useRealTimers(); });
