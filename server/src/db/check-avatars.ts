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
    const { rows } = await client.query(`
      SELECT
        id,
        name,
        user_type,
        status,
        LEFT(COALESCE(avatar_url, ''), 45) AS avatar_start,
        LENGTH(COALESCE(avatar_url, '')) AS len
      FROM users
      ORDER BY name
    `);

    console.log(`\n📊 users (${rows.length} rows):\n`);
    console.log('ID  | NAME                   | TYPE        | STATUS   | LEN   | AVATAR_START');
    console.log('----+------------------------+-------------+----------+-------+---------------------------------------------');
    rows.forEach(r => {
      console.log(
        `${String(r.id).padEnd(3)} | ${(r.name || '').padEnd(22)} | ${(r.user_type || '').padEnd(11)} | ${(r.status || '').padEnd(8)} | ${String(r.len).padEnd(5)} | ${r.avatar_start}`
      );
    });
    console.log();
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('❌ Query failed:', err);
  process.exit(1);
});
