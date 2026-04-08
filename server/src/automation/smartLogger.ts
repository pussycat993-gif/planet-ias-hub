import pool from '../db/auth';

interface SmartLoggerResult {
  suggested_subject: string;
  jira_tickets: string[];
  participants: Array<{ hub_user_id: number; pci_person_id: number | null; name: string }>;
  entities: Array<{ pci_entity_id: number; name: string }>;
  files: string[];
  action_items: string[];
}

const JIRA_TICKET_PATTERN = /\b(IAS-\d+)\b/gi;
const ACTION_ITEM_PATTERNS = [
  /(\w[\w\s]+)\s+(?:will|to|should|needs to)\s+(.+?)(?:\.|$)/gi,
  /action[:\s]+(.+?)(?:\.|$)/gi,
];

export async function runSmartLogger(callId: number, channelId: number): Promise<SmartLoggerResult> {
  // Fetch last 100 messages from channel
  const { rows: messages } = await pool.query(
    `SELECT m.body, m.message_type, u.name AS sender_name, u.id AS sender_id,
            f.file_name
     FROM messages m
     LEFT JOIN users u ON u.id = m.sender_id
     LEFT JOIN files f ON f.message_id = m.id
     WHERE m.channel_id = $1 AND m.deleted_at IS NULL
     ORDER BY m.created_at DESC LIMIT 100`,
    [channelId]
  );

  // Fetch call participants
  const { rows: participants } = await pool.query(
    `SELECT cp.user_id, cp.pci_person_id, u.name
     FROM call_participants cp
     JOIN users u ON u.id = cp.user_id
     WHERE cp.call_id = $1`,
    [callId]
  );

  const fullText = messages.map(m => m.body || '').join('\n');

  // Extract Jira tickets
  const jiraTickets = [...new Set([...fullText.matchAll(JIRA_TICKET_PATTERN)].map(m => m[1].toUpperCase()))];

  // Extract shared files
  const files = [...new Set(messages.filter(m => m.file_name).map(m => m.file_name))];

  // Extract action items (simple heuristic)
  const actionItems: string[] = [];
  for (const pattern of ACTION_ITEM_PATTERNS) {
    const matches = [...fullText.matchAll(pattern)];
    matches.forEach(m => {
      const item = m[0].trim();
      if (item.length > 10 && item.length < 200) actionItems.push(item);
    });
  }

  // Build suggested subject
  let suggestedSubject = 'Video Call';
  if (jiraTickets.length > 0) {
    suggestedSubject = `Video Call — ${jiraTickets.slice(0, 2).join(', ')} discussion`;
  }

  // Fetch entity context for participants with pci_person_id
  const entities: Array<{ pci_entity_id: number; name: string }> = [];
  // In production: call PCI API for each participant's primary entity
  // For now, return empty — populated when PCI API responds

  return {
    suggested_subject: suggestedSubject,
    jira_tickets: jiraTickets,
    participants: participants.map(p => ({
      hub_user_id: p.user_id,
      pci_person_id: p.pci_person_id,
      name: p.name,
    })),
    entities,
    files,
    action_items: actionItems.slice(0, 5),
  };
}
