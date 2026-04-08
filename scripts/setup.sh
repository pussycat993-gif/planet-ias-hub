#!/bin/bash
# IAS Hub — Tenant Setup Wizard
# Run: bash scripts/setup.sh

set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       IAS Hub — Tenant Setup Wizard      ║"
echo "╚══════════════════════════════════════════╝"
echo ""

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  echo "⚠  .env file already exists. Overwrite? (y/N)"
  read -r overwrite
  if [ "$overwrite" != "y" ] && [ "$overwrite" != "Y" ]; then
    echo "Aborted."
    exit 0
  fi
fi

echo "─────────────────────────────────────────────"
echo "Step 1 — Tenant Configuration"
echo "─────────────────────────────────────────────"

read -rp "Tenant ID (e.g. psg, acme-corp): " TENANT_ID
read -rp "PLANet Contact IAS URL (e.g. https://ias-app.planetsg.com): " PCI_API_URL

echo ""
echo "─────────────────────────────────────────────"
echo "Step 2 — Database"
echo "─────────────────────────────────────────────"

read -rp "Database password: " DB_PASS

echo ""
echo "─────────────────────────────────────────────"
echo "Step 3 — Security"
echo "─────────────────────────────────────────────"

echo "JWT_SECRET must match the JWT_SECRET in PLANet Contact IAS .env"
read -rp "JWT Secret (min 32 chars): " JWT_SECRET

echo ""
echo "─────────────────────────────────────────────"
echo "Step 4 — WebRTC (mediasoup)"
echo "─────────────────────────────────────────────"

read -rp "Server public IP (for WebRTC NAT traversal): " PUBLIC_IP

echo ""
echo "─────────────────────────────────────────────"
echo "Step 5 — Email (for password reset)"
echo "─────────────────────────────────────────────"

read -rp "SMTP Host (leave blank to skip): " SMTP_HOST
if [ -n "$SMTP_HOST" ]; then
  read -rp "SMTP Port (default 587): " SMTP_PORT
  SMTP_PORT=${SMTP_PORT:-587}
  read -rp "SMTP Username: " SMTP_USER
  read -rsp "SMTP Password: " SMTP_PASS
  echo ""
  read -rp "From email: " SMTP_FROM
fi

# Generate .env
cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=3001
TENANT_ID=${TENANT_ID}

DB_HOST=postgres
DB_PORT=5432
DB_NAME=ias_hub
DB_USER=ias_hub_user
DB_PASS=${DB_PASS}

REDIS_HOST=redis
REDIS_PORT=6379

JWT_SECRET=${JWT_SECRET}
PCI_API_URL=${PCI_API_URL}

WHISPER_API_URL=http://whisper:9000

MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=${PUBLIC_IP}

JIRA_CLOUD_ID=016ccab4-41b8-4069-b389-0e6f7385b912
JIRA_PROJECT_KEY=IAS

SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT:-587}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
SMTP_FROM=${SMTP_FROM}
EOF

# Update turnserver.conf with public IP
sed -i.bak "s/YOUR_SERVER_PUBLIC_IP/${PUBLIC_IP}/" "$ROOT_DIR/docker/turnserver.conf"
rm -f "$ROOT_DIR/docker/turnserver.conf.bak"

echo ""
echo "✅ .env created at $ENV_FILE"
echo ""
echo "─────────────────────────────────────────────"
echo "Starting IAS Hub..."
echo "─────────────────────────────────────────────"
echo ""

cd "$ROOT_DIR/docker"
docker compose up -d

echo ""
echo "⏳ Waiting for database..."
sleep 15

echo "▶  Running migrations..."
cd "$ROOT_DIR"
npm run migrate --workspace=server

echo "▶  Seeding database..."
npm run seed --workspace=server

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         IAS Hub is ready!                ║"
echo "║  Server:  http://localhost:3001           ║"
echo "╚══════════════════════════════════════════╝"
echo ""
