import React, { useState, useMemo, useRef, useEffect } from 'react';

const BLUE = '#1976d2';
const BLUE_DARK = '#1565c0';

// ── Types ──────────────────────────────────────────────────────
export interface PickerItem {
  id: string;
  name: string;
  type: string;               // e.g. "Company", "Event", "Person", "Project", "Tag"
  logoColor?: string;         // fallback avatar background
  logoAbbr?: string;          // fallback avatar text (e.g. "AC")
  iconEmoji?: string;         // alternative: emoji instead of logo
}

export type PickerKind = 'entity' | 'people' | 'tag';

interface Props {
  kind: PickerKind;
  items: PickerItem[];
  onSelect: (item: PickerItem) => void;
  onClose: () => void;
  maxVisible?: number;        // default 50
  alreadySelected?: string[]; // names/ids to dim out
}

// ── Title mapping ──────────────────────────────────────────────
const KIND_LABELS: Record<PickerKind, string> = {
  entity: 'Add Entity to Activity',
  people: 'Add Person to Activity',
  tag:    'Add Tag to Activity',
};

// ── Type → emoji fallback ──────────────────────────────────────
const TYPE_EMOJI: Record<string, string> = {
  Company:              '🏢',
  Event:                '🎫',
  Project:              '📁',
  'Award & Grant Program': '🏆',
  Software:             '💻',
  Person:               '👤',
  Tag:                  '🏷️',
  Organization:         '🏛️',
};

// ── Component ──────────────────────────────────────────────────
export default function EntityPickerModal({ kind, items, onSelect, onClose, maxVisible = 50, alreadySelected = [] }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Escape to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(i =>
      i.name.toLowerCase().includes(q) ||
      i.type.toLowerCase().includes(q)
    );
  }, [items, query]);

  const visible = filtered.slice(0, maxVisible);
  const overflow = filtered.length > maxVisible;

  const renderLogo = (item: PickerItem) => {
    const size = 44;
    if (item.iconEmoji) {
      return (
        <div style={{ width: size, height: size, borderRadius: 6, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
          {item.iconEmoji}
        </div>
      );
    }
    const bg = item.logoColor || '#cfd8dc';
    const abbr = item.logoAbbr || item.name.slice(0, 2).toUpperCase();
    return (
      <div style={{ width: size, height: size, borderRadius: 6, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
        {abbr}
      </div>
    );
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, Arial, sans-serif' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', width: 620, maxWidth: '94vw', height: '78vh', maxHeight: 720, borderRadius: 12, boxShadow: '0 16px 60px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ background: BLUE, color: '#fff', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{KIND_LABELS[kind]}</span>
          <span onClick={onClose} style={{ cursor: 'pointer', fontSize: 20, opacity: .9 }}>✕</span>
        </div>

        {/* Search */}
        <div style={{ padding: '14px 18px', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={kind === 'people' ? 'Search people...' : kind === 'tag' ? 'Search tags...' : 'Search entities...'}
              style={{ width: '100%', padding: '10px 38px 10px 14px', fontSize: 14, border: '1px solid #dde1e7', borderRadius: 8, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
            {query && (
              <span
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 22, height: 22, borderRadius: '50%', background: '#bbb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, cursor: 'pointer' }}
              >✕</span>
            )}
          </div>
        </div>

        {/* Count / overflow notice */}
        {filtered.length > 0 && (
          <div style={{ padding: '0 18px 10px', fontSize: 12, color: '#888', flexShrink: 0 }}>
            Showing {Math.min(visible.length, filtered.length)} of {filtered.length} results
            {overflow && (
              <span style={{ color: '#e65100', fontStyle: 'italic', marginLeft: 6 }}>
                — refine your search to see all
              </span>
            )}
          </div>
        )}

        {/* Results list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
          {visible.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#aaa', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>🔍</div>
              {query ? `No results for "${query}"` : 'No items available'}
            </div>
          ) : visible.map(item => {
            const isSelected = alreadySelected.includes(item.name) || alreadySelected.includes(item.id);
            const emoji = item.iconEmoji || TYPE_EMOJI[item.type];
            const resolvedItem = emoji && !item.logoColor && !item.logoAbbr ? { ...item, iconEmoji: emoji } : item;
            return (
              <div
                key={item.id}
                onClick={() => !isSelected && onSelect(item)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', borderRadius: 8, margin: '4px 0',
                  cursor: isSelected ? 'default' : 'pointer',
                  border: '1px solid #e8e8e8',
                  background: isSelected ? '#f5f5f5' : '#fff',
                  opacity: isSelected ? 0.5 : 1,
                  transition: 'all .12s',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f0f7ff'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '#fff'; }}
              >
                {renderLogo(resolvedItem)}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>
                    {item.type}
                  </div>
                </div>
                {isSelected && <span style={{ fontSize: 11, color: '#888', flexShrink: 0 }}>Added</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
