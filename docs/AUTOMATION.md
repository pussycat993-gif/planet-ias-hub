# IAS Hub — Automation Engine Specification

## Overview

The automation engine runs as part of the Node.js server. Each automation is an isolated module in `server/src/automation/`. Automations are triggered by:

- **WebSocket events** (message sent, call ended)
- **HTTP webhooks** from PLANet Contact IAS
- **Scheduled cron jobs** (meeting briefing timer)
- **User actions** (call end modal confirm)

---

## Architecture

```
PCI Webhook / Socket Event / Cron
          │
          ▼
   AutomationEngine (orchestrator)
          │
          ├── SmartLogger
          ├── MeetingBriefing (cron)
          ├── DWMTrigger
          ├── AutoChannel
          └── SmartNotifications
          │
          ▼
   Posts card/message to channel via Socket.io
   Logs event to automation_events table
```

---

## Automation 1: Smart Activity Logger

**Trigger:** Call ends (user clicks "End Call")  
**What it does:** AI scans the conversation in the active channel — detects Jira ticket mentions, participants, shared files — and auto-fills the PCI log modal before the user even opens it.

**Flow:**
1. Call ends → `call:end` socket event fires
2. SmartLogger fetches last 100 messages from channel
3. Scans for: Jira ticket patterns (`IAS-\d+`), file attachments, @mentions
4. Matches participants to PCI People records
5. Generates suggested subject from Jira tickets + channel name
6. Returns pre-filled payload → frontend opens modal with data filled in

**Input:**
```json
{ "call_id": 42, "channel_id": 1 }
```

**Output (to frontend):**
```json
{
  "suggested_subject": "Video Call — IAS-537 trigger matching discussion",
  "jira_tickets": ["IAS-536", "IAS-537"],
  "participants": [
    { "hub_user_id": 2, "pci_person_id": 215, "name": "Bugarski, Staša" }
  ],
  "entities": [{ "pci_entity_id": 44, "name": "PSG Workgroup" }],
  "files": ["dwm_test_data_v2.sql"],
  "action_items": ["Staša to fix NULL wildcard by EOD"]
}
```

---

## Automation 2: Meeting Prep Briefing

**Trigger:** Cron job, runs every minute, checks for meetings starting in N minutes  
**What it does:** 15 minutes before a scheduled meeting, posts a briefing card into the linked channel with attendee context from PCI (open activities, open tasks, last interaction) and Jira sprint status.

**Flow:**
1. Cron fires every 60 seconds
2. Queries `scheduled_meetings` WHERE `meeting_date` BETWEEN NOW() AND NOW() + briefing_minutes_before AND `status = 'scheduled'`
3. For each upcoming meeting: fetches PCI activities and tasks for each participant
4. Fetches current Jira sprint status
5. Posts `briefing_card` message to channel (pinned: false)
6. Sends notification to all channel members
7. Updates meeting status to `briefing_sent`

**Briefing card structure:**
```json
{
  "type": "briefing_card",
  "subject": "Sprint 14 Kick-off",
  "meeting_date": "2026-03-30T10:00:00Z",
  "attendees": ["Staša B.", "Fedor D.", "Ivana V."],
  "pci_activities": [
    { "person": "Staša B.", "subject": "IAS-535 migration", "status": "Active" }
  ],
  "jira_sprint": { "name": "Sprint 14", "done": 3, "in_progress": 3, "to_do": 2 },
  "last_interactions": [
    { "person": "Staša B.", "last_activity": "Pumble Call — Jan 26" }
  ]
}
```

---

## Automation 3: DWM Workflow Trigger

**Trigger:** PCI webhook on workflow step status change  
**What it does:** When a DWM workflow step changes in PLANet Contact IAS (e.g. Invoice → Approval Required), IAS Hub posts a DWM card into the relevant channel. The card has inline Approve/Reject actions that write back to PCI.

**Flow:**
1. PCI fires `POST /api/automation/dwm-trigger`
2. DWMTrigger identifies target channel (from `pci_entity_id` or `pci_project_id`)
3. Posts `dwm_card` message with step info and action buttons
4. User clicks Approve/Reject in IAS Hub
5. IAS Hub calls PCI API to update workflow step status
6. Card updates to show new status

**DWM card payload:**
```json
{
  "type": "dwm_card",
  "workflow_name": "Invoice Approval Flow",
  "document": "INV-2026-031",
  "entity": "Acme Corp",
  "step": "Step 2 — Manager Approval",
  "assigned_to": "Bedford, Dean",
  "status": "pending",
  "pci_workflow_step_id": 441,
  "pci_activity_id": 9010
}
```

---

## Automation 4: Auto-Channel from PCI

**Trigger:** PCI webhook on new Project or Entity creation  
**What it does:** When a new Project or Entity is created in PCI, IAS Hub automatically creates a channel, adds all linked People as members, and pins a card with the PCI record link.

**Flow:**
1. PCI fires `POST /api/automation/auto-channel`
2. AutoChannel creates new channel (type: `public`, name derived from project/entity)
3. Fetches linked People from PCI API
4. Matches People to IAS Hub users (by email or pci_id)
5. Adds matched users as channel members
6. Posts a system card with PCI project link
7. Sends notifications to all added members

**Channel naming:**
- Project: `project-{slug}` e.g. `project-ias-hub`
- Entity: `client-{slug}` e.g. `client-acme-corp`

---

## Automation 5: Smart Notifications

**Trigger:** Continuous — hooks into message and call events  
**What it does:** AI filters raw notification events and delivers only contextually relevant ones. Suppresses noise (e.g. messages in muted channels), elevates important ones (e.g. you are assignee on a mentioned Jira ticket), and sends reminders for unanswered calls.

**Rules engine:**
| Condition | Action |
|---|---|
| Message in muted channel | Suppress |
| @mention of current user | Always deliver |
| Jira ticket mentioned + user is assignee | Elevate priority |
| Missed call from any user | Remind after 1 hour if not answered |
| DWM step assigned to user | Always deliver |
| Meeting in 15 min | Always deliver (briefing) |
| Generic message, no mention | Deliver only if user is online |

---

## Webhook Endpoints (PCI → IAS Hub)

| Method | Endpoint | Automation |
|---|---|---|
| POST | `/api/automation/dwm-trigger` | DWM card in channel |
| POST | `/api/automation/auto-channel` | Create channel from PCI project/entity |

### POST /api/automation/dwm-trigger
```json
{
  "workflow_name": "Invoice Approval Flow",
  "document_name": "INV-2026-031",
  "pci_entity_id": 44,
  "pci_project_id": null,
  "step_name": "Step 2 — Manager Approval",
  "assigned_to_pci_id": 102,
  "pci_workflow_step_id": 441,
  "pci_activity_id": 9010,
  "status": "pending"
}
```

### POST /api/automation/auto-channel
```json
{
  "trigger": "project",
  "pci_project_id": 88,
  "name": "IAS Hub — v1.0",
  "linked_people_ids": [102, 215, 318]
}
```

---

## Cron Schedule

| Automation | Frequency | Description |
|---|---|---|
| Meeting Briefing | Every 60 seconds | Check for upcoming meetings |
| Smart Notifications | Every 30 minutes | Check for unanswered calls |
| Session cleanup | Every hour | Remove expired sessions from DB |
