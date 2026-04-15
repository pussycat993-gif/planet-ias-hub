import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const WHISPER_URL = process.env.WHISPER_API_URL || 'http://localhost:9000';

export interface TranscriptLine {
  speaker: string;
  timestamp: string;
  text: string;
}

export interface TranscriptionResult {
  transcript: string;
  lines: TranscriptLine[];
  language: string;
  duration: number;
}

export interface AISummaryResult {
  topic: string;
  key_points: string[];
  action_items: string[];
  full_summary: string;
}

// ── Transcribe audio file via Whisper ─────────────────────
export async function transcribeAudio(
  audioFilePath: string,
  participants: string[] = []
): Promise<TranscriptionResult> {
  const form = new FormData();
  form.append('audio_file', fs.createReadStream(audioFilePath));
  form.append('task', 'transcribe');
  form.append('language', 'en');
  form.append('output', 'json');

  const { data } = await axios.post(`${WHISPER_URL}/asr`, form, {
    headers: form.getHeaders(),
    timeout: 120000, // 2 min max for transcription
  });

  // Parse Whisper output into structured lines
  const lines = parseWhisperOutput(data, participants);
  const transcript = lines.map(l => `${l.speaker} [${l.timestamp}]\n${l.text}`).join('\n\n');

  return {
    transcript,
    lines,
    language: data.language || 'en',
    duration: data.duration || 0,
  };
}

// ── Transcribe from in-memory buffer (no temp file) ───────
export async function transcribeBuffer(
  audioBuffer: Buffer,
  filename: string,
  participants: string[] = []
): Promise<TranscriptionResult> {
  const form = new FormData();
  form.append('audio_file', audioBuffer, { filename, contentType: 'audio/webm' });
  form.append('task', 'transcribe');
  form.append('language', 'en');
  form.append('output', 'json');

  const { data } = await axios.post(`${WHISPER_URL}/asr`, form, {
    headers: form.getHeaders(),
    timeout: 120000,
  });

  const lines = parseWhisperOutput(data, participants);
  const transcript = lines.map(l => `${l.speaker} [${l.timestamp}]\n${l.text}`).join('\n\n');

  return { transcript, lines, language: data.language || 'en', duration: data.duration || 0 };
}

// ── Generate AI summary from transcript ───────────────────
export async function generateSummary(
  transcript: string,
  participants: string[]
): Promise<AISummaryResult> {
  // Simple rule-based summary — replace with LLM call if configured
  const lines = transcript.split('\n').filter(l => l.trim());
  const words = transcript.toLowerCase();

  // Extract Jira tickets mentioned
  const jiraTickets = [...new Set([...transcript.matchAll(/\b(IAS-\d+)\b/gi)].map(m => m[1].toUpperCase()))];

  // Extract action items (simple heuristic)
  const actionItems: string[] = [];
  const actionPatterns = [
    /(\w[\w\s]+)\s+(?:will|to|should|needs to)\s+(.+?)(?:\.|$)/gi,
    /action[:\s]+(.+?)(?:\.|$)/gi,
    /follow.?up[:\s]+(.+?)(?:\.|$)/gi,
  ];
  for (const pattern of actionPatterns) {
    const matches = [...transcript.matchAll(pattern)];
    matches.forEach(m => {
      const item = m[0].trim();
      if (item.length > 10 && item.length < 200 && !actionItems.includes(item)) {
        actionItems.push(item);
      }
    });
  }

  // Key points from first sentences of each speaker turn
  const keyPoints = lines
    .filter(l => !l.includes('[') && l.length > 20)
    .slice(0, 6)
    .map(l => l.trim());

  // Topic from first line / Jira tickets
  const topic = jiraTickets.length > 0
    ? `Discussion — ${jiraTickets.slice(0, 3).join(', ')}`
    : participants.length > 0
      ? `Call with ${participants.join(', ')}`
      : 'Meeting discussion';

  const fullSummary = [
    `**Topic:** ${topic}`,
    `**Participants:** ${participants.join(', ') || 'Unknown'}`,
    keyPoints.length > 0 ? `**Key points:** ${keyPoints.slice(0, 3).join('; ')}` : '',
    actionItems.length > 0 ? `**Action items:** ${actionItems.slice(0, 3).join('; ')}` : '',
    jiraTickets.length > 0 ? `**Jira tickets mentioned:** ${jiraTickets.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  return {
    topic,
    key_points: keyPoints.slice(0, 5),
    action_items: actionItems.slice(0, 5),
    full_summary: fullSummary,
  };
}

// ── Health check ──────────────────────────────────────────
export async function isWhisperAvailable(): Promise<boolean> {
  try {
    await axios.get(`${WHISPER_URL}/`, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

// ── Helpers ───────────────────────────────────────────────
function parseWhisperOutput(data: any, participants: string[]): TranscriptLine[] {
  const lines: TranscriptLine[] = [];

  // Whisper returns segments array
  const segments: any[] = data.segments || [];

  segments.forEach((seg: any, i: number) => {
    // Alternate speakers if no diarization
    const speakerIndex = i % Math.max(participants.length, 2);
    const speaker = participants[speakerIndex] || `Speaker ${speakerIndex + 1}`;
    const timestamp = formatTimestamp(seg.start || 0);

    lines.push({
      speaker,
      timestamp,
      text: (seg.text || '').trim(),
    });
  });

  // Fallback if no segments
  if (lines.length === 0 && data.text) {
    lines.push({
      speaker: participants[0] || 'Speaker 1',
      timestamp: '00:00',
      text: data.text.trim(),
    });
  }

  return lines;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
