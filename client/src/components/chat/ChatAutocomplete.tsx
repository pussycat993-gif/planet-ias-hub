import React, { useEffect, useRef } from 'react';

const BLUE = '#1976d2';
const BLUE_DARK = '#1565c0';

// ── Types ──────────────────────────────────────────────────────
export interface AutocompleteItem {
  id: string;
  label: string;          // primary text
  sublabel?: string;      // secondary text (role, description)
  avatarUrl?: string;     // for mention
  avatarInitials?: string;
  avatarColor?: string;
  icon?: string;          // for slash command
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
        background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,.15)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: 'Segoe UI, Arial, sans-serif', zIndex: 2500,
      }}
    >
      <div style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', background: '#fafafa', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
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
                background: highlighted ? '#f0f7ff' : '#fff',
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
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#e3f2fd', color: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                  {item.icon || '/'}
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.label}
                </div>
                {item.sublabel && (
                  <div style={{ fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.sublabel}
                  </div>
                )}
              </div>

              {item.hotkey && (
                <span style={{ fontSize: 10, color: '#aaa', background: '#f5f6f8', padding: '2px 6px', borderRadius: 4, flexShrink: 0, fontFamily: 'monospace' }}>
                  {item.hotkey}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ padding: '5px 12px', fontSize: 10, color: '#aaa', borderTop: '1px solid #f0f0f0', background: '#fafafa', display: 'flex', gap: 12, flexShrink: 0 }}>
        <span><kbd style={kbdStyle}>↑↓</kbd> Navigate</span>
        <span><kbd style={kbdStyle}>Enter</kbd> Select</span>
        <span><kbd style={kbdStyle}>Esc</kbd> Close</span>
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  background: '#e8e8e8', border: '1px solid #ddd', borderRadius: 3,
  padding: '1px 4px', fontFamily: 'monospace', fontSize: 9, color: '#555',
};
