# IAS Hub — Database Schema

## Overview

Database: PostgreSQL 16
All tables use `created_at` / `updated_at` timestamps.
Soft delete pattern (`deleted_at`) on messages.

---

## Entity Relationship Diagram

```
users
  ├── sessions (1:N)
  ├── channel_members (N:M via channels)
  ├── messages (1:N)
  ├── call_participants (N:M via call_logs)
  ├── notifications (1:N)
  └── pci_log_settings (1:N per channel)

channels
  ├── channel_members (1:N)
  ├── messages (1:N)
  ├── call_logs (1:N)
  ├── pci_log_settings (1:1)
  ├── pinned_messages (1:N)
  └── automation_events (1:N)

call_logs
  ├── call_participants (1:N)
  └── call_log_attachments (1:N)

files
  └── message_files (1:N via messages)
```

---

## Tables

### 1. users

Stores both SSO (PCI) users and standalone external users.

```sql
CREATE TABLE users (
  id              SERIAL PRIMARY KEY,
  pci_id          INTEGER UNIQUE,                    -- NULL for external users
  email           VARCHAR(255) UNIQUE NOT NULL,
  name            VARCHAR(255) NOT NULL,
  avatar_url      TEXT,
  role            VARCHAR(50) DEFAULT 'member',      -- admin | member | guest
  user_type       VARCHAR(20) NOT NULL,              -- sso | standalone
  password_hash   TEXT,                              -- NULL for SSO users
  tenant_id       VARCHAR(100) NOT NULL,
  status          VARCHAR(20) DEFAULT 'offline',     -- online | away | offline
  status_message  VARCHAR(150),                      -- custom status e.g. "In a meeting"
  last_seen_at    TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

---

### 2. sessions

Active login sessions.

```sql
CREATE TABLE sessions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

---

### 3. channels

Public channels, private channels, custom groups, and DMs.

```sql
CREATE TABLE channels (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(100) NOT NULL,
  type              VARCHAR(20) DEFAULT 'public',    -- public | private | group | dm
  description       TEXT,
  logo_color        VARCHAR(7),                      -- hex e.g. #1565c0
  logo_abbr         VARCHAR(4),                      -- e.g. PSG, QA
  logo_url          TEXT,                            -- custom uploaded logo
  pci_project_id    INTEGER,                         -- linked PCI project (for auto-channels)
  pci_entity_id     INTEGER,                         -- linked PCI entity
  archived          BOOLEAN DEFAULT FALSE,
  created_by        INTEGER REFERENCES users(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);
```

---

### 4. channel_members

Users in channels, with per-user notification preferences.

```sql
CREATE TABLE channel_members (
  channel_id          INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role                VARCHAR(20) DEFAULT 'member',  -- owner | admin | member
  notification_pref   VARCHAR(20) DEFAULT 'all',     -- all | mentions | mute
  last_read_at        TIMESTAMP,
  joined_at           TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (channel_id, user_id)
);
```

---

### 5. messages

All messages — text, files, system messages, automation cards.

```sql
CREATE TABLE messages (
  id            SERIAL PRIMARY KEY,
  channel_id    INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  sender_id     INTEGER REFERENCES users(id),        -- NULL for system messages
  body          TEXT,
  message_type  VARCHAR(20) DEFAULT 'text',          -- text | file | system | automation | meeting_card | dwm_card | briefing_card
  reply_to_id   INTEGER REFERENCES messages(id),
  edited        BOOLEAN DEFAULT FALSE,
  pinned        BOOLEAN DEFAULT FALSE,
  automation_payload  JSONB,                         -- for automation cards (meeting data, DWM data etc.)
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW(),
  deleted_at    TIMESTAMP                            -- soft delete
);
```

---

### 6. message_reactions

Emoji reactions on messages.

```sql
CREATE TABLE message_reactions (
  id          SERIAL PRIMARY KEY,
  message_id  INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji       VARCHAR(10) NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);
```

---

### 7. files

Files shared in conversations.

```sql
CREATE TABLE files (
  id            SERIAL PRIMARY KEY,
  message_id    INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  channel_id    INTEGER NOT NULL REFERENCES channels(id),
  uploaded_by   INTEGER NOT NULL REFERENCES users(id),
  file_name     VARCHAR(255) NOT NULL,
  file_size     INTEGER NOT NULL,                    -- bytes
  mime_type     VARCHAR(100),
  storage_path  TEXT NOT NULL,                       -- local path or S3 key
  created_at    TIMESTAMP DEFAULT NOW()
);
```

---

### 8. call_logs

Audio and video call records.

```sql
CREATE TABLE call_logs (
  id                SERIAL PRIMARY KEY,
  channel_id        INTEGER REFERENCES channels(id),
  call_type         VARCHAR(10) NOT NULL,            -- audio | video
  started_at        TIMESTAMP NOT NULL,
  ended_at          TIMESTAMP,
  duration_secs     INTEGER,
  started_by        INTEGER REFERENCES users(id),
  transcript        TEXT,                            -- Whisper AI output
  ai_summary        TEXT,                            -- AI-generated summary
  pci_activity_id   INTEGER,                         -- linked PCI Activity record
  pci_activity_type VARCHAR(50),                     -- Video Call | Audio Call
  pci_subject       VARCHAR(255),                    -- editable subject for PCI log
  logged_to_pci     BOOLEAN DEFAULT FALSE,
  log_skipped       BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMP DEFAULT NOW()
);
```

---

### 9. call_participants

Users in each call.

```sql
CREATE TABLE call_participants (
  call_id     INTEGER NOT NULL REFERENCES call_logs(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  pci_person_id INTEGER,                             -- matched PCI People record
  joined_at   TIMESTAMP DEFAULT NOW(),
  left_at     TIMESTAMP,
  PRIMARY KEY (call_id, user_id)
);
```

---

### 10. pci_log_settings

Per-conversation PCI activity logging configuration.

```sql
CREATE TABLE pci_log_settings (
  id              SERIAL PRIMARY KEY,
  channel_id      INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enabled         BOOLEAN DEFAULT FALSE,
  trigger         VARCHAR(30) DEFAULT 'manual',      -- manual | on_call_end | on_close
  activity_type   VARCHAR(50) DEFAULT 'Chat Session',
  subject_template VARCHAR(255),
  auto_people     BOOLEAN DEFAULT TRUE,              -- auto-match participants to PCI People
  auto_entities   BOOLEAN DEFAULT TRUE,              -- auto-match PCI Entities
  auto_files      BOOLEAN DEFAULT FALSE,             -- auto-attach shared files
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE (channel_id, user_id)
);
```

---

### 11. scheduled_meetings

Meeting cards posted from PCI into channels.

```sql
CREATE TABLE scheduled_meetings (
  id                SERIAL PRIMARY KEY,
  channel_id        INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  message_id        INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  pci_activity_id   INTEGER NOT NULL,
  subject           VARCHAR(255) NOT NULL,
  meeting_date      TIMESTAMP NOT NULL,
  duration_minutes  INTEGER DEFAULT 60,
  participants      JSONB,                           -- array of names
  status            VARCHAR(20) DEFAULT 'scheduled', -- scheduled | in_progress | completed | canceled
  call_log_id       INTEGER REFERENCES call_logs(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);
```

---

### 12. notifications

In-app notifications per user.

```sql
CREATE TABLE notifications (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          VARCHAR(50) NOT NULL,                -- message | call_missed | automation | meeting | dwm
  title         VARCHAR(255),
  body          TEXT,
  channel_id    INTEGER REFERENCES channels(id),
  message_id    INTEGER REFERENCES messages(id),
  read          BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMP DEFAULT NOW()
);
```

---

### 13. automation_events

Log of all automation triggers and actions.

```sql
CREATE TABLE automation_events (
  id              SERIAL PRIMARY KEY,
  event_type      VARCHAR(50) NOT NULL,              -- smart_logger | meeting_briefing | dwm_trigger | auto_channel | smart_notif
  channel_id      INTEGER REFERENCES channels(id),
  triggered_by    VARCHAR(50),                       -- pci | system | user
  payload         JSONB,                             -- full context data
  status          VARCHAR(20) DEFAULT 'success',     -- success | failed | skipped
  created_at      TIMESTAMP DEFAULT NOW()
);
```

---

### 14. automation_settings

Per-tenant automation on/off configuration.

```sql
CREATE TABLE automation_settings (
  id              SERIAL PRIMARY KEY,
  tenant_id       VARCHAR(100) NOT NULL UNIQUE,
  smart_logger    BOOLEAN DEFAULT TRUE,
  meeting_briefing BOOLEAN DEFAULT TRUE,
  briefing_minutes_before INTEGER DEFAULT 15,
  dwm_trigger     BOOLEAN DEFAULT TRUE,
  auto_channel    BOOLEAN DEFAULT FALSE,
  smart_notif     BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

---

## Indexes

```sql
-- Messages
CREATE INDEX idx_messages_channel_created ON messages(channel_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_pinned ON messages(channel_id) WHERE pinned = TRUE;

-- Sessions
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Users
CREATE INDEX idx_users_pci_id ON users(pci_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tenant ON users(tenant_id);

-- Notifications
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE read = FALSE;

-- Call logs
CREATE INDEX idx_call_logs_channel ON call_logs(channel_id);
CREATE INDEX idx_call_logs_logged ON call_logs(logged_to_pci);

-- Files
CREATE INDEX idx_files_channel ON files(channel_id);

-- Channel members
CREATE INDEX idx_channel_members_user ON channel_members(user_id);
```

---

## Key Design Decisions

1. **`message_type`** — single messages table handles all card types (meeting, DWM, briefing) via `automation_payload` JSONB field. No separate tables per card type.

2. **`pci_log_settings`** — per user per channel. Same channel can have different log settings for different users.

3. **`call_participants.pci_person_id`** — Smart Logger auto-matches IAS Hub users to PCI People records. Stored at participant level, not call level.

4. **Soft delete on messages** — `deleted_at` instead of hard delete. "Message deleted" shown in UI, content removed.

5. **`automation_settings`** — one row per tenant. All automation toggles in one place.

6. **JSONB for `automation_payload`** — flexible, no schema change needed when adding new automation card types.
