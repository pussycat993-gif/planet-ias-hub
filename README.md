# IAS Hub

Real-time communication desktop application — licensed add-on to PLANet Contact IAS.

## Product

IAS Hub provides PSG clients with integrated chat, voice, and video communication, deeply connected to their PLANet Contact IAS CRM data.

**Core features:**
- 1:1 chat and group channels
- Custom groups with logos
- Audio and video calls with screen share
- Post-call transcription (Whisper AI) and AI summary
- PCI activity logging — user-initiated, per-conversation
- Meeting prep briefing automation
- DWM workflow trigger cards
- Auto-channel creation from PCI projects
- AI assistant (Jira + PCI context)

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop | Electron |
| Frontend | React + TypeScript + Tailwind CSS |
| Backend | Node.js + Express |
| Real-time | Socket.io |
| Video/Audio | mediasoup (SFU) |
| Transcription | Whisper AI (local) |
| Database | PostgreSQL |
| Cache / Presence | Redis |
| Deployment | Docker Compose (self-hosted per tenant) |

## Project Structure

```
planet-ias-hub/
├── electron/        # Electron main process
├── client/          # React frontend
├── server/          # Node.js backend
├── docker/          # Docker Compose setup
└── docs/            # PRD, API spec, setup guide
```

## Getting Started

See [docs/SETUP.md](docs/SETUP.md) for full setup instructions.

```bash
# Install dependencies
npm install

# Start dev environment
npm run dev
```

## Integration with PLANet Contact IAS

IAS Hub connects to PCI via REST API using a shared JWT secret. See [docs/API.md](docs/API.md) for all required PCI endpoints.

## Related

- PLANet Contact IAS repo: `bitbucket.org/planet-ias/planet-contact-ias`
- PRD: [docs/PRD.md](docs/PRD.md)

---

Design by PLANet Systems Group | © IAS Hub 2026
