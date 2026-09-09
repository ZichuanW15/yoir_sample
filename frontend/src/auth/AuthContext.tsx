import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';
import { api } from '@/src/api/client';
import { Role, Session } from '@/src/api/types';

interface AuthValue {
  session: Session | null;
  login(email: string, password: string, roleHint?: Role): Promise<Session>;
  logout(): void;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const value = useMemo<AuthValue>(
    () => ({
      session,
      async login(email, password, roleHint) {
        const created = await api.login(email, password, roleHint);
        setSession(created);
        return created;
      },
      // US-08: the local session is dropped immediately so no authenticated screen
      // can be reused, then the server session is invalidated in the background.
      logout() {
        const token = session?.accessToken;
        setSession(null);
        if (token) void api.logout(token);
      },
    }),
    [session],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
}
