# Demo Guide — ground-up-wall

Step-by-step instructions to start the app locally and walk through the full upload → moderate →
display flow.

For tool installation (Deno, PostgreSQL, Git), see
[docs/phase01/dev_setup.md](docs/phase01/dev_setup.md).\
For developer setup details, see [SETUP.md](SETUP.md).

---

## Prerequisites

- Deno 2.x
- PostgreSQL 17+ running locally
- Two databases: `ground_up_wall_dev` (app) and `ground_up_wall_test` (tests)

---

## First-time setup

### macOS / Linux (bash)

```bash
createdb ground_up_wall_dev
createdb ground_up_wall_test
cp .env.example .env
export ADMIN_INITIAL_PASSWORD="YourStrongPass123!"   # optional locally
deno task db:migrate
deno task db:seed
deno task db:seed:demos
deno task start
```

### Windows (PowerShell)

```powershell
createdb ground_up_wall_dev
createdb ground_up_wall_test
Copy-Item .env.example .env
$env:ADMIN_INITIAL_PASSWORD = "YourStrongPass123!"
deno task db:migrate
deno task db:seed
deno task db:seed:demos
deno task start
```

Open **http://localhost:8080**

The app loads variables from `.env` automatically at startup (via `lib/load_env.ts`). You do not
need to export every variable to your shell unless you want to override `.env` values.

**Local dev tip:** Sessions are persisted to `.dev/sessions.json`, so you stay logged in across
`deno task dev` restarts when you save files. Log in once as **`admin`** to access `/towkay`,
`/semak`, and `/concourse` in separate tabs. `/muatnaik` is public and needs no login.

**Session lifetime:** All staff and display accounts use a **24-hour idle timeout** — any
authenticated activity (page loads, API calls, loading protected images) extends the session by
another 24 hours. The display wall also polls `/api/masuk/me` every 45 minutes when idle so
long-running SSE sessions do not expire while images are browser-cached.

**Staff URL cheat sheet**

| Role | Page | Path |
|------|------|------|
| Participant upload | Muat naik | `/muatnaik` |
| Staff login | Masuk | `/masuk` |
| Moderation | Semak | `/semak` |
| Approved gallery | Pamer | `/semak/pamer` |
| Display wall | Concourse | `/concourse` |
| Admin | Towkay | `/towkay` |
| Change password | Tukar | `/tukar` |

Legacy scanner-obvious paths (`/login`, `/upload`, `/moderate`, `/display`, `/admin`) intentionally return **404**.

---

## Seeded accounts

After `deno task db:seed`:

| Role         | Username    | Password (local dev)                              |
| ------------ | ----------- | ------------------------------------------------- |
| Admin        | `admin`     | `ADMIN_INITIAL_PASSWORD` env value, or `admin123` |
| Moderator    | `moderator` | `DEMO_MODERATOR_PASSWORD` env value, or `demo123` |
| Display wall | `display`   | `DEMO_DISPLAY_PASSWORD` env value, or `demo123`   |

Set passwords in `.env` before seeding if you want non-default credentials. Re-running seed is
idempotent — existing accounts are not recreated.

**Optional:** `deno task db:seed:demos` adds 40 approved submissions with **generated placeholder
images** (coloured background, sequence number, and submitter initial — not photographs) so
`/concourse` shows a full train without manual moderation. Pending demo rows (10 by default) use the
same image generator. If demo rows already exist, the script skips and prints _"Demo submissions
already seeded. Use --force to replace."_ — run
`deno run -A scripts/seed_demo_submissions.ts --force` to refresh images and DB rows.

If moderation queue thumbnails appear broken, stale `image_url` paths usually mean the files were
removed from `./uploads` while DB rows remain — re-run with `--force`.

---

## Configuration

### Databases

| Database              | Env var                  | Used by                                                     |
| --------------------- | ------------------------ | ----------------------------------------------------------- |
| `ground_up_wall_dev`  | `DATABASE_URL` in `.env` | `deno task start`, `db:migrate`, `db:seed`, `db:seed:demos` |
| `ground_up_wall_test` | `DATABASE_URL_TEST`      | `deno task test` only                                       |

The dev server and seed scripts must use the **same** `DATABASE_URL`. Seeding `ground_up_wall_dev`
while the app points elsewhere leads to empty display and login issues.

### Seed commands

| Command                   | What it does                                                                  |
| ------------------------- | ----------------------------------------------------------------------------- |
| `deno task db:seed`       | Users + `system_config` defaults (idempotent; passwords only on first create) |
| `deno task db:seed:demos` | 40 approved + 10 pending demo submissions with numbered images                |

### Code defaults vs admin parameters

Runtime-tunable values (dwell time, message limits, PoW toggle, killswitch, QR interval) live in
**Admin → Parameters** (`system_config` table). Shipped code defaults and copy fallbacks are
centralized in [`lib/defaults/app_defaults.ts`](lib/defaults/app_defaults.ts). Re-run
`deno task db:seed` to upsert new default rows and migrate keys still at old shipped defaults (e.g.
`pow_challenge_enabled` false → true).

---

## Verify automated tests

```bash
# Full suite (requires Postgres + test DB)
deno task test

# PR smoke subset
deno task test:e2e:smoke
```

On Windows, if tests conflict with a running dev server or parallel workers cause flakes:

```powershell
$env:DENO_JOBS="1"
$env:DATABASE_URL_TEST="postgres://localhost:5432/ground_up_wall_test"
deno task test
```

---

## Demo script (three browser windows)

Use separate browser windows or profiles so sessions do not overwrite each other.

Protected pages (`/concourse`, `/semak`, `/towkay`, `/tukar`) redirect to `/masuk` when you are not signed in. Wrong-role users are sent to their role home (`/concourse` or `/semak`).

### Window 1 — Participant upload (no login)

1. Open **http://localhost:8080/muatnaik**
2. Choose a photo (max 10 MB)
3. Enter name and message; check the privacy acknowledgment
4. Submit — you should see a success confirmation

#### Mobile image format smoke test (manual)

| Device / browser | Photo source              | Expected                                     |
| ---------------- | ------------------------- | -------------------------------------------- |
| iPhone Safari    | Camera roll HEIC          | Picks file, processes, submits successfully  |
| Android Chrome   | JPEG or WebP from gallery | Picks file, processes, submits successfully  |
| Desktop Chrome   | `.heic` file from disk    | WASM fallback converts; submits successfully |
| Any              | PDF or other non-image    | "Unsupported image type" on pick or submit   |

If HEIC fails on a device, ask the participant to enable **Settings → Camera → Formats → Most
Compatible (JPEG)** on iPhone and retry.

### Window 2 — Moderator approval

1. Open **http://localhost:8080/masuk**
2. Log in as `moderator` / `demo123` (or your configured password)
3. You are redirected to **/semak**
4. Find the pending submission; approve it (new items appear at the **bottom** of the pending list)
5. Optional: edit message, reject, use display override controls (blank, reload, panic — panic has
   no confirm), or open **Gallery** (`/semak/pamer`) to browse approved submissions with
   search and pagination
6. **Display train controls**: jump field auto-tracks the current cabin; editing it pauses auto-sync
   for 30 seconds

### Window 3 — Display wall

1. Open **http://localhost:8080/masuk** in a new window
2. Log in as `display` / `demo123`
3. You are redirected to **/concourse**
4. If the fullscreen prompt appears, choose **Go fullscreen** or **Not now** (or press F11 later)
5. The approved photo should appear on the metro train within a few seconds (SSE realtime)
6. Optional (moderator or admin session): pause/play train, jump to cabin

### Optional — Admin panel

1. Log in as `admin`
2. Visit **http://localhost:8080/towkay**
3. Try: **Users**, **Parameters** (dwell time, word list), **Audit log**, **Display override**

---

## Manual NFR sign-off

Some requirements need human verification on target hardware:

| NFR                        | How to verify                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| **NFR-03 (60fps)**         | Chrome DevTools → Performance → record 30s on `/concourse` with 50+ cabins → ≥55fps sustained |
| **NFR-04 (<30s realtime)** | Approve in `/semak`; measure time until submission visible on `/concourse`                 |
| **NFR-08 (legibility)**    | DevTools → Computed → cabin name ≥24px, message ≥18px                                       |

Automated audit integrity checks: `deno task test:e2e:smoke --filter audit`

---

## Troubleshooting

| Problem                                         | Fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Invalid credentials** (admin / admin123)      | Seed only sets passwords on **first create**. If accounts already exist, re-running `db:seed` does not change them. Either use the password from your first seed (`ADMIN_INITIAL_PASSWORD` in `.env`, or `YourStrongPass123!` if you set it in PowerShell), or reset: `psql $DATABASE_URL -c "DELETE FROM users WHERE username IN ('admin','moderator','display');"` then `deno task db:seed`. If the users table is empty, run `deno task db:migrate` then `deno task db:seed` — seed prints the password used. |
| **Too many failed attempts**                    | Login lockout is in-memory. Restart `deno task start` and try again with the correct password.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Broken images on display/moderation             | Ensure `deno task start` is running; uploaded files are served from `STORAGE_PATH` (default `./uploads`) at `/submissions/`, `/placeholders/`, `/overrides/`                                                                                                                                                                                                                                                                                                                                                     |
| Postgres connection refused                     | Start PostgreSQL; check `DATABASE_URL` in `.env`                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `database "ground_up_wall_test" does not exist` | Run `createdb ground_up_wall_test` before `deno task test`                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Tests fail while dev server runs                | Stop the dev server or use a separate test database via `DATABASE_URL_TEST`                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Login redirect wrong role                       | Display users go to `/concourse`; moderator/admin go to `/semak`                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Seed refuses to run                             | In deployed environments, set `ADMIN_INITIAL_PASSWORD`, `DEMO_MODERATOR_PASSWORD`, and `DEMO_DISPLAY_PASSWORD`                                                                                                                                                                                                                                                                                                                                                                                                   |
| Demo train empty after seed                     | Ensure app and seed use the same `DATABASE_URL`; run `deno task db:seed:demos --force` if demos were skipped                                                                                                                                                                                                                                                                                                                                                                                                     |
| PoW challenge on every upload                   | Default is on after seed; disable in Admin → Parameters or re-seed to migrate old DBs                                                                                                                                                                                                                                                                                                                                                                                                                            |
| HEIC preview stuck on “Loading preview…” (Chrome) | CSP needs `worker-src 'self' blob:` and the app must use `heic-to/csp` (not the default bundle, which requires `unsafe-eval`). Hard-refresh after server restart. Safari often decodes HEIC natively. |

---

## Display override: reload and panic

Moderator and admin **Display override** panels include:

| Control | Behavior |
|---------|----------|
| **Blank screen** | Immediate blank on all displays; persisted until Resume |
| **Reload display** | Rebuilds server train tape at cabin 1 and soft-syncs all displays (confirm dialog). Use after deleting approved content to clear ghost cabins without changing blank/placeholder state |
| **Panic** | **No confirm** — blanks all displays immediately (SSE first), resets playback, stays blank until Resume |
| **Resume display** | Returns to normal train |

Panic and reload publish a `display_reload` SSE event; clients re-fetch `/api/concourse/submissions`
rather than doing a full page reload.

For offline/LAN deployment details, see [SETUP.md — Offline / standalone event operation](SETUP.md#offline--standalone-event-operation).

---

## Useful commands

| Command                           | Purpose                                           |
| --------------------------------- | ------------------------------------------------- |
| `deno task start`                 | Dev server with hot reload (port 8080)            |
| `deno task db:migrate`            | Create/update database schema                     |
| `deno task db:seed`               | Admin + demo users + default system parameters    |
| `deno task db:seed:demos`         | 40 approved demo submissions with numbered images |
| `deno task generate:mrt-stations` | Refresh MRT/LRT station list from Wikipedia       |
| `/roof-badge-preview.html`        | Compare MRT roof badge styles (static page)       |
| `deno task test`                  | Full test suite                                   |
| `deno task test:e2e:smoke`        | Smoke E2E scenarios                               |
| `deno task check`                 | Format, lint, and type-check                      |
