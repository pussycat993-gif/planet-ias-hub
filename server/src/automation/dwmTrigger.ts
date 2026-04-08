import pool from '../db/auth';
import { io } from '../index';

interface DWMTriggerPayload {
  workflow_name: string;
  document_name: string;
  pci_entity_id?: number;
  pci_project_id?: number;
  step_name: string;
  assigned_to_pci_id?: number;
  pci_workflow_step_id: number;
  pci_activity_id: number;
  status: string;
}

export async function handleDWMTrigger(payload: DWMTriggerPayload): Promise<void> {
  // Find target channel — first try entity, then project
  let channelId: number | null = null;

  if (payload.pci_entity_id) {
    const { rows } = await pool.query(
      'SELECT id FROM channels WHERE pci_entity_id = $1 AND archived = FALSE LIMIT 1',
      [payload.pci_entity_id]
    );
    if (rows[0]) channelId = rows[0].id;
  }

  if (!channelId && payload.pci_project_id) {
    const { rows } = await pool.query(
      'SELECT id FROM channels WHERE pci_project_id = $1 AND archived = FALSE LIMIT 1',
      [payload.pci_project_id]
    );
    if (rows[0]) channelId = rows[0].id;
  }

  // Fallback: find assigned user's DM or first general channel
  if (!channelId) {
    const { rows } = await pool.query(
      "SELECT id FROM channels WHERE name = 'general' AND archived = FALSE LIMIT 1"
    );
    if (rows[0]) channelId = rows[0].id;
  }

  if (!channelId) {
    console.warn('DWM Trigger: No target channel found for payload', payload);
    return;
  }

  // Find assigned user in IAS Hub
  let assignedUserId: number | null = null;
  if (payload.assigned_to_pci_id) {
    const { rows } = await pool.query(
      'SELECT id FROM users WHERE pci_id = $1 LIMIT 1',
      [payload.assigned_to_pci_id]
    );
    if (rows[0]) assignedUserId = rows[0].id;
  }

  const dwmPayload = {
    type: 'dwm_card',
    workflow_name: payload.workflow_name,
    document: payload.document_name,
    step: payload.step_name,
    status: payload.status,
    pci_workflow_step_id: payload.pci_workflow_step_id,
    pci_activity_id: payload.pci_activity_id,
  };

  // Post DWM card message
  const { rows } = await pool.query(
    `INSERT INTO messages (channel_id, sender_id, message_type, body, automation_payload)
     VALUES ($1, NULL, 'dwm_card', $2, $3) RETURNING id`,
    [
      channelId,
      `DWM: ${payload.workflow_name} — ${payload.step_name}`,
      JSON.stringify(dwmPayload),
    ]
  );

  // Log event
  await pool.query(
    `INSERT INTO automation_events (event_type, channel_id, triggered_by, payload, status)
     VALUES ('dwm_trigger', $1, 'pci', $2, 'success')`,
    [channelId, JSON.stringify(payload)]
  );

  // Emit to channel
  io.to(`channel:${channelId}`).emit('automation:card', {
    channelId,
    messageId: rows[0].id,
    card: dwmPayload,
  });

  // Notify assigned user
  if (assignedUserId) {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, channel_id)
       VALUES ($1, 'dwm', $2, $3, $4)`,
      [
        assignedUserId,
        `Action required: ${payload.workflow_name}`,
        `${payload.step_name} — ${payload.document_name}`,
        channelId,
      ]
    );
    io.to(`user:${assignedUserId}`).emit('notification:new', {
      type: 'dwm',
      title: `Action required: ${payload.step_name}`,
      body: payload.document_name,
    });
  }
}

// Handle approve/reject action from IAS Hub user
export async function handleDWMAction(
  workflowStepId: number,
  action: 'approve' | 'reject',
  userId: number
): Promise<void> {
  // Update PCI via API
  const pciClient = (await import('../pci/client')).default;
  await pciClient.post('/api/ias-connect/dwm-action', {
    workflow_step_id: workflowStepId,
    action,
    user_id: userId,
  });
  // Log event
  await pool.query(
    `INSERT INTO automation_events (event_type, triggered_by, payload, status)
     VALUES ('dwm_trigger', 'user', $1, 'success')`,
    [JSON.stringify({ workflowStepId, action, userId })]
  );
}
