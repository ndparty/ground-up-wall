#!/usr/bin/env bash
# Deploy a tagged release and restart the app. Run on the VPS as root (or with sudo).
#
# VPS layout:
#   APP_HOME=/opt/ground-up-wall          — groundupwall $HOME (.ssh, .env)
#   APP_DIR=/opt/ground-up-wall/ground-up-wall — git checkout (this script)
#
# Usage:
#   sudo ./scripts/deploy.sh           # latest v* tag
#   sudo ./scripts/deploy.sh v1.0.2    # specific tag
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/ground-up-wall/ground-up-wall}"
ENV_FILE="${ENV_FILE:-/opt/ground-up-wall/.env}"
APP_USER="${APP_USER:-groundupwall}"
SERVICE_NAME="${SERVICE_NAME:-ground-up-wall}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8080/api/health}"
TAG="${1:-}"

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "error: $APP_DIR is not a git checkout" >&2
  exit 1
fi

cd "$APP_DIR"

echo "==> fetch tags"
sudo -u "$APP_USER" git fetch --tags origin

if [[ -z "$TAG" ]]; then
  TAG="$(sudo -u "$APP_USER" git tag -l 'v*' --sort=-v:refname | head -1)"
  if [[ -z "$TAG" ]]; then
    echo "error: no v* tags found" >&2
    exit 1
  fi
  echo "==> latest tag: $TAG"
else
  echo "==> deploying tag: $TAG"
fi

sudo -u "$APP_USER" git checkout --force "$TAG"

echo "==> install dependencies"
sudo -u "$APP_USER" deno install --lock=deno.lock

echo "==> cache dependencies"
sudo -u "$APP_USER" deno cache --lock=deno.lock prod.ts main.ts

echo "==> migrate database"
sudo -u "$APP_USER" bash -c "
  cd '$APP_DIR'
  if [[ -f '$ENV_FILE' ]]; then
    set -a
    # shellcheck disable=SC1090
    source '$ENV_FILE'
    set +a
  fi
  deno task db:migrate
"

echo "==> restart $SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo "==> health check"
sleep 2
curl -fsS "$HEALTH_URL" | grep -q '"ok":true' || {
  echo "error: health check failed at $HEALTH_URL" >&2
  journalctl -u "$SERVICE_NAME" -n 30 --no-pager >&2 || true
  exit 1
}

echo "Deployed $TAG successfully."
