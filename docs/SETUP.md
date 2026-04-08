# IAS Hub — Setup Guide

## Prerequisites

- Node.js 20+
- Docker + Docker Compose v2
- Git

---

## Quick Start (New Tenant)

```bash
git clone https://github.com/pussycat993-gif/planet-ias-hub.git
cd planet-ias-hub
npm install
bash scripts/setup.sh
```

The setup wizard will ask for:
- Tenant ID
- PLANet Contact IAS URL
- Database password
- JWT Secret (must match PCI `.env`)
- Server public IP (for WebRTC)
- SMTP config (optional, for password reset)

It will then start Docker, run migrations, and seed the database automatically.

---

## Manual Setup

### 1. Clone and install

```bash
git clone https://github.com/pussycat993-gif/planet-ias-hub.git
cd planet-ias-hub
npm install
```

### 2. Configure environment

```bash
cp docker/.env.example .env
```

Edit `.env`:
- `JWT_SECRET` — must match PLANet Contact IAS `.env`
- `PCI_API_URL` — URL of the PCI Laravel app (e.g. `https://ias-app.planetsg.com`)
- `DB_PASS` — strong password
- `MEDIASOUP_ANNOUNCED_IP` — your server's public IP

### 3. Start Docker stack

```bash
cd docker && docker compose up -d
```

Services started:
- `ias-hub-app` — Node.js server (port 3001)
- `ias-hub-postgres` — PostgreSQL 16 (internal)
- `ias-hub-redis` — Redis 7 (internal)
- `ias-hub-whisper` — Whisper AI transcription (port 9000)
- `ias-hub-coturn` — TURN/STUN server (port 3478)

### 4. Run migrations and seed

```bash
cd ..
npm run migrate --workspace=server
npm run seed --workspace=server
```

---

## Development Mode

```bash
# Start only PostgreSQL and Redis in Docker
cd docker && docker compose up -d postgres redis && cd ..

# Start server with live reload
npm run dev:server

# Start React frontend
npm run dev:client

# Start Electron (after frontend is running)
npm run dev:electron
```

---

## Helper Scripts

```bash
bash scripts/hub.sh start       # Start all Docker services
bash scripts/hub.sh stop        # Stop all services
bash scripts/hub.sh restart     # Restart all services
bash scripts/hub.sh logs        # Tail app logs
bash scripts/hub.sh migrate     # Run pending migrations
bash scripts/hub.sh reset-db    # Reset database (⚠ deletes all data)
```

---

## Docker Stack Details

| Service | Image | Port | Purpose |
|---|---|---|---|
| app | custom (Node 20) | 3001 | IAS Hub backend |
| postgres | postgres:16-alpine | internal | Database |
| redis | redis:7-alpine | internal | Cache + presence |
| whisper | openai-whisper-asr-webservice | 9000 | AI transcription |
| coturn | coturn/coturn | 3478 | WebRTC TURN/STUN |

---

## Infrastructure Requirements (per tenant)

| Resource | Minimum |
|---|---|
| CPU | 4 vCPU |
| RAM | 8 GB |
| Storage | 100 GB |
| Ports open | 443 (HTTPS), 3001 (API), 3478 (TURN/STUN) |
| OS | Ubuntu 20.04+ / Debian 11+ |

---

## Connecting to PLANet Contact IAS

IAS Hub uses JWT SSO. The `JWT_SECRET` in IAS Hub `.env` must match the PCI `.env`.

PCI must have the IAS Connect API endpoints installed (`/api/ias-connect/*`).
See [API.md](API.md) for the full list of required PCI endpoints.

---

## Production Build

```bash
# Build server + client
npm run build

# Package Electron app
npm run package
```

Output in `dist/`:
- `IAS Hub.dmg` (macOS)
- `IAS Hub Setup.exe` (Windows)
- `IAS Hub.AppImage` (Linux)

---

## Troubleshooting

**Docker containers not starting:**
```bash
cd docker && docker compose logs app
docker compose down && docker compose up -d --build
```

**Database connection error:**
- In Docker: use `DB_HOST=postgres`
- Local dev: use `DB_HOST=localhost`
- Wait 15s for PostgreSQL healthcheck

**WebRTC calls not connecting:**
- Check `MEDIASOUP_ANNOUNCED_IP` matches your server's public IP
- Verify port 3478 is open on firewall
- Check Coturn logs: `docker logs ias-hub-coturn`

**Whisper transcription failing:**
- Check Whisper service: `docker logs ias-hub-whisper`
- Verify `WHISPER_API_URL=http://whisper:9000` in Docker env
