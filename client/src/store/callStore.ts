import { create } from 'zustand';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface TranscriptLine {
  speaker: string;
  text: string;
  time: string;
}

export interface PostCallInfo {
  callType: 'audio' | 'video';
  duration: number;
  participants: string[];
  transcript: TranscriptLine[];
}

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
  isRaisingHand: boolean;
  timerInterval: ReturnType<typeof setInterval> | null;
  localStream: MediaStream | null;
  remoteStreams: Map<number, MediaStream>;

  // Post-call modal — lives OUTSIDE callActive so it survives unmount
  postCallInfo: PostCallInfo | null;

  startCall: (channelId: number, type: 'audio' | 'video') => Promise<void>;
  endCall: () => Promise<void>;
  setPostCallInfo: (info: PostCallInfo) => void;
  clearPostCallInfo: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleShare: () => void;
  toggleRaiseHand: () => void;
  setLocalStream: (stream: MediaStream | null) => void;
  addRemoteStream: (userId: number, stream: MediaStream) => void;
  removeRemoteStream: (userId: number) => void;
  clearRemoteStreams: () => void;
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
  isRaisingHand: false,
  timerInterval: null,
  localStream: null,
  remoteStreams: new Map(),
  postCallInfo: null,

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
        isRaisingHand: false,
        timerInterval: interval,
        localStream: null,
        remoteStreams: new Map(),
      });

      // Auto-set presence to 'in_call' so teammates see "In a call" badge
      // on the caller's avatar until they hang up. Fire-and-forget — a
      // network hiccup here should never break the call itself.
      try {
        const authState = (await import('./authStore')).useAuthStore.getState();
        if (authState.user) {
          await authState.setAutoStatus('in_call', null);
        }
      } catch { /* ignore */ }
    } catch (err) {
      console.error('startCall error:', err);
    }
  },

  endCall: async () => {
    const { callId, timerInterval, localStream } = get();
    if (timerInterval) clearInterval(timerInterval);
    localStream?.getTracks().forEach(t => t.stop());
    try {
      if (callId) await axios.post(`${API}/calls/${callId}/end`);
    } catch { /* ignore */ }

    // Clear the 'in_call' auto-status. If the user has Focus mode active,
    // callStore shouldn't touch it — Focus is set by SetStatusModal only,
    // so we check before clearing.
    try {
      const authModule = await import('./authStore');
      const authState = authModule.useAuthStore.getState();
      if (authState.user?.auto_status === 'in_call') {
        await authState.setAutoStatus(null, null);
      }
    } catch { /* ignore */ }

    set({
      active: false,
      callId: null,
      callType: null,
      timerInterval: null,
      localStream: null,
      remoteStreams: new Map(),
      elapsedSeconds: 0,
    });
  },

  setPostCallInfo: (info) => set({ postCallInfo: info }),
  clearPostCallInfo: () => set({ postCallInfo: null }),

  toggleMute: () => set(s => ({ isMuted: !s.isMuted })),
  toggleCamera: () => set(s => ({ isCameraOff: !s.isCameraOff })),
  toggleShare: () => set(s => ({ isSharing: !s.isSharing })),
  toggleRaiseHand: () => set(s => ({ isRaisingHand: !s.isRaisingHand })),
  setLocalStream: (stream) => set({ localStream: stream }),
  addRemoteStream: (userId, stream) => {
    set(s => { const m = new Map(s.remoteStreams); m.set(userId, stream); return { remoteStreams: m }; });
  },
  removeRemoteStream: (userId) => {
    set(s => { const m = new Map(s.remoteStreams); m.delete(userId); return { remoteStreams: m }; });
  },
  clearRemoteStreams: () => set({ remoteStreams: new Map() }),
}));
