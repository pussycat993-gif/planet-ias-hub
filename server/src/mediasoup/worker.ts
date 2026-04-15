import * as mediasoup from 'mediasoup';

let worker: mediasoup.types.Worker | null = null;

const CODEC_CAPABILITIES: mediasoup.types.RtpCodecCapability[] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {},
  },
  {
    kind: 'video',
    mimeType: 'video/H264',
    clockRate: 90000,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '42e01f',
      'level-asymmetry-allowed': 1,
    },
  },
];

export async function getWorker(): Promise<mediasoup.types.Worker> {
  if (!worker) {
    worker = await mediasoup.createWorker({
      logLevel: 'warn',
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
    });

    worker.on('died', (error) => {
      console.error('mediasoup worker died:', error);
      worker = null;
      // Restart worker after 2s
      setTimeout(() => getWorker(), 2000);
    });

    console.log('mediasoup worker started (pid=%d)', worker.pid);
  }
  return worker;
}

export async function createRouter(): Promise<mediasoup.types.Router> {
  const w = await getWorker();
  return w.createRouter({ mediaCodecs: CODEC_CAPABILITIES });
}
