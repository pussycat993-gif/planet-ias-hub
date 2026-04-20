import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * The pinned chip is the one guarantee we give every user — it's always
 * visible, always accessible, always exactly this text. The backend's Ask IAS
 * prompt treats it as a well-defined "return prioritized actions" request.
 */
export const PINNED_CHIP = 'What are my priorities today?';

/**
 * Fallback values if the preferences endpoint is unreachable. Kept in sync
 * with ASK_IAS_CHIPS_DEFAULT in server/src/preferences/schemas.ts.
 */
export const DEFAULT_CUSTOM_CHIPS: [string, string, string] = [
  "What's blocking my team?",
  'Any news from my top clients?',
  "Summarize this week's progress",
];

const KEY = 'ask_ias.chips';

export interface UseAskIASPrefs {
  /** The 3 user-editable chips (the pinned chip is NOT in here). */
  chips: string[];
  loading: boolean;
  saving: boolean;
  /** Persist a new set of 3 chips. Returns { ok, error? }. */
  updateChips: (newChips: string[]) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Restore the three default chips. */
  resetChips: () => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Refetch from server (used after the modal re-opens if needed). */
  reload: () => Promise<void>;
}

/**
 * Loads the user's 3 custom Ask IAS chips from /users/me/preferences and
 * exposes save/reset helpers. Falls back to the defaults on any fetch error.
 */
export function useAskIASPrefs(): UseAskIASPrefs {
  const [chips, setChips] = useState<string[]>(DEFAULT_CUSTOM_CHIPS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/users/me/preferences`);
      const stored = data?.data?.[KEY];
      if (Array.isArray(stored) && stored.length === 3
          && stored.every((s: any) => typeof s === 'string')) {
        setChips(stored);
      } else {
        setChips(DEFAULT_CUSTOM_CHIPS);
      }
    } catch {
      setChips(DEFAULT_CUSTOM_CHIPS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const updateChips = useCallback(async (newChips: string[]) => {
    setSaving(true);
    try {
      await axios.put(`${API}/users/me/preferences`, {
        key: KEY,
        value: newChips,
      });
      setChips(newChips);
      return { ok: true as const };
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Save failed';
      return { ok: false as const, error: msg };
    } finally {
      setSaving(false);
    }
  }, []);

  const resetChips = useCallback(() => updateChips([...DEFAULT_CUSTOM_CHIPS]), [updateChips]);

  return { chips, loading, saving, updateChips, resetChips, reload };
}
