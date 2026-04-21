import { Router, Request, Response } from 'express';
import pool from '../db/auth';

const router = Router();

// ── Mock transcription for demo ──────────────────────────
// In production this would call Whisper API (OpenAI) or Anthropic/local
// Whisper server. For the Hub demo we return sensible-looking mock text
// that reflects the file name and type.
const MOCK_TRANSCRIPTS = {
  short: [
    "Hey, just wanted to quickly follow up on the document you sent yesterday.",
    "Yeah, it looks good. Let me review the details and get back to you.",
    "Perfect, take your time. I'll be here.",
  ],
  medium: [
    "So about the Q3 architecture review — I think we need to loop in Staša and Dean before the client demo.",
    "The DWM module is nearly ready but there are two open questions about the workflow execution engine.",
    "First, how do we handle parallel step execution when there's a join policy. And second, what happens if a step times out — do we retry or escalate?",
    "I'd say for now we keep it simple: retry once after five minutes, then escalate to the workflow owner.",
    "Agreed. Let's document this and I'll update the Jira tasks tomorrow.",
  ],
  long: [
    "OK team, let's kick off this sprint review. We have a lot to cover today so I'll try to keep each section short.",
    "First up — the IAS Hub rollout. We're at eighty percent completion for the core chat features.",
    "Voice notes and video calls are working. File uploads with inline playback are in testing.",
    "The big outstanding item is the automation engine integration with the workflow module.",
    "Staša, can you walk us through where you are with IAS-488?",
    "Sure. The workflow detail refactor is deployed to staging. I'm waiting on QA sign-off from Fedor.",
    "Once that's done we can move on to the step execution engine which is the bigger piece.",
    "Dean has already started on the document parser improvements which will help with the PDF workflow trigger.",
    "Peđa is going to demo the OCR results for scanned invoices in next week's session.",
    "Finally — the dashboard redesign. Mockup is approved, implementation kicks off Monday.",
    "Any questions? No? Great. Let's wrap this up and tackle the sprint backlog.",
  ],
};

function pickMockTranscript(size: number): string {
  if (size < 100_000) return MOCK_TRANSCRIPTS.short.join(' ');
  if (size < 500_000) return MOCK_TRANSCRIPTS.medium.join(' ');
  return MOCK_TRANSCRIPTS.long.join(' ');
}

// Attempt to guess duration in seconds from file size
function estimateDuration(size: number, mimeType: string): number {
  // Rough bitrate estimates: 32 kbps for speech audio, 500 kbps for video
  const bitsPerSecond = mimeType.startsWith('video/') ? 500_000 : 32_000;
  return Math.round((size * 8) / bitsPerSecond);
}

// POST /transcribe/:fileId — transcribe audio or video attachment
router.post('/:fileId', async (req: Request, res: Response) => {
  const { fileId } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT id, file_name, file_size, mime_type, storage_path FROM files WHERE id = $1',
      [fileId]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'File not found' });

    const file = rows[0];
    const mime = file.mime_type || '';
    if (!mime.startsWith('audio/') && !mime.startsWith('video/')) {
      return res.status(400).json({ success: false, error: 'Only audio and video files can be transcribed' });
    }

    // Simulate Whisper API latency (1-2.5 seconds)
    const delay = 1000 + Math.random() * 1500;
    await new Promise(r => setTimeout(r, delay));

    const text = pickMockTranscript(file.file_size);
    const duration = estimateDuration(file.file_size, mime);
    const isVoiceNote = /^voice-note-/i.test(file.file_name);

    return res.json({
      success: true,
      data: {
        text,
        duration,
        language: 'en',
        file_name: file.file_name,
        kind: mime.startsWith('video/') ? 'video' : isVoiceNote ? 'voice-note' : 'audio',
        // In production this would come from the actual transcription service
        provider: 'mock',
      },
    });
  } catch (err) {
    console.error('Transcribe error:', err);
    return res.status(500).json({ success: false, error: 'Transcription failed' });
  }
});

export default router;
