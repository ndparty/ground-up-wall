# ground-up-wall

A photowall web application for events — participants upload photos with short messages, moderators approve them, and approved submissions ride an SMRT-themed train on a display wall.

Built for the Singapore National Day ground-up party.

## Status

**Phase 01 (local MVP)** — feature-complete on localhost: upload, moderation, display wall, admin panel, and audit logging.

## Quick start

```bash
createdb ground_up_wall_dev
cp .env.example .env
export ADMIN_INITIAL_PASSWORD="YourStrongPass123!"   # optional locally; required in deployed envs
deno task db:migrate
deno task db:seed
deno task start
```

Open http://localhost:8000 — log in as `admin` (see [SETUP.md](SETUP.md) for credentials).

Full setup instructions: **[SETUP.md](SETUP.md)**  
OS-specific tool install: **[docs/phase01/dev_setup.md](docs/phase01/dev_setup.md)**

## Tech stack

| Layer | Technology |
|-------|------------|
| Runtime / framework | Deno 2.x + Fresh 2.x |
| UI | Preact + Signals |
| Database | PostgreSQL 17+ |
| File storage | Local filesystem (`STORAGE_PATH`) |
| Real-time | In-memory SSE (Phase 2: Supabase) |

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
deno task test              # all tests
deno task test:e2e:smoke    # PR smoke subset
deno task test:e2e          # full E2E suite
```

## Documentation

| Document | Description |
|----------|-------------|
| [SETUP.md](SETUP.md) | Developer setup and NFR sign-off |
| [docs/phase01/epic_plan-phase01.md](docs/phase01/epic_plan-phase01.md) | Phase 01 work items WI-01–WI-07 |
| [docs/ai-dlc/](docs/ai-dlc/) | Requirements, user stories, architecture |

## Phase roadmap

1. **Phase 1** — Local MVP (current)
2. **Phase 2** — Cloud deployment (Deno Deploy + Supabase)
3. **Phase 3** — Instagram hashtag integration

## Contributing

Work items follow the stacked-PR workflow in the Phase 01 epic plan. Branch from the previous WI branch, implement per the matching `code_execution_plan-wi-*.md`, run `deno task test`, and open a PR.
