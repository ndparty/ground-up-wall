# Phase 02 — Oracle VPS production

Production deployment for the Phase 01 application on an **Oracle Cloud Always Free** VPS. Same
stack as local dev (Deno + PostgreSQL + filesystem storage); no Deno Deploy or Supabase.

| Document                                                                        | Purpose                                                                         |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [oracle_vps_deploy.md](oracle_vps_deploy.md)                                    | Full ops guide: firewall, Postgres, systemd, Caddy, Cloudflare, deploy, backups |
| [../deploy/ground-up-wall.service](../../deploy/ground-up-wall.service)         | systemd unit for the app (copy to `/etc/systemd/system/`)                       |
| [../deploy/webhook.service](../../deploy/webhook.service)                       | systemd unit for optional GitHub Release auto-deploy (§10.2)                    |
| [../deploy/webhook.hooks.json.example](../../deploy/webhook.hooks.json.example) | Example [adnanh/webhook](https://github.com/adnanh/webhook) hooks config        |

**Deploy:** tag-based via [`scripts/deploy.sh`](../../scripts/deploy.sh) — checkout `v*`, migrate,
restart, health check. Optional auto-deploy on GitHub Release:
[§10.2](oracle_vps_deploy.md#102-optional-auto-deploy-on-github-release).

**Firewall:** Cloudflare-only UFW rules via
[`scripts/cloudflare-ufw.sh`](../../scripts/cloudflare-ufw.sh) — see
[§9.2](oracle_vps_deploy.md#92-firewall-only-cloudflare-may-reach-80-and-443). Optional GitHub
webhook port via [`scripts/github-webhook-ufw.sh`](../../scripts/github-webhook-ufw.sh) — see
[§10.2.4](oracle_vps_deploy.md#1024-firewall-ufw--oci).

**VPS paths:** git checkout at `/opt/ground-up-wall/ground-up-wall` (`APP_DIR`); production `.env`
and Git auth in `/opt/ground-up-wall` (`APP_HOME`).

**App flags:** `DEPLOYED=1` in `.env` enables HSTS, Secure cookies, and required seed passwords.
