# Oracle VPS deployment — Ubuntu 24.04

Production deployment for **Phase 1** (Deno Fresh + local PostgreSQL + filesystem storage) on an Oracle Cloud Always Free A1 instance, with **Caddy** on the origin, **Cloudflare** at the edge (recommended), and **tag-based** updates.

**Prerequisites on the VPS:** Ubuntu 24.04, sudo user (default `ubuntu` user removed), SSH key access.

---

## Where to find hardening steps

| What to harden | Section in this doc |
|----------------|---------------------|
| Oracle cloud network (Security List) | [§1](#1-oracle-cloud-firewall-security-list) |
| Ubuntu host firewall (UFW), SSH, auto-updates, fail2ban | [§2](#2-harden-ubuntu) |
| PostgreSQL (localhost only, least privilege) | [§3](#3-postgresql-localhost-only) |
| App Unix user, file permissions, `.env` | [§4](#4-application-user-and-directories)–[§5](#5-environment-file) |
| systemd service hardening | [§7](#7-systemd-service) |
| TLS origin (Caddy) | [§8](#8-caddy-https-origin) |
| Cloudflare edge + origin-only exposure | [§9](#9-cloudflare-recommended) |
| Backups | [§11](#11-backups-recommended) |

**Application-level security** (NFR-23: rate limits, CSRF, PoW, CSP) is already in code — enable with `DEPLOYED=1` in [§5](#5-environment-file). No extra app config for Cloudflare beyond what [§9](#9-cloudflare-recommended) describes.

---

## 1. Oracle cloud firewall (Security List)

In the OCI console for your VCN subnet, allow **ingress**:

| Port | Purpose |
|------|---------|
| 22/tcp | SSH (restrict source to your IP if possible) |
| 80/tcp | HTTP — **Let's Encrypt** ACME + redirect (restrict to Cloudflare IPs — [§9.2](#92-firewall-only-cloudflare-may-reach-80-and-443)) |
| 443/tcp | HTTPS from **Cloudflare only** ([§9.2](#92-firewall-only-cloudflare-may-reach-80-and-443)) |

Do **not** open **5432** (Postgres) or **8080** (app) to the internet. Caddy listens on **443**; the app binds **127.0.0.1:8080** only.

---

## 2. Harden Ubuntu

Run as your sudo user.

### 2.1 Packages

```bash
sudo apt update
sudo apt install -y ufw fail2ban unattended-upgrades postgresql postgresql-contrib caddy git
```

Install **Deno 2.x** (official installer):

```bash
curl -fsSL https://deno.land/install.sh | sh
echo 'export DENO_INSTALL="$HOME/.deno"' >> ~/.bashrc
echo 'export PATH="$DENO_INSTALL/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
deno --version
```

Copy `deno` to a system path for the app user (after creating the user in §4):

```bash
sudo cp "$(which deno)" /usr/local/bin/deno
```

### 2.2 UFW (defense in depth)

Oracle's security list is not enough — enable a host firewall:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
# 80 + 443 — tighten to Cloudflare IPs only after Caddy works (§9.2)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

> After Caddy obtains its first certificate, replace wide `allow 80/tcp` / `allow 443/tcp` with **Cloudflare-CIDR-only** rules so the origin cannot be bypassed.

### 2.3 SSH

Edit `/etc/ssh/sshd_config` (values may already be set):

```
PermitRootLogin no
PasswordAuthentication no
```

```bash
sudo systemctl reload ssh
```

### 2.4 Automatic security updates

```bash
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 2.5 Fail2ban (optional)

```bash
sudo systemctl enable --now fail2ban
```

---

## 3. PostgreSQL (localhost only)

```bash
sudo -u postgres psql <<'SQL'
CREATE USER groundupwall WITH PASSWORD 'CHANGE_ME_STRONG_DB_PASSWORD';
CREATE DATABASE ground_up_wall OWNER groundupwall;
GRANT ALL PRIVILEGES ON DATABASE ground_up_wall TO groundupwall;
SQL
```

Confirm Postgres listens on localhost only (`/etc/postgresql/*/main/postgresql.conf`):

```
listen_addresses = 'localhost'
```

```bash
sudo systemctl restart postgresql
```

---

## 4. Application user and directories

```bash
sudo useradd --system --home-dir /opt/ground-up-wall --create-home --shell /bin/bash groundupwall || true
sudo mkdir -p /var/lib/ground-up-wall/uploads
sudo chown -R groundupwall:groundupwall /var/lib/ground-up-wall
```

Clone the repo (replace with your Git URL):

```bash
sudo -u groundupwall git clone https://github.com/YOUR_ORG/ground-up-wall.git /opt/ground-up-wall
cd /opt/ground-up-wall
sudo -u groundupwall git checkout v1.0.1   # or latest v* tag
```

Cache dependencies once:

```bash
cd /opt/ground-up-wall
sudo -u groundupwall deno cache --lock=deno.lock prod.ts main.ts
```

---

## 5. Environment file

```bash
sudo -u groundupwall cp /opt/ground-up-wall/.env.example /opt/ground-up-wall/.env
sudo chmod 600 /opt/ground-up-wall/.env
sudo chown groundupwall:groundupwall /opt/ground-up-wall/.env
```

Edit `/opt/ground-up-wall/.env`:

```env
DEPLOYED=1
HOSTNAME=127.0.0.1
PORT=8080
DATABASE_URL=postgres://groundupwall:CHANGE_ME_STRONG_DB_PASSWORD@127.0.0.1:5432/ground_up_wall
STORAGE_PATH=/var/lib/ground-up-wall/uploads
REALTIME_PROVIDER=memory
ADMIN_INITIAL_PASSWORD=YourStrongAdminPass!
DEMO_MODERATOR_PASSWORD=YourStrongModPass!
DEMO_DISPLAY_PASSWORD=YourStrongDisplayPass!
```

`DEPLOYED=1` enables **HSTS**, **Secure** session cookies, and refuses weak seed fallbacks.

---

## 6. Database migrate and seed (first time only)

```bash
cd /opt/ground-up-wall
sudo -u groundupwall deno task db:migrate
sudo -u groundupwall deno task db:seed
```

Optional demo train data:

```bash
sudo -u groundupwall deno task db:seed:demos
```

---

## 7. systemd service

Copy the unit file from the repo (adjust paths if your install dir differs):

```bash
sudo cp /opt/ground-up-wall/deploy/ground-up-wall.service /etc/systemd/system/ground-up-wall.service
```

Or create `/etc/systemd/system/ground-up-wall.service` manually:

```ini
[Unit]
Description=ground-up-wall photowall
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=groundupwall
Group=groundupwall
WorkingDirectory=/opt/ground-up-wall
EnvironmentFile=/opt/ground-up-wall/.env
ExecStart=/usr/local/bin/deno run -A /opt/ground-up-wall/prod.ts
Restart=on-failure
RestartSec=5

# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/ground-up-wall /opt/ground-up-wall

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ground-up-wall
sudo systemctl status ground-up-wall
curl -s http://127.0.0.1:8080/api/health
```

---

## 8. Caddy (HTTPS origin)

The path **Cloudflare → your VPS → Caddy → app:8080** must use TLS. With **Let's Encrypt** ([§8.2](#82-lets-encrypt-on-origin-port-80--443--preferred-if-you-want-public-le)), open **80** and **443** on the origin (restricted to Cloudflare IPs — [§9.2](#92-firewall-only-cloudflare-may-reach-80-and-443)).

### 8.1 Cloudflare Origin Certificate (443 only, no LE)

1. In Cloudflare: **SSL/TLS → Origin Server → Create Certificate** (RSA, 15 years, hostnames: `your.domain.example` and optionally `*.your.domain.example`).
2. Save `origin.pem` and `origin-key.pem` on the VPS:

```bash
sudo mkdir -p /etc/caddy/certs
sudo chmod 700 /etc/caddy/certs
sudo nano /etc/caddy/certs/origin.pem      # paste certificate
sudo nano /etc/caddy/certs/origin-key.pem  # paste private key
sudo chmod 600 /etc/caddy/certs/*
sudo chown -R caddy:caddy /etc/caddy/certs
```

3. `/etc/caddy/Caddyfile`:

```
your.domain.example {
    tls /etc/caddy/certs/origin.pem /etc/caddy/certs/origin-key.pem

    reverse_proxy 127.0.0.1:8080 {
        # Pass real visitor IP from Cloudflare (rate limits / lockout use this)
        header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
        header_up X-Forwarded-Proto https
        header_up Host {host}
    }
}
```

```bash
sudo systemctl reload caddy
```

4. Test from the VPS (origin cert is only trusted via Cloudflare, not public browsers directly to IP):

```bash
curl -fsS --resolve your.domain.example:443:127.0.0.1 \
  --cacert /etc/caddy/certs/origin.pem \
  https://your.domain.example/api/health
```

Public visitors use `https://your.domain.example` through Cloudflare.

### 8.2 Let's Encrypt on origin (port 80 + 443) — preferred if you want public LE

Caddy can obtain and renew **Let's Encrypt** certificates automatically. With **proxied** Cloudflare DNS, HTTP-01 still works: Let's Encrypt hits Cloudflare on port 80, Cloudflare forwards to your origin, and Caddy answers `/.well-known/acme-challenge/`.

**OCI / UFW:** open **80** and **443**, but restrict both to **[Cloudflare IP ranges](https://www.cloudflare.com/ips/)** only (see [§9.2](#92-firewall-only-cloudflare-may-reach-443)). Renewals keep working because validation never needs a direct LE→origin connection.

`/etc/caddy/Caddyfile`:

```
your.domain.example {
    reverse_proxy 127.0.0.1:8080 {
        header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
        header_up X-Forwarded-Proto {http.request.header.X-Forwarded-Proto}
        header_up Host {host}
    }
}
```

Caddy listens on **:80** (ACME + redirect to HTTPS) and **:443** (TLS). Set Cloudflare SSL to **Full (strict)**.

```bash
sudo systemctl reload caddy
curl -fsS https://your.domain.example/api/health
```

**Risks of exposing port 80** (and how to mitigate) — see [§9.5](#95-risks-of-origin-port-80-with-lets-encrypt).

### 8.3 Alternative: Cloudflare Origin Certificate (no port 80)

If you want **443 only** on the origin, use a Cloudflare Origin Certificate ([§8.1](#81-origin-certificate-on-caddy)) instead of LE.

### 8.4 Alternative: LE DNS-01 (no port 80, proxied DNS)

DNS-01 via Caddy + Cloudflare API token — more setup, no origin :80.

---

## 9. Cloudflare (recommended)

Place the site behind Cloudflare **proxied** DNS. Cloudflare terminates visitor HTTP/HTTPS; visitors never talk to your origin IP on port 80.

### 9.1 Cloudflare dashboard

| Setting | Value | Why |
|---------|-------|-----|
| **DNS** | `A` record → VPS IP, **Proxied** (orange cloud) | Hides origin; DDoS/WAF at edge |
| **SSL/TLS mode** | **Full (strict)** | Encrypts CF→origin; requires valid origin cert (§8.1) |
| **Always Use HTTPS** | On | Edge redirects HTTP→HTTPS (visitors never hit your :80) |
| **Minimum TLS Version** | 1.2+ | Reasonable default |
| **WebSockets** | On (default) | SSE display/moderation streams |

Optional: **Authenticated Origin Pulls** (CF presents a client cert to your origin) — extra hardening; requires Caddy `tls` client auth config.

### 9.2 Firewall: only Cloudflare may reach :80 and :443

Without this, someone who learns your origin IP can bypass Cloudflare on **either** port.

1. Download current ranges: [https://www.cloudflare.com/ips/](https://www.cloudflare.com/ips/)
2. In **OCI Security List** and **UFW**, allow **80** and **443** only from Cloudflare IPv4/IPv6 ranges (not `0.0.0.0/0`).
3. Keep **22** restricted to your admin IP.

Example (refresh IPs from Cloudflare before applying):

```bash
# Illustrative — replace with current https://www.cloudflare.com/ips-v4
for ip in 173.245.48.0/20 103.21.244.0/22; do
  sudo ufw allow from "$ip" to any port 80 proto tcp
  sudo ufw allow from "$ip" to any port 443 proto tcp
done
sudo ufw delete allow 80/tcp    # remove wide-open rules from §2.2 if added
sudo ufw delete allow 443/tcp
```

### 9.3 App compatibility (already handled in code)

| Concern | Status |
|---------|--------|
| **Real client IP** for rate limit / login lockout | `clientKey()` prefers `CF-Connecting-IP`, then `X-Forwarded-For` ([`lib/security/rate_limit.ts`](../../lib/security/rate_limit.ts)) |
| **Caddy forwards client IP** | `header_up X-Forwarded-For {CF-Connecting-IP}` in §8.1 |
| **Secure cookies + HSTS** | `DEPLOYED=1` in `.env` |
| **CSRF** | Compares `Origin`/`Referer` to request URL — works through Cloudflare (same public host) |
| **SSE long connections** | Comment keepalive every 25s in [`lib/sse/create_event_stream.ts`](../../lib/sse/create_event_stream.ts) — avoids Cloudflare proxy read timeout during quiet periods |
| **Upload size** | 12 MB app limit; Cloudflare free proxy body limit is 100 MB — sufficient |

No `DEPLOYED=0` or code changes needed beyond deploying a release that includes the above.

### 9.4 What you do *not* need on the origin

- Port **80** open to the whole internet (only Cloudflare ranges — [§9.2](#92-firewall-only-cloudflare-may-reach-80-and-443))
- Exposing **8080** or **5432**

### 9.5 Risks of origin port 80 with Let's Encrypt

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Bypass Cloudflare** (hit origin IP directly, skip WAF/rate limits) | High if firewall is open | Restrict **80 and 443** to Cloudflare IPs only ([§9.2](#92-firewall-only-cloudflare-may-reach-80-and-443)). This is the critical control — port 80 alone is not the problem; **world-open** origin ports are. |
| **Plain HTTP to origin** | Medium | Cloudflare **Full (strict)** only — never **Flexible** (that sends decrypted HTTP from CF to origin). Caddy should redirect all non-ACME HTTP to HTTPS. |
| **DDoS / scanning on :80** | Medium if open to world | Cloudflare-only firewall rules; Oracle VCN matches UFW. |
| **LE renewal failure** | Medium (outage when cert expires) | Keep :80 reachable **from Cloudflare**; monitor Caddy logs / cert expiry; test `caddy reload` after firewall changes. |
| **Origin IP leaked** | Ongoing | Use CF proxied DNS; avoid grey-cloud except briefly; don't publish origin IP in emails/docs. Firewall still blocks non-CF traffic if rules are correct. |
| **Misconfiguration drift** | Low | Avoid `ufw allow 80/tcp` without `from` — document rules in runbook; re-check after OCI console edits. |

**Compared to Origin Certificate only on :443:** LE adds one more open port on the host, but with Cloudflare-only firewall rules the practical risk is small — attackers who discover your IP still cannot reach :80 or :443 unless they spoof from CF ranges (not feasible). The main operational difference is **renewal dependency** on the HTTP-01 path through Cloudflare staying healthy.

---

## 10. Updates (tag-based deploy)

From the repo, `scripts/deploy.sh` checks out a **git tag** (`v*`), runs migrations, and restarts the service.

```bash
sudo chmod +x /opt/ground-up-wall/scripts/deploy.sh
```

**Latest tag:**

```bash
sudo /opt/ground-up-wall/scripts/deploy.sh
```

**Specific release:**

```bash
sudo /opt/ground-up-wall/scripts/deploy.sh v1.0.2
```

Optional convenience symlink:

```bash
echo '#!/bin/bash
exec /opt/ground-up-wall/scripts/deploy.sh "$@"' | sudo tee /usr/local/bin/deploy-wall
sudo chmod +x /usr/local/bin/deploy-wall
```

**Rollback:** deploy an older tag — only safe if no irreversible DB migrations ran between versions.

**Downtime:** ~2–5 seconds on `systemctl restart`. Display wall SSE clients reconnect automatically.

### Optional: auto-deploy on GitHub Release

Use a [webhook](https://github.com/adnanh/webhook) on the VPS that runs `deploy.sh` with the release tag when you publish a GitHub Release. Restrict by shared secret; do not auto-deploy `main`.

---

## 11. Backups (recommended)

No automatic backups on Always Free — schedule manually:

```bash
# /usr/local/bin/backup-ground-up-wall.sh
sudo -u postgres pg_dump ground_up_wall | gzip > /var/backups/ground_up_wall_$(date +%F).sql.gz
tar -czf /var/backups/ground_up_wall_uploads_$(date +%F).tar.gz -C /var/lib/ground-up-wall uploads
```

Add a weekly `cron` entry as root.

---

## 12. Pre-event checklist

- [ ] Cloudflare **Full (strict)**; Caddy LE cert valid (or Origin Cert if using §8.1)
- [ ] Origin **80 and 443** restricted to Cloudflare IP ranges (not open to world)
- [ ] `https://your.domain.example/upload` loads through Cloudflare
- [ ] `https://your.domain.example/api/health` returns `{"ok":true,"db":true}`
- [ ] Admin login works; change default passwords if still using seed values
- [ ] Display wall SSE works (`/display` after display login)
- [ ] Oracle idle reclamation: light traffic or cron `curl` during the week before the event
- [ ] `deploy-wall` tested once on staging tag

---

## 13. Troubleshooting

| Problem | Fix |
|---------|-----|
| **525/526** SSL errors from Cloudflare | Set SSL mode to **Full (strict)**; verify origin cert paths in Caddyfile |
| **502** from Cloudflare | App or Caddy down — `systemctl status caddy ground-up-wall` |
| Rate limits affect everyone at once | Caddy not passing `CF-Connecting-IP` — check §8.1 headers |
| Display SSE drops every ~100s | Deploy version with SSE keepalive; confirm Cloudflare proxy (not grey-cloud) |
| `Connection refused` on 8080 | `sudo journalctl -u ground-up-wall -f` — check `DATABASE_URL`, Postgres running |
| 502 from Caddy | App not listening — verify `HOSTNAME=127.0.0.1` and service active |
| Seed refuses weak passwords | Set `ADMIN_INITIAL_PASSWORD` etc. in `.env` |
| Images 404 | Check files under `STORAGE_PATH`; app user owns directory |
| After deploy, health fails | `sudo journalctl -u ground-up-wall -n 50`; re-run `deno task db:migrate` |

---

## Related

- Local development: [SETUP.md](../../SETUP.md)
- Demo walkthrough: [DEMO.md](../../DEMO.md)
- Phase 03 research: [instagram_feasibility.md](../phase03/instagram_feasibility.md)
