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
  isRaisingHand: boolean;
  timerInterval: ReturnType<typeof setInterval> | null;

  // WebRTC streams
  localStream: MediaStream | null;
  remoteStreams: Map<number, MediaStream>; // userId → stream

  startCall: (channelId: number, type: 'audio' | 'video') => Promise<void>;
  endCall: () => Promise<{ callId: number; startedAt: Date } | null>;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleShare: () => void;
  toggleRaiseHand: () => void;

  // Stream management
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
    } catch (err) {
      console.error('startCall error:', err);
    }
  },

  endCall: async () => {
    const { callId, startedAt, timerInterval, localStream } = get();
    if (!callId) return null;

    if (timerInterval) clearInterval(timerInterval);

    // Stop local media tracks
    localStream?.getTracks().forEach(t => t.stop());

    try {
      await axios.post(`${API}/calls/${callId}/end`);
    } catch { /* ignore */ }

    const result = { callId, startedAt: startedAt! };

    set({
      active: false,
      timerInterval: null,
      localStream: null,
      remoteStreams: new Map(),
      elapsedSeconds: 0,
    });

    return result;
  },

  toggleMute: () => set(s => ({ isMuted: !s.isMuted })),
  toggleCamera: () => set(s => ({ isCameraOff: !s.isCameraOff })),
  toggleShare: () => set(s => ({ isSharing: !s.isSharing })),
  toggleRaiseHand: () => set(s => ({ isRaisingHand: !s.isRaisingHand })),

  setLocalStream: (stream) => set({ localStream: stream }),

  addRemoteStream: (userId, stream) => {
    set(s => {
      const updated = new Map(s.remoteStreams);
      updated.set(userId, stream);
      return { remoteStreams: updated };
    });
  },

  removeRemoteStream: (userId) => {
    set(s => {
      const updated = new Map(s.remoteStreams);
      updated.delete(userId);
      return { remoteStreams: updated };
    });
  },

  clearRemoteStreams: () => set({ remoteStreams: new Map() }),
}));
