import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';

let socket: Socket | null = null;

export function useSocket() {
  const { user, token } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user || !token) return;

    // Connect once
    if (!socket) {
      const setStatus = useUIStore.getState().setConnectionStatus;

      socket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001', {
        auth: { userId: user.id, token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socket.on('connect', () => {
        console.log('Socket connected:', socket?.id);
        useUIStore.getState().setConnectionStatus('connected');
      });

      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        // 'io server disconnect' means the server kicked us; everything else will auto-reconnect
        useUIStore.getState().setConnectionStatus(
          reason === 'io server disconnect' ? 'disconnected' : 'reconnecting'
        );
      });

      socket.on('connect_error', (err) => {
        console.error('Socket error:', err.message);
        useUIStore.getState().setConnectionStatus('reconnecting');
      });

      socket.io.on('reconnect_attempt', () => {
        useUIStore.getState().setConnectionStatus('reconnecting');
      });

      socket.io.on('reconnect_failed', () => {
        useUIStore.getState().setConnectionStatus('disconnected');
      });
    }

    socketRef.current = socket;

    return () => {
      // Don't disconnect on component unmount — keep socket alive
    };
  }, [user, token]);

  return socketRef.current;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    useUIStore.getState().setConnectionStatus('disconnected');
  }
}

export function retrySocketNow() {
  if (socket && !socket.connected) {
    useUIStore.getState().setConnectionStatus('reconnecting');
    socket.connect();
  }
}
