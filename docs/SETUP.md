# IAS Hub — Setup Guide

## Prerequisites

- Node.js 20+
- Docker + Docker Compose
- Git

## Local Development

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/planet-ias-hub.git
cd planet-ias-hub
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp docker/.env.example .env
```

Edit `.env` and fill in:
- `JWT_SECRET` — must match the secret in PLANet Contact IAS `.env`
- `PCI_API_URL` — URL of the PCI Laravel app
- `DB_PASS` — choose a local password

### 4. Start PostgreSQL and Redis via Docker

```bash
cd docker && docker-compose up -d postgres redis
cd ..
```

### 5. Start the development server

```bash
npm run dev
```

This starts:
- React frontend at `http://localhost:5173`
- Node.js backend at `http://localhost:3001`
- Electron app window (loads from Vite dev server)

---

## Production Deployment (Self-Hosted per Tenant)

### 1. Build

```bash
npm run build
```

### 2. Start full Docker stack

```bash
cp docker/.env.example .env
# fill in production values

cd docker && docker-compose up -d
```

### 3. Package Electron app for distribution

```bash
npm run package
```

Output in `dist/`:
- `IAS Hub.dmg` (macOS)
- `IAS Hub Setup.exe` (Windows)
- `IAS Hub.AppImage` (Linux)

---

## Connecting to PLANet Contact IAS

IAS Hub uses JWT-based SSO. The `JWT_SECRET` in IAS Hub `.env` must match the one configured in the PCI Laravel `.env`.

PCI must have the IAS Connect API endpoints installed. See [API.md](API.md) for the full list.

---

## Troubleshooting

**Electron blank screen:**
- Make sure Vite dev server is running (`npm run dev:client`)
- Check that port 5173 is not blocked

**Socket.io not connecting:**
- Verify Node.js backend is running on port 3001
- Check CORS settings in `server/src/index.ts`

**PCI API errors:**
- Confirm `PCI_API_URL` is correct in `.env`
- Confirm `JWT_SECRET` matches PCI

**PostgreSQL connection error:**
- Wait 15 seconds after `docker-compose up` for healthcheck to pass
- Check `DB_HOST=postgres` in Docker, `DB_HOST=localhost` in local dev
