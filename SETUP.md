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

   > **Security:** If passwords are not set, the seed script uses local fallbacks (`admin123`, `demo123`) and prints them to the console. The seed script **refuses** fallbacks when `DENO_DEPLOYMENT_ID` is set (deployed environments).

5. **Run migrations:**

   ```bash
   deno task db:migrate
   ```

6. **Seed initial data** (admin, demo moderator/display accounts, default system parameters):

   ```bash
   deno task db:seed
   ```

7. **Start the dev server:**

   ```bash
   deno task start
   ```

   Open http://localhost:8000

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

- **NFR-03 (60fps):** Open `/display` in Chrome → DevTools → Performance → record 30s with 50+ cabins → confirm ≥55fps sustained.
- **NFR-04 (30s real-time):** Approve a submission in `/moderate`; measure time until it appears on `/display` (<30s).
- **NFR-08 (legibility):** DevTools → Computed → font-size on cabin name (≥24px) and message (≥18px).

Automated checks cover audit-log integrity (`deno task test:e2e:smoke --filter audit`).

## Project structure

```
routes/          Fresh pages and API handlers
islands/         Interactive Preact components
lib/             Services, repositories, validation
scripts/         migrate.ts, seed.ts
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
| Migration errors | Run `deno task db:migrate` on a clean database |
| Tests fail with auth errors | Create `ground_up_wall_test`; set `DATABASE_URL_TEST`; avoid running dev server against the test DB during `deno task test` |
| Seed says admin exists | Idempotent — safe to re-run |
| Images 404 on display | Confirm files exist under `./uploads/` and server is running |

## Phase roadmap

- **Phase 1 (current):** Local MVP — Deno Fresh + Postgres + filesystem storage
- **Phase 2:** Cloud deployment (Deno Deploy + Supabase)
- **Phase 3:** Instagram integration

See [docs/phase01/epic_plan-phase01.md](docs/phase01/epic_plan-phase01.md) for the full work-item breakdown.
