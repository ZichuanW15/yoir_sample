/** Real screens, auth, chrome, API client and UI primitives. HTTP, navigation,
 * device storage/layout and the Stripe SDK host are controlled test boundaries. */
import { act, render, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PropsWithChildren, ReactElement, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Session } from '@/src/api/types';
import { AuthProvider, useAuth } from '@/src/auth/AuthContext';
import { ChromeProvider } from '@/src/chrome';

jest.mock('@/src/payments/sheet', () => ({
  PaymentSheetHost: ({ children }: import('react').PropsWithChildren) => children,
  usePaymentSheet: () => ({ present: jest.fn(), supported: false }),
}));
jest.mock('expo-router', () => {
  const navigation = {
    push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), dismissAll: jest.fn(), canDismiss: jest.fn(() => false),
  };
  return {
    router: navigation,
    useLocalSearchParams: jest.fn(() => ({})),
    Redirect: ({ href }: { href: string }) => {
      const React = jest.requireActual<typeof import('react')>('react');
      React.useEffect(() => { navigation.replace(href); }, [href]);
      return null;
    },
  };
});
jest.mock('@/src/auth/sessionStore', () => ({
  readSession: jest.fn(async () => null), writeSession: jest.fn(async () => undefined), clearSession: jest.fn(async () => undefined),
}));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

export const navigation = router as jest.Mocked<typeof router>;
export const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
type Reply = Response | Error | Promise<Response> | (() => Response | Promise<Response>);
const replies = new Map<string, Reply>();
const originalFetch = global.fetch;

export function jsonResponse(body: unknown, status = 200): Response {
  const empty = status === 204 || status === 205;
  return {
    ok: status >= 200 && status < 300, status,
    headers: { get: (name: string) => !empty && name.toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : null },
    json: async () => { if (empty) throw new SyntaxError('Unexpected end of JSON input'); return body; },
  } as Response;
}
export function apiFailure(code: string, message: string, status = 400, fields?: Record<string, string>): Response {
  return jsonResponse({ code, message, requestId: 'public-screen-test', ...(fields ? { fieldErrors: fields } : {}) }, status);
}
export function reply(method: string, path: string, value: Reply) {
  replies.set(`${method} ${path}`, value);
}
export function callsTo(method: string, path: string) {
  return fetchMock.mock.calls.filter(([url, init]) => (init?.method ?? 'GET') === method && new URL(String(url), 'http://localhost').pathname.endsWith(path));
}
export function routeParams(params: Record<string, string>) {
  jest.mocked(useLocalSearchParams).mockReturnValue(params);
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export async function tick(milliseconds = 1200) {
  await act(async () => { await jest.advanceTimersByTimeAsync(milliseconds); });
}

beforeEach(() => {
  jest.useFakeTimers();
  // Existing shared fixtures expire at 07:00Z and offer slots on 1 September.
  // A fixed earlier clock keeps normal tests from accepting expired/past data.
  jest.setSystemTime(new Date('2026-08-28T06:00:00Z'));
  replies.clear();
  fetchMock.mockReset();
  navigation.push.mockReset();
  navigation.replace.mockReset();
  navigation.back.mockReset();
  navigation.canGoBack.mockReset().mockReturnValue(true);
  navigation.dismissAll.mockReset();
  navigation.canDismiss.mockReset().mockReturnValue(false);
  jest.mocked(useLocalSearchParams).mockReset().mockReturnValue({});
  fetchMock.mockImplementation(async (url, init) => {
    const path = new URL(String(url), 'http://localhost').pathname.replace(/^\/api\/v1/, '');
    const key = `${init?.method ?? 'GET'} ${path}`;
    const value = replies.get(key);
    if (value === undefined) throw new Error(`Unconfigured HTTP request: ${key}`);
    if (value instanceof Error) throw value;
    return typeof value === 'function' ? value() : value;
  });
  global.fetch = fetchMock;
});
afterEach(() => { jest.useRealTimers(); });
afterAll(() => { global.fetch = originalFetch; });

function SessionBootstrap({ session, children }: PropsWithChildren<{ session?: Session }>) {
  const auth = useAuth();
  const started = useRef(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(!session);
  useEffect(() => {
    if (!session || started.current) return;
    started.current = true;
    void auth.login(session.user.email, 'bootstrap-password').then(() => setReady(true)).catch((cause: Error) => setError(cause.message));
  }, [auth, session]);
  if (error) return <Text>{error}</Text>;
  if (!ready) return <Text>Establishing test session</Text>;
  return children;
}

export async function renderPublic(element: ReactElement, session?: Session) {
  if (session) reply('POST', '/auth/sessions', jsonResponse({ ...session, expiresAt: '2030-01-01T00:00:00Z' }));
  let ready = false;
  function ReadyBoundary({ children }: PropsWithChildren) {
    useEffect(() => { ready = true; }, []);
    return children;
  }
  const result = render(
    <AuthProvider>
      <ChromeProvider>
        <SessionBootstrap session={session}><ReadyBoundary>{element}</ReadyBoundary></SessionBootstrap>
      </ChromeProvider>
    </AuthProvider>,
  );
  await waitFor(() => { if (!ready) throw new Error('Waiting for test session restoration'); });
  return result;
}

/** An observer/driver for the real provider; no session state is injected. */
export function AuthStatusProbe() {
  const { session, login, logout } = useAuth();
  const [result, setResult] = useState('');
  return (
    <View>
      <Text>{session ? `signed in as ${session.user.name}` : 'signed out'}</Text>
      <Text>{result}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Sign in probe" onPress={() => {
        void login('alex@example.com', 'correct-password').then((created) => setResult(`returned ${created.user.role}`)).catch(() => setResult('login failed'));
      }}><Text>Sign in probe</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Log out probe" onPress={logout}><Text>Log out probe</Text></Pressable>
    </View>
  );
}
