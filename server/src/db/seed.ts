import { Pool } from 'pg';
import bcrypt from 'bcrypt';
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

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🌱 Seeding IAS Hub database...\n');

    // Default automation settings for tenant
    const tenantId = process.env.TENANT_ID || 'default';
    await client.query(`
      INSERT INTO automation_settings (tenant_id, smart_logger, meeting_briefing, briefing_minutes_before, dwm_trigger, auto_channel, smart_notif)
      VALUES ($1, true, true, 15, true, false, true)
      ON CONFLICT (tenant_id) DO NOTHING
    `, [tenantId]);
    console.log('  ✅ Automation settings seeded');

    // Seed default public channels
    const channels = [
      { name: 'general', type: 'public', description: 'General team communication' },
      { name: 'development', type: 'public', description: 'Development discussions' },
      { name: 'ias-project', type: 'public', description: 'IAS Hub project channel' },
    ];

    for (const ch of channels) {
      await client.query(`
        INSERT INTO channels (name, type, description)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [ch.name, ch.type, ch.description]);
    }
    console.log('  ✅ Default channels seeded (general, development, ias-project)');

    // Seed demo standalone admin user (for testing only — remove in production)
    if (process.env.NODE_ENV === 'development') {
      const passwordHash = await bcrypt.hash('Admin@IASHub2026!', 12);
      await client.query(`
        INSERT INTO users (email, name, role, user_type, password_hash, tenant_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (email) DO NOTHING
      `, ['admin@iashub.local', 'IAS Hub Admin', 'admin', 'standalone', passwordHash, tenantId]);
      console.log('  ✅ Demo admin user seeded (dev only) — admin@iashub.local / Admin@IASHub2026!');
    }

    await client.query('COMMIT');
    console.log('\n✅ Seed complete.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
