#!/bin/bash
# IAS Hub — Start/Stop/Reset helpers

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOCKER_DIR="$ROOT_DIR/docker"

case "$1" in
  start)
    echo "▶ Starting IAS Hub..."
    cd "$DOCKER_DIR" && docker compose up -d
    echo "✅ IAS Hub running on port 3001"
    ;;
  stop)
    echo "⏹ Stopping IAS Hub..."
    cd "$DOCKER_DIR" && docker compose down
    echo "✅ Stopped"
    ;;
  restart)
    echo "🔄 Restarting IAS Hub..."
    cd "$DOCKER_DIR" && docker compose down && docker compose up -d
    echo "✅ Restarted"
    ;;
  logs)
    cd "$DOCKER_DIR" && docker compose logs -f app
    ;;
  migrate)
    echo "▶ Running migrations..."
    cd "$ROOT_DIR" && npm run migrate --workspace=server
    ;;
  reset-db)
    echo "⚠  This will DELETE all data. Are you sure? (y/N)"
    read -r confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
      cd "$DOCKER_DIR" && docker compose down -v
      docker compose up -d postgres redis
      sleep 10
      cd "$ROOT_DIR"
      npm run migrate --workspace=server
      npm run seed --workspace=server
      echo "✅ Database reset complete"
    else
      echo "Aborted."
    fi
    ;;
  *)
    echo "Usage: bash scripts/hub.sh [start|stop|restart|logs|migrate|reset-db]"
    ;;
esac
