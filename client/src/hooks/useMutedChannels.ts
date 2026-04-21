import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'ias_hub_muted_channels';

// ── Per-channel mute hook ─────────────────────────────────────
// Channel-level notification pause, independent of the global DND.
// Backed by localStorage; synced across components via custom event.
export function useMutedChannels() {
  const [muted, setMuted] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  });

  useEffect(() => {
    const h = () => {
      try { setMuted(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
      catch { setMuted([]); }
    };
    window.addEventListener('ias:muted-changed', h);
    return () => window.removeEventListener('ias:muted-changed', h);
  }, []);

  const toggle = useCallback((id: number) => {
    setMuted(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event('ias:muted-changed'));
      return next;
    });
  }, []);

  const isMuted = useCallback((id: number) => muted.includes(id), [muted]);

  return { muted, toggle, isMuted };
}
