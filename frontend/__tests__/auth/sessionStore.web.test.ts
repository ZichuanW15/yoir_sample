import { clearSession, readSession, writeSession } from '@/src/auth/sessionStore.web';

/**
 * The browser half of session persistence. Its whole job is to survive a reload
 * and to fail quietly when the browser refuses to store anything — private
 * browsing, or site data blocked — because neither should cost more than a sign-in.
 */

const original = window.localStorage;

function useStorage(impl: Partial<Storage>) {
  Object.defineProperty(window, 'localStorage', { value: impl, configurable: true });
}

describe('session storage in a browser', () => {
  afterEach(() => {
    Object.defineProperty(window, 'localStorage', { value: original, configurable: true });
  });

  test('what is written is what comes back after a reload', async () => {
    const store = new Map<string, string>();
    useStorage({
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });

    await writeSession('{"accessToken":"abc"}');

    expect(await readSession()).toBe('{"accessToken":"abc"}');
    // A single key, so signing out cannot leave a stray copy behind.
    expect([...store.keys()]).toEqual(['yoir.session']);
  });

  test('clearing removes it, so a refresh does not bring the session back', async () => {
    const store = new Map<string, string>([['yoir.session', '{"accessToken":"abc"}']]);
    useStorage({
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });

    await clearSession();

    expect(await readSession()).toBeNull();
  });

  test('nothing stored reads as no session rather than as an error', async () => {
    useStorage({ getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
    expect(await readSession()).toBeNull();
  });

  test('a browser that refuses storage costs a sign-in, not a crash', async () => {
    // Safari in private browsing throws on setItem; blocked site data throws on read.
    const refuse = () => { throw new Error('SecurityError'); };
    useStorage({ getItem: refuse, setItem: refuse, removeItem: refuse });

    await expect(readSession()).resolves.toBeNull();
    await expect(writeSession('anything')).resolves.toBeUndefined();
    await expect(clearSession()).resolves.toBeUndefined();
  });
});
