import React, { useEffect, useState } from 'react';
import { DEFAULT_CUSTOM_CHIPS, PINNED_CHIP } from '../../hooks/useAskIASPrefs';

const BLUE = '#1976d2';

interface Props {
  /** Currently persisted chips (starting state for the form). */
  chips: string[];
  saving: boolean;
  /** Save handler that calls PUT /users/me/preferences via the prefs hook. */
  onSave: (newChips: string[]) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Reset helper — restores the three default chips on the server. */
  onReset: () => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Closes the editor (used by Cancel and by Save-on-success). */
  onClose: () => void;
}

/**
 * Inline editor panel shown below the prompt when the user clicks "Edit
 * questions". Row 1 is the pinned chip — readonly, amber, with a lock hint.
 * Rows 2-4 are editable text inputs bound to `chips`.
 *
 * Validation mirrors the server contract (exactly 3 strings, 5-120 chars
 * each). Server validation is the source of truth — client-side checks are
 * there to give fast feedback before the round-trip.
 */
export default function ChipsEditor({ chips, saving, onSave, onReset, onClose }: Props) {
  const [draft, setDraft] = useState<string[]>([...chips]);
  const [error, setError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<number | null>(null);

  // Keep draft in sync if chips change while the editor is open (e.g. another
  // tab saved new chips). We don't overwrite the user's unsaved typing though.
  useEffect(() => {
    const isUnchanged = draft.every((v, i) => v === chips[i]);
    if (isUnchanged) setDraft([...chips]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chips]);

  const setAt = (i: number, value: string) => {
    setDraft(d => d.map((v, idx) => (idx === i ? value : v)));
    setError(null);
    setRowError(null);
  };

  const validateDraft = (): string | null => {
    for (let i = 0; i < draft.length; i++) {
      const t = (draft[i] || '').trim();
      if (t.length < 5)   { setRowError(i); return `Chip ${i + 2} is too short (min 5 chars)`; }
      if (t.length > 120) { setRowError(i); return `Chip ${i + 2} is too long (max 120 chars)`; }
    }
    return null;
  };

  const handleSave = async () => {
    const v = validateDraft();
    if (v) { setError(v); return; }
    const trimmed = draft.map(s => s.trim());
    const result = await onSave(trimmed);
    if (result.ok) {
      setError(null);
      onClose();
    } else {
      setError(result.error);
    }
  };

  const handleReset = async () => {
    setDraft([...DEFAULT_CUSTOM_CHIPS]);
    setError(null);
    setRowError(null);
    const result = await onReset();
    if (!result.ok) setError(result.error);
  };

  const isDirty = draft.some((v, i) => v !== chips[i]);

  return (
    <div style={{
      margin: '0 20px 14px',
      padding: 14,
      background: '#fafbfc',
      border: '1px solid #dde1e7',
      borderRadius: 10,
      fontFamily: 'inherit',
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: '.05em',
        marginBottom: 10,
      }}>
        Customize question chips
      </div>

      {/* Row 1 — pinned, readonly */}
      <Row
        num={1}
        value={PINNED_CHIP}
        readonly
        rightLabel="⭐ Pinned"
      />

      {/* Rows 2-4 — editable */}
      {[0, 1, 2].map(i => (
        <Row
          key={i}
          num={i + 2}
          value={draft[i] || ''}
          onChange={v => setAt(i, v)}
          error={rowError === i}
          maxLength={120}
        />
      ))}

      {/* Validation / server error */}
      {error && (
        <div style={{
          marginTop: 8,
          fontSize: 11,
          color: '#c62828',
          background: '#ffebee',
          border: '1px solid #ffcdd2',
          padding: '6px 10px',
          borderRadius: 6,
        }}>
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
        <button
          type="button"
          onClick={handleReset}
          disabled={saving}
          style={{
            marginRight: 'auto',
            padding: '6px 12px',
            border: '1px solid #dde1e7',
            background: '#fff',
            color: '#666',
            borderRadius: 6,
            fontSize: 11,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: saving ? .6 : 1,
          }}
        >
          Reset to defaults
        </button>

        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          style={{
            padding: '6px 12px',
            border: '1px solid #dde1e7',
            background: '#fff',
            color: '#666',
            borderRadius: 6,
            fontSize: 11,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !isDirty}
          style={{
            padding: '6px 14px',
            background: isDirty ? BLUE : '#90caf9',
            color: '#fff',
            border: `1px solid ${isDirty ? BLUE : '#90caf9'}`,
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            cursor: saving || !isDirty ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: saving ? .7 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────

interface RowProps {
  num: number;
  value: string;
  readonly?: boolean;
  rightLabel?: string;
  onChange?: (v: string) => void;
  error?: boolean;
  maxLength?: number;
}

function Row({ num, value, readonly, rightLabel, onChange, error, maxLength }: RowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 11, color: '#888', width: 14, flexShrink: 0 }}>{num}.</span>
      <input
        type="text"
        value={value}
        readOnly={readonly}
        onChange={e => onChange?.(e.target.value)}
        maxLength={maxLength}
        style={{
          flex: 1,
          border: error
            ? '1px solid #c62828'
            : readonly
              ? '1px solid #ffd54f'
              : '1px solid #dde1e7',
          borderRadius: 6,
          padding: '6px 10px',
          fontSize: 12,
          fontFamily: 'inherit',
          outline: 'none',
          background: readonly ? '#fffde7' : '#fff',
          color: readonly ? '#8a6d00' : '#1a1a2e',
          cursor: readonly ? 'not-allowed' : 'text',
          transition: 'border-color .15s',
        }}
        onFocus={e => { if (!readonly && !error) e.currentTarget.style.borderColor = BLUE; }}
        onBlur={e => { if (!readonly && !error) e.currentTarget.style.borderColor = '#dde1e7'; }}
      />
      {rightLabel && (
        <span style={{
          fontSize: 10,
          color: '#8a6d00',
          width: 60,
          flexShrink: 0,
          textAlign: 'right',
          fontWeight: 600,
        }}>{rightLabel}</span>
      )}
    </div>
  );
}
