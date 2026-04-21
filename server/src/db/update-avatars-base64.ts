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

// ─────────────────────────────────────────────────────────────
// Generates SVG avatars with initials + consistent color per name,
// encodes them as base64 data URLs, and writes to users.avatar_url.
// No external image files required — everything is self-contained.
// ─────────────────────────────────────────────────────────────

const PALETTE = [
  '#1565c0', '#2e7d32', '#6a1b9a', '#c62828',
  '#e65100', '#00695c', '#283593', '#4a148c',
];

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function buildAvatarDataUrl(name: string): string {
  const bg = stringToColor(name);
  const letters = initials(name);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
<rect width="128" height="128" fill="${bg}"/>
<text x="64" y="64" font-family="Segoe UI, Arial, sans-serif" font-size="56" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${letters}</text>
</svg>`;

  const base64 = Buffer.from(svg, 'utf-8').toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

async function run() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, email, name FROM users WHERE user_type = 'standalone' ORDER BY name`
    );

    console.log(`\n🎨 Generating SVG avatars for ${rows.length} users...\n`);

    for (const u of rows) {
      const dataUrl = buildAvatarDataUrl(u.name);
      const { rowCount } = await client.query(
        `UPDATE users SET avatar_url = $1 WHERE id = $2`,
        [dataUrl, u.id]
      );
      console.log(`  ${rowCount ? '✅' : '⚠️ '} ${u.name.padEnd(22)} ${u.email}`);
    }

    // Verify
    const { rows: verify } = await client.query(
      `SELECT name, LENGTH(avatar_url) AS len FROM users WHERE avatar_url LIKE 'data:image/svg+xml%' ORDER BY name`
    );
    console.log(`\n📊 Saved data URLs:`);
    verify.forEach(r => console.log(`  ${r.name.padEnd(22)} ${r.len} chars`));

    console.log('\n✅ Done. Restart client (Vite hot reload should pick it up) and avatars will render inline.\n');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
