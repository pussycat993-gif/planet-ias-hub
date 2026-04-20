import React, { useEffect, useRef, useState } from 'react';
import { useAskIASStore } from '../../store/askIASStore';
import { useAskIASPrefs } from '../../hooks/useAskIASPrefs';
import { useAskIAS } from '../../hooks/useAskIAS';
import ChipsRow from './ChipsRow';
import ChipsEditor from './ChipsEditor';
import ChatShell from './ChatShell';

const BLUE_DARK = '#1565c0';
const BLUE = '#1976d2';
const MODEL_LABEL = 'claude-sonnet-4';

/**
 * Ask IAS modal — chat layout.
 *
 * Standard chat pattern: scrollable history in the middle, prompt input
 * pinned to the bottom, chips above the prompt. Chips compact once there's
 * any history to avoid visual competition.
 *
 * Scope covered as of HUB-37: ChatShell with user bubbles + assistant
 * blocks driven by useAskIAS. HUB-38 will replace the baseline ResponseRenderer
 * with full-fidelity list/summary/table. HUB-39 will wire Open/Done actions.
 * HUB-40 is the polish pass.
 */
export default function AskIASModal() {
  const { isOpen, close, history, focusPromptToken } = useAskIASStore();
  const { chips, loading: chipsLoading, saving, updateChips, resetChips } = useAskIASPrefs();
  const { askQuestion } = useAskIAS();

  const [editing, setEditing] = useState(false);
  const [draftQuestion, setDraftQuestion] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const hasHistory = history.length > 0;
  const lastTurn = history[history.length - 1];
  const awaitingResponse = lastTurn?.role === 'assistant' && lastTurn?.loading;

  // Esc closes. Auto-focus the prompt when the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    // Remember where focus was so we can restore it on close (a11y).
    returnFocusRef.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => inputRef.current?.focus(), 180);
    return () => { document.removeEventListener('keydown', onKey); clearTimeout(t); };
  }, [isOpen, close]);

  // External focus request (e.g. Cmd+K pressed while modal is already open).
  useEffect(() => {
    if (!isOpen) return;
    if (focusPromptToken === 0) return;
    inputRef.current?.focus();
    inputRef.current?.select?.();
  }, [focusPromptToken, isOpen]);

  // When the modal closes, reset local UI state + return focus to the element
  // that had it before we opened (the Ask IAS button, typically).
  useEffect(() => {
    if (!isOpen) {
      setEditing(false);
      setDraftQuestion('');
      // Delay slightly so the modal's own animation doesn't steal focus back.
      const t = setTimeout(() => {
        if (returnFocusRef.current && typeof returnFocusRef.current.focus === 'function') {
          returnFocusRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Submit the current draft (Enter or send button).
  const submit = async () => {
    const q = draftQuestion.trim();
    if (!q || awaitingResponse) return;
    setDraftQuestion('');
    await askQuestion(q);
  };

  // Chip click: auto-submit the chip's text as a question.
  const handleSelectChip = (text: string) => {
    if (awaitingResponse) return;
    setEditing(false);
    setDraftQuestion('');
    askQuestion(text);
  };

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.45)',
        zIndex: 4000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 60,
        animation: 'ias-ask-fade .18s ease-out',
        fontFamily: 'Segoe UI, Arial, sans-serif',
      }}
    >
      <style>{`
        @keyframes ias-ask-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ias-ask-slide {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ask IAS — AI assistant"
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 14,
          width: 720,
          maxWidth: '95vw',
          height: 'min(760px, calc(100vh - 100px))',
          boxShadow: '0 16px 60px rgba(0,0,0,.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'ias-ask-slide .22s ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 20px 12px',
          borderBottom: '1px solid #eee',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 18 }}>✨</span>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: BLUE_DARK, flex: 1 }}>
            Ask IAS
          </h2>
          <button
            type="button"
            onClick={() => setEditing(e => !e)}
            title={editing ? 'Close editor' : 'Edit questions'}
            style={{
              padding: '5px 10px',
              border: editing ? '1px solid #90caf9' : '1px solid #dde1e7',
              background: editing ? '#f0f7ff' : '#fff',
              borderRadius: 6,
              fontSize: 11,
              color: editing ? BLUE : '#666',
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {editing ? '✕ Close editor' : '✏️ Edit questions'}
          </button>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 18,
              cursor: 'pointer',
              color: '#888',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >✕</button>
        </div>

        {/* Scrollable chat body (grows to fill) */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          background: hasHistory ? '#fafbfc' : '#fff',
          transition: 'background .2s',
        }}>
          <ChatShell />
        </div>

        {/* Chips editor inline (when open) OR chips row above prompt */}
        {editing ? (
          <div style={{ borderTop: '1px solid #eee', background: '#fff', flexShrink: 0, paddingTop: 12 }}>
            <ChipsEditor
              chips={chips}
              saving={saving}
              onSave={updateChips}
              onReset={resetChips}
              onClose={() => setEditing(false)}
            />
          </div>
        ) : (
          <div style={{ borderTop: '1px solid #eee', background: '#fff', flexShrink: 0, paddingTop: 10 }}>
            <ChipsRow chips={chips} onSelect={handleSelectChip} compact={hasHistory} />
            {chipsLoading && (
              <div style={{ padding: '0 20px 8px', fontSize: 10, color: '#bbb', fontStyle: 'italic' }}>
                Loading your question chips…
              </div>
            )}
          </div>
        )}

        {/* Prompt input (always visible, pinned above footer) */}
        <div style={{ padding: '4px 20px 12px', background: '#fff', flexShrink: 0 }}>
          <PromptInput
            ref={inputRef}
            value={draftQuestion}
            onChange={setDraftQuestion}
            disabled={editing || awaitingResponse}
            placeholder={
              editing
                ? 'Finish editing chips first…'
                : awaitingResponse
                  ? 'Waiting for response…'
                  : hasHistory
                    ? 'Ask a follow-up…'
                    : 'Ask anything — e.g. "What are my priorities today?"'
            }
            onSubmit={submit}
          />
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 20px',
          borderTop: '1px solid #eee',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 11,
          color: '#888',
          background: '#fafbfc',
          flexShrink: 0,
        }}>
          <span>
            Tip: <Kbd>⌘K</Kbd> or <Kbd>Ctrl+K</Kbd> to toggle · <Kbd>Esc</Kbd> to close
          </span>
          <span style={{ fontSize: 10 }}>🔌 Powered by {MODEL_LABEL}</span>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────

interface PromptInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
}

const PromptInput = React.forwardRef<HTMLTextAreaElement, PromptInputProps>(
  function PromptInput({ value, onChange, onSubmit, disabled, placeholder }, ref) {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!disabled) onSubmit();
      }
    };

    const canSend = !disabled && value.trim().length > 0;

    return (
      <div style={{ position: 'relative' }}>
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          style={{
            width: '100%',
            minHeight: 42,
            maxHeight: 120,
            border: '1px solid #dde1e7',
            borderRadius: 10,
            padding: '11px 48px 11px 14px',
            fontSize: 13,
            fontFamily: 'inherit',
            outline: 'none',
            background: disabled ? '#f5f5f5' : '#f8f9fa',
            color: disabled ? '#aaa' : '#1a1a2e',
            resize: 'none',
            boxSizing: 'border-box',
            transition: 'border-color .15s, background .15s, box-shadow .15s',
          }}
          onFocus={e => {
            if (disabled) return;
            e.currentTarget.style.borderColor = BLUE;
            e.currentTarget.style.background = '#fff';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(25,118,210,.1)';
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = '#dde1e7';
            e.currentTarget.style.background = disabled ? '#f5f5f5' : '#f8f9fa';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSend}
          aria-label="Send"
          style={{
            position: 'absolute',
            right: 5,
            top: 4,
            width: 32,
            height: 32,
            borderRadius: 8,
            background: canSend ? BLUE : '#cfd8dc',
            color: '#fff',
            border: 'none',
            cursor: canSend ? 'pointer' : 'not-allowed',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background .15s',
          }}
          onMouseEnter={e => { if (canSend) e.currentTarget.style.background = BLUE_DARK; }}
          onMouseLeave={e => { if (canSend) e.currentTarget.style.background = BLUE; }}
        >→</button>
      </div>
    );
  }
);

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd style={{
      display: 'inline-block',
      padding: '1px 6px',
      border: '1px solid #dde1e7',
      borderRadius: 4,
      background: '#fff',
      fontFamily: 'Menlo, Consolas, monospace',
      fontSize: 10,
      color: '#555',
    }}>{children}</kbd>
  );
}
