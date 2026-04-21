import { create } from 'zustand';
import axios from 'axios';
import { getSocket } from '../hooks/useSocket';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface Message {
  id: number;
  channel_id: number;
  sender: { id: number; name: string; avatar_url?: string; status?: string } | null;
  body: string | null;
  message_type: string;
  pinned: boolean;
  edited: boolean;
  reply_to_id: number | null;
  automation_payload?: any;
  file?: {
    id: number;
    name: string;
    size: number;
    mime_type: string;
    basename: string;  // file on disk, served at /uploads/<basename>
  } | null;
  reactions: Array<{ emoji: string; user_id: number }>;
  thread_count?: number;
  thread_last_reply_at?: string | null;
  thread_participants?: Array<{ id: number; name: string; avatar_url: string | null }>;
  created_at: string;
  deleted_at: string | null;
}

export interface Channel {
  id: number;
  name: string;
  type: 'public' | 'private' | 'group' | 'dm';
  description?: string;
  logo_color?: string;
  logo_abbr?: string;
  logo_url?: string;
  unread_count?: number;
  member_count?: number;
  other_user?: { id: number; name: string; status: string; avatar_url?: string; role?: string; email?: string };
}

interface ChatState {
  channels: { public: Channel[]; private: Channel[]; groups: Channel[]; dms: Channel[] };
  activeChannelId: number | null;
  activeChannel: Channel | null;
  messages: Message[];
  loadingMessages: boolean;
  hasMoreMessages: boolean;
  typingUsers: Record<number, boolean>;

  fetchChannels: () => Promise<void>;
  selectChannel: (channelId: number) => Promise<void>;
  fetchMessages: (channelId: number, before?: string) => Promise<void>;
  sendMessage: (body: string, replyToId?: number) => void;
  receiveMessage: (message: Message) => void;
  incrementThreadCount: (parentId: number, lastReplyAt?: string) => void;
  setTyping: (userId: number, typing: boolean) => void;
  createChannel: (name: string, type: string, memberIds?: number[]) => Promise<Channel>;
  markRead: (channelId: number) => Promise<void>;
  editMessage: (id: number, body: string) => Promise<void>;
  deleteMessage: (id: number) => Promise<void>;
  togglePinMessage: (id: number, pinned: boolean) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  channels: { public: [], private: [], groups: [], dms: [] },
  activeChannelId: null,
  activeChannel: null,
  messages: [],
  loadingMessages: false,
  hasMoreMessages: false,
  typingUsers: {},

  fetchChannels: async () => {
    try {
      const { data } = await axios.get(`${API}/channels`);
      set({ channels: data.data });
    } catch (err) {
      console.error('fetchChannels error:', err);
    }
  },

  selectChannel: async (channelId: number) => {
    const { channels } = get();
    const all = [...channels.public, ...channels.private, ...channels.groups, ...channels.dms];
    const ch = all.find(c => c.id === channelId) || null;
    set({ activeChannelId: channelId, activeChannel: ch, messages: [], hasMoreMessages: false });
    const socket = getSocket();
    socket?.emit('channel:join', String(channelId));
    await get().fetchMessages(channelId);
    await get().markRead(channelId);
  },

  fetchMessages: async (channelId: number, before?: string) => {
    set({ loadingMessages: true });
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (before) params.append('before', before);
      const { data } = await axios.get(`${API}/messages/${channelId}/messages?${params}`);
      const { messages } = get();
      const newMessages = before ? [...data.data.messages, ...messages] : data.data.messages;
      set({ messages: newMessages, hasMoreMessages: data.data.has_more, loadingMessages: false });
    } catch (err) {
      console.error('fetchMessages error:', err);
      set({ loadingMessages: false });
    }
  },

  sendMessage: (body: string, replyToId?: number) => {
    const { activeChannelId } = get();
    if (!activeChannelId || !body.trim()) return;
    const socket = getSocket();
    socket?.emit('message:send', { channelId: String(activeChannelId), body: body.trim(), replyToId });
  },

  receiveMessage: (message: Message) => {
    const { activeChannelId, messages } = get();

    // Threaded replies do not appear in the main timeline — they live inside
    // the thread panel. Only update the thread counter on the parent.
    if (message.reply_to_id) {
      if (message.channel_id === activeChannelId) {
        get().incrementThreadCount(message.reply_to_id, message.created_at);
      }
      return;
    }

    if (message.channel_id === activeChannelId) {
      set({ messages: [...messages, message] });
    }
    const { channels } = get();
    const updateUnread = (list: Channel[]) =>
      list.map(c => c.id === message.channel_id && c.id !== activeChannelId
        ? { ...c, unread_count: (c.unread_count || 0) + 1 } : c);
    set({ channels: { public: updateUnread(channels.public), private: updateUnread(channels.private), groups: updateUnread(channels.groups), dms: updateUnread(channels.dms) } });
  },

  incrementThreadCount: (parentId: number, lastReplyAt?: string) => {
    const { messages } = get();
    set({
      messages: messages.map(m => m.id === parentId ? {
        ...m,
        thread_count: (m.thread_count || 0) + 1,
        thread_last_reply_at: lastReplyAt || new Date().toISOString(),
      } : m),
    });
  },

  setTyping: (userId: number, typing: boolean) => {
    set(state => ({ typingUsers: { ...state.typingUsers, [userId]: typing } }));
  },

  createChannel: async (name: string, type: string, memberIds: number[] = []) => {
    const { data } = await axios.post(`${API}/channels`, { name, type, member_ids: memberIds });
    await get().fetchChannels();
    return data.data;
  },

  markRead: async (channelId: number) => {
    try {
      await axios.post(`${API}/channels/${channelId}/read`);
      const { channels } = get();
      const clearUnread = (list: Channel[]) => list.map(c => c.id === channelId ? { ...c, unread_count: 0 } : c);
      set({ channels: { public: clearUnread(channels.public), private: clearUnread(channels.private), groups: clearUnread(channels.groups), dms: clearUnread(channels.dms) } });
    } catch { /* ignore */ }
  },

  editMessage: async (id: number, body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    // Optimistic update
    const { messages } = get();
    const prev = messages.find(m => m.id === id);
    set({ messages: messages.map(m => m.id === id ? { ...m, body: trimmed, edited: true } : m) });
    try {
      await axios.patch(`${API}/messages/${id}`, { body: trimmed });
    } catch (err) {
      // Roll back on failure
      if (prev) set({ messages: get().messages.map(m => m.id === id ? prev : m) });
      console.error('editMessage error:', err);
    }
  },

  deleteMessage: async (id: number) => {
    // Optimistic soft-delete
    const { messages } = get();
    const prev = messages.find(m => m.id === id);
    set({ messages: messages.map(m => m.id === id ? { ...m, body: null, deleted_at: new Date().toISOString() } : m) });
    try {
      await axios.delete(`${API}/messages/${id}`);
    } catch (err) {
      if (prev) set({ messages: get().messages.map(m => m.id === id ? prev : m) });
      console.error('deleteMessage error:', err);
    }
  },

  togglePinMessage: async (id: number, pinned: boolean) => {
    // Optimistic toggle
    const { messages } = get();
    set({ messages: messages.map(m => m.id === id ? { ...m, pinned } : m) });
    try {
      await axios.patch(`${API}/messages/${id}/pin`, { pinned });
    } catch (err) {
      set({ messages: get().messages.map(m => m.id === id ? { ...m, pinned: !pinned } : m) });
      console.error('togglePinMessage error:', err);
    }
  },
}));
