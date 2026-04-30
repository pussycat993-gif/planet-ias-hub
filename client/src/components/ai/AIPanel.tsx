import React, { useState, useRef, useEffect } from 'react';
import { useUIStore } from '../../store/uiStore';
import { useChatStore } from '../../store/chatStore';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const PURPLE = '#6a1b9a';
const BLUE = '#1976d2';

interface AIMessage {
  role: 'user' | 'bot' | 'sys';
  text: string;
  actions?: Array<{ label: string; type: string; url?: string; payload?: any }>;
}

const CHIPS = [
  { label: 'My open tasks', question: 'What are my open tasks?' },
  { label: 'Sprint status', question: 'What is left in the current sprint?' },
  { label: "Today's schedule", question: 'What is on my schedule today?' },
  { label: 'Summarize chat', question: 'Summarize this conversation for PCI log' },
  { label: 'Auto-fill log', question: 'Auto-fill PCI log from this conversation' },
];

export default function AIPanel() {
  const { aiPanelOpen, toggleAIPanel } = useUIStore();
  const { activeChannelId } = useChatStore();
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      role: 'sys',
      text: 'Connected to Jira + PLANet IAS · Automations active',
    },
    {
      role: 'bot',
      text: 'Hi! I have access to your Jira tasks and PCI activities. What would you like to know?',
      actions: [{ label: '↗ Open tasks', type: 'chip', payload: 'What are my open tasks?' }],
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!aiPanelOpen) return null;

  const sendQuestion = async (question: string) => {
    if (!question.trim() || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: question }]);
    setLoading(true);

    try {
      const { data } = await axios.post(`${API}/ai/query`, {
        question,
        channel_id: activeChannelId,
      });
      setMessages(m => [...m, {
        role: 'bot',
        text: data.data.response,
        actions: data.data.actions || [],
      }]);
    } catch {
      setMessages(m => [...m, {
        role: 'bot',
        text: 'Could not connect to AI service. Check server and Jira credentials in `.env`.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (action: { label: string; type: string; url?: string; payload?: any }) => {
    if (action.type === 'url' && action.url) {
      window.open(action.url, '_blank');
    } else if (action.type === 'chip' && action.payload) {
      sendQuestion(action.payload);
    } else if (action.type === 'log_to_pci') {
      // TODO: open log modal
    }
  };

  const renderText = (text: string) => {
    // Simple markdown — bold
    return text.split('\n').map((line, i) => (
      <div key={i} style={{ marginBottom: 2 }}>
        {line.split(/\*\*(.+?)\*\*/).map((part, j) =>
          j % 2 === 1
            ? <strong key={j}>{part}</strong>
            : <span key={j}>{part}</span>
        )}
      </div>
    ));
  };

  return (
    <div style={{
      width: 260, borderLeft: '1px solid #dde1e7',
      display: 'flex', flexDirection: 'column', background: '#fff', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${BLUE}, ${PURPLE})`,
        color: '#fff', padding: '7px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>🤖 IAS Hub AI</span>
        <span
          style={{ cursor: 'pointer', fontSize: 14, opacity: .8 }}
          onClick={toggleAIPanel}
        >✕</span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            {msg.role === 'sys' && (
              <div style={{
                background: '#fafafa', color: '#888', fontSize: 10,
                textAlign: 'center', padding: '3px 6px', borderRadius: 4,
              }}>
                {msg.text}
              </div>
            )}
            {msg.role === 'user' && (
              <div style={{
                background: '#e3f2fd', color: '#1565c0',
                padding: '6px 9px', borderRadius: 8,
                fontSize: 12, lineHeight: 1.5, textAlign: 'right',
              }}>
                {msg.text}
              </div>
            )}
            {msg.role === 'bot' && (
              <div style={{
                background: '#f3e5f5', color: PURPLE,
                border: '1px solid #e1bee7', padding: '6px 9px',
                borderRadius: 8, fontSize: 12, lineHeight: 1.6,
              }}>
                {renderText(msg.text)}
                {msg.actions && msg.actions.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {msg.actions.map((action, j) => (
                      <button
                        key={j}
                        onClick={() => handleAction(action)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: '#fff', border: '1px solid #dde1e7',
                          borderRadius: 5, padding: '2px 8px', fontSize: 10,
                          cursor: 'pointer', color: BLUE, fontFamily: 'inherit',
                        }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ color: '#888', fontSize: 11, fontStyle: 'italic', padding: '4px 8px' }}>
            Thinking...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick chips */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 8px',
        borderTop: '1px solid #dde1e7', flexShrink: 0,
      }}>
        {CHIPS.map(chip => (
          <div
            key={chip.label}
            onClick={() => sendQuestion(chip.question)}
            style={{
              background: chip.label.includes('log') || chip.label.includes('Summarize') ? '#f3e5f5' : '#e3f2fd',
              color: chip.label.includes('log') || chip.label.includes('Summarize') ? PURPLE : '#1565c0',
              border: `1px solid ${chip.label.includes('log') || chip.label.includes('Summarize') ? '#ce93d8' : '#bbdefb'}`,
              borderRadius: 12, padding: '3px 9px', fontSize: 11,
              cursor: 'pointer', transition: 'background .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(.95)')}
            onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
          >
            {chip.label}
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{
        padding: '6px 8px', borderTop: '1px solid #dde1e7',
        display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendQuestion(input)}
          placeholder="Ask about Jira, PCI..."
          style={{
            flex: 1, border: '1px solid #dde1e7', borderRadius: 6,
            padding: '4px 8px', fontSize: 12, fontFamily: 'inherit', outline: 'none',
          }}
          onFocus={e => (e.target.style.borderColor = BLUE)}
          onBlur={e => (e.target.style.borderColor = '#dde1e7')}
        />
        <button
          onClick={() => sendQuestion(input)}
          disabled={!input.trim() || loading}
          style={{
            padding: '4px 10px', background: input.trim() ? BLUE : '#90caf9',
            color: '#fff', border: 'none', borderRadius: 6,
            cursor: input.trim() ? 'pointer' : 'default',
            fontSize: 11, fontFamily: 'inherit',
          }}
        >▶</button>
      </div>
    </div>
  );
}
