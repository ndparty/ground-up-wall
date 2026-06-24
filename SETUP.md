# Local Development Setup — ground-up-wall

This guide gets the Phase 01 application running on your machine. For OS-specific tool installation (Deno, PostgreSQL, Git), see [docs/phase01/dev_setup.md](docs/phase01/dev_setup.md).

For a step-by-step demo walkthrough, see **[DEMO.md](DEMO.md)**.

## Prerequisites

- Deno 2.x
- PostgreSQL 17+
- Git

## Quick start

1. **Clone** the repository and `cd` into it.

2. **Create the databases:**

   ```bash
   createdb ground_up_wall_dev
   createdb ground_up_wall_test
   ```

   Windows (if `createdb` is on PATH): same commands in PowerShell. Alternatively use `psql -c "CREATE DATABASE ground_up_wall_dev;"`.

3. **Configure environment:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set `DATABASE_URL` if needed (default: `postgres://localhost:5432/ground_up_wall_dev`).

   The application loads `.env` automatically at startup (`lib/load_env.ts`). Scripts (`db:migrate`, `db:seed`) also read `.env`.

4. **Set passwords** (recommended even for local dev):

   ```bash
   # PowerShell
   $env:ADMIN_INITIAL_PASSWORD = "YourStrongPass123!"
   $env:DEMO_MODERATOR_PASSWORD = "demo123"
   $env:DEMO_DISPLAY_PASSWORD = "demo123"

   # bash/zsh
   export ADMIN_INITIAL_PASSWORD="YourStrongPass123!"
   export DEMO_MODERATOR_PASSWORD="demo123"
   export DEMO_DISPLAY_PASSWORD="demo123"
   ```

   > **Security:** If passwords are not set, the seed script uses local fallbacks (`admin123`, `demo123`) and prints them to the console. The seed script **refuses** fallbacks when `DEPLOYED=1` (or `DENO_DEPLOYMENT_ID` is set) in deployed environments. See [docs/phase02/oracle_vps_deploy.md](docs/phase02/oracle_vps_deploy.md) for VPS production setup.

5. **Run migrations:**

   ```bash
   deno task db:migrate
   ```

6. **Seed initial data** (admin, demo moderator/display accounts, default system parameters):

   ```bash
   deno task db:seed
   ```

   **Optional — populate the display train** with 40 approved demo submissions (numbered placeholder images):

   ```bash
   deno task db:seed:demos
   ```

   Re-run with fresh demo data: `deno run -A scripts/seed_demo_submissions.ts --force`

7. **Start the dev server:**

   ```bash
   deno task start
   ```

   Open http://localhost:8080

## Default accounts

After seeding:

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `ADMIN_INITIAL_PASSWORD`, or `admin123` locally |
| Moderator | `moderator` | `DEMO_MODERATOR_PASSWORD`, or `demo123` locally |
| Display wall | `display` | `DEMO_DISPLAY_PASSWORD`, or `demo123` locally |

## Running tests

| Command | Purpose |
|---------|---------|
| `deno task test` | Full unit + integration + E2E suite (210 tests) |
| `deno task test:unit` | Route + lib tests only (excludes `tests/e2e/`, still uses Postgres) |
| `deno task test:e2e` | Full end-to-end scenario suite |
| `deno task test:e2e:smoke` | PR-time smoke subset (~33 scenarios) |
| `deno task check` | `deno fmt --check`, `deno lint`, `deno check main.ts` |

Tests use `DATABASE_URL_TEST` (default: `ground_up_wall_test`). Create that database before running tests.

For flaky parallel runs on Windows, use a single worker:

```powershell
$env:DENO_JOBS="1"
deno task test
```

## Visual / performance NFR sign-off

Some non-functional requirements require manual verification on target hardware:

- **NFR-03 (60fps):** Open `/concourse` in Chrome → DevTools → Performance → record 30s with 50+ cabins → confirm ≥55fps sustained.
- **NFR-04 (30s real-time):** Approve a submission in `/semak`; measure time until it appears on `/concourse` (<30s).
- **NFR-08 (legibility):** DevTools → Computed → font-size on cabin name (≥24px) and message (≥18px).

Automated checks cover audit-log integrity (`deno task test:e2e:smoke --filter audit`).

## Offline / standalone event operation

At event time the app does **not** load third-party CDN scripts, fonts, or analytics. Browsers
talk only to your server (`connect-src 'self'` in CSP). Static assets, bundled JS, uploads, API,
and SSE all come from the same host.

**Typical LAN setup:** one machine runs Deno + local Postgres; display wall, moderator laptop, and
guest phones use `http://<server-ip>:8080` on the venue Wi‑Fi. Public internet is **not** required
during the event.

**Mobile login and upload on HTTP LAN:** proof-of-work uses a bundled SHA-256 solver (`static/pow-worker.js`)
that does not require `crypto.subtle`, so staff login (`/masuk`) and participant upload (`/muatnaik`)
work on phones over plain HTTP. PoW challenges prefetch in the background while the user fills the form.
Tune cost vs speed in Admin → Parameters → **Proof-of-work difficulty** (`pow_difficulty_bits`, default 16;
lower for slower devices or congested Wi‑Fi).

**Display PC on localhost, phones on LAN:** if the projector opens `http://localhost:8080/concourse` but
guests must scan a LAN address, set Admin → Parameters → **Public participant URL** (`public_participant_url`)
to e.g. `http://192.168.1.5:8080`. The top banner shows that host; the QR cabin encodes the same origin
(home redirect sends phones to upload). Leave empty to auto-detect from the browser address bar.

| Requirement | Notes |
|-------------|--------|
| Pre-install (once, with internet) | `deno cache` / `deno task start` pulls JSR + npm deps; run `db:migrate` and `db:seed` |
| On-site | Deno server running; PostgreSQL reachable (default `localhost` or LAN host) |
| `.env` defaults | `DATABASE_URL` → local Postgres; `REALTIME_PROVIDER=memory`; `STORAGE_PATH=./uploads` |
| Breaks offline use | Remote cloud Postgres (e.g. Supabase URL); missing pre-cached npm packages |

HEIC preview on Chrome uses the bundled `heic-to/csp` build (Web Worker from `blob:`, no
`unsafe-eval`). CSP includes `worker-src 'self' blob:` so conversion works without external requests.

This is not a PWA — clients still need the server reachable on the LAN. There is no background sync
when the server is down.

## Project structure

```
routes/          Fresh pages and API handlers
islands/         Interactive Preact components
lib/             Services, repositories, validation
scripts/         migrate.ts, seed.ts, seed_demo_submissions.ts
tests/e2e/       End-to-end integration tests
static/          CSS and assets
uploads/         Uploaded images (created at runtime)
docs/phase01/    Epic plan and execution plans
```

Uploaded images are served at `/submissions/`, `/placeholders/`, and `/overrides/` from `STORAGE_PATH`.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Connection refused` to Postgres | Ensure PostgreSQL is running; verify `DATABASE_URL` |
| SSL / TLS errors (`Could not check if server accepts SSL`, response `69` or `0`) | Local dev auto-appends `sslmode=disable` for loopback hosts; ensure Postgres is running (`Get-Service postgresql*` on Windows) |
| Migration errors | Run `deno task db:migrate` on a clean database |
| Tests fail with auth errors | Create `ground_up_wall_test`; set `DATABASE_URL_TEST`; avoid running dev server against the test DB during `deno task test` |
| `session was terminated unexpectedly` on dev restart | Postgres is up but the old connection was stale — fixed by reconnect logic; if it persists after rapid restarts, wait a few seconds or restart the PostgreSQL service |
| Seed says admin exists | Idempotent — safe to re-run |
| Images 404 on display | Confirm files exist under `./uploads/` and server is running |

## Phase roadmap

- **Phase 1 (complete):** Local MVP — Deno Fresh + Postgres + filesystem storage
- **Phase 2 (production):** [docs/phase02/oracle_vps_deploy.md](docs/phase02/oracle_vps_deploy.md) — Oracle VPS (same stack as local; no Deno Deploy / Supabase)
- **Phase 3 (planned):** Instagram integration — [docs/phase03/instagram_feasibility.md](docs/phase03/instagram_feasibility.md)

See [docs/phase01/epic_plan-phase01.md](docs/phase01/epic_plan-phase01.md) for the full work-item breakdown.
