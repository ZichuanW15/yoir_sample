import {
  createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { bindAuth } from '@/src/api/authBridge';
import { api } from '@/src/api/client';
import { Role, Session } from '@/src/api/types';
import { clearSession, readSession, writeSession } from './sessionStore';

interface AuthValue {
  session: Session | null;
  /** True until the stored session has been read back, so screens do not act on a
   *  `null` that only means "not looked yet". */
  restoring: boolean;
  login(email: string, password: string, roleHint?: Role): Promise<Session>;
  /**
   * Take on a session the app was handed rather than one it asked for — following a
   * confirmation link signs the person in, because the link is itself proof that
   * they own the address.
   */
  adopt(session: Session): Promise<void>;
  logout(): void;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

const stillValid = (iso: string | null | undefined): boolean => {
  const at = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(at) && at > Date.now();
};

/**
 * A stored session is worth restoring while *either* of its tokens is still good.
 *
 * The access token lasting an hour is why a long-lived session needs a refresh
 * token at all: a phone opened the next morning has a lapsed access token and a
 * perfectly valid session behind it, and asking for a password there would defeat
 * the whole mechanism. What cannot be restored is a session with neither — and a
 * malformed or truncated value is treated the same way.
 */
function parseStoredSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as Session;
    if (!stored?.accessToken || !stored?.user || !stored?.expiresAt) return null;
    if (stillValid(stored.expiresAt)) return stored;
    if (stored.refreshToken && stillValid(stored.refreshToken ? stored.refreshExpiresAt : null)) {
      // The next authenticated request renews it; the client refreshes on 401.
      return stored;
    }
    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);

  /**
   * Let the HTTP client reach the session, so it can renew a lapsed access token
   * and retry without every screen having to think about it. A ref keeps the
   * registration stable while still reading the latest value.
   */
  const latest = useRef<Session | null>(session);
  // Kept current in an effect rather than during render. The getter below is only
  // ever called while a request is in flight, long after the commit.
  useEffect(() => { latest.current = session; }, [session]);
  useEffect(() => {
    bindAuth(
      () => latest.current,
      (next) => {
        setSession(next);
        if (next) void writeSession(JSON.stringify(next));
        else void clearSession();
      },
    );
  }, []);

  // Without this, a browser refresh — or any app relaunch — signs the person out,
  // because the session only ever lived in React state.
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        const stored = parseStoredSession(await readSession());
        if (cancelled) return;
        if (stored) setSession(stored);
        else void clearSession();
      } catch {
        // Both store implementations swallow their own failures, but the app must
        // not depend on that: an unhandled rejection here would leave `restoring`
        // true forever and render nothing at all.
      } finally {
        if (!cancelled) setRestoring(false);
      }
    };
    void restore();
    return () => { cancelled = true; };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      restoring,
      async login(email, password, roleHint) {
        const created = await api.login(email, password, roleHint);
        setSession(created);
        await writeSession(JSON.stringify(created));
        return created;
      },
      async adopt(next) {
        setSession(next);
        await writeSession(JSON.stringify(next));
      },
      // US-08: the local session is dropped immediately so no authenticated screen
      // can be reused, then the server session is invalidated in the background.
      logout() {
        const token = session?.accessToken;
        const refresh = session?.refreshToken;
        setSession(null);
        void clearSession();
        // Revoke the refresh token too, or the session could be minted again.
        if (token) void api.logout(token, refresh);
      },
    }),
    [session, restoring],
  );

  // Screens redirect on a null session, so nothing may render until the stored one
  // has been read back — otherwise every refresh bounces to the sign-in screen,
  // which is the very symptom persistence is meant to fix.
  if (restoring) return null;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
}
