# Code Execution Plan: ground-up-wall

| Field | Value |
|-------|-------|
| Document Type | Code Execution Plan |
| Epic Work Item | `WI-07` |
| Tech Spec | `ground-up-wall/docs/phase01/epic_plan-phase01.md` |
| Version | 1.0 |
| Author | Developer |

---

> This document is the **single source of truth** for implementation sequencing of WI-07 (Seeding + Integration Tests + Docs).
> ⚠️ This is the **capstone work item** — all WI-01 through WI-06c must be merged before starting.

---

## Pre-Conditions

- [ ] WI-01 merged to `main` (Foundation)
- [ ] WI-02 merged to `main` (Auth)
- [ ] WI-03 merged to `main` (Upload)
- [ ] WI-04 merged to `main` (Moderation)
- [ ] WI-05a merged to `main` (Display Wall Core)
- [ ] WI-05b merged to `main` (Train Controls)
- [ ] WI-06a merged to `main` (Admin User Management)
- [ ] WI-06b merged to `main` (Admin System Parameters)
- [ ] WI-06c merged to `main` (Admin Audit + Display Override)
- [ ] All migrations have been run
- [ ] Branch created from `main`: `wi-07-integration`
- [ ] Both developers contribute to this WI

---

> ⚠️ **Single Source of Truth** — This document is the authoritative sequencing guide for WI-07.

---

## 1. ground-up-wall

### 1.1 Seed Data Script

**Commit message:** `WI-07: create seed data script with initial admin account and default system parameters`

#### Files Changed

| File | Change | Description |
|------|--------|-------------|
| `scripts/seed.ts` | New | Seed script — creates initial admin account and default system configs |
| `scripts/seed_test.ts` | New | Tests for seed execution |

#### Implementation Details

1. **Create `scripts/seed.ts`:**
   ```typescript
   // 1. Connect to database
   // 2. Check if admin already exists (idempotent)
   // 3. Create initial admin account:
   //    username: 'admin'
   //    password: from env variable ADMIN_INITIAL_PASSWORD, OR fallback to 'admin123' for local dev only
   //    role: 'admin'
   // 4. Seed system_config defaults (only if not already set):
   ```

   > ⚠️ **Security note (admin initial password)**: The `'admin123'` fallback exists **for local development convenience only**. It is intentionally weak and is printed in plain text to the seed script's console output. **For any non-local environment (staging, demo, production), `ADMIN_INITIAL_PASSWORD` MUST be set to a strong password (min 12 chars, mixed case + digits + symbols) before running the seed script.** The seed script will refuse to run with the fallback password if `DENO_DEPLOYMENT_ID` is set (a heuristic for "this is not a local Deno process"). Document this prominently in SETUP.md and the README so it's not missed.

   ```typescript
   const DEFAULTS = [
     { key: 'train_dwell_time', value: '15', default_value: '15' },
     { key: 'message_prompt_text', value: 'What does National Day mean to you?', default_value: 'What does National Day mean to you?' },
     { key: 'message_length_limit', value: '50', default_value: '50' },
     { key: 'message_length_unit', value: 'characters', default_value: 'characters' },
     { key: 'auto_moderator_word_list', value: SEEDED_WORD_LIST.join(','), default_value: SEEDED_WORD_LIST.join(',') },
   ];
   // 5. Log results to console
   ```

2. **Seeded PG-13 word list** (defined as constant in seed file):
   ```typescript
   const SEEDED_WORD_LIST = [
     'damn', 'hell', 'crap', 'shit', 'fuck', 'bastard', 'bitch',
     'asshole', 'piss', 'dick', 'cock', 'porn', 'slut', 'whore',
     // ... expanded list appropriate for PG-13 audience
   ];
   ```

3. **Run seed**: `deno run -A scripts/seed.ts`

#### Unit Tests

| Test File | Test Method | Verifies |
|-----------|-------------|----------|
| `scripts/seed_test.ts` | `testSeedCreatesAdmin` | Running seed creates admin account |
| `scripts/seed_test.ts` | `testSeedIdempotent` | Running seed twice does not duplicate admin or configs |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Admin account created with correct role
- [ ] All 6 default system parameters seeded with correct values
- [ ] Running seed twice produces no duplicates or errors

---

### 1.2 End-to-End Integration Tests

**Commit message:** `WI-07: implement end-to-end integration tests covering all user stories and exit criteria`

#### Files Changed

| File | Change | Description |
|------|--------|-------------|
| `tests/e2e/upload.test.ts` | New | E2E tests for upload flow (US-01, US-02, US-02a) |
| `tests/e2e/moderation.test.ts` | New | E2E tests for moderation flow (US-03, US-04, US-05, US-06, US-12) |
| `tests/e2e/display.test.ts` | New | E2E tests for display wall (US-07, US-08, US-15) |
| `tests/e2e/admin.test.ts` | New | E2E tests for admin panels (US-09, US-10, US-14, US-16, US-17, US-18, US-19) |
| `tests/e2e/auth.test.ts` | New | E2E tests for auth (US-11, US-NFR-03) |
| `tests/e2e/nfr.test.ts` | New | E2E tests for NFRs (US-NFR-01, US-NFR-02, US-NFR-04, US-NFR-05) |
| `tests/helpers.ts` | New | Test helpers — database setup/teardown, auth helpers, test data factories |

#### Implementation Details

1. **Create `tests/helpers.ts`:**
   - `setupTestDb()`: create test database with all 4 tables
   - `teardownTestDb()`: drop test database
   - `createTestAdmin()`: create admin user for test auth
   - `createTestModerator()`: create moderator user
   - `createTestDisplayWallUser()`: create display wall user
   - `createTestSubmission(overrides)`: create a test submission with default data
   - `loginAs(moderatorCredentials)`: return auth token for test requests

2. **Upload flow tests** (`tests/e2e/upload.test.ts`):
   - US-01: Submit photo with message and name → success confirmation
   - US-01: Submit with social handle → saved correctly
   - US-01: Message exceeds character limit → validation error
   - US-01: Message exceeds word limit → validation error
   - US-01: Submit without acknowledgment checkbox → disabled button
   - US-01: No file selected → validation error
   - US-01: Invalid file type → validation error
   - US-02a: Privacy notice displayed with indefinite retention
   - US-02a: Posting guidelines disclaimer displayed
   - US-02a: Mandatory acknowledgment checkbox required

3. **Moderation flow tests** (`tests/e2e/moderation.test.ts`):
   - US-03: Login with valid credentials → redirect to moderation
   - US-03: Login with invalid credentials → error
   - US-03: Access without login → redirected to login
   - US-04: View pending submissions → list displayed
   - US-04: No pending submissions → empty message
   - US-05: Approve submission → moved to approved
   - US-05: Reject submission → removed from queue (no notification)
   - US-05: Edit pending submission → content updated, audit preserved
   - US-05: Edit approved submission → display updated, audit preserved
   - US-06: Delete approved submission → removed from wall
   - US-12: Flagged message shows visual indicator
   - US-12: Flagging is advisory only (can still approve)

4. **Display wall tests** (`tests/e2e/display.test.ts`):
   - US-07: Display Wall User login and view train
   - US-07: Display approved submissions in chronological order
   - US-07: Empty state shows branded waiting screen
   - US-07: Unauthenticated user blocked (403)
   - US-07: Participant blocked (403)
   - US-07: Blank screen display override
   - US-07: Placeholder display override
   - US-07: Resume display override
   - US-08: New approval appears on wall within 30 seconds
   - US-08: Browser refresh recovers state
   - US-15: Pause freezes train
   - US-15: Resume continues from current cabin
   - US-15: New submissions during pause appended but hidden
   - US-15: Jump to cabin scrolls to target
   - US-15: Jump to out-of-range clamps to last
   - US-15: Display Wall User cannot see controls

5. **Admin panel tests** (`tests/e2e/admin.test.ts`):
   - US-09: Create moderator account
   - US-09: Duplicate username error
   - US-09: Empty username/password validation
   - US-10: View moderator list with status
   - US-10: Reset moderator password
   - US-14: Change dwell time (3-60s validation)
   - US-14: Change message prompt text
   - US-14: Update auto-moderator word list
   - US-14: Change message length limit and unit
   - US-14: Upload default placeholder image
   - US-14: Reset parameter to default
   - US-14: Invalid dwell time validation
   - US-16: Create Display Wall account
   - US-16: Disable/delete Display Wall account
   - US-16: User management shows role and status
   - US-17: View audit log with filtering
   - US-17: Audit log is read-only
   - US-17: Non-admin cannot access audit log
   - US-18: Disable moderator account
   - US-18: Re-enable disabled moderator
   - US-18: Delete moderator preserves audit references
   - US-19: Blank display wall
   - US-19: Show placeholder (default + per-action)
   - US-19: Resume display
   - US-19: Override state persists for new connections
   - US-19: Override broadcast via RealtimeService

6. **Auth tests** (`tests/e2e/auth.test.ts`):
   - US-11: Successful password change
   - US-11: Incorrect current password error
   - US-11: Password confirmation mismatch error

7. **NFR tests** (`tests/e2e/nfr.test.ts`):
   - US-NFR-01: Mobile responsive upload form (viewport width test)
   - US-NFR-01: Font sizes meet minimum (24px name, 18px message)
   - US-NFR-02: Animation runs at 60fps (performance measurement)
   - US-NFR-02: Handles 200 submissions within 5 seconds load time
   - US-NFR-03: Admin panel not publicly accessible
   - US-NFR-03: Image upload validation (size + type)
   - US-NFR-05: Audit entries cannot be deleted or modified
   - US-NFR-05: All 15+ auditable actions are logged correctly
   - US-NFR-05: **Negative test** — the Repository interface must not expose `updateAuditEntry` or `deleteAuditEntry` methods. Enforce via TypeScript compile-time check (a unit test that uses `Object.keys(repository)` on the typed interface) and a runtime check (introspect the PostgresRepository class for these method names and fail the test if found).

#### Unit Tests (E2E)

| Test File | Total Scenarios | Smoke subset (PR-time) |
|-----------|:--------------:|:----------------------:|
| `tests/e2e/upload.test.ts` | ~12 | ~5 (form renders, valid submit, char limit, word limit, no-ack-disabled) |
| `tests/e2e/moderation.test.ts` | ~18 | ~7 (login, view queue, approve, reject, edit pending, edit approved, flagged UI) |
| `tests/e2e/display.test.ts` | ~16 | ~6 (DW user view, 403 blocks, blank override, placeholder override, resume, new approval within 30s) |
| `tests/e2e/admin.test.ts` | ~22 | ~8 (create mod, disable, delete, reset pw, change dwell, change prompt, create DW, audit view) |
| `tests/e2e/auth.test.ts` | ~3 | ~2 (success, wrong current password) |
| `tests/e2e/nfr.test.ts` | ~8 | ~2 (audit log integrity negative test, admin route not public) |
| **Total** | **~79** | **~30 (PR smoke)** |

**CI split strategy**:
- **PR-time (`deno task test:e2e:smoke`)** — runs the ~30 smoke subset on every PR push. Target wall-clock: ≤5 minutes. If any smoke test fails, the PR is blocked.
- **Nightly / pre-release (`deno task test:e2e`)** — runs all 79 scenarios nightly on `main` and on tagged releases. Target wall-clock: ≤30 minutes. Failures create issues but don't block individual PRs.
- **Tag the smoke tests** with `Deno.test({ name: "smoke: ..." })` or use a shared `isSmoke` flag so the `--filter=smoke` deno-test flag selects them. (Alternatively, prefix smoke test names with `smoke_` and use `--filter=^smoke_`.)

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] PR-time smoke subset (~30) passes in ≤5 min against a clean test database
- [ ] Full E2E suite (~79) passes in ≤30 min nightly
- [ ] NFR-03 (60fps) confirmed via measurement
- [ ] NFR-04 (30s real-time) confirmed via measurement
- [ ] NFR-22 (audit log integrity) confirmed via assertion tests, **including negative test** (no update/delete on audit_log)

---

### 1.3 README and Local Development Documentation

**Commit message:** `WI-07: add README with local development setup, configuration, and quick-start guide`

#### Files Changed

| File | Change | Description |
|------|--------|-------------|
| `README.md` | Modified | Complete README with setup instructions, architecture overview, workflow |
| `SETUP.md` | New | Detailed setup guide for developers |

#### Implementation Details

1. **Create `SETUP.md`** with:
   - Prerequisites: Deno, **PostgreSQL 17+**, git
   - Step-by-step setup:
     1. Clone repository
     2. Create database: `createdb ground_up_wall_dev`
     3. Copy `.env.example` to `.env`, configure `DATABASE_URL`
     4. Set `ADMIN_INITIAL_PASSWORD` env var to a strong password (see admin-password security note in §1.1)
     5. Run migrations: `deno task db:migrate`
     6. Run seeds: `deno run -A scripts/seed.ts`
     7. Start dev server: `deno task start`
   - Default admin credentials: admin / (value of `ADMIN_INITIAL_PASSWORD` or `'admin123'` for local dev only)
   - Running tests: `deno task test` (unit), `deno task test:e2e` (E2E), `deno task test:e2e:smoke` (PR-time smoke subset)
   - **Visual / Performance NFR verification protocol** (reproducible exit-criteria sign-off):
     - **NFR-03 (60fps animation)**: Open display wall page in Chrome → DevTools → Performance → record for 30s with 50+ cabins in train → confirm FPS counter reads ≥55fps sustained. Take a screenshot of the FPS overlay for the audit trail.
     - **NFR-04 (30s real-time)**: Open moderation panel and display wall in two tabs. Submit + approve a photo. Measure wall-clock from approval to cabin visible on display. Must be <30s. Log the measurement.
     - **NFR-08 (legibility)**: Measure cabin font sizes with DevTools → Computed → font-size. Name ≥24px, message ≥18px. Screenshot.
     - **NFR-22 (audit log integrity)**: Run `deno task test:e2e:smoke --filter audit` (or the dedicated NFR test) and confirm all auditable action types produce a row. Negative test: `lib/repositories/postgres_repository_test.ts` has `testNoUpdateOrDeleteOnAuditLog` which calls reflection/introspection on the Repository interface to confirm no `updateAuditEntry` or `deleteAuditEntry` methods are exposed.
   - Project structure overview
   - Common troubleshooting

2. **Update `README.md`**:
   - Project name and description
   - Badges (build status if CI configured)
   - Quick start (3-step)
   - Architecture overview (brief)
   - Tech stack
   - Phase roadmap (Phase 1 → Phase 2 → Phase 3)
   - Contributing guidelines (link to epic plan workflow)

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] A new developer can follow SETUP.md and have a running system in 5 minutes
- [ ] README includes all necessary sections

---

## Post-Implementation Checklist

- [ ] All chunks verified — each compiles, passes tests, and meets ≥80% coverage
- [ ] No regressions in existing functionality
- [ ] Post-implementation checks executed and signed off
- [ ] All 10 Exit Criteria from Epic Plan are satisfied:
  - [ ] FR-01 to FR-24 pass E2E testing (Exit 1)
  - [ ] Update 01 FRs pass acceptance (Exit 2)
  - [ ] Update 02 FRs pass acceptance (Exit 3)
  - [ ] NFR-03 (60fps) confirmed (Exit 4)
  - [ ] NFR-04 (30s real-time) verified (Exit 5)
  - [ ] NFR-22 (audit log) verified (Exit 6)
  - [ ] Display Wall User login verified (Exit 7)
  - [ ] Organiser sign-off completed (Exit 8)
  - [ ] All user stories pass Gherkin AC (Exit 9)
  - [ ] Contract tests reusable in Phase 2 (Exit 10)
- [ ] Phase 01 is complete — ready for organiser demo