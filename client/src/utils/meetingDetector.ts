// ───────────────────────────────────────────────────────────────
// Meeting intent detector
// Parses a chat message to determine whether someone is proposing
// a meeting, and extracts the suggested date/time if so.
//
// Rules:
//  - Must contain a meeting keyword (EN or BS/SR)
//  - Must contain a parseable time
//  - If the resulting datetime is in the past AND no explicit
//    future date was given → assume tomorrow
// ───────────────────────────────────────────────────────────────

export interface MeetingDetection {
  match: boolean;
  datetime?: Date;
  title?: string;
}

// ── Meeting intent keywords ────────────────────────────────────
const MEETING_KEYWORDS: RegExp[] = [
  // English
  /\blet'?s\s+(meet|chat|talk|call|discuss|sync|catch\s+up|jump\s+on)/i,
  /\b(we'?ll|we\s+will|can\s+we|shall\s+we|should\s+we|could\s+we)\s+(meet|talk|call|chat|discuss|sync|catch\s+up|jump|get\s+on)/i,
  /\b(meeting|call|sync|standup|review|stand-up|huddle)\s+(at|on|tomorrow|today|scheduled)/i,
  /\bmeet\s+(at|on|tomorrow|today|me|up)/i,
  /\bsee\s+you\s+(at|tomorrow|on|in)/i,
  /\bschedule\s+(a\s+)?(meeting|call|sync|chat)/i,
  /\bcatch\s+up\s+(at|on|tomorrow|today)/i,
  /\bjoin\s+(me|us)\s+(at|on|tomorrow|today)/i,
  /\bavailable\s+(at|on|tomorrow|today)/i,

  // Bosnian / Serbian
  /\b(vidimo|vidjet[iu]|videt[iu])\s+se\b/i,
  /\b(čujemo|cujemo|čut[iu]|cut[iu])\s+se\b/i,
  /\b(da\s+se\s+)?(nađemo|nadjemo|nadjem[oe])\b/i,
  /\bsastan[ae]k\b/i,
  /\bsastanimo\s+se\b/i,
  /\b(možemo|mozemo)\s+(se\s+)?(čuti|cuti|videti|vidjeti|naći|naci|naići|naiđi|naidji)/i,
  /\b(zvat|zvaću|zovnuću|zovnucu|zvacu)\s+(te|vas|ga|ih)/i,
  /\b(hajde|ajmo|idemo)\s+(da\s+se\s+)?(vidimo|čujemo|cujemo|nađemo|nadjemo)/i,
  /\b(stižem|stizem|dolazim)\s+(u|oko)\b/i,
];

// ── Time patterns (ordered: most specific first) ───────────────
interface TimePattern {
  regex: RegExp;
  hourIdx: number;
  minIdx?: number;
  ampmIdx?: number;
}

const TIME_PATTERNS: TimePattern[] = [
  // "10:30 AM", "10:30am", "10:30 PM"
  { regex: /\b(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)\b/i, hourIdx: 1, minIdx: 2, ampmIdx: 3 },
  // "10 AM", "10am", "10 PM"
  { regex: /\b(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)\b/i, hourIdx: 1, ampmIdx: 2 },
  // "u 10h", "at 10h", "oko 10h"
  { regex: /\b(?:u|at|oko)\s+(\d{1,2})\s*h\b/i, hourIdx: 1 },
  // "14:30", "10:30" (24h)
  { regex: /\b(\d{1,2}):(\d{2})\b/, hourIdx: 1, minIdx: 2 },
  // "u 10", "at 10", "oko 10" (fallback, requires context word)
  { regex: /\b(?:u|at|oko)\s+(\d{1,2})(?=\s|[,.;!?]|$)/i, hourIdx: 1 },
];

// ── Day-of-week lookups (EN + BS/SR variants) ──────────────────
const DAY_NAMES: string[][] = [
  ['sunday',    'nedjelja',   'nedelja'],      // 0
  ['monday',    'ponedjeljak','ponedeljak'],   // 1
  ['tuesday',   'utorak'],                     // 2
  ['wednesday', 'srijeda',    'sreda'],        // 3
  ['thursday',  'četvrtak',   'cetvrtak'],     // 4
  ['friday',    'petak'],                      // 5
  ['saturday',  'subota'],                     // 6
];

// ── Helpers ────────────────────────────────────────────────────
function hasMeetingKeyword(text: string): boolean {
  return MEETING_KEYWORDS.some(rx => rx.test(text));
}

function extractTime(text: string): { hour: number; minute: number; source: string } | null {
  const lower = text.toLowerCase();

  for (const p of TIME_PATTERNS) {
    const m = lower.match(p.regex);
    if (!m) continue;

    let hour = parseInt(m[p.hourIdx], 10);
    const minute = p.minIdx ? parseInt(m[p.minIdx], 10) : 0;
    const ampm = p.ampmIdx ? m[p.ampmIdx]?.toLowerCase().replace(/\./g, '') : null;

    if (isNaN(hour) || hour > 23 || minute > 59) continue;

    if (ampm) {
      if (ampm.startsWith('p') && hour < 12) hour += 12;
      if (ampm.startsWith('a') && hour === 12) hour = 0;
    } else {
      // Local context hints for 12h-ambiguous times
      const hasPm = /\b(popodne|uveče|uvece|naveče|navece|večeras|veceras|evening|afternoon|tonight)\b/i.test(lower);
      const hasAm = /\b(ujutru|jutros|jutro|morning)\b/i.test(lower);
      if (hasPm && hour < 12) hour += 12;
      if (hasAm && hour === 12) hour = 0;
    }

    return { hour, minute, source: m[0] };
  }
  return null;
}

function extractDayOffset(text: string): { offset: number; explicit: boolean } {
  const lower = text.toLowerCase();

  if (/\b(day\s+after\s+tomorrow|prekosutra|preksutra)\b/.test(lower)) return { offset: 2, explicit: true };
  if (/\b(tomorrow|sutra)\b/.test(lower))                                return { offset: 1, explicit: true };
  if (/\b(today|danas|tonight|večeras|veceras|jutros)\b/.test(lower))    return { offset: 0, explicit: true };

  // Day of week
  const isNextWeek = /\b(next|idući|iduci|sljedeći|sljedeci|slijedeći|slijedeci)\b/.test(lower);

  for (let i = 0; i < 7; i++) {
    for (const name of DAY_NAMES[i]) {
      if (new RegExp(`\\b${name}\\b`, 'i').test(lower)) {
        const today = new Date().getDay();
        let offset = i - today;
        if (offset <= 0) offset += 7;
        if (isNextWeek) offset += 7;
        return { offset, explicit: true };
      }
    }
  }

  return { offset: 0, explicit: false };
}

// ── Main API ───────────────────────────────────────────────────
export function detectMeeting(text: string | null | undefined): MeetingDetection {
  if (!text || text.trim().length < 3) return { match: false };
  if (!hasMeetingKeyword(text))         return { match: false };

  const time = extractTime(text);
  if (!time)                            return { match: false };

  const { offset, explicit } = extractDayOffset(text);

  const now = new Date();
  const datetime = new Date(now);
  datetime.setDate(now.getDate() + offset);
  datetime.setHours(time.hour, time.minute, 0, 0);

  // Fallback: if time is in the past and no explicit date given → assume tomorrow
  if (datetime.getTime() < now.getTime() && !explicit) {
    datetime.setDate(datetime.getDate() + 1);
  }

  // Build a reasonable title
  const trimmed = text.trim().replace(/\s+/g, ' ');
  const title = trimmed.length > 60 ? trimmed.slice(0, 57) + '…' : trimmed;

  return { match: true, datetime, title };
}

// ── Local datetime formatting for <input type="datetime-local"> ─
export function toLocalDateTimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
