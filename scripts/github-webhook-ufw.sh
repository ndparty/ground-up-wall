#!/usr/bin/env bash
# Sync UFW allow rules for the GitHub webhook listener from api.github.com/meta hooks CIDRs.
# Optional — only when auto-deploy on GitHub Release is enabled (docs/phase02/oracle_vps_deploy.md §10.2).
#
# Usage:
#   sudo ./scripts/github-webhook-ufw.sh              # add missing GitHub hook CIDRs
#   sudo ./scripts/github-webhook-ufw.sh --purge      # remove github-hooks rules, re-fetch all
#   sudo GITHUB_WEBHOOK_PORT=9000 ./scripts/github-webhook-ufw.sh
set -euo pipefail

GITHUB_META_URL="https://api.github.com/meta"
GH_COMMENT="github-hooks"
PORT="${GITHUB_WEBHOOK_PORT:-9000}"
PURGE=false

usage() {
  cat <<EOF
Usage: github-webhook-ufw.sh [--purge] [--port PORT]

  (default)  Fetch GitHub hooks CIDRs and add missing UFW rules for the webhook port.
  --purge    Delete all UFW rules tagged "github-hooks", then re-fetch and re-apply.
             Also removes world-open PORT/tcp rules for the webhook port.

  PORT defaults to 9000, or set GITHUB_WEBHOOK_PORT.

Does not modify SSH, 80/443, or Cloudflare rules. Mirror the same CIDRs in OCI Security List
for the webhook port separately (docs/phase02/oracle_vps_deploy.md §10.2).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --purge) PURGE=true; shift ;;
    --port)
      PORT="${2:?error: --port requires a value}"
      shift 2
      ;;
    -h|--help) usage; exit 0 ;;
    *) echo "error: unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "error: run as root (sudo)" >&2
  exit 1
fi

if ! command -v ufw >/dev/null 2>&1; then
  echo "error: ufw not found" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "error: python3 required to parse GitHub meta JSON" >&2
  exit 1
fi

TMP_META="$(mktemp)"
TMP_CIDRS="$(mktemp)"
trap 'rm -f "$TMP_META" "$TMP_CIDRS"' EXIT

delete_rule_numbers() {
  local -a nums=("$@")
  local num
  for num in "${nums[@]}"; do
    [[ -n "$num" ]] || continue
    echo "==> delete ufw rule $num"
    yes | ufw delete "$num" >/dev/null
  done
}

collect_github_rule_numbers() {
  ufw status numbered 2>/dev/null \
    | grep -F "# $GH_COMMENT" \
    | sed -n 's/^\[\s*\([0-9]*\)\].*/\1/p' \
    | sort -rn
}

collect_world_open_port_rule_numbers() {
  ufw status numbered 2>/dev/null \
    | grep -F "${PORT}/tcp" \
    | grep -E 'ALLOW IN[[:space:]]+Anywhere' \
    | grep -vF "# $GH_COMMENT" \
    | sed -n 's/^\[\s*\([0-9]*\)\].*/\1/p' \
    | sort -rn
}

purge_github_rules() {
  mapfile -t nums < <(collect_github_rule_numbers)
  if [[ ${#nums[@]} -eq 0 ]]; then
    echo "==> no github-hooks-tagged ufw rules to purge"
    return
  fi
  delete_rule_numbers "${nums[@]}"
}

remove_world_open_port_rules() {
  mapfile -t nums < <(collect_world_open_port_rule_numbers)
  if [[ ${#nums[@]} -eq 0 ]]; then
    echo "==> no world-open ${PORT}/tcp ufw rules to remove"
    return
  fi
  delete_rule_numbers "${nums[@]}"
}

rule_exists() {
  local cidr=$1
  ufw status numbered 2>/dev/null \
    | grep -F " $cidr " \
    | grep -F "${PORT}/tcp" \
    | grep -qF "# $GH_COMMENT"
}

add_cidr() {
  local cidr=$1
  if rule_exists "$cidr"; then
    echo "skip $cidr port $PORT (already allowed)"
  else
    echo "==> allow from $cidr to port $PORT"
    ufw allow from "$cidr" to any port "$PORT" proto tcp comment "$GH_COMMENT"
  fi
}

fetch_github_hook_cidrs() {
  echo "==> fetch $GITHUB_META_URL"
  curl -fsS "$GITHUB_META_URL" -o "$TMP_META"

  if [[ ! -s "$TMP_META" ]]; then
    echo "error: empty response from GitHub meta API" >&2
    exit 1
  fi

  python3 - "$TMP_META" > "$TMP_CIDRS" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as f:
    data = json.load(f)

hooks = data.get("hooks")
if not hooks:
    raise SystemExit("error: no hooks CIDRs in GitHub meta response")

for cidr in hooks:
    print(cidr)
PY

  if [[ ! -s "$TMP_CIDRS" ]]; then
    echo "error: failed to extract hooks CIDRs" >&2
    exit 1
  fi
}

apply_github_hook_cidrs() {
  local cidr
  while IFS= read -r cidr || [[ -n "$cidr" ]]; do
    [[ -z "$cidr" ]] && continue
    add_cidr "$cidr"
  done < "$TMP_CIDRS"
}

if [[ "$PURGE" == true ]]; then
  purge_github_rules
fi

echo "==> webhook listener port: $PORT"
fetch_github_hook_cidrs
apply_github_hook_cidrs
remove_world_open_port_rules

echo "==> ufw status (github-hooks rules)"
ufw status numbered | grep -F "# $GH_COMMENT" || true
echo "==> done"
