import React, { useEffect, useState } from 'react';
import { useAskIASStore } from '../../store/askIASStore';

/**
 * Ask IAS entry-point button. Lives in the Header, to the right of search.
 * Pale gradient pill with a sparkle and a Cmd+K / Ctrl+K hint.
 */
export default function AskIASButton() {
  const { isOpen, toggle } = useAskIASStore();
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);

  const hotkey = isMac ? '⌘K' : 'Ctrl+K';

  return (
    <button
      type="button"
      onClick={toggle}
      title={isOpen ? 'Close Ask IAS' : 'Ask IAS AI assistant'}
      aria-label={isOpen ? 'Close Ask IAS assistant' : 'Open Ask IAS assistant'}
      aria-expanded={isOpen}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 11px 5px 10px',
        height: 30,
        background: isOpen
          ? 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)'
          : 'linear-gradient(135deg, #fff 0%, #f0f7ff 100%)',
        color: '#1565c0',
        border: '1px solid rgba(255,255,255,.5)',
        borderRadius: 18,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'inherit',
        boxShadow: '0 2px 8px rgba(0,0,0,.12)',
        transition: 'transform .15s, box-shadow .15s, background .15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 3px 12px rgba(0,0,0,.18)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.12)';
      }}
    >
      <span
        style={{
          fontSize: 14,
          display: 'inline-block',
          animation: 'ias-ask-sparkle 3s infinite',
          transformOrigin: 'center',
        }}
      >
        ✨
      </span>
      <style>{`
        @keyframes ias-ask-sparkle {
          0%, 85%, 100% { transform: scale(1) rotate(0); }
          92%           { transform: scale(1.25) rotate(12deg); }
        }
      `}</style>
      <span>Ask IAS</span>
      <span style={{ fontSize: 10, opacity: .6, marginLeft: 2, fontWeight: 500 }}>{hotkey}</span>
    </button>
  );
}
