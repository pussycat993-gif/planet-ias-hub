import { useEffect, useRef, useCallback } from 'react';
import { Device } from 'mediasoup-client';
import type { Transport, Producer, Consumer, RtpCapabilities } from 'mediasoup-client/lib/types';
import { getSocket } from './useSocket';
import { useCallStore } from '../store/callStore';

// ── Helpers ───────────────────────────────────────────────
function socketEmit<T = any>(event: string, data: object): Promise<T> {
  return new Promise((resolve, reject) => {
    const socket = getSocket();
    if (!socket) return reject(new Error('No socket'));
    socket.emit(event, data, (response: any) => {
      if (response?.success === false) reject(new Error(response.error));
      else resolve(response);
    });
  });
}

// ── Hook ──────────────────────────────────────────────────
export function useMediasoup(callId: number | null) {
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const producersRef = useRef<Map<string, Producer>>(new Map());
  const consumersRef = useRef<Map<string, Consumer>>(new Map());

  const {
    setLocalStream,
    addRemoteStream,
    removeRemoteStream,
    localStream,
  } = useCallStore();

  // ── Initialize device ────────────────────────────────────
  const initDevice = useCallback(async () => {
    if (!callId) return;

    const device = new Device();
    deviceRef.current = device;

    const { rtpCapabilities }: { rtpCapabilities: RtpCapabilities } =
      await socketEmit('ms:getRouterCapabilities', { callId });

    await device.load({ routerRtpCapabilities: rtpCapabilities });
    return device;
  }, [callId]);

  // ── Create send transport ─────────────────────────────────
  const createSendTransport = useCallback(async () => {
    if (!callId || !deviceRef.current) return;

    const { params } = await socketEmit('ms:createTransport', { callId, direction: 'send' });

    const transport = deviceRef.current.createSendTransport(params);
    sendTransportRef.current = transport;

    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await socketEmit('ms:connectTransport', { callId, transportId: transport.id, dtlsParameters });
        callback();
      } catch (err: any) { errback(err); }
    });

    transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
      try {
        const { producerId } = await socketEmit('ms:produce', {
          callId,
          transportId: transport.id,
          kind,
          rtpParameters,
          appData,
        });
        callback({ id: producerId });
      } catch (err: any) { errback(err); }
    });

    return transport;
  }, [callId]);

  // ── Create recv transport ─────────────────────────────────
  const createRecvTransport = useCallback(async () => {
    if (!callId || !deviceRef.current) return;

    const { params } = await socketEmit('ms:createTransport', { callId, direction: 'recv' });

    const transport = deviceRef.current.createRecvTransport(params);
    recvTransportRef.current = transport;

    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await socketEmit('ms:connectTransport', { callId, transportId: transport.id, dtlsParameters });
        callback();
      } catch (err: any) { errback(err); }
    });

    return transport;
  }, [callId]);

  // ── Start producing ───────────────────────────────────────
  const startProducing = useCallback(async (stream: MediaStream, callType: 'audio' | 'video') => {
    const transport = sendTransportRef.current;
    if (!transport) return;

    // Audio
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      const audioProducer = await transport.produce({ track: audioTrack });
      producersRef.current.set('audio', audioProducer);
    }

    // Video (only for video calls)
    if (callType === 'video') {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const videoProducer = await transport.produce({
          track: videoTrack,
          encodings: [
            { maxBitrate: 100_000 },
            { maxBitrate: 300_000 },
            { maxBitrate: 900_000 },
          ],
          codecOptions: { videoGoogleStartBitrate: 1000 },
        });
        producersRef.current.set('video', videoProducer);
      }
    }
  }, []);

  // ── Consume a remote producer ─────────────────────────────
  const consumeProducer = useCallback(async (producerId: string, remoteUserId: number) => {
    if (!callId || !deviceRef.current || !recvTransportRef.current) return;

    const { params } = await socketEmit('ms:consume', {
      callId,
      transportId: recvTransportRef.current.id,
      producerId,
      rtpCapabilities: deviceRef.current.rtpCapabilities,
    });

    if (!params) return;

    const consumer = await recvTransportRef.current.consume(params);
    consumersRef.current.set(consumer.id, consumer);

    // Resume consumer on server
    await socketEmit('ms:resumeConsumer', { callId, consumerId: consumer.id });

    // Add to remote streams
    const existingStream = useCallStore.getState().remoteStreams.get(remoteUserId);
    if (existingStream) {
      existingStream.addTrack(consumer.track);
    } else {
      const newStream = new MediaStream([consumer.track]);
      addRemoteStream(remoteUserId, newStream);
    }

    consumer.on('transportclose', () => {
      consumersRef.current.delete(consumer.id);
    });

    consumer.on('trackended', () => {
      consumer.close();
      consumersRef.current.delete(consumer.id);
    });
  }, [callId, addRemoteStream]);

  // ── Toggle mute ───────────────────────────────────────────
  const muteAudio = useCallback((mute: boolean) => {
    const producer = producersRef.current.get('audio');
    if (!producer) return;
    if (mute) producer.pause();
    else producer.resume();
  }, []);

  // ── Toggle camera ─────────────────────────────────────────
  const toggleVideo = useCallback((off: boolean) => {
    const producer = producersRef.current.get('video');
    if (!producer) return;
    if (off) producer.pause();
    else producer.resume();
  }, []);

  // ── Screen share ──────────────────────────────────────────
  const startScreenShare = useCallback(async () => {
    if (!sendTransportRef.current) return;
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];

      const screenProducer = await sendTransportRef.current.produce({
        track: screenTrack,
        appData: { type: 'screen' },
      });
      producersRef.current.set('screen', screenProducer);

      screenTrack.onended = () => stopScreenShare();
      return screenStream;
    } catch (err) {
      console.error('Screen share error:', err);
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    const producer = producersRef.current.get('screen');
    if (producer && callId) {
      socketEmit('ms:closeProducer', { callId, producerId: producer.id });
      producer.close();
      producersRef.current.delete('screen');
    }
  }, [callId]);

  // ── Full setup on call join ───────────────────────────────
  const joinCall = useCallback(async (callType: 'audio' | 'video') => {
    if (!callId) return;
    const socket = getSocket();
    if (!socket) return;

    try {
      // Join socket room
      socket.emit('ms:joinCallRoom', { callId });

      // Init device
      await initDevice();

      // Create transports
      await createSendTransport();
      await createRecvTransport();

      // Get local media
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: callType === 'video' ? { width: 1280, height: 720 } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);

      // Start producing
      await startProducing(stream, callType);

      // Consume existing producers
      const { producers }: { producers: { producerId: string; userId: number; kind: string }[] } =
        await socketEmit('ms:getProducers', { callId });

      for (const { producerId, userId } of producers) {
        await consumeProducer(producerId, userId);
      }

      // Listen for new producers
      socket.on('ms:newProducer', async ({ producerId, userId: remoteUserId }: { producerId: string; userId: number }) => {
        await consumeProducer(producerId, remoteUserId);
      });

      // Listen for producer closed
      socket.on('ms:producerClosed', ({ producerId }: { producerId: string }) => {
        // Find and remove the corresponding consumer
        consumersRef.current.forEach((consumer, consumerId) => {
          if (consumer.producerId === producerId) {
            consumer.close();
            consumersRef.current.delete(consumerId);
          }
        });
      });

      // Listen for peer left
      socket.on('ms:peerLeft', ({ userId: remoteUserId }: { userId: number }) => {
        removeRemoteStream(remoteUserId);
      });

    } catch (err) {
      console.error('joinCall error:', err);
      throw err;
    }
  }, [callId, initDevice, createSendTransport, createRecvTransport, startProducing, consumeProducer, setLocalStream, removeRemoteStream]);

  // ── Cleanup on leave ─────────────────────────────────────
  const leaveCall = useCallback(() => {
    if (!callId) return;
    const socket = getSocket();

    socket?.emit('ms:leaveCallRoom', { callId });
    socket?.off('ms:newProducer');
    socket?.off('ms:producerClosed');
    socket?.off('ms:peerLeft');

    producersRef.current.forEach(p => p.close());
    producersRef.current.clear();

    consumersRef.current.forEach(c => c.close());
    consumersRef.current.clear();

    sendTransportRef.current?.close();
    recvTransportRef.current?.close();
    sendTransportRef.current = null;
    recvTransportRef.current = null;
    deviceRef.current = null;

    // Stop local tracks
    const stream = useCallStore.getState().localStream;
    stream?.getTracks().forEach(t => t.stop());
    setLocalStream(null);
  }, [callId, setLocalStream]);

  // ── Cleanup on unmount ────────────────────────────────────
  useEffect(() => {
    return () => { leaveCall(); };
  }, [leaveCall]);

  return {
    joinCall,
    leaveCall,
    muteAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
  };
}
