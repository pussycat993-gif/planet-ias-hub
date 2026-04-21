import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'ias_hub_lastread';

// ── Per-channel last-read tracker ──────────────────────────────
// Stores ISO timestamp of the newest message the user has seen in each channel.
// Used to place an "Unread" divider above messages that arrived since the user
// last visited. Persists across reloads via localStorage.

type LastReadMap = Record<number, string>;

function load(): LastReadMap {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

function save(map: LastReadMap) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch {}
}

export function useLastRead() {
  const [map, setMap] = useState<LastReadMap>(load);

  // Sync across tabs / components
  useEffect(() => {
    const h = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setMap(load());
    };
    window.addEventListener('storage', h);
    return () => window.removeEventListener('storage', h);
  }, []);

  // Returns the timestamp (ISO) the user last saw, or undefined
  const getLastRead = useCallback((channelId: number | null): string | undefined => {
    if (channelId == null) return undefined;
    return map[channelId];
  }, [map]);

  // Mark a timestamp as "seen up to" for this channel.
  // Only advances forward — won't move back.
  const markRead = useCallback((channelId: number, timestamp: string) => {
    setMap(prev => {
      const current = prev[channelId];
      if (current && new Date(current) >= new Date(timestamp)) return prev;
      const next = { ...prev, [channelId]: timestamp };
      save(next);
      return next;
    });
  }, []);

  return { getLastRead, markRead };
}
