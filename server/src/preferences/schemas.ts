/**
 * User preferences — schema registry.
 *
 * Central source of truth for:
 *   - which preference keys are allowed (whitelist)
 *   - what the default value is when a user has no row yet
 *   - how to validate an incoming value before persisting
 *
 * Anything not registered here will be rejected by the PUT endpoint.
 * To add a new preference, register it in PREF_SCHEMAS below.
 */

export interface PrefSchema {
  /** Safe default returned when the user has never set this key. */
  default: any;
  /**
   * Validates an incoming value. Returns null if valid, otherwise a short
   * human-readable error string suitable for a 422 response.
   */
  validate(value: any): string | null;
}

// ── ask_ias.chips ─────────────────────────────────────────
// Exactly 3 strings, each 5-120 chars. The pinned "priorities" chip is
// NOT stored per user — it's hardcoded in the Ask IAS backend.
const ASK_IAS_CHIPS_DEFAULT = [
  "What's blocking my team?",
  'Any news from my top clients?',
  "Summarize this week's progress",
];

function validateAskIasChips(value: any): string | null {
  if (!Array.isArray(value)) return 'Must be an array';
  if (value.length !== 3) return 'Must contain exactly 3 chips';
  for (let i = 0; i < value.length; i++) {
    const v = value[i];
    if (typeof v !== 'string') return `Chip ${i + 1} must be a string`;
    const trimmed = v.trim();
    if (trimmed.length < 5)   return `Chip ${i + 1} is too short (min 5 chars)`;
    if (trimmed.length > 120) return `Chip ${i + 1} is too long (max 120 chars)`;
  }
  return null;
}

// ── Registry ──────────────────────────────────────────────
export const PREF_SCHEMAS: Record<string, PrefSchema> = {
  'ask_ias.chips': {
    default: ASK_IAS_CHIPS_DEFAULT,
    validate: validateAskIasChips,
  },
};

export function isKnownPrefKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(PREF_SCHEMAS, key);
}

/**
 * Returns defaults for every registered key. Used by GET /me/preferences
 * to fill in anything the user hasn't explicitly set.
 */
export function allDefaults(): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of Object.keys(PREF_SCHEMAS)) {
    out[k] = PREF_SCHEMAS[k].default;
  }
  return out;
}
