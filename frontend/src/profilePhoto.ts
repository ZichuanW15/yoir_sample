import { useEffect, useSyncExternalStore } from 'react';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/auth/AuthContext';

/**
 * The job seeker's photo, shared by every avatar that shows it.
 *
 * It is not part of the session: a photo is an inline data URI, far more than
 * SecureStore will hold, so it is fetched once per signed-in person and replaced
 * when the profile is saved.
 */
let current: { userId: string; photo: string | null } | null = null;
let loadingFor: string | null = null;
const listeners = new Set<() => void>();

export function setProfilePhoto(userId: string, photo: string | null): void {
  current = { userId, photo };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const snapshot = () => current;

export function useProfilePhoto(): string | null {
  const { session } = useAuth();
  const userId = session?.user.role === 'job_seeker' ? session.user.id : null;
  const token = session?.accessToken;
  const stored = useSyncExternalStore(subscribe, snapshot, snapshot);

  useEffect(() => {
    if (!userId || !token || current?.userId === userId || loadingFor === userId) return;
    loadingFor = userId;
    api.getJobSeekerProfile(token)
      .then((profile) => setProfilePhoto(userId, profile.photoUrl))
      .catch(() => undefined) // Initials are a fine fallback.
      .finally(() => { loadingFor = null; });
  }, [userId, token]);

  return stored && stored.userId === userId ? stored.photo : null;
}
