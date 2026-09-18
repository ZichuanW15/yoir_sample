import { Platform } from 'react-native';
import { Session } from './types';

/**
 * The seam between the HTTP client and whoever owns the signed-in session.
 *
 * The client has to be able to refresh an expired access token and retry, but it
 * must not import the React context that holds the session — that would be a cycle,
 * and the context already imports the client. So AuthProvider registers its getter
 * and setter here at mount, and the client reaches the session through this.
 */

export type RefreshClient = 'web' | 'native';

/**
 * Which storage the session will live in, and so how long the server lets its
 * refresh token live. A device has the Keychain; a browser has localStorage, which
 * any script on the origin can read, so it is given a deliberately shorter window.
 */
export const platformClient: RefreshClient = Platform.OS === 'web' ? 'web' : 'native';

type Getter = () => Session | null;
type Setter = (session: Session | null) => void;

let getSession: Getter = () => null;
let setSession: Setter = () => {};

export function bindAuth(get: Getter, set: Setter): void {
  getSession = get;
  setSession = set;
}

export const currentSession = (): Session | null => getSession();
export const adoptSession = (session: Session | null): void => setSession(session);

/**
 * A refresh in flight, shared by every caller that wants one.
 *
 * Without this, a screen firing three requests at once would answer three 401s with
 * three refreshes. Only the first would succeed: rotation spends the token, so the
 * other two would present one already used — which the server reads as a stolen
 * credential and answers by revoking the whole session. Single-flighting is not an
 * optimisation here, it is what stops the app logging itself out.
 */
let inflight: Promise<Session | null> | null = null;

export function refreshOnce(exchange: () => Promise<Session | null>): Promise<Session | null> {
  if (!inflight) {
    inflight = exchange()
      .catch(() => null)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** Test seam: forget any in-flight refresh between cases. */
export function resetAuthBridge(): void {
  inflight = null;
  getSession = () => null;
  setSession = () => {};
}
