import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'ias_hub_thread_lastread';

// ── Per-thread last-viewed tracker ────────────────────────────
// Stores ISO timestamp of the newest reply the user has seen in each thread.
// Used to show a bold unread count badge on a thread indicator when new
// replies arrive after the user last opened the thread.
// Persists across reloads via localStorage.

type ThreadLastReadMap = Record<number, string>;

function load(): ThreadLastReadMap {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

function save(map: ThreadLastReadMap) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch {}
}

export function useThreadLastViewed() {
  const [map, setMap] = useState<ThreadLastReadMap>(load);

  // Sync across tabs / components
  useEffect(() => {
    const h = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setMap(load());
    };
    window.addEventListener('storage', h);
    return () => window.removeEventListener('storage', h);
  }, []);

  // Returns the timestamp (ISO) the user last saw on this thread, or undefined
  const getLastViewed = useCallback((parentId: number | null): string | undefined => {
    if (parentId == null) return undefined;
    return map[parentId];
  }, [map]);

  // Mark thread as viewed up to given timestamp.
  // Only advances forward — won't move back.
  const markViewed = useCallback((parentId: number, timestamp: string) => {
    setMap(prev => {
      const current = prev[parentId];
      if (current && new Date(current) >= new Date(timestamp)) return prev;
      const next = { ...prev, [parentId]: timestamp };
      save(next);
      return next;
    });
  }, []);

  // Has this thread got unread replies since last view?
  // Returns true if thread_last_reply_at > last_viewed_at, or if never viewed but has replies.
  const hasUnread = useCallback((parentId: number, lastReplyAt: string | null | undefined): boolean => {
    if (!lastReplyAt) return false;
    const viewed = map[parentId];
    if (!viewed) return true;
    return new Date(lastReplyAt) > new Date(viewed);
  }, [map]);

  return { getLastViewed, markViewed, hasUnread };
}
