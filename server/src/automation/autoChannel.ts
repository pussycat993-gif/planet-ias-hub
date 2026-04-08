import pool from '../db/auth';
import { io } from '../index';

interface AutoChannelPayload {
  trigger: 'project' | 'entity';
  pci_project_id?: number;
  pci_entity_id?: number;
  name: string;
  linked_people_ids: number[];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export async function handleAutoChannel(payload: AutoChannelPayload): Promise<void> {
  const prefix = payload.trigger === 'project' ? 'project-' : 'client-';
  const channelName = `${prefix}${slugify(payload.name)}`;

  // Check if channel already exists for this project/entity
  const existingQuery = payload.pci_project_id
    ? 'SELECT id FROM channels WHERE pci_project_id = $1'
    : 'SELECT id FROM channels WHERE pci_entity_id = $1';
  const existingId = payload.pci_project_id || payload.pci_entity_id;

  const { rows: existing } = await pool.query(existingQuery, [existingId]);
  if (existing[0]) {
    console.log(`Auto-channel: Channel already exists for ${channelName}`);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create channel
    const { rows: channelRows } = await client.query(
      `INSERT INTO channels (name, type, pci_project_id, pci_entity_id, created_by)
       VALUES ($1, 'public', $2, $3, NULL) RETURNING *`,
      [channelName, payload.pci_project_id || null, payload.pci_entity_id || null]
    );
    const channel = channelRows[0];

    // Match PCI people to IAS Hub users by pci_id
    const addedUsers: number[] = [];
    for (const pciPersonId of payload.linked_people_ids) {
      const { rows: userRows } = await client.query(
        'SELECT id, name FROM users WHERE pci_id = $1 LIMIT 1',
        [pciPersonId]
      );
      if (userRows[0]) {
        await client.query(
          'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [channel.id, userRows[0].id]
        );
        addedUsers.push(userRows[0].id);
      }
    }

    // Post system card in new channel
    const cardPayload = {
      type: 'auto_channel_card',
      trigger: payload.trigger,
      pci_name: payload.name,
      pci_project_id: payload.pci_project_id,
      pci_entity_id: payload.pci_entity_id,
      members_added: addedUsers.length,
    };

    await client.query(
      `INSERT INTO messages (channel_id, sender_id, message_type, body, automation_payload)
       VALUES ($1, NULL, 'automation', $2, $3)`,
      [
        channel.id,
        `Channel auto-created from PCI ${payload.trigger}: ${payload.name}`,
        JSON.stringify(cardPayload),
      ]
    );

    // Log event
    await client.query(
      `INSERT INTO automation_events (event_type, channel_id, triggered_by, payload, status)
       VALUES ('auto_channel', $1, 'pci', $2, 'success')`,
      [channel.id, JSON.stringify(payload)]
    );

    await client.query('COMMIT');

    // Notify added users
    for (const userId of addedUsers) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, channel_id)
         VALUES ($1, 'automation', $2, $3, $4)`,
        [userId, `New channel: #${channelName}`, `Auto-created from PCI ${payload.trigger}: ${payload.name}`, channel.id]
      );
      io.to(`user:${userId}`).emit('notification:new', {
        type: 'automation',
        title: `Added to #${channelName}`,
        body: `Channel created from PCI ${payload.trigger}`,
      });
    }

    // Broadcast new channel to all connected users
    io.emit('channel:created', { channel, members: addedUsers });

  } catch (err) {
    await client.query('ROLLBACK');
    await pool.query(
      `INSERT INTO automation_events (event_type, triggered_by, payload, status)
       VALUES ('auto_channel', 'pci', $1, 'failed')`,
      [JSON.stringify(payload)]
    );
    throw err;
  } finally {
    client.release();
  }
}
