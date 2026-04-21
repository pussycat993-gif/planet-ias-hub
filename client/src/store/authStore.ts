import { create } from 'zustand';
import axios from 'axios';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  user_type: 'sso' | 'standalone';
  avatar_url?: string;
  status: string;
  status_message?: string;
  status_emoji?: string | null;
  auto_status?: 'in_call' | 'in_meeting' | 'focus' | 'away_auto' | null;
  auto_status_until?: string | null;
  timezone?: string | null;
  last_seen_at?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;

  loginSSO: (token: string) => Promise<void>;
  loginStandalone: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  setStatus: (status: string) => Promise<void>;
  setStatusMessage: (message: string) => Promise<void>;
  setStatusEmoji: (emoji: string | null) => Promise<void>;
  setAutoStatus: (auto: 'in_call' | 'in_meeting' | 'focus' | 'away_auto' | null, until?: string | null) => Promise<void>;
  setTimezone: (tz: string | null) => Promise<void>;
}

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('ias_hub_token'),
  loading: false,
  error: null,

  loginSSO: async (pciToken: string) => {
    set({ loading: true, error: null });
    try {
      const { data } = await axios.post(`${API}/auth/sso`, { token: pciToken });
      localStorage.setItem('ias_hub_token', data.data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.data.token}`;
      set({ user: data.data.user, token: data.data.token, loading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'SSO login failed', loading: false });
    }
  },

  loginStandalone: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const { data } = await axios.post(`${API}/auth/login`, { email, password });
      localStorage.setItem('ias_hub_token', data.data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.data.token}`;
      set({ user: data.data.user, token: data.data.token, loading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Login failed', loading: false });
    }
  },

  logout: async () => {
    const { token } = get();
    if (token) {
      try {
        await axios.post(`${API}/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch { /* ignore */ }
    }
    localStorage.removeItem('ias_hub_token');
    delete axios.defaults.headers.common['Authorization'];
    set({ user: null, token: null });
  },

  clearError: () => set({ error: null }),

  setStatus: async (status: string) => {
    const { user, token } = get();
    if (!user || !token) return;
    try {
      await axios.patch(`${API}/users/${user.id}/status`, { status });
      set({ user: { ...user, status } });
    } catch { /* ignore */ }
  },

  setStatusMessage: async (message: string) => {
    const { user, token } = get();
    if (!user || !token) return;
    try {
      await axios.patch(`${API}/users/${user.id}/status-message`, { status_message: message });
      set({ user: { ...user, status_message: message } });
    } catch { /* ignore */ }
  },

  setStatusEmoji: async (emoji: string | null) => {
    const { user, token } = get();
    if (!user || !token) return;
    try {
      await axios.patch(`${API}/users/${user.id}/status-emoji`, { status_emoji: emoji });
      set({ user: { ...user, status_emoji: emoji } });
    } catch { /* ignore */ }
  },

  setAutoStatus: async (auto, until) => {
    const { user, token } = get();
    if (!user || !token) return;
    try {
      await axios.patch(`${API}/users/${user.id}/auto-status`, { auto_status: auto, until: until || null });
      set({ user: { ...user, auto_status: auto, auto_status_until: until || null } });
    } catch { /* ignore */ }
  },

  setTimezone: async (tz: string | null) => {
    const { user, token } = get();
    if (!user || !token) return;
    try {
      await axios.patch(`${API}/users/${user.id}/timezone`, { timezone: tz });
      set({ user: { ...user, timezone: tz } });
    } catch { /* ignore */ }
  },
}));
