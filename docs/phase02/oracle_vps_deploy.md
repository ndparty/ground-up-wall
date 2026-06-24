# Oracle VPS deployment — Ubuntu 24.04

Production deployment for **Phase 1** (Deno Fresh + local PostgreSQL + filesystem storage) on an
Oracle Cloud Always Free A1 instance, with **Caddy** on the origin, **Cloudflare** at the edge
(recommended), and **tag-based** updates.

**Prerequisites on the VPS:** Ubuntu 24.04, sudo user (default `ubuntu` user removed), SSH key
access.

---

## Where to find hardening steps

| What to harden                                          | Section in this doc                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------- |
| Oracle cloud network (Security List)                    | [§1](#1-oracle-cloud-firewall-security-list)                        |
| Ubuntu host firewall (UFW), SSH, auto-updates, fail2ban | [§2](#2-harden-ubuntu)                                              |
| PostgreSQL (localhost only, least privilege)            | [§3](#3-postgresql-localhost-only)                                  |
| GitHub read access (private repo clone + deploy fetch)  | [§3.5](#35-github-access-private-repository)                        |
| App Unix user, file permissions, `.env`                 | [§4](#4-application-user-and-directories)–[§5](#5-environment-file) |
| systemd service hardening                               | [§7](#7-systemd-service)                                            |
| TLS origin (Caddy)                                      | [§8](#8-caddy-https-origin)                                         |
| Cloudflare edge + origin-only exposure                  | [§9](#9-cloudflare-recommended)                                     |
| Authenticated Origin Pulls (mTLS from Cloudflare)       | [§9.7](#97-authenticated-origin-pulls-recommended)                |
| Backups                                                 | [§11](#11-backups-recommended)                                      |

**Application-level security** (NFR-23: rate limits, CSRF, PoW, CSP) is already in code — enable
with `DEPLOYED=1` in [§5](#5-environment-file). No extra app config for Cloudflare beyond what
[§9](#9-cloudflare-recommended) describes.

---

## 1. Oracle cloud firewall (Security List)

In the OCI console for your VCN subnet, allow **ingress**:

| Port    | Purpose                                                                                                                           |
| ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 22/tcp  | SSH (restrict source to your IP if possible)                                                                                      |
| 80/tcp  | HTTP — **Let's Encrypt** ACME + redirect (restrict to Cloudflare IPs — [§9.2](#92-firewall-only-cloudflare-may-reach-80-and-443)) |
| 443/tcp | HTTPS from **Cloudflare only** ([§9.2](#92-firewall-only-cloudflare-may-reach-80-and-443))                                        |

Do **not** open **5432** (Postgres) or **8080** (app) to the internet. Caddy listens on **443**; the
app binds **127.0.0.1:8080** only.

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

> After Caddy obtains its first certificate, run [`scripts/cloudflare-ufw.sh`](../../scripts/cloudflare-ufw.sh)
> (§9.2) to replace wide `allow 80/tcp` / `allow 443/tcp` with **Cloudflare-CIDR-only** rules.

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

## 3.5 GitHub access (private repository)

The repo is **private**. Initial clone and every `deploy.sh` run (`git fetch --tags`,
`git checkout`) execute as the **`groundupwall`** system user (home `/opt/ground-up-wall`).
Configure credentials for that user **before** cloning in [§4](#4-application-user-and-directories).

### Recommended: SSH deploy key (read-only)

**On GitHub** (repo **Settings → Deploy keys → Add deploy key**):

1. Title: e.g. `ground-up-wall-vps-prod`
2. Paste the VPS public key (from below)
3. Leave **Allow write access** unchecked

**On the VPS** (run after creating `groundupwall` in §4, before `git clone`):

```bash
sudo -u groundupwall mkdir -p /opt/ground-up-wall/.ssh
sudo -u groundupwall ssh-keygen -t ed25519 \
  -f /opt/ground-up-wall/.ssh/id_ed25519_deploy -N "" -C "ground-up-wall-vps"
sudo chmod 700 /opt/ground-up-wall/.ssh
sudo chmod 600 /opt/ground-up-wall/.ssh/id_ed25519_deploy
sudo chmod 644 /opt/ground-up-wall/.ssh/id_ed25519_deploy.pub

# Add deploy key to GitHub, then:
sudo cat /opt/ground-up-wall/.ssh/id_ed25519_deploy.pub

sudo -u groundupwall ssh-keyscan github.com >> /opt/ground-up-wall/.ssh/known_hosts
sudo chmod 644 /opt/ground-up-wall/.ssh/known_hosts
sudo -u groundupwall git config --global core.sshCommand \
  "ssh -i /opt/ground-up-wall/.ssh/id_ed25519_deploy -o IdentitiesOnly=yes"
```

Verify (expect `Hi ndparty/ground-up-wall! You've successfully authenticated...`):

```bash
sudo -u groundupwall ssh -i /opt/ground-up-wall/.ssh/id_ed25519_deploy \
  -o IdentitiesOnly=yes -T git@github.com
```

### Alternative: HTTPS + fine-grained PAT

Use when SSH deploy keys are not an option. Create a **fine-grained** personal access token on
GitHub with **Contents: Read** and **Metadata: Read** on `ndparty/ground-up-wall` only; set an
expiration.

Store the token in a file owned by `groundupwall` (not in `.env` — the app does not need GitHub
access):

```bash
sudo -u groundupwall git config --global credential.helper \
  'store --file /opt/ground-up-wall/.git-credentials'
sudo sh -c 'printf "https://x-access-token:YOUR_FINE_GRAINED_PAT@github.com\n" \
  > /opt/ground-up-wall/.git-credentials'
sudo chmod 600 /opt/ground-up-wall/.git-credentials
sudo chown groundupwall:groundupwall /opt/ground-up-wall/.git-credentials
```

Verify:

```bash
sudo -u groundupwall git ls-remote https://github.com/ndparty/ground-up-wall.git HEAD
```

### Security notes

- Never commit tokens or private keys to the repo.
- `chmod 600` on credential and key files; owner `groundupwall`.
- One deploy key per VPS; rotate if the host is rebuilt or compromised.
- Prefer a read-only deploy key over a broad personal PAT.
- After setup, `git remote -v` must **not** embed the token in the URL.

---

## 4. Application user and directories

The `groundupwall` system user has home **`APP_HOME`** at `/opt/ground-up-wall`. The git checkout
lives separately at **`APP_DIR`** `/opt/ground-up-wall/ground-up-wall`. Do **not** clone into
`APP_HOME` — tag checkouts would mix with `.ssh`, `.git-credentials`, and `.env`.

| Path | Role |
| ---- | ---- |
| `/opt/ground-up-wall` | `APP_HOME` — `.ssh`, `.git-credentials`, `.env` |
| `/opt/ground-up-wall/ground-up-wall` | `APP_DIR` — git checkout, app code |
| `/var/lib/ground-up-wall/uploads` | `STORAGE_PATH` — uploaded images |

```bash
sudo useradd --system --home-dir /opt/ground-up-wall --create-home --shell /bin/bash groundupwall || true
sudo mkdir -p /var/lib/ground-up-wall/uploads
sudo chown -R groundupwall:groundupwall /var/lib/ground-up-wall
```

Clone the repo after [§3.5](#35-github-access-private-repository) auth is working:

```bash
# SSH (recommended — deploy key)
sudo -u groundupwall git clone git@github.com:ndparty/ground-up-wall.git \
  /opt/ground-up-wall/ground-up-wall

# Or HTTPS (fine-grained PAT in ~/.git-credentials — see §3.5)
# sudo -u groundupwall git clone https://github.com/ndparty/ground-up-wall.git \
#   /opt/ground-up-wall/ground-up-wall

cd /opt/ground-up-wall/ground-up-wall
sudo -u groundupwall git fetch --tags origin
sudo -u groundupwall git checkout v1.0.4   # or latest v* tag
```

Cache dependencies once:

```bash
cd /opt/ground-up-wall/ground-up-wall
sudo -u groundupwall deno cache --lock=deno.lock prod.ts main.ts
```

---

## 5. Environment file

Production `.env` lives in **`APP_HOME`** (not inside the git checkout) so secrets survive
re-clones and are never touched by `git checkout`.

```bash
sudo -u groundupwall cp /opt/ground-up-wall/ground-up-wall/.env.example /opt/ground-up-wall/.env
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

Run from **`APP_DIR`**. Load env from home first (systemd does this automatically at runtime;
one-off CLI needs an explicit source):

```bash
cd /opt/ground-up-wall/ground-up-wall
sudo -u groundupwall bash -c 'set -a && source /opt/ground-up-wall/.env && set +a && deno task db:migrate'
sudo -u groundupwall bash -c 'set -a && source /opt/ground-up-wall/.env && set +a && deno task db:seed'
```

Optional demo train data:

```bash
sudo -u groundupwall bash -c 'set -a && source /opt/ground-up-wall/.env && set +a && deno task db:seed:demos'
```

---

## 7. systemd service

Copy the unit file from the repo (adjust paths if your install dir differs):

```bash
sudo cp /opt/ground-up-wall/ground-up-wall/deploy/ground-up-wall.service \
  /etc/systemd/system/ground-up-wall.service
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
WorkingDirectory=/opt/ground-up-wall/ground-up-wall
EnvironmentFile=/opt/ground-up-wall/.env
ExecStart=/usr/local/bin/deno run -A /opt/ground-up-wall/ground-up-wall/prod.ts
Restart=on-failure
RestartSec=5

# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/ground-up-wall /opt/ground-up-wall/ground-up-wall

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

The path **Cloudflare → your VPS → Caddy → app:8080** must use TLS. With **Let's Encrypt**
([§8.2](#82-lets-encrypt-on-origin-port-80--443--preferred-if-you-want-public-le)), open **80** and
**443** on the origin (restricted to Cloudflare IPs —
[§9.2](#92-firewall-only-cloudflare-may-reach-80-and-443)).

### 8.1 Cloudflare Origin Certificate (443 only, no LE)

1. In Cloudflare: **SSL/TLS → Origin Server → Create Certificate** (RSA, 15 years, hostnames:
   `your.domain.example` and optionally `*.your.domain.example`).
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

4. Test from the VPS (origin cert is only trusted via Cloudflare, not public browsers directly to
   IP):

```bash
curl -fsS --resolve your.domain.example:443:127.0.0.1 \
  --cacert /etc/caddy/certs/origin.pem \
  https://your.domain.example/api/health
```

Public visitors use `https://your.domain.example` through Cloudflare.

After the origin cert works, add **Authenticated Origin Pulls** ([§9.7](#97-authenticated-origin-pulls-recommended)).

### 8.2 Let's Encrypt on origin (port 80 + 443) — preferred if you want public LE

Caddy can obtain and renew **Let's Encrypt** certificates automatically. With **proxied** Cloudflare
DNS, HTTP-01 still works: Let's Encrypt hits Cloudflare on port 80, Cloudflare forwards to your
origin, and Caddy answers `/.well-known/acme-challenge/`.

**OCI / UFW:** open **80** and **443**, but restrict both to
**[Cloudflare IP ranges](https://www.cloudflare.com/ips/)** only (see
[§9.2](#92-firewall-only-cloudflare-may-reach-443)). Renewals keep working because validation never
needs a direct LE→origin connection.

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

Caddy listens on **:80** (ACME + redirect to HTTPS) and **:443** (TLS). Set Cloudflare SSL to **Full
(strict)**.

```bash
sudo systemctl reload caddy
curl -fsS https://your.domain.example/api/health
```

**Risks of exposing port 80** (and how to mitigate) — see
[§9.5](#95-risks-of-origin-port-80-with-lets-encrypt).

After LE works, add **Authenticated Origin Pulls** ([§9.7](#97-authenticated-origin-pulls-recommended)).

### 8.3 Alternative: Cloudflare Origin Certificate (no port 80)

If you want **443 only** on the origin, use a Cloudflare Origin Certificate
([§8.1](#81-origin-certificate-on-caddy)) instead of LE.

### 8.4 Alternative: LE DNS-01 (no port 80, proxied DNS)

DNS-01 via Caddy + Cloudflare API token — more setup, no origin :80.

---

## 9. Cloudflare (recommended)

Place the site behind Cloudflare **proxied** DNS. Cloudflare terminates visitor HTTP/HTTPS; visitors
never talk to your origin IP on port 80.

### 9.1 Cloudflare dashboard

| Setting                 | Value                                           | Why                                                     |
| ----------------------- | ----------------------------------------------- | ------------------------------------------------------- |
| **DNS**                 | `A` record → VPS IP, **Proxied** (orange cloud) | Hides origin; DDoS/WAF at edge                          |
| **SSL/TLS mode**        | **Full (strict)**                               | Encrypts CF→origin; requires valid origin cert (§8.1)   |
| **Always Use HTTPS**    | On                                              | Edge redirects HTTP→HTTPS (visitors never hit your :80) |
| **Minimum TLS Version** | 1.2+                                            | Reasonable default                                      |
| **WebSockets**          | On (default)                                    | SSE display/moderation streams                          |

**Authenticated Origin Pulls** (recommended): Cloudflare presents a client certificate on every
proxied request to your origin; Caddy verifies it with [§9.7](#97-authenticated-origin-pulls-recommended).
Use together with [§9.2](#92-firewall-only-cloudflare-may-reach-80-and-443) — IP allowlists and mTLS
are independent layers.

### 9.2 Firewall: only Cloudflare may reach :80 and :443

Without this, someone who learns your origin IP can bypass Cloudflare on **either** port.

Cloudflare publishes current ranges as plain text:

- IPv4: [https://www.cloudflare.com/ips-v4](https://www.cloudflare.com/ips-v4)
- IPv6: [https://www.cloudflare.com/ips-v6](https://www.cloudflare.com/ips-v6)

Use [`scripts/cloudflare-ufw.sh`](../../scripts/cloudflare-ufw.sh) on the VPS to fetch both lists and
apply UFW rules for **80** and **443** (tagged `cloudflare` for safe refresh). The script also removes
the world-open `80/tcp` and `443/tcp` rules from §2.2.

**Run once after Caddy/LE works** (from the app checkout on the VPS):

```bash
chmod +x /opt/ground-up-wall/ground-up-wall/scripts/cloudflare-ufw.sh
sudo /opt/ground-up-wall/ground-up-wall/scripts/cloudflare-ufw.sh
sudo ufw status numbered
```

Verify the site still loads through Cloudflare (`https://your.domain.example/api/health`).

**Refresh when Cloudflare adds ranges** (weekly cron as root):

```bash
sudo crontab -e
```

```cron
# Sunday 03:00 — sync Cloudflare IPs into UFW
0 3 * * 0 /opt/ground-up-wall/ground-up-wall/scripts/cloudflare-ufw.sh --purge >> /var/log/cloudflare-ufw.log 2>&1
```

`--purge` deletes old `cloudflare`-tagged rules and re-applies from the live lists. Without it, the
script only adds missing CIDRs (fine for ad-hoc runs).

**OCI Security List (required separately):** UFW is host-only. In the Oracle console (or OCI CLI),
ingress rules for **80** and **443** must also allow only the same Cloudflare IPv4/IPv6 CIDRs — not
`0.0.0.0/0`. Download the lists from the URLs above and mirror them in the VCN security list.
Keep **22** restricted to your admin IP in both UFW and OCI.

**Manual one-liner** (if you prefer not to use the script — IPv4 only):

```bash
curl -fsS https://www.cloudflare.com/ips-v4 | while read -r ip; do
  sudo ufw allow from "$ip" to any port 80 proto tcp comment 'cloudflare'
  sudo ufw allow from "$ip" to any port 443 proto tcp comment 'cloudflare'
done
sudo ufw delete allow 80/tcp
sudo ufw delete allow 443/tcp
```

Also fetch [ips-v6](https://www.cloudflare.com/ips-v6) if the instance has a public IPv6 address.

### 9.3 App compatibility (already handled in code)

| Concern                                           | Status                                                                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Real client IP** for rate limit / login lockout | `clientKey()` prefers `CF-Connecting-IP`, then `X-Forwarded-For` ([`lib/security/rate_limit.ts`](../../lib/security/rate_limit.ts))                                 |
| **Caddy forwards client IP**                      | `header_up X-Forwarded-For {CF-Connecting-IP}` in §8.1                                                                                                              |
| **Secure cookies + HSTS**                         | `DEPLOYED=1` in `.env`                                                                                                                                              |
| **CSRF**                                          | Compares `Origin`/`Referer` to request URL — works through Cloudflare (same public host)                                                                            |
| **SSE long connections**                          | Comment keepalive every 25s in [`lib/sse/create_event_stream.ts`](../../lib/sse/create_event_stream.ts) — avoids Cloudflare proxy read timeout during quiet periods |
| **Upload size**                                   | 12 MB app limit; Cloudflare free proxy body limit is 100 MB — sufficient                                                                                            |

No `DEPLOYED=0` or code changes needed beyond deploying a release that includes the above.

### 9.4 What you do _not_ need on the origin

- Port **80** open to the whole internet (only Cloudflare ranges —
  [§9.2](#92-firewall-only-cloudflare-may-reach-80-and-443))
- Exposing **8080** or **5432**

### 9.5 Risks of origin port 80 with Let's Encrypt

| Risk                                                                 | Severity                          | Mitigation                                                                                                                                                                                                    |
| -------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bypass Cloudflare** (hit origin IP directly, skip WAF/rate limits) | High if firewall is open          | Restrict **80 and 443** to Cloudflare IPs only ([§9.2](#92-firewall-only-cloudflare-may-reach-80-and-443)). Enable **Authenticated Origin Pulls** ([§9.7](#97-authenticated-origin-pulls-recommended)) so direct TLS to Caddy without CF's client cert fails even if IP rules drift. |
| **Plain HTTP to origin**                                             | Medium                            | Cloudflare **Full (strict)** only — never **Flexible** (that sends decrypted HTTP from CF to origin). Caddy should redirect all non-ACME HTTP to HTTPS.                                                       |
| **DDoS / scanning on :80**                                           | Medium if open to world           | Cloudflare-only firewall rules; Oracle VCN matches UFW.                                                                                                                                                       |
| **LE renewal failure**                                               | Medium (outage when cert expires) | Keep :80 reachable **from Cloudflare**; monitor Caddy logs / cert expiry; test `caddy reload` after firewall changes.                                                                                         |
| **Origin IP leaked**                                                 | Ongoing                           | Use CF proxied DNS; avoid grey-cloud except briefly; don't publish origin IP in emails/docs. Firewall still blocks non-CF traffic if rules are correct.                                                       |
| **Misconfiguration drift**                                           | Low                               | Avoid `ufw allow 80/tcp` without `from` — document rules in runbook; re-check after OCI console edits.                                                                                                        |

**Compared to Origin Certificate only on :443:** LE adds one more open port on the host, but with
Cloudflare-only firewall rules the practical risk is small — attackers who discover your IP still
cannot reach :80 or :443 unless they spoof from CF ranges (not feasible). The main operational
difference is **renewal dependency** on the HTTP-01 path through Cloudflare staying healthy.

### 9.6 Cloudflare WAF rate limits (recommended)

Add **Rate limiting rules** in Cloudflare → Security → WAF → Rate limiting rules. Tune thresholds
for your event size; start conservative and loosen if staff get blocked.

| Rule name     | Match                                                            | Threshold (example)           | Action |
| ------------- | ---------------------------------------------------------------- | ----------------------------- | ------ |
| Login burst   | URI Path equals `/api/masuk/session` OR URI Path equals `/masuk` | 10 requests / 1 minute per IP | Block  |
| Upload burst  | URI Path equals `/api/muatnaik/submit`                           | 20 requests / 1 minute per IP | Block  |
| PoW challenge | URI Path equals `/api/masuk/challenge`                           | 30 requests / 1 minute per IP | Block  |

**Do not** enumerate obscure staff paths in `robots.txt` — the app serves `Disallow: /` for all
crawlers ([`static/robots.txt`](../../static/robots.txt)). Legacy paths (`/login`, `/upload`, etc.)
return 404 at the app layer.

**Staff URL cheat sheet** (share with organisers only — not linked from public pages):

| Role               | Path           |
| ------------------ | -------------- |
| Participant upload | `/muatnaik`    |
| Staff login        | `/masuk`       |
| Moderation         | `/semak`       |
| Approved gallery   | `/semak/pamer` |
| Display wall       | `/concourse`   |
| Admin              | `/towkay`      |
| Change password    | `/tukar`       |

### 9.7 Authenticated Origin Pulls (recommended)

**Authenticated Origin Pulls (AOP)** add a cryptographic check on top of the Cloudflare IP firewall
([§9.2](#92-firewall-only-cloudflare-may-reach-80-and-443)). When enabled, Cloudflare presents a
**client certificate** signed by Cloudflare's origin-pull CA on every proxied HTTPS request to your
origin. Caddy verifies that certificate during the TLS handshake and rejects connections that do not
present a valid one — including a direct `curl` to your origin IP that might otherwise reach Caddy
if firewall rules drift or the origin IP leaks.

| Layer | What it blocks |
| ----- | -------------- |
| UFW + OCI (§9.2) | Non-Cloudflare source IPs on :80 / :443 |
| AOP (this section) | Connections that reach :443 without Cloudflare's client cert |

Do **both**. AOP does not replace IP allowlists (someone on a Cloudflare IP range without a valid
client cert should still be blocked by mTLS; conversely, mTLS does not help if :443 is world-open and
an attacker finds another path to your app).

**Prerequisites:** Caddy serves HTTPS for your hostname ([§8.1](#81-cloudflare-origin-certificate-443-only-no-le) or
[§8.2](#82-lets-encrypt-on-origin-port-80--443--preferred-if-you-want-public-le)); Cloudflare DNS is
**proxied**; SSL mode is **Full (strict)** ([§9.1](#91-cloudflare-dashboard)).

#### 9.7.1 Download Cloudflare's origin-pull CA

On the VPS:

```bash
sudo mkdir -p /etc/caddy/certs
sudo curl -fsS -o /etc/caddy/certs/cloudflare-origin-pull-ca.pem \
  https://developers.cloudflare.com/ssl/static/authenticated_origin_pull_ca.pem
sudo chmod 644 /etc/caddy/certs/cloudflare-origin-pull-ca.pem
sudo chown root:caddy /etc/caddy/certs/cloudflare-origin-pull-ca.pem
```

Official reference:
[Cloudflare Authenticated Origin Pulls CA](https://developers.cloudflare.com/ssl/static/authenticated_origin_pull_ca.pem).

Re-download after major Cloudflare CA rotations (rare). Pin the URL above rather than copying PEM
text from blog posts.

#### 9.7.2 Configure Caddy `client_auth`

Add a `client_auth` block inside the site `tls` configuration. Caddy **2.8+** (Ubuntu 24.04
package) uses `trust_pool file`; older Caddy builds may need `trusted_ca_cert_file` instead (see
note at end).

**With Cloudflare Origin Certificate** ([§8.1](#81-cloudflare-origin-certificate-443-only-no-le)) —
replace `your.domain.example`:

```
your.domain.example {
    tls /etc/caddy/certs/origin.pem /etc/caddy/certs/origin-key.pem {
        client_auth {
            mode require_and_verify
            trust_pool file /etc/caddy/certs/cloudflare-origin-pull-ca.pem
        }
    }

    reverse_proxy 127.0.0.1:8080 {
        header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
        header_up X-Forwarded-Proto https
        header_up Host {host}
    }
}
```

**With Let's Encrypt** ([§8.2](#82-lets-encrypt-on-origin-port-80--443--preferred-if-you-want-public-le)) —
explicit `tls` block so `client_auth` nests correctly; Caddy still obtains and renews LE certs:

```
your.domain.example {
    tls {
        client_auth {
            mode require_and_verify
            trust_pool file /etc/caddy/certs/cloudflare-origin-pull-ca.pem
        }
    }

    reverse_proxy 127.0.0.1:8080 {
        header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
        header_up X-Forwarded-Proto {http.request.header.X-Forwarded-Proto}
        header_up Host {host}
    }
}
```

Validate syntax before reload:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

> **Older Caddy:** if `caddy validate` rejects `trust_pool`, use
> `trusted_ca_cert_file /etc/caddy/certs/cloudflare-origin-pull-ca.pem` inside `client_auth` instead
> of `trust_pool file`.

#### 9.7.3 Enable in Cloudflare

1. Open your zone (e.g. `wall.example.com`) → **SSL/TLS** → **Origin Server**.
2. Under **Authenticated Origin Pulls**, toggle **On** (zone-level, Cloudflare-managed client cert).
3. Confirm **SSL/TLS encryption mode** remains **Full (strict)**.

This is **zone-level** AOP with Cloudflare's shared origin-pull certificate — the usual setup for a
single photowall hostname. Per-hostname custom client certs are only needed for multi-tenant origins;
see [Cloudflare per-hostname AOP](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/set-up/per-hostname/)
if you outgrow zone-level.

**Safe rollout order**

1. Install the CA file on the VPS ([§9.7.1](#971-download-cloudflares-origin-pull-ca)).
2. Update the Caddyfile and `caddy validate` + `reload` ([§9.7.2](#972-configure-caddy-client_auth)).
3. Verify the site still works through Cloudflare **before** enabling the Cloudflare toggle (Caddy
   accepts connections without a client cert until CF starts sending one — brief window only if you
   delay step 3).
4. Enable **Authenticated Origin Pulls** in the dashboard ([§9.7.3](#973-enable-in-cloudflare)).
5. Re-test through Cloudflare and run the negative test ([§9.7.4](#974-verify)).

If you enable the Cloudflare toggle **before** Caddy enforces client auth, proxied traffic continues
to work (CF sends a cert; Caddy ignores it until configured). If you enable Caddy `require_and_verify`
**before** the Cloudflare toggle, proxied traffic **breaks** (502) until step 4 is done — configure
Caddy first, then flip the toggle immediately.

#### 9.7.4 Verify

**Through Cloudflare (must succeed):**

```bash
curl -fsS https://your.domain.example/api/health
```

**Direct to origin IP without Cloudflare client cert (must fail):**

Use your VPS public IP. With Origin Certificate, pin the cert; with LE, use `-k` to skip server cert
verification — you are testing **client-auth rejection**, not server trust.

```bash
# Origin Certificate (§8.1)
curl -v --resolve your.domain.example:443:YOUR_VPS_IP \
  --cacert /etc/caddy/certs/origin.pem \
  https://your.domain.example/api/health
# Expect: TLS handshake error, connection reset, or HTTP 4xx — not {"ok":true}

# Let's Encrypt (§8.2) — -k only to reach origin; mTLS should still block
curl -vk --resolve your.domain.example:443:YOUR_VPS_IP \
  https://your.domain.example/api/health
# Expect: handshake failure / no JSON health body
```

**From the VPS via localhost** (also without client cert — should fail once AOP is fully enabled):

```bash
curl -vk --resolve your.domain.example:443:127.0.0.1 \
  https://your.domain.example/api/health
```

If the negative test still returns `{"ok":true}`, Caddy is not enforcing `require_and_verify` — recheck
the Caddyfile, `caddy validate`, and that you reloaded Caddy.

#### 9.7.5 Troubleshooting AOP

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| **502** from Cloudflare right after enabling AOP | Caddy requires client cert but CF toggle off, or wrong CA file | Enable CF AOP; verify CA path; `journalctl -u caddy -n 30` |
| Site works direct-to-IP | `client_auth` missing or mode not `require_and_verify` | Fix Caddyfile; `caddy validate`; `reload` |
| `caddy validate` syntax error on `trust_pool` | Older Caddy | Use `trusted_ca_cert_file` ([§9.7.2](#972-configure-caddy-client_auth)) |
| Health OK via CF, fails direct | Expected when AOP works | No action |
| Grey-cloud DNS (DNS only) | CF does not send origin-pull cert on non-proxied records | Keep **proxied** (orange cloud) for the app `A` record |

---

## 10. Updates (tag-based deploy)

From the repo, `scripts/deploy.sh` checks out a **git tag** (`v*`), runs migrations, and restarts
the service. It reuses the same `origin` credentials configured in
[§3.5](#35-github-access-private-repository) — if `git fetch` fails during deploy, re-check that
section.

```bash
sudo chmod +x /opt/ground-up-wall/ground-up-wall/scripts/deploy.sh
```

**Latest tag:**

```bash
sudo /opt/ground-up-wall/ground-up-wall/scripts/deploy.sh
```

**Specific release:**

```bash
sudo /opt/ground-up-wall/ground-up-wall/scripts/deploy.sh v1.0.2
```

Optional convenience symlink:

```bash
echo '#!/bin/bash
exec /opt/ground-up-wall/ground-up-wall/scripts/deploy.sh "$@"' | sudo tee /usr/local/bin/deploy-wall
sudo chmod +x /usr/local/bin/deploy-wall
```

**Rollback:** deploy an older tag — only safe if no irreversible DB migrations ran between versions.

**Downtime:** ~2–5 seconds on `systemctl restart`. Display wall SSE clients reconnect automatically.

### 10.1 Migrating an existing VPS (repo was cloned into home)

If you previously cloned into `/opt/ground-up-wall` directly:

1. Stop the service: `sudo systemctl stop ground-up-wall`
2. Preserve secrets: ensure `.env` is at `/opt/ground-up-wall/.env` (move out of the old checkout
   if needed)
3. Preserve Git auth: keep `/opt/ground-up-wall/.ssh` and `.git-credentials` in home
4. Clone fresh to the subdirectory (or move the checkout):
   `sudo -u groundupwall git clone git@github.com:ndparty/ground-up-wall.git /opt/ground-up-wall/ground-up-wall`
5. Copy the updated unit file and reload:
   `sudo cp /opt/ground-up-wall/ground-up-wall/deploy/ground-up-wall.service /etc/systemd/system/`
   then `sudo systemctl daemon-reload`
6. Verify: `sudo deploy-wall` (or run `deploy.sh` with your current tag)

### Optional: auto-deploy on GitHub Release

Use a [webhook](https://github.com/adnanh/webhook) on the VPS that runs `deploy.sh` with the release
tag when you publish a GitHub Release. Restrict by shared secret; do not auto-deploy `main`.

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
- [ ] **Authenticated Origin Pulls** enabled in Cloudflare and enforced in Caddy (§9.7); direct-to-origin `curl` without client cert fails
- [ ] Origin **80 and 443** restricted to Cloudflare IP ranges — UFW via `cloudflare-ufw.sh` (§9.2) and matching OCI Security List rules
- [ ] `https://your.domain.example/muatnaik` loads through Cloudflare
- [ ] `https://your.domain.example/api/health` returns `{"ok":true,"db":true}`
- [ ] Admin login works; change default passwords if still using seed values
- [ ] Display wall SSE works (`/concourse` after display login)
- [ ] Legacy paths (`/login`, `/upload`, `/moderate`, `/display`, `/admin`) return 404
- [ ] Cloudflare WAF rate limits configured (§9.6)
- [ ] Oracle idle reclamation: light traffic or cron `curl` during the week before the event
- [ ] GitHub deploy key or PAT verified:
      `sudo -u groundupwall git -C /opt/ground-up-wall/ground-up-wall fetch --tags origin` (non-interactive)
- [ ] `deploy-wall` tested once on staging tag

---

## 13. Troubleshooting

| Problem                                                | Fix                                                                                     |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| **525/526** SSL errors from Cloudflare                 | Set SSL mode to **Full (strict)**; verify origin cert paths in Caddyfile                |
| **502** from Cloudflare after enabling AOP             | Enable CF **Authenticated Origin Pulls** (§9.7.3); verify CA file + `client_auth` in Caddyfile |
| **502** from Cloudflare                                | App or Caddy down — `systemctl status caddy ground-up-wall`                             |
| Direct `curl` to origin IP still returns health JSON   | AOP not enforced — add `client_auth` (§9.7.2), `require_and_verify`, reload Caddy       |
| Rate limits affect everyone at once                    | Caddy not passing `CF-Connecting-IP` — check §8.1 headers                               |
| Display SSE drops every ~100s                          | Deploy version with SSE keepalive; confirm Cloudflare proxy (not grey-cloud)            |
| `Connection refused` on 8080                           | `sudo journalctl -u ground-up-wall -f` — check `DATABASE_URL`, Postgres running         |
| 502 from Caddy                                         | App not listening — verify `HOSTNAME=127.0.0.1` and service active                      |
| Seed refuses weak passwords                            | Set `ADMIN_INITIAL_PASSWORD` etc. in `.env`                                             |
| Images 404                                             | Check files under `STORAGE_PATH`; app user owns directory                               |
| After deploy, health fails                             | `sudo journalctl -u ground-up-wall -n 50`; re-run `deno task db:migrate`                |
| `git clone` / `git fetch` 401, 403, or password prompt | Complete [§3.5](#35-github-access-private-repository); test as `groundupwall`           |
| `Permission denied (publickey)` on `git fetch`         | Deploy key not on repo, wrong key path, or `core.sshCommand` not set for `groundupwall` |
| `Host key verification failed` (git/ssh)               | `sudo -u groundupwall ssh-keyscan github.com >> /opt/ground-up-wall/.ssh/known_hosts`   |

---

## Related

- Local development: [SETUP.md](../../SETUP.md)
- Demo walkthrough: [DEMO.md](../../DEMO.md)
- Phase 03 research: [instagram_feasibility.md](../phase03/instagram_feasibility.md)
