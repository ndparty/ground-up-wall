# Testing Guide

## Overview

This project supports three testing modes:

1. **Mock Database (CI)** - Fast, no PostgreSQL required
2. **PostgreSQL (Local Development)** - Full integration testing
3. **Browser E2E (Playwright)** - Real browser-based UI testing

## CI Pipeline (GitHub Actions)

The CI pipeline uses the **mock database** by default:

- No PostgreSQL service required
- Tests run faster (~2-3 minutes vs ~5-7 minutes)
- Set via `USE_MOCK_DB=true` environment variable

### What Runs in CI

- **Pull Requests**: Unit tests (`deno task test:unit`) + smoke tests (`deno task test:e2e:smoke`)
- **Main Branch**: Unit tests (`deno task test:unit`) + smoke tests (`deno task test:e2e:smoke`)
- **All builds**: Lint and format checks (`deno task check`)
- **Browser tests**: Run separately in `e2e-browser.yml` via `deno task test:e2e:browser` (requires
  PostgreSQL + Chromium); they are excluded from `test:unit` and never run in the main CI workflow

## Local Development

### Quick Test (Mock Database)

Run tests without PostgreSQL:

```bash
USE_MOCK_DB=true deno task test
```

### Full Integration Test (PostgreSQL Required)

For complete database integration testing:

```bash
# 1. Start PostgreSQL (using Docker)
docker run --name ground-up-wall-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ground_up_wall_test \
  -p 5432:5432 \
  -d postgres:17-alpine

# 2. Run migrations
deno task db:migrate

# 3. Run full test suite
deno task test

# 4. Stop PostgreSQL when done
docker stop ground-up-wall-db
docker rm ground-up-wall-db
```

### Using Docker Compose (Recommended)

Create a `docker-compose.test.yml`:

```yaml
version: "3.8"
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ground_up_wall_test
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Then run:

```bash
# Start PostgreSQL
docker-compose -f docker-compose.test.yml up -d

# Run migrations
deno task db:migrate

# Run tests
deno task test

# Stop PostgreSQL
docker-compose -f docker-compose.test.yml down
```

## Test Commands

```bash
# Run all tests
deno task test

# Run only unit tests (no e2e)
deno task test:unit

# Run only e2e tests (API-level, handler-based)
deno task test:e2e

# Run smoke tests only
deno task test:e2e:smoke

# Run browser E2E tests (Playwright, requires Chromium installed)
deno task test:e2e:browser

# Run with mock database
USE_MOCK_DB=true deno task test
```

## Browser E2E Tests (Playwright)

Browser tests use **Playwright** to validate UI behaviour in a real Chromium browser. They exercise
selected user-story paths from `docs/ai-dlc/inception/user-stories/stories.md`.

**Honest coverage:** inclusion in the table below means the check is **runnable and documented**,
not that every related user story or NFR is fully accepted. Soft-pass / skipped paths are treated as
unproven. NFR file is **smoke-only** (demoted) until real budgets exist.

Browser E2E **must run serially** (omit `--parallel` — serial is Deno’s default;
`deno task
test:e2e:browser` does not pass `--parallel`). Parallel workers share one Postgres and
will race on auth/config mutations.

### Test Files

| File                                             | Stories / notes                   | Feature                |
| ------------------------------------------------ | --------------------------------- | ---------------------- |
| `tests/e2e-browser/upload.feature_test.ts`       | US-01, US-02, US-02a              | Upload Page            |
| `tests/e2e-browser/moderation.feature_test.ts`   | US-03, US-04, US-05, US-06, US-12 | Moderate Photos        |
| `tests/e2e-browser/display.feature_test.ts`      | US-07, US-08, US-15               | Display Wall           |
| `tests/e2e-browser/admin-users.feature_test.ts`  | US-09, US-10, US-16, US-18        | Admin — Manage Users   |
| `tests/e2e-browser/admin-config.feature_test.ts` | US-14, US-17, US-19               | Admin — Config & Audit |
| `tests/e2e-browser/password.feature_test.ts`     | US-11 (seeded `pwdchange` user)   | Change Password        |
| `tests/e2e-browser/nfr.feature_test.ts`          | Smoke only — not NFR acceptance   | Structural smoke       |

### Prerequisites

Playwright and Chromium must be installed:

```bash
# Install Playwright (already in deno.json imports)
deno add npm:playwright

# Install Chromium browser binary
npx playwright install chromium
```

### Running

```bash
# Run all browser tests (serial — required)
deno task test:e2e:browser

# Run a specific feature file
deno test -P --allow-run --allow-ffi tests/e2e-browser/upload.feature_test.ts
```

CI sets `SECURITY_GATES_DISABLED=1` on the browser workflow step (PoW/rate limits off). Local runs
should match that when debugging CI-equivalent behaviour.

### Test Structure

Each test file follows this pattern:

1. **Setup**: Start an **in-process** Fresh HTTP server (`setup.ts` + `Deno.serve`) and launch
   Playwright Chromium — not a separate subprocess
2. **Tests**: One or more `Deno.test` cases named with the US ID (or `smoke (NFR demoted): …`)
3. **Teardown**: Close browser, restore mutated config/password where applicable, stop server

Tests use `sanitizeResources: false` and `sanitizeOps: false` because Playwright manages its own
async lifecycle outside Deno's scope tracking.

Shared login lives in `tests/e2e-browser/helpers.ts` and **fails hard** via `waitForURL` if still on
`/masuk` (no soft-pass).

## When to Use Each Mode

### Use Mock Database When:

- ✅ Running quick tests during development
- ✅ Testing business logic without database concerns
- ✅ CI/CD pipelines (already configured)
- ✅ Testing edge cases that are hard to reproduce in PostgreSQL

### Use PostgreSQL When:

- ✅ Testing database migrations
- ✅ Testing PostgreSQL-specific features (JSON operators, constraints, etc.)
- ✅ Performance testing with real database
- ✅ Before pushing to main (full integration validation)
- ✅ Debugging database-related issues

## Architecture

### MockRepository

Located in `lib/repositories/mock_repository.ts`:

- In-memory implementation of the `Repository` interface
- No external dependencies
- Fast test execution
- Automatic cleanup between tests

### PostgresRepository

Located in `lib/repositories/postgres_repository.ts`:

- Real PostgreSQL implementation
- Tests actual SQL queries and constraints
- Required for migration testing
- Catches database-specific issues

## Environment Variables

| Variable                  | Purpose                                   | Default                                         |
| ------------------------- | ----------------------------------------- | ----------------------------------------------- |
| `USE_MOCK_DB`             | Use mock repository instead of PostgreSQL | `false`                                         |
| `DATABASE_URL`            | PostgreSQL connection URL                 | `postgres://localhost:5432/ground_up_wall_test` |
| `DATABASE_URL_TEST`       | Test database URL                         | Same as `DATABASE_URL`                          |
| `SECURITY_GATES_DISABLED` | Disable rate limits in tests              | `1` (set automatically)                         |

## Troubleshooting

### "PostgreSQL did not become ready in time"

This error occurs when PostgreSQL isn't running. Solutions:

1. **Use mock database** (recommended for most cases):
   ```bash
   USE_MOCK_DB=true deno task test
   ```

2. **Start PostgreSQL**:
   ```bash
   docker-compose -f docker-compose.test.yml up -d
   ```

### TypeScript Errors in IDE

The IDE may show `Cannot find name 'Deno'` errors. These are false positives - the code works
correctly when run with Deno. To suppress:

1. Install Deno VS Code extension
2. Or ignore these specific errors

### Tests Pass in CI but Fail Locally

This usually indicates a PostgreSQL-specific issue. Run with PostgreSQL locally:

```bash
docker-compose -f docker-compose.test.yml up -d
deno task db:migrate
deno task test
```

## Contributing

When adding new tests:

1. **Use mock repository** for business logic tests
2. **Use PostgreSQL** for database-specific tests
3. **Mark smoke tests** with `smoke:` prefix for CI
4. **Clean up test data** using `cleanupTestData()` or `repo.clear()`

## Performance Comparison

| Mode       | Test Suite Time | PostgreSQL Required |
| ---------- | --------------- | ------------------- |
| Mock       | ~2-3 minutes    | ❌ No               |
| PostgreSQL | ~5-7 minutes    | ✅ Yes              |

The mock database significantly speeds up CI while maintaining test coverage for business logic.

## Notes

- Test counts are not listed in documentation to avoid frequent updates as tests are added/removed
- All commands work regardless of the number of tests
- CI automatically runs the appropriate test subsets for each environment
