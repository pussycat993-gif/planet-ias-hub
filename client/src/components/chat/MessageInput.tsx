import React, { useState, useRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useUIStore } from '../../store/uiStore';
import { getSocket } from '../../hooks/useSocket';
import { useAuthStore } from '../../store/authStore';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function MessageInput() {
  const [text, setText] = useState('');
  const [logEnabled, setLogEnabled] = useState(false);
  const { activeChannelId, sendMessage } = useChatStore();
  const { openModal } = useUIStore();
  const { user } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage(text);
    setText('');
    stopTyping();
  };

  const handleInput = (val: string) => {
    setText(val);
    const socket = getSocket();
    if (!activeChannelId) return;
    socket?.emit('typing:start', String(activeChannelId));
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(stopTyping, 2000);
  };

  const stopTyping = () => {
    const socket = getSocket();
    if (activeChannelId) socket?.emit('typing:stop', String(activeChannelId));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChannelId) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      await axios.post(`${API}/channels/${activeChannelId}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch (err) {
      console.error('Upload error:', err);
    }
  };

  return (
    <div style={{
      padding: '7px 12px', borderTop: '1px solid #dde1e7',
      background: '#fff', display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0,
    }}>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        border: '1px solid #dde1e7', borderRadius: 8,
        padding: '4px 8px', gap: 6, background: '#f0f2f5',
      }}>
        <span
          style={{ cursor: 'pointer', color: '#888', fontSize: 15 }}
          onClick={() => fileRef.current?.click()}
          title="Attach file"
        >📎</span>
        <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFileUpload} />
        <span style={{ cursor: 'pointer', color: '#888', fontSize: 15 }} title="Emoji">😊</span>
        <input
          type="text"
          value={text}
          onChange={e => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={activeChannelId ? 'Message — type @ to mention...' : 'Select a channel first'}
          disabled={!activeChannelId}
          style={{
            flex: 1, border: 'none', background: 'transparent',
            outline: 'none', fontSize: 13, color: '#1a1a2e', fontFamily: 'inherit',
          }}
        />
        <span
          style={{ cursor: 'pointer', color: '#888', fontSize: 13 }}
          onClick={() => setText(t => t + '@')}
          title="Mention"
        >@</span>
      </div>

      {/* PCI log toggle */}
      <button
        onClick={() => setLogEnabled(l => !l)}
        title="Log conversation to PCI"
        style={{
          display: 'flex', alignItems: 'center', gap: 4, fontSize: 10,
          color: logEnabled ? '#1976d2' : '#888',
          cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
          border: `1px solid ${logEnabled ? '#90caf9' : '#dde1e7'}`,
          background: logEnabled ? '#e3f2fd' : '#fff', fontFamily: 'inherit',
        }}
      >
        🔗 Log
      </button>

      <button
        onClick={handleSend}
        disabled={!text.trim() || !activeChannelId}
        style={{
          padding: '6px 16px', background: text.trim() ? '#1976d2' : '#90caf9',
          color: '#fff', border: 'none', borderRadius: 8,
          cursor: text.trim() ? 'pointer' : 'not-allowed',
          fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
        }}
      >
        Send
      </button>
    </div>
  );
}
