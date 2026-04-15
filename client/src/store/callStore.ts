import { create } from 'zustand';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface CallState {
  active: boolean;
  callId: number | null;
  callType: 'audio' | 'video' | null;
  channelId: number | null;
  startedAt: Date | null;
  elapsedSeconds: number;
  isMuted: boolean;
  isCameraOff: boolean;
  isSharing: boolean;
  timerInterval: ReturnType<typeof setInterval> | null;

  startCall: (channelId: number, type: 'audio' | 'video') => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleShare: () => void;
}

export const useCallStore = create<CallState>((set, get) => ({
  active: false,
  callId: null,
  callType: null,
  channelId: null,
  startedAt: null,
  elapsedSeconds: 0,
  isMuted: false,
  isCameraOff: false,
  isSharing: false,
  timerInterval: null,

  startCall: async (channelId: number, type: 'audio' | 'video') => {
    if (get().active) return;
    try {
      const { data } = await axios.post(`${API}/calls/start`, {
        channel_id: channelId,
        call_type: type,
      });
      const interval = setInterval(() => {
        set(s => ({ elapsedSeconds: s.elapsedSeconds + 1 }));
      }, 1000);
      set({
        active: true,
        callId: data.data.call_id,
        callType: type,
        channelId,
        startedAt: new Date(),
        elapsedSeconds: 0,
        isMuted: false,
        isCameraOff: false,
        isSharing: false,
        timerInterval: interval,
      });
    } catch (err) {
      console.error('startCall error:', err);
    }
  },

  endCall: async () => {
    const { callId, timerInterval } = get();
    if (!callId) return;
    if (timerInterval) clearInterval(timerInterval);
    try {
      await axios.post(`${API}/calls/${callId}/end`);
    } catch { /* ignore */ }
    // Open end call modal via uiStore
    const { useUIStore } = await import('./uiStore');
    useUIStore.getState().openModal('endCall');
    set({
      active: false,
      timerInterval: null,
    });
  },

  toggleMute: () => set(s => ({ isMuted: !s.isMuted })),
  toggleCamera: () => set(s => ({ isCameraOff: !s.isCameraOff })),
  toggleShare: () => set(s => ({ isSharing: !s.isSharing })),
}));
