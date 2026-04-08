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

interface SSOUserPayload {
  pci_id: number;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
  user_type: 'sso' | 'standalone';
}

// ── Users ─────────────────────────────────────────────────

export async function findOrCreateSSOUser(payload: SSOUserPayload) {
  const tenantId = process.env.TENANT_ID || 'default';
  const { rows } = await pool.query(
    `INSERT INTO users (pci_id, name, email, role, avatar_url, user_type, tenant_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'online')
     ON CONFLICT (pci_id) DO UPDATE SET
       name       = EXCLUDED.name,
       email      = EXCLUDED.email,
       avatar_url = EXCLUDED.avatar_url,
       status     = 'online',
       last_seen_at = NOW(),
       updated_at = NOW()
     RETURNING *`,
    [payload.pci_id, payload.name, payload.email, payload.role, payload.avatar_url, 'sso', tenantId]
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

export async function findUserById(id: number) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE id = $1 LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

export async function updateUserStatus(userId: number, status: 'online' | 'away' | 'offline') {
  await pool.query(
    'UPDATE users SET status = $1, last_seen_at = NOW(), updated_at = NOW() WHERE id = $2',
    [status, userId]
  );
}

// ── Sessions ──────────────────────────────────────────────

export async function createSession(userId: number, token: string) {
  await pool.query(
    `INSERT INTO sessions (user_id, token, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
    [userId, token]
  );
}

export async function invalidateSession(token: string) {
  await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
}

export async function isSessionValid(token: string): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT id FROM sessions WHERE token = $1 AND expires_at > NOW()',
    [token]
  );
  return rows.length > 0;
}

export async function cleanExpiredSessions() {
  const { rowCount } = await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
  return rowCount || 0;
}

export default pool;
