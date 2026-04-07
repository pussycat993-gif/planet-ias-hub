# CLAUDE.md — IAS Hub Developer Guide

## Project Overview

IAS Hub is a standalone Electron desktop application and Node.js backend that serves as a real-time communication add-on to PLANet Contact IAS (PCI). It is developed and maintained by PLANet Systems Group.

## Repository

- **GitHub:** `github.com/planet-ias/planet-ias-hub`
- **Bitbucket (mirror):** `bitbucket.org/planet-ias/planet-ias-hub`
- **Related repo (PCI):** `bitbucket.org/planet-ias/planet-contact-ias`

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Desktop wrapper | Electron 29 | Windows / macOS / Linux |
| Frontend | React 18 + TypeScript | Vite build |
| Styling | Tailwind CSS | PCI design tokens in `client/src/styles/tokens.css` |
| State | Zustand | One store per domain (chat, calls, pci, ui) |
| Real-time | Socket.io | Client in `client/src/hooks/useSocket.ts` |
| Backend | Node.js + Express | Entry: `server/index.js` |
| Video/Audio | mediasoup | SFU — config in `server/src/mediasoup/` |
| Transcription | Whisper AI | Local HTTP service — wrapper in `server/src/whisper/` |
| Database | PostgreSQL | Models in `server/src/db/models/` |
| Cache/Presence | Redis | Presence keys: `presence:{userId}` |
| Auth | JWT | Shared secret with PCI — env: `JWT_SECRET` |
| Deployment | Docker Compose | One stack per tenant |

## Key Conventions

### Naming
- Components: PascalCase (`ChatHeader.tsx`, `CallBar.tsx`)
- Hooks: camelCase with `use` prefix (`useCall.ts`, `usePCI.ts`)
- API routes: kebab-case (`/api/pci-context`, `/api/activity-log`)
- DB tables: snake_case (`messages`, `channels`, `call_logs`)
- Socket events: camelCase (`message:send`, `call:start`, `presence:update`)

### PCI Colors (must match PLANet Contact IAS)
```css
--blue-primary: #1976d2;
--blue-dark:    #1565c0;
--blue-light:   #e3f2fd;
--green:        #2e7d32;
--red:          #c62828;
--orange:       #e65100;
```

### Status badge colors (same as PCI Activity List)
- Active → solid blue `#1565c0`
- Complete → solid green `#2e7d32`
- Canceled → solid red `#c62828`

## Environment Variables

Copy `docker/.env.example` to `.env` in root.

```env
# App
NODE_ENV=development
PORT=3001
CLIENT_PORT=5173

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ias_hub
DB_USER=ias_hub_user
DB_PASS=

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Auth (shared with PCI)
JWT_SECRET=
PCI_API_URL=https://ias-app.planetsg.com

# Whisper AI
WHISPER_API_URL=http://localhost:9000

# mediasoup
MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=127.0.0.1
```

## PCI API Integration

All calls to PLANet Contact IAS go through `server/src/pci/client.ts` — never call PCI directly from the frontend.

### Required PCI endpoints (to be built in Laravel):
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/ias-connect/auth/verify` | Validate JWT |
| GET | `/api/ias-connect/users` | User roster |
| GET | `/api/ias-connect/contact/{id}` | PCI context for right panel |
| POST | `/api/ias-connect/activity-log` | Log call/chat to PCI |
| GET | `/api/ias-connect/presence/{userId}` | Presence status |
| POST | `/api/ias-connect/scheduled-meeting` | Push meeting card to channel |
| DELETE | `/api/ias-connect/scheduled-meeting/{id}` | Cancel meeting card |

## Automation Modules

Each automation lives in `server/src/automation/`:

| File | Automation |
|---|---|
| `smartLogger.ts` | AI auto-fills PCI log modal from conversation context |
| `meetingBriefing.ts` | Posts briefing card 15 min before PCI meeting |
| `dwmTrigger.ts` | Posts DWM workflow step cards (approve/reject) |
| `autoChannel.ts` | Creates channel when PCI project/entity is created |
| `smartNotifications.ts` | AI filters and routes relevant notifications |

## Jira Integration

Jira is accessed read-only via Atlassian MCP server. Config in `server/src/jira/client.ts`.

- Cloud ID: `016ccab4-41b8-4069-b389-0e6f7385b912`
- Project key: `IAS`
- MCP server: `https://mcp.atlassian.com/v1/sse`

## Docker

```bash
# Start full stack (app + postgres + redis + coturn)
cd docker && docker-compose up -d

# Rebuild after changes
docker-compose up -d --build
```

## Development

```bash
# Install all dependencies
npm install

# Start dev (Electron + React + Node concurrently)
npm run dev

# Build for production
npm run build

# Package Electron app
npm run package
```

## Lessons Learned

1. Never call PCI API directly from React — always proxy through Node.js backend
2. mediasoup requires its own worker process — keep it isolated in `server/src/mediasoup/`
3. Whisper transcription is async — always show loading state, never block UI
4. Socket.io rooms map 1:1 to channels/DMs — room ID = channel ID
5. Presence is stored in Redis with TTL — not in PostgreSQL
