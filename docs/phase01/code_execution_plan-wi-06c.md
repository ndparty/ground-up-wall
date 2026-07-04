# Code Execution Plan: ground-up-wall

| Field          | Value                                              |
| -------------- | -------------------------------------------------- |
| Document Type  | Code Execution Plan                                |
| Epic Work Item | `WI-06c`                                           |
| Tech Spec      | `ground-up-wall/docs/phase01/epic_plan-phase01.md` |
| Version        | 1.0                                                |
| Author         | Developer                                          |

---

> This document is the **single source of truth** for implementation sequencing of WI-06c (Admin:
> Audit Log + Display Override).

---

## Pre-Conditions

- [ ] WI-01 merged to `main` (Foundation — schema, Repository, RealtimeService, PhotoWallService)
- [ ] WI-02 merged to `main` (Auth — login, session, role guards, admin role check)
- [ ] WI-04 merged to `main` (Moderation — creates audit log entries from approve/reject/edit/delete
      actions)
- [ ] WI-05a merged to `main` (Display Wall Core — display wall exists to override)
- [ ] WI-05b merged to `main` (Train Controls — train exists with play state)
- [ ] Migration has been run (tables exist)
- [ ] Branch created from `main`: `wi-06c-admin-audit-override`
- [ ] ⚠️ This work item can be developed **mostly in parallel** with WI-06a and WI-06b. Part C
      (Display Override Integration on DisplayComponent) requires WI-05a merged.

---

> ⚠️ **Single Source of Truth** — This document is the authoritative sequencing guide for WI-06c.

---

## 1. ground-up-wall

### 1.1 Audit Log View Page

**Commit message:** `WI-06c: implement audit log view page with read-only display and filtering`

#### Files Changed

| File                                  | Change | Description                                             |
| ------------------------------------- | ------ | ------------------------------------------------------- |
| `routes/admin/audit-log.tsx`          | New    | Audit log page — filtered read-only table               |
| `islands/AuditLogView.tsx`            | New    | Client island — audit log table with filter controls    |
| `routes/api/admin/audit-log/index.ts` | New    | GET /api/admin/audit-log — query audit log with filters |

#### Implementation Details

1. **Create `routes/api/admin/audit-log/index.ts`:**
   - GET handler, requires admin role
   - Accepts query params: `moderator_id`, `action_type`, `target_type`, `date_from`, `date_to`
   - Calls `photoWallService.getAuditLog(filters)`
   - Returns array of AuditEntry objects (append-only — no delete/update exposed)
   - Each entry: `id`, `moderator_id`, `action_type`, `target_type`, `target_id`, `old_value`,
     `new_value`, `timestamp`

2. **Create `routes/admin/audit-log.tsx`:** renders AuditLogView island

3. **Create `islands/AuditLogView.tsx`:**
   - Fetches audit log from `/api/admin/audit-log` with filters
   - Filter controls:
     - **Moderator**: dropdown populated from moderator list
     - **Action type**: dropdown of all action types (approve, reject, edit, delete,
       create_moderator, etc.)
     - **Target type**: dropdown (submission, moderator, display_wall_user, system_config,
       display_override)
     - **Date range**: from/to date pickers
     - **Apply Filters** button
   - Table columns: Timestamp, Moderator, Action, Target Type, Target ID, Old Value, New Value
   - Empty state: "No audit log entries found" message
   - Append-only enforced: no edit/delete buttons on rows

#### Unit Tests

| Test File                       | Test Method              | Verifies                                         |
| ------------------------------- | ------------------------ | ------------------------------------------------ |
| `islands/AuditLogView_test.tsx` | `testShowsAuditEntries`  | Audit entries render in table                    |
| `islands/AuditLogView_test.tsx` | `testShowsEmptyState`    | No entries shows empty message                   |
| `islands/AuditLogView_test.tsx` | `testFilterByActionType` | Filtering by action type returns correct entries |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Audit log page accessible at `/admin/audit-log`
- [ ] All audit entries display with correct columns (NFR-22)
- [ ] Filtering by moderator, action type, date range works
- [ ] Audit log is read-only — no edit/delete operations available (NFR-22, NFR-05)

---

### 1.2 Display Override Controls (Admin Panel Side)

**Commit message:**
`WI-06c: implement display override controls (blank/placeholder/resume) in admin panel`

#### Files Changed

| File                                   | Change | Description                                                 |
| -------------------------------------- | ------ | ----------------------------------------------------------- |
| `routes/admin/display-override.tsx`    | New    | Display override page in admin panel                        |
| `islands/AdminDisplayOverride.tsx`     | New    | Island — blank/placeholder/resume controls for admin        |
| `routes/api/admin/display-override.ts` | New    | POST /api/admin/display-override — command display override |

#### Implementation Details

1. **Create `routes/api/admin/display-override.ts`:**
   - POST handler, requires admin role
   - Accepts `{ type: 'blank' | 'placeholder' | 'resume', image?: File }`
   - Calls `photoWallService.commandDisplayOverride(type, adminId, image)`
   - Broadcasts command via RealtimeService
   - Persists override state in database
   - Logs in audit log

2. **Create `routes/admin/display-override.tsx`:** renders AdminDisplayOverride island

3. **Create `islands/AdminDisplayOverride.tsx`:**
   - Shows current display override state (from `photoWallService.getDisplayOverrideState()`)
   - Three action buttons:
     - **"Blank Screen"** — with confirmation dialog
     - **"Show Placeholder"** — uses system default placeholder OR allows per-action image upload
     - **"Resume Display"** — returns to train animation
   - Status indicator: shows current state (Normal / Blank / Placeholder)
   - Success/error feedback after each command

#### Unit Tests

| Test File                                   | Test Method                     | Verifies                                                     |
| ------------------------------------------- | ------------------------------- | ------------------------------------------------------------ |
| `routes/api/admin/display-override_test.ts` | `testBlankDisplayCommand`       | Blank command broadcasts event, persists state, logs audit   |
| `routes/api/admin/display-override_test.ts` | `testPlaceholderDisplayCommand` | Placeholder command shows system default or per-action image |
| `routes/api/admin/display-override_test.ts` | `testResumeDisplayCommand`      | Resume command returns display to normal                     |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Blank screen command broadcast to all connected display wall sessions (FR-24c)
- [ ] Placeholder shows system default or per-action image (FR-24c)
- [ ] Resume returns to normal train display (FR-24c)
- [ ] All override actions logged in audit log (NFR-22)

---

### 1.3 Display Override State Persistence

**Commit message:** `WI-06c: persist display override state in database for new sessions`

#### Files Changed

| File                                      | Change   | Description                                                               |
| ----------------------------------------- | -------- | ------------------------------------------------------------------------- |
| `lib/repositories/postgres_repository.ts` | Modified | Ensure `getDisplayOverrideState`/`setDisplayOverrideState` work correctly |
| `lib/services/photo_wall_service.ts`      | Modified | Ensure persistence on display override commands                           |

#### Implementation Details

1. **Verify `Repository` methods:**
   - `setDisplayOverrideState(state: DisplayOverrideState)`: upserts `display_override_state` key in
     `system_config` table with JSON value
     `{ type: 'normal' | 'blank' | 'placeholder', imageUrl?: string }`
   - `getDisplayOverrideState()`: reads the state from `system_config`, returns default
     `{ type: 'normal' }` if not set

2. **Modify `photoWallService.commandDisplayOverride()`:**
   - After broadcasting via RealtimeService, call `repository.setDisplayOverrideState(state)`
   - State includes: `type`, `imageUrl` (for placeholder), `commanded_by`, `commanded_at`

#### Unit Tests

| Test File                                 | Test Method                   | Verifies                                           |
| ----------------------------------------- | ----------------------------- | -------------------------------------------------- |
| `lib/services/photo_wall_service_test.ts` | `testDisplayOverridePersists` | After blank command, new session loads blank state |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Display override state persists in database
- [ ] New display wall sessions load persisted state on connect

---

### 1.4 Display Override Integration (DisplayComponent Side)

**Commit message:**
`WI-06c: integrate display override response into DisplayComponent (blank/placeholder/resume)`

#### Files Changed

| File                       | Change   | Description                                                                 |
| -------------------------- | -------- | --------------------------------------------------------------------------- |
| `islands/TrainDisplay.tsx` | Modified | Subscribe to display override commands, respond to blank/placeholder/resume |

#### Implementation Details

1. **Modify `islands/TrainDisplay.tsx`:**
   - On mount: check persisted override state via `GET /api/display/override-state`
   - Subscribe to `display_override` events via RealtimeService
   - Event handler:
     ```typescript
     function handleDisplayOverride(command: DisplayOverrideCommand) {
       switch (command.type) {
         case "blank":
           setOverrideState({ type: "blank" });
           break;
         case "placeholder":
           setOverrideState({ type: "placeholder", imageUrl: command.imageUrl });
           break;
         case "resume":
           setOverrideState({ type: "normal" });
           break;
       }
     }
     ```
   - Override state affects rendering:
     - `blank`: render solid black screen (hide train completely)
     - `placeholder`: render placeholder image (centered, fills screen) — use command's imageUrl or
       fall back to system default
     - `normal`: render train animation as usual
   - Train continues to receive new submissions and update chain internally during
     blank/placeholder, but is hidden

#### Unit Tests

| Test File                       | Test Method                 | Verifies                                        |
| ------------------------------- | --------------------------- | ----------------------------------------------- |
| `islands/TrainDisplay_test.tsx` | `testBlankScreenHidesTrain` | Display shows black screen when blank commanded |
| `islands/TrainDisplay_test.tsx` | `testPlaceholderShowsImage` | Display shows placeholder image                 |
| `islands/TrainDisplay_test.tsx` | `testResumeRestoresTrain`   | Resume returns to train animation               |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Display wall shows black screen when blank commanded (FR-24c)
- [ ] Display wall shows placeholder image when commanded (FR-24c)
- [ ] Display wall resumes train animation from its position (FR-24c)
- [ ] New session loading after a blank command starts blank (FR-24c)

---

### 1.5 Get Display Override State API

**Commit message:** `WI-06c: add API endpoint for display override state for new sessions`

#### Files Changed

| File                                   | Change | Description                                                          |
| -------------------------------------- | ------ | -------------------------------------------------------------------- |
| `routes/api/display/override-state.ts` | New    | GET /api/display/override-state — get current display override state |

#### Implementation Details

1. **Create `routes/api/display/override-state.ts`:**
   - GET handler, requires display_wall/moderator/admin role
   - Calls `photoWallService.getDisplayOverrideState()`
   - Returns `{ type: 'normal' | 'blank' | 'placeholder', imageUrl?: string }`

#### Unit Tests

| Test File                                   | Test Method                | Verifies                                                 |
| ------------------------------------------- | -------------------------- | -------------------------------------------------------- |
| `routes/api/display/override-state_test.ts` | `testReturnsNormalDefault` | Returns normal state when no override has been commanded |
| `routes/api/display/override-state_test.ts` | `testReturnsBlankState`    | Returns blank state after blank command                  |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] New display wall sessions load the correct override state on startup

---

## Post-Implementation Checklist

- [ ] All chunks verified — each compiles, passes tests, and meets ≥80% coverage
- [ ] No regressions in existing functionality
- [ ] Post-implementation checks executed and signed off
- [ ] Audit log view displays all entries with filtering (US-17)
- [ ] Audit log is read-only and append-only (NFR-05, NFR-22)
- [ ] Display override controls work from admin panel (FR-24c)
- [ ] Blank screen hides train on all connected display wall sessions (FR-24c)
- [ ] Placeholder shows system default or per-action override image (FR-24c)
- [ ] Resume returns display to train animation (FR-24c)
- [ ] Override state persists for new sessions (FR-24c)
- [ ] All display override actions logged in audit log (NFR-22)
