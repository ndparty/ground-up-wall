# Testing Guide

## Overview

This project supports three testing modes:

1. **Mock Database (CI)** - Fast, no PostgreSQL required
2. **PostgreSQL (Local Development)** - Full integration testing
3. **Browser E2E (Playwright)** - Real browser-based UI testing

## CI Pipeline (GitHub Actions)

Two workflows share the same trigger matrix:

| Trigger             | Branches / events                  |
| ------------------- | ---------------------------------- |
| `push`              | `main`                             |
| `pull_request`      | `main`, `integration/all-features` |
| `release`           | `published`                        |
| `workflow_dispatch` | manual                             |

| Workflow          | Job                                        | What it runs        |
| ----------------- | ------------------------------------------ | ------------------- |
| `ci.yml`          | unit + smoke (mock DB) + `deno task check` | Fast; no Postgres   |
| `e2e-browser.yml` | Playwright browser E2E                     | Postgres + Chromium |

Mock CI uses `USE_MOCK_DB=true` (no PostgreSQL; ~2–3 minutes). Browser E2E is excluded from
`test:unit` and never runs in the main CI workflow.

### Artifacts

Both workflows upload under `Actions → run → Artifacts` (always, including green runs). The browser
job summary also links directly to an unarchived, self-contained `report.html`; it opens in the
browser without downloading a ZIP. GitHub authentication is still required for private repository
artifacts.

Archived debug packs use `{suite}-{event}-{sha7}` where `event` is `pr` | `push` | `release` |
`manual`. The unarchived direct artifact is named `report.html` (`upload-artifact@v7` intentionally
ignores `name` for direct single-file uploads).

Retention: **14 days** (PR / push / manual), **90 days** (release).

#### Browser E2E (`e2e-*-…`)

Root: `test-results/e2e-browser/` (env `E2E_ARTIFACTS_DIR`).

| Path                                                               | When                                                                                                                 |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `failures/<test>/{screenshot.png,page.html,console.txt,error.txt}` | On failure                                                                                                           |
| `success/*.png`                                                    | Green audit shots for major upload, moderation, display, and admin surfaces                                          |
| `visual-diff/<name>.{actual,expected,diff}.png`                    | Visual baseline mismatch                                                                                             |
| `summary.json`                                                     | Always (`passed`, `failed`, `screenshots`, `sha`, `event`)                                                           |
| `report.html`                                                      | Direct artifact only; embedded success shots, visual triples, errors, page/capture diagnostics, and console excerpts |

CI always sets `E2E_CAPTURE_SUCCESS_SHOT=1`. Locally, set that env only when you want success
screenshots (default off to avoid filling disks).

Committed visual baselines under `tests/e2e-browser/baselines/` cover every browser feature file:
upload idle/error/success, login and moderation states, display playing/paused/post-jump, admin
users/config/audit/override states, password banners, public/protected smoke shells, and a station
sign matrix spanning MRT, LRT, dual-system, one-to-three line badges, long names, and narrow widths.
CI uses `pixelmatch` and fails when more than 0.1% of pixels differ. Only genuinely volatile
content, such as timestamps and the random local join URL, is masked gray; station signs are
rendered and compared directly.

Animation has two complementary gates. The runtime test asserts `sliding` → transform delta → `idle`
and the requested final cabin. The frame-accurate gate pauses a clone of the live transform
transition, seeks every nominal 60 Hz timeline point to verify monotonic movement, duration, easing,
endpoints, and centering, then compares a labeled 0/25/50/75/100% storyboard baseline. Timeline
seeking proves interpolation and visual correctness, not actual frame delivery or freedom from
hardware jank. NFR-03 still requires profiling on representative display hardware (or a dedicated
performance runner). Realtime coverage approves a unique fixture while the display remains open,
verifies it appears within 30 seconds, then verifies refresh restores the server-authoritative list,
position, and play/pause state.

#### Unit / smoke CI (`ci-*-…`)

Root: `test-results/ci/` — **text only** (no screenshots):

| Path                                 | Contents                   |
| ------------------------------------ | -------------------------- |
| `unit-junit.xml` / `smoke-junit.xml` | JUnit reports              |
| `unit.log` / `smoke.log`             | Tee’d console output       |
| `summary.json`                       | Commit SHA + step outcomes |

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

| File                                              | Executable browser coverage                                                        | Feature                |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------- |
| `tests/e2e-browser/upload.feature_test.ts`        | US-01/02/02a form, client + server acknowledgment rejection, upload → queue        | Upload Page            |
| `tests/e2e-browser/moderation.feature_test.ts`    | US-03/04/05/06/12 login, queue, edit/approve/reject/delete, flagged fixture, audit | Moderate Photos        |
| `tests/e2e-browser/display.feature_test.ts`       | US-07/08/15 auth, animation, realtime approval, authoritative refresh              | Display Wall           |
| `tests/e2e-browser/admin-users.feature_test.ts`   | US-09/10/16/18 create/toggle/delete with verified cleanup                          | Admin — Manage Users   |
| `tests/e2e-browser/admin-config.feature_test.ts`  | US-14/17/19 validation, audit, live override effects, verified restoration         | Admin — Config & Audit |
| `tests/e2e-browser/password.feature_test.ts`      | US-11 success/error states; probes known credentials and restores original         | Change Password        |
| `tests/e2e-browser/nfr.feature_test.ts`           | Static public/protected/read-only smoke only — not NFR acceptance                  | Structural smoke       |
| `tests/e2e-browser/station-sign.feature_test.tsx` | MRT/LRT/logo/badge/name-length matrices at normal and narrow widths                | Station signage        |

### Prerequisites

Playwright and Chromium must be installed:

```bash
# Install the Chromium build matching the exact Playwright import/lock version
npx --yes playwright@1.61.1 install chromium
```

### Running

```bash
# Run all browser tests (serial — required)
deno task test:e2e:browser

# Run a specific feature file
deno test -P --allow-run --allow-ffi tests/e2e-browser/upload.feature_test.ts

# Intentionally regenerate visual baselines (requires the same Postgres/seed setup)
deno task test:e2e:baselines

# Regenerate the self-contained report from the current artifact directory
deno task test:e2e:report
```

CI sets `SECURITY_GATES_DISABLED=1` on the browser workflow step (PoW/rate limits off). Local runs
should match that when debugging CI-equivalent behaviour.

Baseline updates should be generated on Linux matching `ubuntu-latest`, reviewed as images, and
committed only for intentional UI changes. `E2E_STATION_SEED=42` stabilizes train destination names;
`E2E_TRAIN_DWELL_SECONDS=60` prevents automatic ticks racing static captures. The animation test
still triggers a jump explicitly. Station destinations are not masked: the seeded full-display
captures and dedicated station-sign matrix intentionally gate their logos, names, line badges,
spacing, and truncation.

For a Linux-compatible update, manually dispatch **E2E Browser Tests** with `update-baselines=true`,
download `generated-baselines/` from the debug pack, replace the committed files under
`tests/e2e-browser/baselines/`, review the image diff, then rerun in normal comparison mode. Never
enable baseline update mode on ordinary pull-request or push runs.

Fixed baseline viewports are **375×812** for participant upload/mobile smoke and **1920×1080** for
the display wall. Other admin/moderation/password surfaces use the harness default **1280×800**.
Baseline names ending in `-static` are captured only after the island is ready and any train track
is idle. The animation storyboard is produced non-realtime by seeking exact transition times and is
therefore deterministic across runner speeds. Dynamic list timestamps are masked rather than
accepted as pixel noise.

### Test Structure

Each test file follows this pattern:

1. **`runBrowserTest`** (`helpers.ts`): starts the in-process Fresh server + Chromium under nullable
   ownership, attaches console capture, runs the body, writes failure/success artifacts, and awaits
   page/browser/server teardown even when startup or cleanup fails
2. **Tests**: One or more `Deno.test` cases named with the US ID (or `smoke (NFR demoted): …`)
3. **Restore**: temporary submissions/users, config, display override, playback mode/position, and
   password credentials are restored and verified in `finally`; cleanup failures fail the test

The artifact root is cleared once at process start, so rerunning the serial suite does not retain
stale pass/fail entries. A repeatability check should run `deno task test:e2e:browser` twice against
the same migrated/seeded PostgreSQL database; both runs must pass without reseeding.

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

| Variable                   | Purpose                                    | Default                        |
| -------------------------- | ------------------------------------------ | ------------------------------ |
| `USE_MOCK_DB`              | Use mock repository instead of PostgreSQL  | `false`                        |
| `DATABASE_URL`             | PostgreSQL connection URL                  | `postgres://localhost:5432/…`  |
| `DATABASE_URL_TEST`        | Test database URL                          | Same as `DATABASE_URL`         |
| `SECURITY_GATES_DISABLED`  | Disable rate limits in tests               | `1` (set automatically)        |
| `E2E_ARTIFACTS_DIR`        | Browser E2E artifact root                  | `test-results/e2e-browser`     |
| `E2E_CAPTURE_SUCCESS_SHOT` | Write green success screenshots (`1` = on) | unset (off) locally; `1` in CI |
| `E2E_STATION_SEED`         | Seed generated train station names         | unset; `42` in visual CI       |
| `E2E_TRAIN_DWELL_SECONDS`  | Stabilize the automatic dwell during E2E   | unset; `60` in visual CI       |
| `E2E_VISUAL`               | Compare pages with committed PNG baselines | unset; `1` in visual CI        |
| `E2E_UPDATE_BASELINES`     | Rewrite PNG baselines instead of comparing | unset (off)                    |

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
