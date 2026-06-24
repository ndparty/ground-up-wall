#!/usr/bin/env bash
# Sync UFW allow rules for ports 80/443 from Cloudflare published IP ranges.
# Run on the VPS as root after Caddy/LE is working (docs/phase02/oracle_vps_deploy.md §9.2).
#
# Usage:
#   sudo ./scripts/cloudflare-ufw.sh           # add missing Cloudflare CIDRs
#   sudo ./scripts/cloudflare-ufw.sh --purge   # remove cloudflare rules, re-fetch all
set -euo pipefail

CF_IPV4_URL="https://www.cloudflare.com/ips-v4"
CF_IPV6_URL="https://www.cloudflare.com/ips-v6"
CF_COMMENT="cloudflare"
PORTS=(80 443)
PURGE=false

usage() {
  cat <<'EOF'
Usage: cloudflare-ufw.sh [--purge]

  (default)  Fetch Cloudflare IPv4/IPv6 ranges and add missing UFW rules for 80/443.
  --purge    Delete all UFW rules tagged "cloudflare", then re-fetch and re-apply.
             Also removes world-open 80/tcp and 443/tcp rules from initial bootstrap.

Does not modify SSH or other ports. Mirror the same CIDRs in OCI Security List separately.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --purge) PURGE=true; shift ;;
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

TMP_IPV4="$(mktemp)"
TMP_IPV6="$(mktemp)"
trap 'rm -f "$TMP_IPV4" "$TMP_IPV6"' EXIT

delete_rule_numbers() {
  local -a nums=("$@")
  local num
  for num in "${nums[@]}"; do
    [[ -n "$num" ]] || continue
    echo "==> delete ufw rule $num"
    yes | ufw delete "$num" >/dev/null
  done
}

collect_cloudflare_rule_numbers() {
  ufw status numbered 2>/dev/null \
    | grep -F "# $CF_COMMENT" \
    | sed -n 's/^\[\s*\([0-9]*\)\].*/\1/p' \
    | sort -rn
}

collect_world_open_web_rule_numbers() {
  ufw status numbered 2>/dev/null \
    | grep -E '(80|443)/tcp' \
    | grep -E 'ALLOW IN[[:space:]]+Anywhere' \
    | grep -vF "# $CF_COMMENT" \
    | sed -n 's/^\[\s*\([0-9]*\)\].*/\1/p' \
    | sort -rn
}

purge_cloudflare_rules() {
  mapfile -t nums < <(collect_cloudflare_rule_numbers)
  if [[ ${#nums[@]} -eq 0 ]]; then
    echo "==> no cloudflare-tagged ufw rules to purge"
    return
  fi
  delete_rule_numbers "${nums[@]}"
}

remove_world_open_web_rules() {
  mapfile -t nums < <(collect_world_open_web_rule_numbers)
  if [[ ${#nums[@]} -eq 0 ]]; then
    echo "==> no world-open 80/443 ufw rules to remove"
    return
  fi
  delete_rule_numbers "${nums[@]}"
}

rule_exists() {
  local cidr=$1 port=$2
  ufw status numbered 2>/dev/null \
    | grep -F " $cidr " \
    | grep -F "${port}/tcp" \
    | grep -qF "# $CF_COMMENT"
}

add_cidr() {
  local cidr=$1
  local port
  for port in "${PORTS[@]}"; do
    if rule_exists "$cidr" "$port"; then
      echo "skip $cidr port $port (already allowed)"
    else
      echo "==> allow from $cidr to port $port"
      ufw allow from "$cidr" to any port "$port" proto tcp comment "$CF_COMMENT"
    fi
  done
}

fetch_cloudflare_ips() {
  echo "==> fetch $CF_IPV4_URL"
  curl -fsS "$CF_IPV4_URL" -o "$TMP_IPV4"
  echo "==> fetch $CF_IPV6_URL"
  curl -fsS "$CF_IPV6_URL" -o "$TMP_IPV6"

  if [[ ! -s "$TMP_IPV4" ]]; then
    echo "error: empty IPv4 list from Cloudflare" >&2
    exit 1
  fi
  if [[ ! -s "$TMP_IPV6" ]]; then
    echo "error: empty IPv6 list from Cloudflare" >&2
    exit 1
  fi
}

apply_cloudflare_ips() {
  local ip
  while IFS= read -r ip || [[ -n "$ip" ]]; do
    [[ -z "$ip" ]] && continue
    add_cidr "$ip"
  done < "$TMP_IPV4"

  while IFS= read -r ip || [[ -n "$ip" ]]; do
    [[ -z "$ip" ]] && continue
    add_cidr "$ip"
  done < "$TMP_IPV6"
}

if [[ "$PURGE" == true ]]; then
  purge_cloudflare_rules
fi

fetch_cloudflare_ips
apply_cloudflare_ips
remove_world_open_web_rules

echo "==> ufw status (cloudflare rules)"
ufw status numbered | grep -F "# $CF_COMMENT" || true
echo "==> done"
