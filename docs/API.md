# IAS Hub — API Specification

## Overview

Base URL: `http://localhost:3001/api` (dev) | `https://hub.yourdomain.com/api` (prod)

All endpoints except `/auth/*` require:
```
Authorization: Bearer {session_token}
```

All responses follow this structure:
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

---

## Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/sso` | SSO login via PCI JWT token |
| POST | `/auth/login` | Standalone email + password login |
| GET | `/auth/me` | Get current user profile |
| POST | `/auth/logout` | Invalidate session |
| POST | `/auth/refresh` | Refresh session token |
| POST | `/auth/reset-password` | Request password reset (external users) |

### POST /auth/sso
```json
// Request
{ "token": "eyJhbGci..." }

// Response 200
{
  "success": true,
  "data": {
    "token": "eyJhbGci...",
    "user": {
      "id": 1,
      "name": "Ivana Vrtunic",
      "email": "ivana.vrtunic@planetsg.com",
      "role": "admin",
      "user_type": "sso",
      "avatar_url": "https://..."
    }
  }
}
```

### POST /auth/login
```json
// Request
{ "email": "user@example.com", "password": "secure_password" }

// Response 200
{ "success": true, "data": { "token": "...", "user": { ... } } }

// Response 401
{ "success": false, "error": "Invalid credentials" }
```

---

## Users

| Method | Endpoint | Description |
|---|---|---|
| GET | `/users` | List all users in tenant |
| GET | `/users/:id` | Get user by ID |
| PATCH | `/users/:id/status` | Update presence status |
| PATCH | `/users/:id/status-message` | Update custom status message |
| GET | `/users/:id/presence` | Get user presence |

### GET /users
```json
// Response 200
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Ivana Vrtunic",
      "email": "ivana.vrtunic@planetsg.com",
      "avatar_url": "...",
      "status": "online",
      "status_message": "In a meeting until 3 PM",
      "user_type": "sso",
      "role": "admin"
    }
  ]
}
```

### PATCH /users/:id/status
```json
// Request
{ "status": "away" }  // online | away | offline
```

---

## Channels

| Method | Endpoint | Description |
|---|---|---|
| GET | `/channels` | List all channels for current user |
| POST | `/channels` | Create new channel or group |
| GET | `/channels/:id` | Get channel details |
| PATCH | `/channels/:id` | Update channel name/description |
| DELETE | `/channels/:id` | Archive channel |
| GET | `/channels/:id/members` | List channel members |
| POST | `/channels/:id/members` | Add member to channel |
| DELETE | `/channels/:id/members/:userId` | Remove member |
| GET | `/channels/:id/unread` | Get unread count |
| POST | `/channels/:id/read` | Mark channel as read |

### GET /channels
```json
// Response 200
{
  "success": true,
  "data": {
    "public": [ { "id": 1, "name": "general", "type": "public", "unread_count": 3 } ],
    "groups": [ { "id": 4, "name": "PSG Dev Team", "type": "group", "logo_color": "#1565c0", "logo_abbr": "PSG" } ],
    "dms": [ { "id": 7, "type": "dm", "other_user": { "id": 2, "name": "Bugarski, Staša", "status": "online" } } ]
  }
}
```

### POST /channels
```json
// Request
{
  "name": "ias-project",
  "type": "public",             // public | private | group
  "description": "IAS project discussions",
  "logo_color": "#1565c0",      // for groups
  "logo_abbr": "IAS",           // for groups
  "member_ids": [2, 3, 4]       // optional
}
```

---

## Messages

| Method | Endpoint | Description |
|---|---|---|
| GET | `/channels/:id/messages` | Get messages (paginated) |
| POST | `/channels/:id/messages` | Send message |
| PATCH | `/messages/:id` | Edit message |
| DELETE | `/messages/:id` | Soft delete message |
| POST | `/messages/:id/reactions` | Add emoji reaction |
| DELETE | `/messages/:id/reactions/:emoji` | Remove reaction |
| GET | `/channels/:id/messages/pinned` | Get pinned messages |
| PATCH | `/messages/:id/pin` | Pin/unpin message |
| GET | `/channels/:id/messages/search` | Search messages in channel |

### GET /channels/:id/messages
```json
// Query params: ?limit=50&before=2026-03-27T10:00:00Z

// Response 200
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": 101,
        "sender": { "id": 2, "name": "Bugarski, Staša", "avatar_url": "..." },
        "body": "IAS-536 migration is done",
        "message_type": "text",
        "created_at": "2026-03-27T09:14:00Z",
        "edited": false,
        "pinned": false,
        "reactions": [],
        "reply_to": null
      }
    ],
    "has_more": true,
    "next_cursor": "2026-03-27T09:00:00Z"
  }
}
```

### POST /channels/:id/messages
```json
// Request
{
  "body": "Hello team!",
  "message_type": "text",
  "reply_to_id": null
}
```

---

## Files

| Method | Endpoint | Description |
|---|---|---|
| POST | `/channels/:id/files` | Upload file |
| GET | `/channels/:id/files` | List files in channel |
| GET | `/files/:id/download` | Download file |
| DELETE | `/files/:id` | Delete file |

### POST /channels/:id/files
```
Content-Type: multipart/form-data
Body: file (binary), message_body (optional text)

Response 200:
{
  "success": true,
  "data": {
    "file_id": 55,
    "message_id": 201,
    "file_name": "dwm_test_data_v2.sql",
    "file_size": 43008,
    "mime_type": "application/sql",
    "storage_path": "/uploads/tenant/2026/03/dwm_test_data_v2.sql"
  }
}
```

---

## Calls

| Method | Endpoint | Description |
|---|---|---|
| POST | `/calls/start` | Start a call |
| POST | `/calls/:id/end` | End a call |
| POST | `/calls/:id/join` | Join existing call |
| GET | `/calls/:id` | Get call details |
| GET | `/calls/history` | Get call history |
| POST | `/calls/:id/transcribe` | Request Whisper transcription |
| POST | `/calls/:id/log-to-pci` | Log call to PCI as activity |

### POST /calls/start
```json
// Request
{
  "channel_id": 1,
  "call_type": "video"   // audio | video
}

// Response 200
{
  "success": true,
  "data": {
    "call_id": 42,
    "mediasoup_router_id": "abc123",
    "ice_servers": [ { "urls": "turn:...", "username": "...", "credential": "..." } ]
  }
}
```

### POST /calls/:id/transcribe
```json
// Request: multipart/form-data with audio file
// or: { "audio_url": "..." } if stored on server

// Response 200
{
  "success": true,
  "data": {
    "transcript": "Ivana V. [00:00] IAS-536 migration is done...\nStaša B. [00:18] Yes, there's an edge case...",
    "ai_summary": "Topic: IAS-536 and IAS-537...\nKey points: ...\nAction items: ..."
  }
}
```

### POST /calls/:id/log-to-pci
```json
// Request
{
  "activity_type": "Video Call",
  "subject": "Video Call — IAS-537 discussion",
  "started_at": "2026-03-27T09:41:00Z",
  "ended_at": "2026-03-27T09:53:44Z",
  "participant_pci_ids": [102, 215],
  "entity_pci_ids": [44],
  "file_names": ["dwm_test_data_v2.sql"],
  "note": "AI summary text here..."
}

// Response 200
{
  "success": true,
  "data": {
    "pci_activity_id": 8821,
    "pci_activity_url": "https://ias-app.planetsg.com/activity/8821"
  }
}
```

---

## PCI Integration

| Method | Endpoint | Description |
|---|---|---|
| GET | `/pci/context/:personId` | Get PCI data for right panel |
| GET | `/pci/users` | Get PCI user roster (for SSO) |
| POST | `/pci/scheduled-meeting` | Receive scheduled meeting from PCI |
| DELETE | `/pci/scheduled-meeting/:id` | Cancel meeting card |
| POST | `/pci/activity-log` | Log activity to PCI |
| GET | `/pci/presence/:userId` | Push presence update to PCI |

### GET /pci/context/:personId
```json
// Response 200
{
  "success": true,
  "data": {
    "person": {
      "id": 102,
      "name": "Bugarski, Staša",
      "role": "FileMaker Developer",
      "email": "stash@planetsg.com",
      "company": "PSG",
      "status": "Active",
      "avatar_url": "..."
    },
    "recent_activities": [
      {
        "id": 8810,
        "type": "Video Call",
        "subject": "Meeting w/ Workgroup Team",
        "date": "2026-01-26 01:00",
        "status": "Complete"
      }
    ],
    "open_tasks": [
      { "id": 8815, "subject": "IAS-535 migration review", "status": "Active" }
    ],
    "entities": [
      { "id": 44, "name": "PSG Workgroup", "type": "Team" }
    ]
  }
}
```

### POST /pci/scheduled-meeting (called by PCI Laravel)
```json
// Request
{
  "channel_id": 1,
  "pci_activity_id": 9010,
  "subject": "Sprint 14 Kick-off",
  "meeting_date": "2026-03-30T10:00:00Z",
  "duration_minutes": 60,
  "participants": ["Staša B.", "Fedor D.", "Ivana V."]
}

// Response 200
{ "success": true, "data": { "message_id": 310, "meeting_id": 12 } }
```

---

## PCI Log Settings

| Method | Endpoint | Description |
|---|---|---|
| GET | `/channels/:id/pci-settings` | Get log settings for channel |
| PUT | `/channels/:id/pci-settings` | Save log settings for channel |

### PUT /channels/:id/pci-settings
```json
// Request
{
  "enabled": true,
  "trigger": "on_call_end",
  "activity_type": "Chat Session",
  "subject_template": "Discussion — #general",
  "auto_people": true,
  "auto_entities": true,
  "auto_files": false
}
```

---

## Notifications

| Method | Endpoint | Description |
|---|---|---|
| GET | `/notifications` | Get notifications for current user |
| PATCH | `/notifications/:id/read` | Mark as read |
| POST | `/notifications/read-all` | Mark all as read |
| GET | `/notifications/unread-count` | Get unread count |

---

## Automations

| Method | Endpoint | Description |
|---|---|---|
| GET | `/automation/settings` | Get tenant automation settings |
| PUT | `/automation/settings` | Save automation settings |
| GET | `/automation/events` | Get automation event log |
| POST | `/automation/simulate/:type` | Simulate automation (dev only) |

### PUT /automation/settings
```json
// Request
{
  "smart_logger": true,
  "meeting_briefing": true,
  "briefing_minutes_before": 15,
  "dwm_trigger": true,
  "auto_channel": false,
  "smart_notif": true
}
```

---

## WebSocket Events (Socket.io)

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `channel:join` | `channelId` | Join channel room |
| `channel:leave` | `channelId` | Leave channel room |
| `message:send` | `{ channelId, body, fileUrl? }` | Send message |
| `typing:start` | `channelId` | User started typing |
| `typing:stop` | `channelId` | User stopped typing |
| `call:start` | `{ channelId, type }` | Initiate call |
| `call:end` | `channelId` | End call |
| `presence:update` | `{ status }` | Update own presence |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `message:receive` | `{ message }` | New message in channel |
| `message:updated` | `{ messageId, body }` | Message edited |
| `message:deleted` | `{ messageId }` | Message deleted |
| `typing:update` | `{ userId, typing }` | Someone is/isn't typing |
| `call:incoming` | `{ callId, callerId, type }` | Incoming call |
| `call:ended` | `{ callId }` | Call ended |
| `presence:update` | `{ userId, status }` | User presence changed |
| `notification:new` | `{ notification }` | New notification |
| `automation:card` | `{ channelId, card }` | Automation card posted |
| `meeting:posted` | `{ channelId, meeting }` | Scheduled meeting card posted |

---

## Error Codes

| Code | HTTP | Description |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Invalid request data |
| `PCI_ERROR` | 502 | PCI API unreachable or returned error |
| `INTERNAL_ERROR` | 500 | Server error |
