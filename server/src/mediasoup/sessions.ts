import * as mediasoup from 'mediasoup';
import { createRouter } from './worker';

// ── Session ───────────────────────────────────────────────
interface Transport {
  transport: mediasoup.types.WebRtcTransport;
  userId: number;
  direction: 'send' | 'recv';
}

interface Producer {
  producer: mediasoup.types.Producer;
  userId: number;
  kind: 'audio' | 'video';
}

interface Consumer {
  consumer: mediasoup.types.Consumer;
  userId: number;
  producerId: string;
}

interface CallSession {
  router: mediasoup.types.Router;
  transports: Map<string, Transport>;   // transportId → Transport
  producers: Map<string, Producer>;     // producerId  → Producer
  consumers: Map<string, Consumer>;     // consumerId  → Consumer
  userIds: Set<number>;
}

// callId → session
const sessions = new Map<number, CallSession>();

// ── Get or create session ─────────────────────────────────
export async function getOrCreateSession(callId: number): Promise<CallSession> {
  if (!sessions.has(callId)) {
    const router = await createRouter();
    sessions.set(callId, {
      router,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
      userIds: new Set(),
    });
    console.log(`mediasoup session created for call ${callId}`);
  }
  return sessions.get(callId)!;
}

export function getSession(callId: number): CallSession | undefined {
  return sessions.get(callId);
}

// ── Transport helpers ─────────────────────────────────────
const LISTEN_IP = process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0';
const ANNOUNCED_IP = process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1';

export async function createWebRtcTransport(
  callId: number,
  userId: number,
  direction: 'send' | 'recv'
): Promise<{ id: string; iceParameters: any; iceCandidates: any; dtlsParameters: any }> {
  const session = await getOrCreateSession(callId);
  session.userIds.add(userId);

  const transport = await session.router.createWebRtcTransport({
    listenIps: [{ ip: LISTEN_IP, announcedIp: ANNOUNCED_IP }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1_000_000,
  });

  session.transports.set(transport.id, { transport, userId, direction });

  transport.on('dtlsstatechange', (state) => {
    if (state === 'closed') {
      session.transports.delete(transport.id);
    }
  });

  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  };
}

export async function connectTransport(
  callId: number,
  transportId: string,
  dtlsParameters: mediasoup.types.DtlsParameters
): Promise<void> {
  const session = getSession(callId);
  if (!session) throw new Error(`No session for call ${callId}`);
  const entry = session.transports.get(transportId);
  if (!entry) throw new Error(`Transport ${transportId} not found`);
  await entry.transport.connect({ dtlsParameters });
}

// ── Producer helpers ──────────────────────────────────────
export async function createProducer(
  callId: number,
  userId: number,
  transportId: string,
  kind: 'audio' | 'video',
  rtpParameters: mediasoup.types.RtpParameters,
  appData: Record<string, unknown> = {}
): Promise<string> {
  const session = getSession(callId);
  if (!session) throw new Error(`No session for call ${callId}`);
  const entry = session.transports.get(transportId);
  if (!entry) throw new Error(`Transport ${transportId} not found`);

  const producer = await entry.transport.produce({ kind, rtpParameters, appData });
  session.producers.set(producer.id, { producer, userId, kind });

  producer.on('transportclose', () => {
    session.producers.delete(producer.id);
  });

  return producer.id;
}

export function closeProducer(callId: number, producerId: string): void {
  const session = getSession(callId);
  if (!session) return;
  const entry = session.producers.get(producerId);
  if (entry) {
    entry.producer.close();
    session.producers.delete(producerId);
  }
}

// ── Consumer helpers ──────────────────────────────────────
export async function createConsumer(
  callId: number,
  userId: number,
  transportId: string,
  producerId: string,
  rtpCapabilities: mediasoup.types.RtpCapabilities
): Promise<{ id: string; kind: string; rtpParameters: any; producerId: string } | null> {
  const session = getSession(callId);
  if (!session) throw new Error(`No session for call ${callId}`);

  if (!session.router.canConsume({ producerId, rtpCapabilities })) {
    console.warn(`Cannot consume producer ${producerId} for user ${userId}`);
    return null;
  }

  const entry = session.transports.get(transportId);
  if (!entry) throw new Error(`Transport ${transportId} not found`);

  const consumer = await entry.transport.consume({
    producerId,
    rtpCapabilities,
    paused: true, // start paused, resume after connecting
  });

  session.consumers.set(consumer.id, { consumer, userId, producerId });

  consumer.on('transportclose', () => session.consumers.delete(consumer.id));
  consumer.on('producerclose', () => session.consumers.delete(consumer.id));

  return {
    id: consumer.id,
    kind: consumer.kind,
    rtpParameters: consumer.rtpParameters,
    producerId,
  };
}

export async function resumeConsumer(callId: number, consumerId: string): Promise<void> {
  const session = getSession(callId);
  if (!session) return;
  const entry = session.consumers.get(consumerId);
  if (entry) await entry.consumer.resume();
}

// ── Session cleanup ───────────────────────────────────────
export function closeSession(callId: number): void {
  const session = sessions.get(callId);
  if (!session) return;
  session.consumers.forEach(({ consumer }) => consumer.close());
  session.producers.forEach(({ producer }) => producer.close());
  session.transports.forEach(({ transport }) => transport.close());
  session.router.close();
  sessions.delete(callId);
  console.log(`mediasoup session closed for call ${callId}`);
}

// ── Getters ───────────────────────────────────────────────
export function getRouterCapabilities(callId: number): mediasoup.types.RtpCapabilities | null {
  const session = sessions.get(callId);
  return session ? session.router.rtpCapabilities : null;
}

export function getProducersForCall(callId: number, excludeUserId?: number): { producerId: string; userId: number; kind: string }[] {
  const session = sessions.get(callId);
  if (!session) return [];
  const result: { producerId: string; userId: number; kind: string }[] = [];
  session.producers.forEach(({ producer, userId, kind }, producerId) => {
    if (userId !== excludeUserId) {
      result.push({ producerId, userId, kind });
    }
  });
  return result;
}
