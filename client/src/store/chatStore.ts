import { create } from 'zustand';
import axios from 'axios';
import { getSocket } from '../hooks/useSocket';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface Message {
  id: number;
  channel_id: number;
  sender: { id: number; name: string; avatar_url?: string } | null;
  body: string | null;
  message_type: string;
  pinned: boolean;
  edited: boolean;
  reply_to_id: number | null;
  automation_payload?: any;
  reactions: Array<{ emoji: string; user_id: number }>;
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
  other_user?: { id: number; name: string; status: string; avatar_url?: string };
}

interface ChatState {
  channels: { public: Channel[]; private: Channel[]; groups: Channel[]; dms: Channel[] };
  activeChannelId: number | null;
  activeChannel: Channel | null;
  messages: Message[];
  loadingMessages: boolean;
  hasMoreMessages: boolean;
  typingUsers: Record<number, boolean>; // userId → typing

  fetchChannels: () => Promise<void>;
  selectChannel: (channelId: number) => Promise<void>;
  fetchMessages: (channelId: number, before?: string) => Promise<void>;
  sendMessage: (body: string, replyToId?: number) => void;
  receiveMessage: (message: Message) => void;
  setTyping: (userId: number, typing: boolean) => void;
  createChannel: (name: string, type: string, memberIds?: number[]) => Promise<Channel>;
  markRead: (channelId: number) => Promise<void>;
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

    // Join socket room
    const socket = getSocket();
    socket?.emit('channel:join', String(channelId));

    // Fetch messages
    await get().fetchMessages(channelId);

    // Mark as read
    await get().markRead(channelId);
  },

  fetchMessages: async (channelId: number, before?: string) => {
    set({ loadingMessages: true });
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (before) params.append('before', before);
      const { data } = await axios.get(`${API}/channels/${channelId}/messages?${params}`);
      const { messages } = get();
      const newMessages = before ? [...data.data.messages, ...messages] : data.data.messages;
      set({ messages: newMessages, hasMoreMessages: data.data.has_more, loadingMessages: false });
    } catch (err) {
      set({ loadingMessages: false });
    }
  },

  sendMessage: (body: string, replyToId?: number) => {
    const { activeChannelId } = get();
    if (!activeChannelId || !body.trim()) return;
    const socket = getSocket();
    socket?.emit('message:send', {
      channelId: String(activeChannelId),
      body: body.trim(),
      replyToId,
    });
  },

  receiveMessage: (message: Message) => {
    const { activeChannelId, messages } = get();
    if (message.channel_id === activeChannelId) {
      set({ messages: [...messages, message] });
    }
    // Update unread count for other channels
    const { channels } = get();
    const updateUnread = (list: Channel[]) =>
      list.map(c => c.id === message.channel_id && c.id !== activeChannelId
        ? { ...c, unread_count: (c.unread_count || 0) + 1 }
        : c
      );
    set({
      channels: {
        public: updateUnread(channels.public),
        private: updateUnread(channels.private),
        groups: updateUnread(channels.groups),
        dms: updateUnread(channels.dms),
      },
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
      const clearUnread = (list: Channel[]) =>
        list.map(c => c.id === channelId ? { ...c, unread_count: 0 } : c);
      set({
        channels: {
          public: clearUnread(channels.public),
          private: clearUnread(channels.private),
          groups: clearUnread(channels.groups),
          dms: clearUnread(channels.dms),
        },
      });
    } catch { /* ignore */ }
  },
}));
