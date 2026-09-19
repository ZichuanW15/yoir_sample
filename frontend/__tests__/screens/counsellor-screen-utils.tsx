/** Screen-level evidence: real providers, forms, validators and controls; only API,
 * routing, device storage, safe-area measurements, photo picker and animation timing are seams.
 * Mocked writes verify frontend behaviour; backend persistence is covered separately. */
import React, { PropsWithChildren, useEffect, useState } from 'react';
import { Animated, Text } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { api } from '@/src/api/client';
import { AuthProvider, useAuth } from '@/src/auth/AuthContext';
import { ChromeProvider } from '@/src/chrome';
import { Session } from '@/src/api/types';
import { counsellorProfileFixture, counsellorSessionFixture, serviceFixture } from '../fixtures';

jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'redirect' }, href),
    useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]),
    useLocalSearchParams: jest.fn(() => ({ serviceId: 'service-1' })),
    usePathname: jest.fn(() => '/'),
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/src/auth/sessionStore', () => ({
  readSession: jest.fn(async () => null), writeSession: jest.fn(async () => undefined), clearSession: jest.fn(async () => undefined),
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(), launchImageLibraryAsync: jest.fn(),
}));
jest.mock('@/src/api/client', () => {
  const actual = jest.requireActual('@/src/api/client');
  return { ...actual, api: Object.fromEntries(Object.keys(actual.api).map((key) => [key, jest.fn()])) };
});

export const apiMock = api as jest.Mocked<typeof api>;
export { counsellorProfileFixture, counsellorSessionFixture, serviceFixture };

function LoginBoundary({ children, session }: PropsWithChildren<{ session: Session | null }>) {
  const { login } = useAuth();
  const [ready, setReady] = useState(!session);
  useEffect(() => {
    if (session) void login(session.user.email, 'test-password', session.user.role).then(() => setReady(true));
    // Mount once: use the actual provider to establish the requested test session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ready ? <>{children}</> : <Text>Establishing test session</Text>;
}

export async function renderCounsellor(element: React.ReactElement, session: Session | null = counsellorSessionFixture) {
  // Keep normal screen journeys independent of the shared fixture's historical
  // expiry date, including suites that pin Date.now to a controlled test clock.
  const activeSession = session ? {
    ...session,
    user: { ...session.user },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  } : null;
  if (activeSession) apiMock.login.mockResolvedValueOnce(activeSession);
  let ready = false;
  function ReadyBoundary({ children }: PropsWithChildren) {
    useEffect(() => { ready = true; }, []);
    return <>{children}</>;
  }
  const result = render(<AuthProvider><ChromeProvider><LoginBoundary session={activeSession}><ReadyBoundary>{element}</ReadyBoundary></LoginBoundary></ChromeProvider></AuthProvider>);
  await waitFor(() => expect(ready).toBe(true));
  return result;
}

export function setupCounsellorMocks() {
  for (const fn of Object.values(apiMock)) if (jest.isMockFunction(fn)) fn.mockReset();
  apiMock.getOwnCounsellorProfile.mockResolvedValue({ ...counsellorProfileFixture });
  apiMock.listOwnServices.mockResolvedValue([{ ...serviceFixture }]);
  apiMock.listOwnAvailabilityWindows.mockResolvedValue([]);
  apiMock.getPayoutStatus.mockResolvedValue({ stripeAccountId: 'acct-test', chargesEnabled: true, payoutsEnabled: true, onboardingRequired: false, abn: null, gstRegistered: false });
  apiMock.createService.mockResolvedValue(serviceFixture);
  apiMock.updateService.mockResolvedValue(serviceFixture);
  apiMock.deleteService.mockResolvedValue(undefined);
  apiMock.updateOwnCounsellorProfile.mockResolvedValue(counsellorProfileFixture);
  apiMock.deleteAvailabilityWindow.mockResolvedValue(undefined);
  // TopBar's bell is job-seeker-only, but the hook behind it (useNotifications)
  // fetches for any signed-in role — same as the real client falling back to []
  // on a route that isn't deployed yet, so a counsellor screen that renders TopBar
  // doesn't need to know that endpoint exists.
  apiMock.listNotifications.mockResolvedValue([]);
  // Keep real animation components and hooks while removing native timing/loops.
  jest.spyOn(Animated, 'timing').mockImplementation((value: any, config: any) => ({
    start: (done?: (value: { finished: boolean }) => void) => { value.setValue(config.toValue); done?.({ finished: true }); },
    stop: jest.fn(), reset: jest.fn(),
  }));
  jest.spyOn(Animated, 'loop').mockImplementation(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() }));
}

export function fillService(overrides: { title?: string; description?: string; price?: string } = {}) {
  fireEvent.changeText(screen.getByLabelText('Service title'), overrides.title ?? 'Interview coaching');
  fireEvent.changeText(screen.getByLabelText('Description'), overrides.description ?? 'A practical coaching session with individual interview feedback.');
  fireEvent.changeText(screen.getByLabelText('Price (AUD)'), overrides.price ?? '95.25');
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export async function settle<T>(pending: ReturnType<typeof deferred<T>>, value: T) {
  await act(async () => { pending.resolve(value); await pending.promise; });
}
