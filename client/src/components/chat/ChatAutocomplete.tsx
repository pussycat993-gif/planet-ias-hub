import React, { useEffect, useRef } from 'react';
import Icon, { IconName } from '../ui/Icon';

const BLUE = 'var(--blue-primary)';
const BLUE_DARK = 'var(--blue-dark)';

// ── Types ──────────────────────────────────────────────────────
export interface AutocompleteItem {
  id: string;
  label: string;          // primary text
  sublabel?: string;      // secondary text (role, description)
  avatarUrl?: string;     // for mention
  avatarInitials?: string;
  avatarColor?: string;
  icon?: IconName;        // Lucide icon for slash command
  emoji?: string;         // fallback glyph for commands with no Lucide equivalent (/shrug)
  hotkey?: string;        // shortcut hint
}

export type AutocompleteKind = 'mention' | 'command';

interface Props {
  kind: AutocompleteKind;
  items: AutocompleteItem[];
  highlightedIndex: number;
  onHighlight: (index: number) => void;
  onSelect: (item: AutocompleteItem) => void;
  onClose: () => void;
}

// ── Component ──────────────────────────────────────────────────
export default function ChatAutocomplete({ kind, items, highlightedIndex, onHighlight, onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const highlightedRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  // Scroll highlighted item into view
  useEffect(() => {
    highlightedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  if (items.length === 0) return null;

  const title = kind === 'mention' ? 'Mention a person' : 'Slash commands';

  return (
    <div ref={ref}
      style={{
        position: 'absolute', bottom: '100%', left: 0, marginBottom: 8,
        width: 320, maxHeight: 280,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,.15)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: 'var(--font-sans)', zIndex: 2500,
      }}
    >
      <div style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', background: 'var(--grey-light)', borderBottom: '1px solid var(--neutral-light-active)', flexShrink: 0 }}>
        {title}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {items.map((item, i) => {
          const highlighted = i === highlightedIndex;
          return (
            <div key={item.id}
              ref={highlighted ? highlightedRef : null}
              onClick={() => onSelect(item)}
              onMouseEnter={() => onHighlight(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 12px', cursor: 'pointer',
                background: highlighted ? 'var(--blue-xlight)' : 'var(--surface)',
                borderLeft: highlighted ? `3px solid ${BLUE}` : '3px solid transparent',
                paddingLeft: highlighted ? 9 : 12,
              }}
            >
              {/* Avatar / icon */}
              {kind === 'mention' ? (
                item.avatarUrl ? (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                    <img src={item.avatarUrl} alt={item.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: item.avatarColor || BLUE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {item.avatarInitials || item.label.slice(0, 2).toUpperCase()}
                  </div>
                )
              ) : (
                <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--blue-xlight)', color: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                  {item.icon ? <Icon name={item.icon} size={15} /> : item.emoji ? <span>{item.emoji}</span> : '/'}
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.label}
                </div>
                {item.sublabel && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.sublabel}
                  </div>
                )}
              </div>

              {item.hotkey && (
                <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--grey-light)', padding: '2px 6px', borderRadius: 4, flexShrink: 0, fontFamily: 'monospace' }}>
                  {item.hotkey}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ padding: '5px 12px', fontSize: 10, color: 'var(--text3)', borderTop: '1px solid var(--neutral-light-active)', background: 'var(--grey-light)', display: 'flex', gap: 12, flexShrink: 0 }}>
        <span><kbd style={kbdStyle}>↑↓</kbd> Navigate</span>
        <span><kbd style={kbdStyle}>Enter</kbd> Select</span>
        <span><kbd style={kbdStyle}>Esc</kbd> Close</span>
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  background: 'var(--grey-light)', border: '1px solid var(--border)', borderRadius: 3,
  padding: '1px 4px', fontFamily: 'monospace', fontSize: 9, color: 'var(--text2)',
};
