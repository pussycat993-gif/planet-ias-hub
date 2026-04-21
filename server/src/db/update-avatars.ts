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

// Full URL — API server is on port 3001
const BASE = 'http://localhost:3001/uploads/avatars';

const UPDATES = [
  { email: 'dean.bedford@planetsg.com',    avatar_url: `${BASE}/dean_bedford.jpg`,    role: 'President'       },
  { email: 'fedor.drmanovic@planetsg.com', avatar_url: `${BASE}/fedor_drmanovic.jpg`, role: 'QA Engineer'     },
  { email: 'ivana.vrtunic@planetsg.com',   avatar_url: `${BASE}/ivana_vrtunic.jpg`,   role: 'Project Manager' },
  { email: 'pedja.jovanovic@planetsg.com', avatar_url: `${BASE}/pedja_jovanovic.jpg`, role: 'Project Manager' },
  { email: 'dusan.mandic@planetsg.com',    avatar_url: `${BASE}/dusan_mandic.jpg`,    role: 'UX/UI Developer' },
  { email: 'stasa.bugarski@planetsg.com',  avatar_url: `${BASE}/stasa_bugarski.jpg`,  role: 'Senior Developer'},
  { email: 'veselko.pesut@planetsg.com',   avatar_url: `${BASE}/veselko_pesut.jpg`,   role: 'Senior Developer'},
];

async function run() {
  const client = await pool.connect();
  try {
    for (const u of UPDATES) {
      const { rowCount } = await client.query(
        `UPDATE users SET avatar_url = $1, role = $2 WHERE email = $3`,
        [u.avatar_url, u.role, u.email]
      );
      console.log(`${rowCount ? '✅' : '⚠️  not found'} ${u.email}`);
    }

    // Verify
    const { rows } = await client.query(`SELECT name, avatar_url, role FROM users ORDER BY name`);
    console.log('\nCurrent state:');
    rows.forEach(r => console.log(`  ${r.name}: ${r.avatar_url || '(no avatar)'} | ${r.role}`));
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
