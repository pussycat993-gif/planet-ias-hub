import { useState, useCallback } from 'react';

const STORAGE_KEY = 'ias_hub_favorites';

// ── Shared favorites hook (channels starred by the user) ──────
// Backed by localStorage; synced across components via custom event.
export function useFavorites() {
  const [favs, setFavs] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  });

  // Listen for changes from other components
  useState(() => {
    const h = () => {
      try { setFavs(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
      catch { setFavs([]); }
    };
    window.addEventListener('ias:favorites-changed', h);
    return () => window.removeEventListener('ias:favorites-changed', h);
  });

  const toggle = useCallback((id: number) => {
    setFavs(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event('ias:favorites-changed'));
      return next;
    });
  }, []);

  const isFav = useCallback((id: number) => favs.includes(id), [favs]);

  return { favs, toggle, isFav };
}
