-- IAS Hub — User Preferences
-- Migration: 003_user_preferences.sql
-- Adds a generic per-user preferences table, seeded with default Ask IAS chips.
-- Reusable for future preferences (landing page, notification settings, etc.).

-- ── USER_PREFERENCES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_preferences (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key         VARCHAR(100) NOT NULL,
  value       JSONB NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, key)
);

-- Lookups are always (user_id, key); the unique constraint already creates
-- a btree index that makes this O(log n).

-- ── Seed default Ask IAS chips for every existing user ────────────
-- Pinned chip is NOT stored per user — it's hardcoded in the backend
-- ("What are my priorities today?") so every user always has access to it.
-- These 3 are the user-editable slots.
INSERT INTO user_preferences (user_id, key, value)
SELECT
  u.id,
  'ask_ias.chips',
  '["What''s blocking my team?", "Any news from my top clients?", "Summarize this week''s progress"]'::jsonb
FROM users u
ON CONFLICT (user_id, key) DO NOTHING;
