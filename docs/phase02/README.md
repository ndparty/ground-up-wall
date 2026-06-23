# Phase 02 — Oracle VPS production

Production deployment for the Phase 01 application on an **Oracle Cloud Always Free** VPS. Same stack as local dev (Deno + PostgreSQL + filesystem storage); no Deno Deploy or Supabase.

| Document | Purpose |
|----------|---------|
| [oracle_vps_deploy.md](oracle_vps_deploy.md) | Full ops guide: firewall, Postgres, systemd, Caddy, Cloudflare, deploy, backups |
| [../deploy/ground-up-wall.service](../../deploy/ground-up-wall.service) | systemd unit file (copy to `/etc/systemd/system/`) |

**Deploy:** tag-based via [`scripts/deploy.sh`](../../scripts/deploy.sh) — checkout `v*`, migrate, restart, health check.

**App flags:** `DEPLOYED=1` in `.env` enables HSTS, Secure cookies, and required seed passwords.
