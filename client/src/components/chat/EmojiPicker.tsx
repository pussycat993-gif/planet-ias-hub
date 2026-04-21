import React, { useState, useMemo, useEffect, useRef } from 'react';

const BLUE = '#1976d2';

// ── Curated emoji set, grouped by category ─────────────────────
interface EmojiGroup {
  key: string;
  label: string;
  icon: string;
  emojis: string[];
}

const GROUPS: EmojiGroup[] = [
  {
    key: 'recent', label: 'Recent', icon: '🕒', emojis: [], // filled from localStorage
  },
  {
    key: 'smileys', label: 'Smileys', icon: '😀', emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
      '😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔',
      '🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷',
      '🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','😎','🤓','🧐','😕',
      '😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱',
      '😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','💩','🤡',
    ],
  },
  {
    key: 'gestures', label: 'People', icon: '👍', emojis: [
      '👍','👎','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️',
      '👋','🤚','🖐️','✋','🖖','👏','🙌','🤲','🤝','🙏','💪','🦾','🦿','🦵','🦶','👂',
      '🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄','💋','🩸','👶','👧','🧒',
      '👦','👩','🧑','👨','👵','🧓','👴','👮','🕵️','💂','👷','🤴','👸','👳','👲','🧕',
    ],
  },
  {
    key: 'hearts', label: 'Hearts', icon: '❤️', emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖',
      '💘','💝','💟','💌','💋','💯','💢','💥','💫','💦','💨','🕳️','💣','💬','👁️‍🗨️','🗨️',
      '🗯️','💭','💤','🌹','🌺','🌸','🌼','🌻','🌷','💐','🌾','🌿','🍀','🍃','🌱','🌳',
    ],
  },
  {
    key: 'objects', label: 'Objects', icon: '💼', emojis: [
      '💼','📁','📂','🗂️','📅','📆','🗓️','📇','📈','📉','📊','📋','📌','📍','📎','🖇️',
      '📏','📐','✂️','🗃️','🗄️','🗑️','🔒','🔓','🔏','🔐','🔑','🗝️','🔨','⛏️','⚒️','🛠️',
      '🗡️','⚔️','🔫','🏹','🛡️','🔧','🔩','⚙️','🗜️','⚖️','🦯','🔗','⛓️','🧰','🧲','⚗️',
      '🧪','🧫','🧬','🔬','🔭','📡','💻','🖥️','🖨️','⌨️','🖱️','🖲️','💽','💾','💿','📀',
      '🧮','📱','📲','☎️','📞','📟','📠','📺','📻','🎙️','🎚️','🎛️','⏱️','⏲️','⏰','🕰️',
    ],
  },
  {
    key: 'symbols', label: 'Symbols', icon: '✅', emojis: [
      '✅','❌','⭕','🚫','⛔','📛','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓',
      '❔','‼️','⁉️','💯','🔅','🔆','⚜️','🔱','📛','🔰','🈁','🈂️','🛂','🛃','🛄','🛅',
      '⚠️','🚸','⬆️','↗️','➡️','↘️','⬇️','↙️','⬅️','↖️','↕️','↔️','↩️','↪️','⤴️','⤵️',
      '🔃','🔄','🔙','🔚','🔛','🔜','🔝','🙏','✍️','💅','🤳','💪','🦵','🦶','👂','🦻',
      '☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋',
    ],
  },
];

const RECENT_KEY = 'ias_hub_recent_emojis';
const RECENT_MAX = 32;

function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
  catch { return []; }
}
function saveRecent(emoji: string) {
  const current = loadRecent().filter(e => e !== emoji);
  const next = [emoji, ...current].slice(0, RECENT_MAX);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  anchorPosition?: 'above' | 'below';
}

export default function EmojiPicker({ onSelect, onClose, anchorPosition = 'above' }: Props) {
  const [activeGroup, setActiveGroup] = useState<string>('smileys');
  const [search, setSearch] = useState('');
  const [recent, setRecent] = useState<string[]>(loadRecent());
  const ref = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  const handlePick = (emoji: string) => {
    saveRecent(emoji);
    setRecent(loadRecent());
    onSelect(emoji);
  };

  // When searching, show matches across all groups
  const visible = useMemo(() => {
    if (!search.trim()) {
      if (activeGroup === 'recent') return recent;
      const g = GROUPS.find(x => x.key === activeGroup);
      return g?.emojis || [];
    }
    const q = search.toLowerCase();
    // Minimal search: match against group label (e.g. "heart" → Hearts group)
    // For real keyword search we'd need emoji keyword data; this is a reasonable v1.
    const matched: string[] = [];
    GROUPS.forEach(g => {
      if (g.label.toLowerCase().includes(q)) matched.push(...g.emojis);
    });
    return matched.slice(0, 200);
  }, [activeGroup, search, recent]);

  return (
    <div ref={ref}
      style={{
        position: 'absolute',
        [anchorPosition === 'above' ? 'bottom' : 'top']: '100%',
        left: 0,
        marginBottom: anchorPosition === 'above' ? 8 : 0,
        marginTop: anchorPosition === 'below' ? 8 : 0,
        width: 340,
        maxHeight: 380,
        background: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,.15)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Segoe UI, Arial, sans-serif',
        zIndex: 3000,
        overflow: 'hidden',
      }}
    >
      {/* Category tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', padding: '4px 6px', gap: 2, flexShrink: 0 }}>
        {GROUPS.map(g => {
          const isActive = activeGroup === g.key && !search;
          const disabled = g.key === 'recent' && recent.length === 0;
          return (
            <div key={g.key}
              onClick={() => { if (!disabled) { setActiveGroup(g.key); setSearch(''); } }}
              title={g.label}
              style={{
                flex: 1, textAlign: 'center', padding: '6px 0',
                cursor: disabled ? 'not-allowed' : 'pointer',
                borderRadius: 6,
                background: isActive ? '#e3f2fd' : 'transparent',
                opacity: disabled ? 0.3 : 1,
                fontSize: 16,
                borderBottom: isActive ? `2px solid ${BLUE}` : '2px solid transparent',
                transition: 'all .12s',
              }}
              onMouseEnter={e => { if (!disabled && !isActive) e.currentTarget.style.background = '#f5f5f5'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              {g.icon}
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ padding: '6px 8px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          style={{ width: '100%', padding: '5px 10px', border: '1px solid #dde1e7', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Emoji grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
        {visible.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#aaa', fontSize: 12 }}>
            {search ? 'No emojis match' : activeGroup === 'recent' ? 'No recent emojis yet' : 'Empty'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2 }}>
            {visible.map((e, i) => (
              <div key={`${e}-${i}`}
                onClick={() => handlePick(e)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', aspectRatio: '1/1', fontSize: 20, cursor: 'pointer', borderRadius: 6, transition: 'background .08s' }}
                onMouseEnter={el => (el.currentTarget.style.background = '#f0f7ff')}
                onMouseLeave={el => (el.currentTarget.style.background = 'transparent')}
              >
                {e}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
