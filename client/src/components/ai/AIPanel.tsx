import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const BLUE = '#1976d2';
const BLUE_DARK = '#1565c0';
const BLUE_LIGHT = '#e3f2fd';

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: Array<{ label: string; type: string; url?: string; payload?: any }>;
  loading?: boolean;
}

const CHIPS = [
  { label: '📋 My tasks',       query: 'What are my open tasks?' },
  { label: '🏃 Sprint status',  query: "What's left in the sprint?" },
  { label: '📅 Today',          query: "What's on my schedule today?" },
  { label: '📝 Summarize chat', query: 'Summarize this conversation' },
  { label: '🔗 Auto-fill log',  query: 'Auto-fill PCI activity log from this conversation' },
];

function MarkdownText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\n)/g);
  return (
    <span style={{ lineHeight: 1.55 }}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={i} style={{
              background: '#f0f2f5', padding: '1px 4px',
              borderRadius: 3, fontSize: '0.9em', fontFamily: 'monospace',
            }}>
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part === '\n') return <br key={i} />;
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

function ActionButton({ action }: { action: { label: string; type: string; url?: string; payload?: any } }) {
  const handleClick = () => {
    if (action.type === 'url' && action.url) {
      window.open(action.url, '_blank');
    } else if (action.type === 'log_to_pci') {
      // Trigger PCI log modal — emit custom event for Layout to handle
      window.dispatchEvent(new CustomEvent('ias-hub:open-pci-log', { detail: action.payload }));
    }
  };

  return (
    <button
      onClick={handleClick}
      style={{
        padding: '3px 10px', border: `1px solid ${BLUE}`,
        color: BLUE, background: '#fff', cursor: 'pointer',
        fontSize: 11, borderRadius: 5, fontFamily: 'inherit',
        marginTop: 4, marginRight: 4, transition: 'all .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = BLUE; e.currentTarget.style.color = '#fff'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = BLUE; }}
    >
      {action.label}
    </button>
  );
}

function MessageBubble({ msg }: { msg: AIMessage }) {
  const isUser = msg.role === 'user';

  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      gap: 6,
      marginBottom: 10,
      alignItems: 'flex-start',
    }}>
      {/* Avatar */}
      <div style={{
        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
        background: isUser ? '#1565c0' : '#f3e5f5',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, color: isUser ? '#fff' : '#6a1b9a', fontWeight: 700,
      }}>
        {isUser ? '👤' : '🤖'}
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: '80%' }}>
        <div style={{
          background: isUser ? BLUE : '#fff',
          color: isUser ? '#fff' : '#1a1a2e',
          border: isUser ? 'none' : '1px solid #dde1e7',
          borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
          padding: '7px 10px',
          fontSize: 12,
        }}>
          {msg.loading ? (
            <span style={{ color: '#888' }}>
              <span style={{ animation: 'pulse 1s infinite' }}>Thinking</span>
              <span style={{ display: 'inline-block', marginLeft: 2, letterSpacing: 2 }}>...</span>
            </span>
          ) : (
            <MarkdownText text={msg.content} />
          )}
        </div>

        {/* Action buttons */}
        {!msg.loading && msg.actions && msg.actions.length > 0 && (
          <div style={{ marginTop: 4 }}>
            {msg.actions.map((a, i) => <ActionButton key={i} action={a} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AIPanel() {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      role: 'assistant',
      content: 'Hi! I can help you with Jira tasks, sprint status, PCI activities, and more. Use the chips below or ask me anything.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { activeChannelId } = useChatStore();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendQuery = async (question: string) => {
    if (!question.trim() || loading) return;

    const userMsg: AIMessage = { role: 'user', content: question };
    const loadingMsg: AIMessage = { role: 'assistant', content: '', loading: true };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await axios.post(`${API}/ai/query`, {
        question,
        channel_id: activeChannelId,
      });

      const assistantMsg: AIMessage = {
        role: 'assistant',
        content: data.data?.response || 'No response received.',
        actions: data.data?.actions || [],
      };

      setMessages(prev => [...prev.slice(0, -1), assistantMsg]);
    } catch (err: any) {
      const errMsg: AIMessage = {
        role: 'assistant',
        content: `⚠️ Error: ${err.response?.data?.error || err.message || 'Request failed'}`,
      };
      setMessages(prev => [...prev.slice(0, -1), errMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuery(input);
    }
  };

  const handleClear = () => {
    setMessages([{
      role: 'assistant',
      content: 'Conversation cleared. How can I help you?',
    }]);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      fontFamily: 'Segoe UI, Arial, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        background: BLUE_DARK,
        color: '#fff',
        padding: '7px 11px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
          🤖 AI Assistant
        </span>
        <button
          onClick={handleClear}
          title="Clear conversation"
          style={{
            background: 'transparent', border: 'none', color: 'rgba(255,255,255,.7)',
            cursor: 'pointer', fontSize: 11, padding: '1px 5px', borderRadius: 4,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,.7)'; }}
        >
          ✕ Clear
        </button>
      </div>

      {/* Messages area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '10px 10px 4px',
        background: '#f7f9fc',
      }}>
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Quick chips */}
      <div style={{
        padding: '6px 8px 4px',
        background: '#fff',
        borderTop: '1px solid #eee',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        flexShrink: 0,
      }}>
        {CHIPS.map(chip => (
          <button
            key={chip.label}
            onClick={() => sendQuery(chip.query)}
            disabled={loading}
            style={{
              padding: '3px 8px',
              border: `1px solid ${BLUE}`,
              borderRadius: 12,
              background: BLUE_LIGHT,
              color: BLUE,
              fontSize: 10,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              fontFamily: 'inherit',
              transition: 'all .15s',
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = BLUE; e.currentTarget.style.color = '#fff'; } }}
            onMouseLeave={e => { e.currentTarget.style.background = BLUE_LIGHT; e.currentTarget.style.color = BLUE; }}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div style={{
        padding: '6px 8px 8px',
        background: '#fff',
        borderTop: '1px solid #eee',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          gap: 6,
          alignItems: 'flex-end',
          border: `1px solid ${loading ? '#90caf9' : '#dde1e7'}`,
          borderRadius: 8,
          padding: '4px 6px 4px 10px',
          background: '#fafafa',
          transition: 'border-color .15s',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything… (Enter to send)"
            disabled={loading}
            rows={1}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'inherit',
              fontSize: 12,
              resize: 'none',
              lineHeight: 1.4,
              maxHeight: 72,
              overflowY: 'auto',
              color: '#1a1a2e',
            }}
          />
          <button
            onClick={() => sendQuery(input)}
            disabled={loading || !input.trim()}
            style={{
              padding: '4px 10px',
              background: loading || !input.trim() ? '#ccc' : BLUE,
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontFamily: 'inherit',
              flexShrink: 0,
              transition: 'background .15s',
            }}
          >
            {loading ? '…' : '↑'}
          </button>
        </div>
        <div style={{ fontSize: 9, color: '#aaa', marginTop: 3, textAlign: 'right' }}>
          Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}
