import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
});

interface UserPayload {
  pci_id?: number;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
  user_type: 'sso' | 'standalone';
}

export async function findOrCreateSSOUser(payload: UserPayload) {
  const { rows } = await pool.query(
    `INSERT INTO users (pci_id, name, email, role, avatar_url, user_type, tenant_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (pci_id) DO UPDATE
     SET name = EXCLUDED.name,
         email = EXCLUDED.email,
         avatar_url = EXCLUDED.avatar_url,
         last_seen_at = NOW()
     RETURNING *`,
    [payload.pci_id, payload.name, payload.email, payload.role, payload.avatar_url, 'sso', process.env.TENANT_ID || 'default']
  );
  return rows[0];
}

export async function findUserByEmail(email: string) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE email = $1 LIMIT 1',
    [email]
  );
  return rows[0] || null;
}

export async function createSession(userId: number, token: string) {
  await pool.query(
    `INSERT INTO sessions (user_id, token, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
    [userId, token]
  );
}

export async function invalidateSession(token: string) {
  await pool.query(
    'DELETE FROM sessions WHERE token = $1',
    [token]
  );
}

export default pool;
