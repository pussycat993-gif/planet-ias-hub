import { Server, Socket } from 'socket.io';
import {
  getOrCreateSession,
  createWebRtcTransport,
  connectTransport,
  createProducer,
  closeProducer,
  createConsumer,
  resumeConsumer,
  closeSession,
  getRouterCapabilities,
  getProducersForCall,
} from './sessions';

export function registerMediasoupHandlers(io: Server, socket: Socket, userId: number) {

  // ── 1. Get router capabilities ────────────────────────────
  // Client calls this first to load the mediasoup Device
  socket.on('ms:getRouterCapabilities', async ({ callId }: { callId: number }, callback) => {
    try {
      await getOrCreateSession(callId); // ensure session exists
      const caps = getRouterCapabilities(callId);
      callback({ success: true, rtpCapabilities: caps });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── 2. Create WebRTC transport ────────────────────────────
  socket.on('ms:createTransport', async (
    { callId, direction }: { callId: number; direction: 'send' | 'recv' },
    callback
  ) => {
    try {
      const params = await createWebRtcTransport(callId, userId, direction);
      callback({ success: true, params });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── 3. Connect transport ──────────────────────────────────
  socket.on('ms:connectTransport', async (
    { callId, transportId, dtlsParameters }: { callId: number; transportId: string; dtlsParameters: any },
    callback
  ) => {
    try {
      await connectTransport(callId, transportId, dtlsParameters);
      callback({ success: true });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── 4. Produce ────────────────────────────────────────────
  // Client starts sending audio/video
  socket.on('ms:produce', async (
    { callId, transportId, kind, rtpParameters, appData }: {
      callId: number;
      transportId: string;
      kind: 'audio' | 'video';
      rtpParameters: any;
      appData?: Record<string, unknown>;
    },
    callback
  ) => {
    try {
      const producerId = await createProducer(callId, userId, transportId, kind, rtpParameters, appData);

      // Notify other participants
      socket.to(`call:${callId}`).emit('ms:newProducer', {
        producerId,
        userId,
        kind,
      });

      callback({ success: true, producerId });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── 5. Get existing producers ─────────────────────────────
  // Called after joining to know who's already producing
  socket.on('ms:getProducers', ({ callId }: { callId: number }, callback) => {
    try {
      const producers = getProducersForCall(callId, userId);
      callback({ success: true, producers });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── 6. Consume ────────────────────────────────────────────
  // Client wants to receive a remote producer
  socket.on('ms:consume', async (
    { callId, transportId, producerId, rtpCapabilities }: {
      callId: number;
      transportId: string;
      producerId: string;
      rtpCapabilities: any;
    },
    callback
  ) => {
    try {
      const params = await createConsumer(callId, userId, transportId, producerId, rtpCapabilities);
      if (!params) {
        return callback({ success: false, error: 'Cannot consume this producer' });
      }
      callback({ success: true, params });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── 7. Resume consumer ────────────────────────────────────
  socket.on('ms:resumeConsumer', async (
    { callId, consumerId }: { callId: number; consumerId: string },
    callback
  ) => {
    try {
      await resumeConsumer(callId, consumerId);
      callback({ success: true });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── 8. Close producer ─────────────────────────────────────
  socket.on('ms:closeProducer', ({ callId, producerId }: { callId: number; producerId: string }) => {
    closeProducer(callId, producerId);
    socket.to(`call:${callId}`).emit('ms:producerClosed', { producerId, userId });
  });

  // ── 9. Join call room ─────────────────────────────────────
  socket.on('ms:joinCallRoom', ({ callId }: { callId: number }) => {
    socket.join(`call:${callId}`);
    // Notify others
    socket.to(`call:${callId}`).emit('ms:peerJoined', { userId });
  });

  // ── 10. Leave call room ───────────────────────────────────
  socket.on('ms:leaveCallRoom', ({ callId }: { callId: number }) => {
    socket.leave(`call:${callId}`);
    socket.to(`call:${callId}`).emit('ms:peerLeft', { userId });
  });

  // ── 11. Raise hand ────────────────────────────────────────
  socket.on('ms:raiseHand', ({ callId, raised }: { callId: number; raised: boolean }) => {
    io.to(`call:${callId}`).emit('ms:handRaised', { userId, raised });
  });

  // ── 12. Close session on call end ─────────────────────────
  socket.on('call:end', (channelId: string) => {
    // Find active calls for this channel and clean up
    // (callId lookup from channelId would require DB query;
    //  for now we rely on explicit ms:leaveCallRoom from each client)
  });
}
