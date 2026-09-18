import { Session } from '@/src/api/types';

/**
 * Where the signed-in session is kept between page loads, in a browser.
 *
 * SecureStore has no web implementation, and a browser has no keychain to offer, so
 * this is localStorage. That means the access token is readable by any script on
 * this origin, which is the standing trade-off for a bearer-token SPA: the
 * alternative is an httpOnly cookie, which the published API's Authorization-header
 * scheme does not use. Tokens are short-lived and revocable server-side, which is
 * what limits the damage.
 *
 * Every call is guarded: localStorage throws in private browsing and when site data
 * is blocked, and that should cost a sign-in, not the whole app.
 */

const KEY = 'yoir.session';

export async function readSession(): Promise<string | null> {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function writeSession(value: string): Promise<void> {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    // Private browsing, or site data blocked. The session lives for this tab only.
  }
}

export async function clearSession(): Promise<void> {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to remove, or storage is unavailable.
  }
}

export type { Session };
