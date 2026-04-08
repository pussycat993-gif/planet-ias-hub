-- IAS Hub — Complete Database Migration
-- Migration: 002_complete_schema.sql
-- Run after 001_initial.sql

-- Drop tables from initial migration to rebuild cleanly
DROP TABLE IF EXISTS automation_events CASCADE;
DROP TABLE IF EXISTS call_participants CASCADE;
DROP TABLE IF EXISTS call_logs CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS channel_members CASCADE;
DROP TABLE IF EXISTS channels CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ── USERS ──────────────────────────────────────────────────────────
CREATE TABLE users (
  id              SERIAL PRIMARY KEY,
  pci_id          INTEGER UNIQUE,
  email           VARCHAR(255) UNIQUE NOT NULL,
  name            VARCHAR(255) NOT NULL,
  avatar_url      TEXT,
  role            VARCHAR(50) DEFAULT 'member',
  user_type       VARCHAR(20) NOT NULL CHECK (user_type IN ('sso', 'standalone')),
  password_hash   TEXT,
  tenant_id       VARCHAR(100) NOT NULL DEFAULT 'default',
  status          VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'away', 'offline')),
  status_message  VARCHAR(150),
  last_seen_at    TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- ── SESSIONS ───────────────────────────────────────────────────────
CREATE TABLE sessions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ── CHANNELS ───────────────────────────────────────────────────────
CREATE TABLE channels (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(100) NOT NULL,
  type              VARCHAR(20) DEFAULT 'public' CHECK (type IN ('public', 'private', 'group', 'dm')),
  description       TEXT,
  logo_color        VARCHAR(7),
  logo_abbr         VARCHAR(4),
  logo_url          TEXT,
  pci_project_id    INTEGER,
  pci_entity_id     INTEGER,
  archived          BOOLEAN DEFAULT FALSE,
  created_by        INTEGER REFERENCES users(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- ── CHANNEL MEMBERS ────────────────────────────────────────────────
CREATE TABLE channel_members (
  channel_id          INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role                VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  notification_pref   VARCHAR(20) DEFAULT 'all' CHECK (notification_pref IN ('all', 'mentions', 'mute')),
  last_read_at        TIMESTAMP,
  joined_at           TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (channel_id, user_id)
);

-- ── MESSAGES ───────────────────────────────────────────────────────
CREATE TABLE messages (
  id                  SERIAL PRIMARY KEY,
  channel_id          INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  sender_id           INTEGER REFERENCES users(id),
  body                TEXT,
  message_type        VARCHAR(30) DEFAULT 'text' CHECK (message_type IN (
                        'text', 'file', 'system', 'automation',
                        'meeting_card', 'dwm_card', 'briefing_card'
                      )),
  reply_to_id         INTEGER REFERENCES messages(id),
  edited              BOOLEAN DEFAULT FALSE,
  pinned              BOOLEAN DEFAULT FALSE,
  automation_payload  JSONB,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW(),
  deleted_at          TIMESTAMP
);

-- ── MESSAGE REACTIONS ──────────────────────────────────────────────
CREATE TABLE message_reactions (
  id          SERIAL PRIMARY KEY,
  message_id  INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji       VARCHAR(10) NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);

-- ── FILES ──────────────────────────────────────────────────────────
CREATE TABLE files (
  id            SERIAL PRIMARY KEY,
  message_id    INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  channel_id    INTEGER NOT NULL REFERENCES channels(id),
  uploaded_by   INTEGER NOT NULL REFERENCES users(id),
  file_name     VARCHAR(255) NOT NULL,
  file_size     INTEGER NOT NULL,
  mime_type     VARCHAR(100),
  storage_path  TEXT NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ── CALL LOGS ──────────────────────────────────────────────────────
CREATE TABLE call_logs (
  id                  SERIAL PRIMARY KEY,
  channel_id          INTEGER REFERENCES channels(id),
  call_type           VARCHAR(10) NOT NULL CHECK (call_type IN ('audio', 'video')),
  started_at          TIMESTAMP NOT NULL,
  ended_at            TIMESTAMP,
  duration_secs       INTEGER,
  started_by          INTEGER REFERENCES users(id),
  transcript          TEXT,
  ai_summary          TEXT,
  pci_activity_id     INTEGER,
  pci_activity_type   VARCHAR(50),
  pci_subject         VARCHAR(255),
  logged_to_pci       BOOLEAN DEFAULT FALSE,
  log_skipped         BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMP DEFAULT NOW()
);

-- ── CALL PARTICIPANTS ──────────────────────────────────────────────
CREATE TABLE call_participants (
  call_id         INTEGER NOT NULL REFERENCES call_logs(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  pci_person_id   INTEGER,
  joined_at       TIMESTAMP DEFAULT NOW(),
  left_at         TIMESTAMP,
  PRIMARY KEY (call_id, user_id)
);

-- ── PCI LOG SETTINGS ───────────────────────────────────────────────
CREATE TABLE pci_log_settings (
  id                SERIAL PRIMARY KEY,
  channel_id        INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enabled           BOOLEAN DEFAULT FALSE,
  trigger           VARCHAR(30) DEFAULT 'manual' CHECK (trigger IN ('manual', 'on_call_end', 'on_close')),
  activity_type     VARCHAR(50) DEFAULT 'Chat Session',
  subject_template  VARCHAR(255),
  auto_people       BOOLEAN DEFAULT TRUE,
  auto_entities     BOOLEAN DEFAULT TRUE,
  auto_files        BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE (channel_id, user_id)
);

-- ── SCHEDULED MEETINGS ─────────────────────────────────────────────
CREATE TABLE scheduled_meetings (
  id                SERIAL PRIMARY KEY,
  channel_id        INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  message_id        INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  pci_activity_id   INTEGER NOT NULL,
  subject           VARCHAR(255) NOT NULL,
  meeting_date      TIMESTAMP NOT NULL,
  duration_minutes  INTEGER DEFAULT 60,
  participants      JSONB,
  status            VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'canceled')),
  call_log_id       INTEGER REFERENCES call_logs(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- ── NOTIFICATIONS ──────────────────────────────────────────────────
CREATE TABLE notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL CHECK (type IN ('message', 'call_missed', 'automation', 'meeting', 'dwm')),
  title       VARCHAR(255),
  body        TEXT,
  channel_id  INTEGER REFERENCES channels(id),
  message_id  INTEGER REFERENCES messages(id),
  read        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ── AUTOMATION EVENTS ──────────────────────────────────────────────
CREATE TABLE automation_events (
  id            SERIAL PRIMARY KEY,
  event_type    VARCHAR(50) NOT NULL CHECK (event_type IN (
                  'smart_logger', 'meeting_briefing', 'dwm_trigger',
                  'auto_channel', 'smart_notif', 'scheduled_meeting'
                )),
  channel_id    INTEGER REFERENCES channels(id),
  triggered_by  VARCHAR(50),
  payload       JSONB,
  status        VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failed', 'skipped')),
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ── AUTOMATION SETTINGS ────────────────────────────────────────────
CREATE TABLE automation_settings (
  id                        SERIAL PRIMARY KEY,
  tenant_id                 VARCHAR(100) NOT NULL UNIQUE,
  smart_logger              BOOLEAN DEFAULT TRUE,
  meeting_briefing          BOOLEAN DEFAULT TRUE,
  briefing_minutes_before   INTEGER DEFAULT 15,
  dwm_trigger               BOOLEAN DEFAULT TRUE,
  auto_channel              BOOLEAN DEFAULT FALSE,
  smart_notif               BOOLEAN DEFAULT TRUE,
  created_at                TIMESTAMP DEFAULT NOW(),
  updated_at                TIMESTAMP DEFAULT NOW()
);

-- ── INDEXES ────────────────────────────────────────────────────────
CREATE INDEX idx_messages_channel_created ON messages(channel_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_pinned ON messages(channel_id) WHERE pinned = TRUE;
CREATE INDEX idx_messages_type ON messages(message_type);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

CREATE INDEX idx_users_pci_id ON users(pci_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_status ON users(status);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE read = FALSE;
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

CREATE INDEX idx_call_logs_channel ON call_logs(channel_id);
CREATE INDEX idx_call_logs_pci ON call_logs(logged_to_pci);

CREATE INDEX idx_files_channel ON files(channel_id);
CREATE INDEX idx_files_message ON files(message_id);

CREATE INDEX idx_channel_members_user ON channel_members(user_id);
CREATE INDEX idx_channel_members_unread ON channel_members(user_id, last_read_at);

CREATE INDEX idx_scheduled_meetings_channel ON scheduled_meetings(channel_id);
CREATE INDEX idx_scheduled_meetings_date ON scheduled_meetings(meeting_date);
CREATE INDEX idx_scheduled_meetings_pci ON scheduled_meetings(pci_activity_id);

CREATE INDEX idx_automation_events_type ON automation_events(event_type, created_at DESC);
CREATE INDEX idx_pci_log_settings_channel ON pci_log_settings(channel_id);
