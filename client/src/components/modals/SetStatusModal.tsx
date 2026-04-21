import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';

const BLUE = '#1976d2';
const BLUE_DARK = '#1565c0';

// ── SetStatusModal ─────────────────────────────────────────────
// Lets the user pick:
//   - a custom emoji shown next to their name (e.g. 🏝, 🎯)
//   - a free-text status message (e.g. "Out for lunch")
//   - when the status should auto-clear (Don't clear / 30m / 1h / 4h / today / week)
//   - Focus mode toggle — sets auto_status='focus' + turns on DND
//
// All choices persist to the server via authStore.set* helpers.
// The modal itself just coordinates state and calls the right setter on Save.

// Curated emoji set — short and avoids ambiguity. Order is by common usage.
const EMOJI_PRESETS = [
  { e: '', label: 'No emoji' },
  { e: '🏝', label: 'Vacation' },
  { e: '🎯', label: 'Focus' },
  { e: '🤒', label: 'Sick' },
  { e: '🍕', label: 'Lunch' },
  { e: '☕', label: 'Coffee' },
  { e: '🚀', label: 'Shipping' },
  { e: '📚', label: 'Learning' },
  { e: '💻', label: 'Deep work' },
  { e: '🎧', label: 'Headphones on' },
  { e: '🛌', label: 'Sleeping' },
  { e: '🧘', label: 'Break' },
  { e: '🎉', label: 'Celebrating' },
  { e: '🎥', label: 'In a meeting' },
  { e: '❤️', label: 'In love' },
  { e: '🍺', label: 'Off hours' },
];

type ClearAfter = 'never' | '30m' | '1h' | '4h' | 'today' | 'week';

const CLEAR_OPTIONS: { value: ClearAfter; label: string }[] = [
  { value: 'never', label: "Don't clear" },
  { value: '30m',   label: 'In 30 minutes' },
  { value: '1h',    label: 'In 1 hour' },
  { value: '4h',    label: 'In 4 hours' },
  { value: 'today', label: 'Today'   },
  { value: 'week',  label: 'This week' },
];

// Given a ClearAfter choice, returns the ISO datetime when the auto-status
// should be wiped (or null to mean "never"). Used for Focus mode's
// auto_status_until and for displaying an expiry hint on the form.
function resolveClearAt(choice: ClearAfter): string | null {
  const now = new Date();
  if (choice === 'never') return null;
  if (choice === '30m') return new Date(now.getTime() + 30 * 60_000).toISOString();
  if (choice === '1h')  return new Date(now.getTime() +  60 * 60_000).toISOString();
  if (choice === '4h')  return new Date(now.getTime() + 240 * 60_000).toISOString();
  if (choice === 'today') {
    const eod = new Date(now); eod.setHours(23, 59, 0, 0);
    return eod.toISOString();
  }
  if (choice === 'week') {
    const eow = new Date(now);
    const daysUntilSunday = 7 - eow.getDay();
    eow.setDate(eow.getDate() + daysUntilSunday);
    eow.setHours(23, 59, 0, 0);
    return eow.toISOString();
  }
  return null;
}

export default function SetStatusModal({ onClose }: { onClose: () => void }) {
  const { user, setStatusEmoji, setStatusMessage, setAutoStatus } = useAuthStore();
  const { dnd, setDnd } = useUIStore();

  const [emoji, setEmoji] = useState<string>(user?.status_emoji || '');
  const [message, setMessage] = useState<string>(user?.status_message || '');
  const [clearAfter, setClearAfter] = useState<ClearAfter>('never');
  const [focusMode, setFocusMode] = useState<boolean>(user?.auto_status === 'focus');
  const [saving, setSaving] = useState(false);

  // Esc to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, saving]);

  const clearPreview = useMemo(() => {
    const iso = resolveClearAt(clearAfter);
    if (!iso) return null;
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }, [clearAfter]);

  const handleSave = async () => {
    setSaving(true);
    const clearAt = resolveClearAt(clearAfter);

    // Focus mode takes over auto_status + auto-enables DND. Turning it off
    // clears auto_status only if Focus was the thing setting it (not a call).
    if (focusMode) {
      await setAutoStatus('focus', clearAt);
      if (!dnd) setDnd(true);
    } else if (user?.auto_status === 'focus') {
      await setAutoStatus(null, null);
    }

    await setStatusEmoji(emoji || null);
    await setStatusMessage(message);

    setSaving(false);
    onClose();
  };

  const handleClearAll = async () => {
    setSaving(true);
    await setStatusEmoji(null);
    await setStatusMessage('');
    if (user?.auto_status === 'focus') {
      await setAutoStatus(null, null);
    }
    setSaving(false);
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, width: 440, maxWidth: '95vw',
        boxShadow: '0 8px 40px rgba(0,0,0,.2)', fontFamily: 'Segoe UI, Arial, sans-serif',
        display: 'flex', flexDirection: 'column', maxHeight: '90vh',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #eee' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: BLUE_DARK }}>Set your status</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888', lineHeight: 1, padding: '0 4px' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 18, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Preview */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
            background: '#f0f7ff', border: '1px solid #c5def9', borderRadius: 10,
          }}>
            <div style={{ fontSize: 22, width: 28, textAlign: 'center' }}>
              {emoji || (focusMode ? '🎯' : '💬')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: BLUE_DARK }}>
                {user?.name}
                {focusMode && <span style={{ marginLeft: 7, fontSize: 10, background: '#e65100', color: '#fff', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>FOCUS</span>}
              </div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {message || (focusMode ? 'Heads down, back later' : 'No status set')}
              </div>
            </div>
          </div>

          {/* Emoji picker */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 7 }}>
              Pick an emoji
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
              {EMOJI_PRESETS.map(({ e, label }) => {
                const selected = emoji === e || (e === '' && !emoji);
                return (
                  <button key={label} onClick={() => setEmoji(e)} title={label}
                    style={{
                      height: 38, fontSize: 18,
                      background: selected ? '#e3f2fd' : '#fff',
                      border: `1px solid ${selected ? BLUE : '#dde1e7'}`,
                      borderRadius: 8, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'inherit',
                    }}
                  >
                    {e || <span style={{ fontSize: 10, color: '#888' }}>None</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Message */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 7 }}>
              Status message
              <span style={{ marginLeft: 8, fontSize: 10, color: '#aaa', fontWeight: 400 }}>
                {message.length}/150
              </span>
            </label>
            <input
              type="text"
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, 150))}
              placeholder={focusMode ? 'Heads down, back later…' : 'What are you up to?'}
              style={{
                width: '100%', padding: '9px 12px', boxSizing: 'border-box',
                border: '1px solid #dde1e7', borderRadius: 8,
                fontSize: 13, fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>

          {/* Clear-after */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 7 }}>
              Clear after
            </label>
            <select
              value={clearAfter}
              onChange={e => setClearAfter(e.target.value as ClearAfter)}
              style={{
                width: '100%', padding: '9px 12px', boxSizing: 'border-box',
                border: '1px solid #dde1e7', borderRadius: 8,
                fontSize: 13, fontFamily: 'inherit', outline: 'none',
                background: '#fff', cursor: 'pointer',
              }}
            >
              {CLEAR_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {clearPreview && (
              <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
                Status will clear at {clearPreview}
              </div>
            )}
          </div>

          {/* Focus mode toggle */}
          <div
            onClick={() => setFocusMode(f => !f)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              background: focusMode ? '#fff3e0' : '#f8f9fa',
              border: `1px solid ${focusMode ? '#ffcc80' : '#eee'}`,
              borderRadius: 10, cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 22 }}>🎯</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: focusMode ? '#e65100' : '#1a1a2e' }}>
                Focus mode
              </div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                Sets your status to 🎯, silences notifications, and shows a FOCUS badge
              </div>
            </div>
            <div style={{
              width: 36, height: 20, borderRadius: 10, flexShrink: 0,
              background: focusMode ? '#e65100' : '#ccc',
              position: 'relative', transition: 'background .15s',
            }}>
              <div style={{
                position: 'absolute', top: 2, left: focusMode ? 18 : 2,
                width: 16, height: 16, borderRadius: '50%',
                background: '#fff', transition: 'left .15s',
                boxShadow: '0 1px 3px rgba(0,0,0,.2)',
              }} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '12px 18px', borderTop: '1px solid #eee' }}>
          <button onClick={handleClearAll} disabled={saving}
            style={{ padding: '8px 14px', border: '1px solid #dde1e7', borderRadius: 7, background: '#fff', cursor: saving ? 'wait' : 'pointer', fontSize: 12, color: '#888', fontFamily: 'inherit' }}>
            Clear status
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} disabled={saving}
              style={{ padding: '8px 14px', border: '1px solid #dde1e7', borderRadius: 7, background: '#fff', cursor: saving ? 'wait' : 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{
                padding: '8px 20px', border: 'none', borderRadius: 7,
                background: saving ? '#90caf9' : BLUE, color: '#fff',
                cursor: saving ? 'wait' : 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
