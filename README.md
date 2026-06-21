# ground-up-wall

A photowall web application for events — participants upload photos with short messages, moderators
approve them, and approved submissions ride a red-and-white metro-themed train on a display wall.

Built for the Singapore National Day ground-up party.

## Status

**Phase 01 (local MVP)** — **complete** (released as **v1.0.0**): upload, moderation, display wall,
admin panel, and audit logging on localhost.

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
| Real-time           | In-memory SSE (Phase 2: Supabase) |

## Architecture

```
Browser  →  Fresh routes (pages + API)
                ↓
         PhotoWallService (facade)
                ↓
    Repository · FileStorage · Realtime · Audit
```

- **Public:** `/upload` — photo submission (no login)
- **Moderator:** `/moderate` — approve, reject, edit, display override
- **Display wall:** `/display` — train animation (display-wall, moderator, or admin login)
- **Admin:** `/admin` — users, parameters, audit log, display override

## Tests

```bash
deno task test              # all tests (210 scenarios)
deno task test:e2e:smoke    # PR smoke subset
deno task test:e2e          # full E2E suite
deno task check             # format, lint, type-check
```

Requires Postgres and `ground_up_wall_test` (or set `DATABASE_URL_TEST`). For serial runs on
Windows: `$env:DENO_JOBS="1"; deno task test`

## Documentation

| Document                                                               | Description                              |
| ---------------------------------------------------------------------- | ---------------------------------------- |
| [DEMO.md](DEMO.md)                                                     | Start, run, and demonstrate the system   |
| [SETUP.md](SETUP.md)                                                   | Developer setup and NFR sign-off         |
| [docs/phase01/epic_plan-phase01.md](docs/phase01/epic_plan-phase01.md) | Phase 01 work items WI-01–WI-07          |
| [docs/ai-dlc/](docs/ai-dlc/)                                           | Requirements, user stories, architecture |

## Phase roadmap

1. **Phase 1** — Local MVP (current)
2. **Phase 2** — Cloud deployment (Deno Deploy + Supabase)
3. **Phase 3** — Instagram hashtag integration

## Contributing

Work items follow the stacked-PR workflow in the Phase 01 epic plan. Branch from the previous WI
branch, implement per the matching `code_execution_plan-wi-*.md`, run `deno task test`, and open a
PR.
