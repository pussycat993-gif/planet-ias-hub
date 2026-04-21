import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ias_hub',
  user: process.env.DB_USER || 'ias_hub_user',
  password: process.env.DB_PASS,
});

async function run() {
  const client = await pool.connect();
  try {
    const { rows: channels } = await client.query(`SELECT id FROM channels WHERE name = 'Workgroup Team' LIMIT 1`);
    if (!channels[0]) { console.error('Workgroup Team not found'); return; }
    const channelId = channels[0].id;

    // Delete ALL existing messages in this channel
    await client.query(`DELETE FROM messages WHERE channel_id = $1`, [channelId]);
    console.log('Cleared existing messages.');

    // Get users
    const { rows: users } = await client.query(`
      SELECT id, name FROM users WHERE email IN (
        'ivana.vrtunic@planetsg.com', 'stasa.bugarski@planetsg.com',
        'dean.bedford@planetsg.com',  'pedja.jovanovic@planetsg.com',
        'dusan.mandic@planetsg.com',  'fedor.drmanovic@planetsg.com',
        'veselko.pesut@planetsg.com'
      )
    `);

    const byFirst: Record<string, number> = {};
    users.forEach((u: any) => { byFirst[u.name.split(' ')[0]] = u.id; });

    function mins(m: number): Date {
      const d = new Date(); d.setMinutes(d.getMinutes() - m); return d;
    }

    const messages = [
      { first: 'Dean',    body: 'Good morning everyone! Quick check-in — how is the sprint looking?',                      m: 300 },
      { first: 'Ivana',   body: 'Good morning Dean! On track. Staša finished IAS-533, Fedor is running QA now.',            m: 295 },
      { first: 'Staša',   body: 'Yes, Role Management modal is done and merged. PR is on Bitbucket for review.',            m: 290 },
      { first: 'Fedor',   body: 'Started QA on IAS-533. First pass looks solid, will report back by end of day.',          m: 280 },
      { first: 'Veselko', body: 'Also pushed the DB indexing improvements for the workflow tables. Queries are ~3x faster.', m: 240 },
      { first: 'Dean',    body: 'Great progress team! Can we do a client demo on Friday?',                                  m: 200 },
      { first: 'Ivana',   body: 'Friday works. Dušan, can you finalize the Dashboard mockup by Thursday EOD?',              m: 195 },
      { first: 'Dušan',   body: 'Absolutely. I have a few tweaks left on the Ask IAS widget, will send by 3pm Thursday.',   m: 180 },
      { first: 'Peđa',    body: 'PDF parser module is ready for review. Staša, can you take a look at the PR when you can?',m: 120 },
      { first: 'Staša',   body: 'On it Peđa! Looks clean at first glance 👍 Will leave comments shortly.',                  m: 60  },
    ];

    for (const msg of messages) {
      const senderId = byFirst[msg.first];
      if (!senderId) { console.warn(`User not found: ${msg.first}`); continue; }
      await client.query(
        `INSERT INTO messages (channel_id, sender_id, body, message_type, created_at) VALUES ($1, $2, $3, 'text', $4)`,
        [channelId, senderId, msg.body, mins(msg.m)]
      );
    }

    console.log(`✅ Inserted 10 messages into Workgroup Team.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
