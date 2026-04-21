-- IAS Hub — Presence + Status Richer States
-- Migration: 004_presence_status.sql
-- Run after 003_user_preferences.sql
--
-- Adds richer presence fields on top of existing status/status_message/last_seen_at:
--   - status_emoji        Custom emoji next to the user's name (e.g. 🏝, 🚀, 📚)
--   - auto_status         Set programmatically by the app (e.g. during a call).
--                         When present, takes display priority over manual `status`.
--   - auto_status_until   When the auto_status should be cleared automatically.
--                         NULL means persistent until explicitly cleared.
--   - timezone            IANA timezone name (e.g. "Europe/Belgrade") for optional
--                         location chip on profile cards and cross-timezone hints.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status_emoji       VARCHAR(10),
  ADD COLUMN IF NOT EXISTS auto_status        VARCHAR(20)
      CHECK (auto_status IS NULL OR auto_status IN ('in_call', 'in_meeting', 'focus', 'away_auto')),
  ADD COLUMN IF NOT EXISTS auto_status_until  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS timezone           VARCHAR(60);

-- Fast lookup of stale auto-statuses so a periodic sweeper can clear them.
CREATE INDEX IF NOT EXISTS idx_users_auto_status_until
  ON users(auto_status_until)
  WHERE auto_status IS NOT NULL;
