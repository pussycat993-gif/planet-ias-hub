-- IAS Hub — Initial Database Migration
-- Run this once on fresh PostgreSQL instance

-- Users
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  pci_id          INTEGER UNIQUE,
  email           VARCHAR(255) UNIQUE NOT NULL,
  name            VARCHAR(255) NOT NULL,
  avatar_url      TEXT,
  role            VARCHAR(50) DEFAULT 'member',
  user_type       VARCHAR(20) NOT NULL CHECK (user_type IN ('sso', 'standalone')),
  password_hash   TEXT,
  tenant_id       VARCHAR(100) NOT NULL DEFAULT 'default',
  last_seen_at    TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Channels
CREATE TABLE IF NOT EXISTS channels (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  type            VARCHAR(20) DEFAULT 'public' CHECK (type IN ('public', 'private', 'group', 'dm')),
  description     TEXT,
  logo_color      VARCHAR(7),
  logo_abbr       VARCHAR(4),
  pci_project_id  INTEGER,
  created_by      INTEGER REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Channel Members
CREATE TABLE IF NOT EXISTS channel_members (
  channel_id  INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        VARCHAR(20) DEFAULT 'member',
  joined_at   TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (channel_id, user_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id            SERIAL PRIMARY KEY,
  channel_id    INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  sender_id     INTEGER NOT NULL REFERENCES users(id),
  body          TEXT,
  file_url      TEXT,
  file_name     VARCHAR(255),
  file_size     INTEGER,
  message_type  VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'system', 'automation')),
  reply_to_id   INTEGER REFERENCES messages(id),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW(),
  deleted_at    TIMESTAMP
);

-- Call Logs
CREATE TABLE IF NOT EXISTS call_logs (
  id              SERIAL PRIMARY KEY,
  channel_id      INTEGER REFERENCES channels(id),
  call_type       VARCHAR(10) NOT NULL CHECK (call_type IN ('audio', 'video')),
  started_at      TIMESTAMP NOT NULL,
  ended_at        TIMESTAMP,
  duration_secs   INTEGER,
  started_by      INTEGER REFERENCES users(id),
  transcript      TEXT,
  ai_summary      TEXT,
  pci_activity_id INTEGER,
  logged_to_pci   BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Call Participants
CREATE TABLE IF NOT EXISTS call_participants (
  call_id   INTEGER NOT NULL REFERENCES call_logs(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id),
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at   TIMESTAMP,
  PRIMARY KEY (call_id, user_id)
);

-- Automation Events
CREATE TABLE IF NOT EXISTS automation_events (
  id            SERIAL PRIMARY KEY,
  event_type    VARCHAR(50) NOT NULL,
  channel_id    INTEGER REFERENCES channels(id),
  payload       JSONB,
  triggered_by  VARCHAR(50),
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_users_pci_id ON users(pci_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
