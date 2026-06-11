# Local Development Setup — ground-up-wall

This guide gets the Phase 01 application running on your machine. For OS-specific tool installation (Deno, PostgreSQL, Git), see [docs/phase01/dev_setup.md](docs/phase01/dev_setup.md).

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

3. **Configure environment:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set `DATABASE_URL` if needed (default: `postgres://localhost:5432/ground_up_wall_dev`).

4. **Set the initial admin password** (recommended even for local dev):

   ```bash
   # PowerShell
   $env:ADMIN_INITIAL_PASSWORD = "YourStrongPass123!"

   # bash/zsh
   export ADMIN_INITIAL_PASSWORD="YourStrongPass123!"
   ```

   > **Security:** If `ADMIN_INITIAL_PASSWORD` is not set, the seed script uses `admin123` for local development only and prints it to the console. The seed script **refuses** to use the fallback when `DENO_DEPLOYMENT_ID` is set (deployed environments).

5. **Run migrations:**

   ```bash
   deno task db:migrate
   ```

6. **Seed initial data** (admin account + default system parameters):

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
| Admin | `admin` | Value of `ADMIN_INITIAL_PASSWORD`, or `admin123` in local dev only |

Create moderator and display-wall accounts from **Admin → Users**.

## Running tests

| Command | Purpose |
|---------|---------|
| `deno task test` | Full unit + integration test suite (serial, uses test DB) |
| `deno task test:unit` | Route + lib tests only (excludes `tests/e2e/`, still uses Postgres) |
| `deno task test:e2e` | Full end-to-end scenario suite |
| `deno task test:e2e:smoke` | PR-time smoke subset (~30 scenarios) |

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
docs/phase01/    Epic plan and execution plans
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Connection refused` to Postgres | Ensure PostgreSQL is running; verify `DATABASE_URL` |
| Migration errors | Run `deno task db:migrate` on a clean database |
| Tests fail with auth errors | Tests default to `ground_up_wall_test` via `DATABASE_URL_TEST`; avoid running dev server against the test DB during `deno task test` |
| Seed says admin exists | Idempotent — safe to re-run |

## Phase roadmap

- **Phase 1 (current):** Local MVP — Deno Fresh + Postgres + filesystem storage
- **Phase 2:** Cloud deployment (Deno Deploy + Supabase)
- **Phase 3:** Instagram integration

See [docs/phase01/epic_plan-phase01.md](docs/phase01/epic_plan-phase01.md) for the full work-item breakdown.
