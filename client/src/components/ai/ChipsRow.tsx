import React from 'react';
import { PINNED_CHIP } from '../../hooks/useAskIASPrefs';

interface Props {
  /** The 3 user-editable chips (from useAskIASPrefs). */
  chips: string[];
  /** Fires when any chip is clicked — parent decides what to do with the text. */
  onSelect: (text: string) => void;
  /** When true, the chips are rendered smaller / dimmer (used once a chat
   *  conversation is under way so they don't visually compete). */
  compact?: boolean;
}

/**
 * Horizontal row of 4 question chips shown under the prompt in the Ask IAS
 * modal. The first chip is pinned (yellow/amber, star icon, not editable).
 * The remaining three come from user preferences.
 */
export default function ChipsRow({ chips, onSelect, compact = false }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        padding: compact ? '0 20px 8px' : '0 20px 14px',
        transition: 'padding .15s',
      }}
    >
      <Chip
        text={PINNED_CHIP}
        pinned
        compact={compact}
        onClick={() => onSelect(PINNED_CHIP)}
      />
      {chips.map((text, i) => (
        <Chip
          key={i}
          text={text}
          compact={compact}
          onClick={() => onSelect(text)}
        />
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────

interface ChipProps {
  text: string;
  pinned?: boolean;
  compact?: boolean;
  onClick: () => void;
}

function Chip({ text, pinned = false, compact = false, onClick }: ChipProps) {
  const padY = compact ? 4 : 6;
  const padX = compact ? 10 : 12;
  const fontSize = compact ? 11 : 12;

  const baseStyle: React.CSSProperties = pinned
    ? {
        background: '#fffde7',
        border: '1px solid #ffd54f',
        color: '#8a6d00',
        fontWeight: 600,
      }
    : {
        background: '#fff',
        border: '1px solid #dde1e7',
        color: '#555',
        fontWeight: 500,
      };

  return (
    <button
      type="button"
      onClick={onClick}
      title={text}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: `${padY}px ${padX}px`,
        borderRadius: 16,
        cursor: 'pointer',
        fontSize,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        transition: 'all .15s',
        ...baseStyle,
      }}
      onMouseEnter={e => {
        if (pinned) {
          e.currentTarget.style.background = '#fff8e1';
          e.currentTarget.style.borderColor = '#ffb300';
        } else {
          e.currentTarget.style.background = '#f0f7ff';
          e.currentTarget.style.borderColor = '#90caf9';
          e.currentTarget.style.color = '#1565c0';
        }
      }}
      onMouseLeave={e => {
        Object.assign(e.currentTarget.style, baseStyle);
      }}
    >
      {pinned && <span style={{ fontSize: 10, opacity: .85 }}>⭐</span>}
      <span>{text}</span>
    </button>
  );
}
