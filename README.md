# ground-up-wall

A photowall web application for events — participants upload photos with short messages, moderators
approve them, and approved submissions ride a red-and-white metro-themed train on a display wall.

Built for the Singapore National Day ground-up party.

## Status

**Phase 01 (local MVP)** — **complete** (released as **v1.0.1**): upload, moderation, display wall,
admin panel, and audit logging on localhost.

**Phase 02 (production)** — **in progress** (tag **v1.0.6** on `phase2` branch): Oracle VPS deploy
path — `prod.ts`, `DEPLOYED=1` hardening, Caddy + Let's Encrypt + Cloudflare. Ops guide:
[docs/phase02/oracle_vps_deploy.md](docs/phase02/oracle_vps_deploy.md).

## Quick start

### bash / macOS / Linux

```bash
createdb ground_up_wall_dev
createdb ground_up_wall_test
cp .env.example .env
export ADMIN_INITIAL_PASSWORD="YourStrongPass123!"   # optional locally
deno task db:migrate
deno task db:seed
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
deno task start
```

Open http://localhost:8080 — see [DEMO.md](DEMO.md) for the full walkthrough and demo accounts.

The app reads `.env` at startup automatically. Full setup: **[SETUP.md](SETUP.md)**\
OS-specific tool install: **[docs/phase01/dev_setup.md](docs/phase01/dev_setup.md)**

## Tech stack

| Layer               | Technology                        |
| ------------------- | --------------------------------- |
| Runtime / framework | Deno 2.x + Fresh 2.x              |
| UI                  | Preact + Signals                  |
| Database            | PostgreSQL 17+                    |
| File storage        | Local filesystem (`STORAGE_PATH`) |
| Real-time           | In-memory SSE (single VPS instance) |

## Architecture

```
Browser  →  Fresh routes (pages + API)
                ↓
         PhotoWallService (facade)
                ↓
    Repository · FileStorage · Realtime · Audit
```

- **Public:** `/muatnaik` — photo submission (no login)
- **Moderator:** `/semak` — approve, reject, edit, display override; gallery at `/semak/pamer`
- **Display wall:** `/concourse` — train animation (display-wall, moderator, or admin login)
- **Admin:** `/towkay` — users, parameters, audit log, display override
- **Login:** `/masuk` — staff sign-in (legacy paths like `/login`, `/upload`, `/moderate` return 404)

## Tests

```bash
# Quick tests with mock database (no PostgreSQL required)
USE_MOCK_DB=true deno task test              # all tests except seed/integration (468 scenarios)
USE_MOCK_DB=true deno task test:unit         # unit tests only
USE_MOCK_DB=true deno task test:e2e:smoke    # smoke tests (PR subset)
USE_MOCK_DB=true deno task test:e2e          # all e2e tests except seed tests

# Full integration tests (requires PostgreSQL)
deno task test              # all tests including seed/integration (473+ scenarios)
deno task test:e2e          # full E2E suite including seed tests
deno task check             # format, lint, type-check
```

**CI uses mock database** — no PostgreSQL required for pull requests.  
**Local full testing** requires PostgreSQL and `ground_up_wall_test` (or set `DATABASE_URL_TEST`).  
For serial runs on Windows: `$env:DENO_JOBS="1"; deno task test`

See [TESTING.md](TESTING.md) for detailed testing guide and Docker Compose setup.

## Documentation

| Document                                                               | Description                              |
| ---------------------------------------------------------------------- | ---------------------------------------- |
| [DEMO.md](DEMO.md)                                                     | Start, run, and demonstrate the system   |
| [SETUP.md](SETUP.md)                                                   | Developer setup and NFR sign-off         |
| [TESTING.md](TESTING.md)                                               | Testing guide (mock DB + PostgreSQL)     |
| [docs/phase01/epic_plan-phase01.md](docs/phase01/epic_plan-phase01.md) | Phase 01 work items WI-01–WI-07          |
| [docs/phase02/oracle_vps_deploy.md](docs/phase02/oracle_vps_deploy.md) | Production deploy (Oracle VPS)           |
| [docs/phase03/instagram_feasibility.md](docs/phase03/instagram_feasibility.md) | Phase 03 Instagram research      |
| [docs/ai-dlc/](docs/ai-dlc/)                                           | Requirements, user stories, architecture |

## Phase roadmap

1. **Phase 1** — Local MVP (**complete**, v1.0.1)
2. **Phase 2** — Production on **Oracle VPS** (Caddy, LE, Cloudflare) — [deploy guide](docs/phase02/oracle_vps_deploy.md)
3. **Phase 3** — Instagram integration — [feasibility research](docs/phase03/instagram_feasibility.md)

> **Superseded:** The original Phase 2 plan (Deno Deploy + Supabase) was dropped in favour of a single Oracle VPS running the same local stack.

## Contributing

Work items follow the stacked-PR workflow in the Phase 01 epic plan. Branch from the previous WI
branch, implement per the matching `code_execution_plan-wi-*.md`, run `deno task test`, and open a
PR.
