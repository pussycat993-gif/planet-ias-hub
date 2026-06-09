// IAS Hub - theme apply.
// Reads the user's `appearance_theme` preference (saved by ProfileAccountModal
// in localStorage) and sets `data-theme` on <html> so the dark token overrides
// in tokens.css take effect app-wide. 'system' follows the OS preference.

const PREFS_KEY = 'ias_hub_profile_prefs';

export type ThemePref = 'light' | 'system' | 'dark';

export function getThemePref(): ThemePref {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    const t = p.appearance_theme;
    return t === 'dark' || t === 'system' ? t : 'light';
  } catch {
    return 'light';
  }
}

function resolve(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') {
    return typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return pref;
}

// Apply a theme immediately (used on startup and for live preview when the
// user changes the Theme selector).
export function applyTheme(pref: ThemePref): void {
  document.documentElement.setAttribute('data-theme', resolve(pref));
}

let systemListenerBound = false;

// Call once on app startup. Applies the saved preference and, for 'system',
// re-applies whenever the OS light/dark setting changes.
export function initTheme(): void {
  applyTheme(getThemePref());
  if (!systemListenerBound && typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (getThemePref() === 'system') applyTheme('system'); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if ((mq as any).addListener) (mq as any).addListener(onChange);
    systemListenerBound = true;
  }
}
