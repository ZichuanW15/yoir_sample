import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { api } from '@/src/api/client';
import { AppNotification } from '@/src/api/types';
import { useAuth } from '@/src/auth/AuthContext';

/**
 * The signed-in person's notifications, shared by the bell's badge and the
 * dropdown. Fetched once per person and again whenever the dropdown opens.
 */
let current: { userId: string; items: AppNotification[] } | null = null;
const listeners = new Set<() => void>();

function publish(next: typeof current) {
  current = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const snapshot = () => current;

export function useNotifications() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const token = session?.accessToken;
  const stored = useSyncExternalStore(subscribe, snapshot, snapshot);
  const items = stored && stored.userId === userId ? stored.items : [];

  const refresh = useCallback(async () => {
    if (!userId || !token) return;
    try {
      publish({ userId, items: await api.listNotifications(token) });
    } catch {
      // A bell that cannot load stays quiet; it must never take the screen down.
    }
  }, [userId, token]);

  useEffect(() => {
    if (current?.userId === userId) return;
    const run = async () => { await refresh(); };
    void run();
  }, [userId, refresh]);

  const markRead = useCallback((ids: string[]) => {
    if (!userId || !token || ids.length === 0 || current?.userId !== userId) return;
    publish({ userId, items: current.items.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)) });
    for (const id of ids) void api.markNotificationRead(id, token).catch(() => undefined);
  }, [userId, token]);

  return { items, unread: items.filter((n) => !n.read).length, refresh, markRead };
}

/** "Just now", "5m", "3h", "2d", then the date. */
export function ago(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 7 * 24 * 60) return `${Math.floor(minutes / (24 * 60))}d`;
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}
