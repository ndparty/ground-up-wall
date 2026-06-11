# Code Execution Plan: ground-up-wall

| Field | Value |
|-------|-------|
| Document Type | Code Execution Plan |
| Epic Work Item | `WI-06b` |
| Tech Spec | `ground-up-wall/docs/phase01/epic_plan-phase01.md` |
| Version | 1.0 |
| Author | Developer |

---

> This document is the **single source of truth** for implementation sequencing of WI-06b (Admin: System Parameters).

---

## Pre-Conditions

- [ ] WI-01 merged to `main` (Foundation — schema, Repository, RealtimeService, PhotoWallService)
- [ ] WI-02 merged to `main` (Auth — login, session, role guards, admin role check)
- [ ] Migration has been run (system_config table exists with defaults from WI-01)
- [ ] Branch created from `main`: `wi-06b-admin-params`
- [ ] ⚠️ This work item can be developed **in parallel** with WI-06a and WI-06c

---

> ⚠️ **Single Source of Truth** — This document is the authoritative sequencing guide for WI-06b.

---

## 1. ground-up-wall

### 1.1 System Parameters Page — List All Parameters

**Commit message:** `WI-06b: create system parameters page showing all configurable parameters with current and default values`

#### Files Changed

| File | Change | Description |
|------|--------|-------------|
| `routes/admin/parameters.tsx` | New | System parameters page — list all parameters |
| `islands/SystemParameters.tsx` | New | Client island — parameters list with edit controls |
| `routes/api/admin/parameters/index.ts` | New | GET /api/admin/parameters — get all system configs |

#### Implementation Details

1. **Create `routes/api/admin/parameters/index.ts`:**
   - GET handler, requires admin role
   - Calls `photoWallService.getSystemParameters()`
   - Returns array of SystemConfig objects with: `key`, `value`, `default_value`, `updated_at`, `updated_by`

2. **Create `routes/admin/parameters.tsx`:** renders SystemParameters island

3. **Create `islands/SystemParameters.tsx`:**
   - Fetches parameters from `/api/admin/parameters`
   - Groups parameters by category:
     - **Display**: `train_dwell_time`
     - **Upload**: `message_prompt_text`, `message_length_limit`, `message_length_unit`
     - **Moderation**: `auto_moderator_word_list`
     - **Display Override**: `default_placeholder_image`
   - Each parameter shows: label, current value, default value (for reference), "Reset to Default" button
   - Parameters are editable inline (implemented in next chunks)

#### Unit Tests

| Test File | Test Method | Verifies |
|-----------|-------------|----------|
| `islands/SystemParameters_test.tsx` | `testShowsAllParameters` | All 6 system parameters render correctly |
| `islands/SystemParameters_test.tsx` | `testShowsCurrentAndDefault` | Current and default values displayed |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] All 6 system parameters displayed on page
- [ ] Current value and default value shown for each parameter

---

### 1.2 Edit Train Dwell Time

**Commit message:** `WI-06b: implement train dwell time parameter editing with validation (3-60s)`

#### Files Changed

| File | Change | Description |
|------|--------|-------------|
| `routes/api/admin/parameters/update.ts` | New | POST /api/admin/parameters/update — update a parameter |
| `islands/SystemParameters.tsx` | Modified | Add inline edit for dwell time with slider/input |

#### Implementation Details

1. **Create `routes/api/admin/parameters/update.ts`:**
   - POST handler, requires admin role
   - Accepts `{ key, value }`
   - Validates value constraints:
     - `train_dwell_time`: range 3-60 (integer)
   - Calls `photoWallService.updateSystemParameter(key, value, adminId)`
   - Broadcasts change via RealtimeService
   - Logs in audit log
   - Returns 200 on success, 400 on validation error

2. **Modify `islands/SystemParameters.tsx` for dwell time:**
   - Inline edit: number input with + / - buttons
   - Shows current value
   - Range indicator: "3s – 60s"
   - "Reset to Default" button

#### Unit Tests

| Test File | Test Method | Verifies |
|-----------|-------------|----------|
| `routes/api/admin/parameters/update_test.ts` | `testUpdateDwellTimeValid` | Valid dwell time (10) updates successfully |
| `routes/api/admin/parameters/update_test.ts` | `testUpdateDwellTimeInvalid` | Invalid dwell time (0, 100) returns 400 |
| `routes/api/admin/parameters/update_test.ts` | `testUpdateDwellTimeAuditLogged` | Dwell time change logged in audit log |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Dwell time updates successfully (3-60s range)
- [ ] Dwell time outside range returns validation error
- [ ] Change broadcast via RealtimeService (display wall updates immediately)
- [ ] Audit log entry created

---

### 1.3 Edit Message Prompt Text, Length Limit, and Length Unit

**Commit message:** `WI-06b: implement message prompt text, length limit, and length unit parameter editing`

#### Files Changed

| File | Change | Description |
|------|--------|-------------|
| `routes/api/admin/parameters/update.ts` | Modified | Add validation for message parameters |
| `islands/SystemParameters.tsx` | Modified | Add inline edit for text, number, and unit select |

#### Implementation Details

1. **Modify `routes/api/admin/parameters/update.ts` — add validations:**
   - `message_prompt_text`: string, max 200 characters
   - `message_length_limit`: integer, min 1, max 1000
   - `message_length_unit`: must be 'characters' or 'words'

2. **Modify `islands/SystemParameters.tsx`:**
   - `message_prompt_text`: text input with character counter
   - `message_length_limit`: number input
   - `message_length_unit`: radio buttons or select dropdown (Characters / Words)

#### Unit Tests

| Test File | Test Method | Verifies |
|-----------|-------------|----------|
| `routes/api/admin/parameters/update_test.ts` | `testUpdatePromptText` | Prompt text updates successfully |
| `routes/api/admin/parameters/update_test.ts` | `testUpdateLengthLimit` | Length limit updates successfully |
| `routes/api/admin/parameters/update_test.ts` | `testUpdateLengthUnit` | Length unit switches between characters and words |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Prompt text updates and reflects on upload form immediately
- [ ] Length limit/unit updates and reflects on upload form live counter immediately
- [ ] Changes broadcast via RealtimeService

---

### 1.4 Edit Auto-Moderator Word List and Placeholder Image

**Commit message:** `WI-06b: implement auto-moderator word list editing and default placeholder image upload`

#### Files Changed

| File | Change | Description |
|------|--------|-------------|
| `routes/api/admin/parameters/update.ts` | Modified | Add word list and placeholder image handling |
| `islands/SystemParameters.tsx` | Modified | Add textarea for word list, file upload for placeholder |
| `routes/api/admin/parameters/upload-placeholder.ts` | New | POST /api/admin/parameters/upload-placeholder — upload/replace placeholder image |

#### Implementation Details

1. **Modify parameter update for word list:**
   - `auto_moderator_word_list`: accepts comma-separated or line-separated string, stored as comma-separated
   - "Reset to Default" restores the seeded PG-13 default list

2. **Create `routes/api/admin/parameters/upload-placeholder.ts`:**
   - POST handler, requires admin role
   - Accepts multipart form with image file
   - Stores via FileStorageService
   - Updates `default_placeholder_image` in system_config
   - Logs in audit log

3. **Modify `islands/SystemParameters.tsx`:**
   - `auto_moderator_word_list`: textarea with comma/line separated words, shows word count
   - `default_placeholder_image`: file upload with preview of current image
   - "Reset to Default" for word list restores seeded list
   - "Remove" button for placeholder image

#### Unit Tests

| Test File | Test Method | Verifies |
|-----------|-------------|----------|
| `routes/api/admin/parameters/update_test.ts` | `testUpdateWordList` | Word list updates and persists |
| `routes/api/admin/parameters/update_test.ts` | `testResetWordListToDefault` | Reset restores seeded default |
| `routes/api/admin/parameters/upload-placeholder_test.ts` | `testUploadPlaceholder` | Placeholder image upload succeeds |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Word list updates and new submissions are flagged against it
- [ ] Reset to default restores seeded PG-13 word list
- [ ] Placeholder image upload works
- [ ] All changes logged in audit log

---

## Post-Implementation Checklist

- [ ] All chunks verified — each compiles, passes tests, and meets ≥80% coverage
- [ ] No regressions in existing functionality
- [ ] Post-implementation checks executed and signed off
- [ ] All 6 system parameters are editable (FR-13a)
- [ ] Train dwell time validates range 3-60s (FR-13a)
- [ ] Message prompt text updates upload form immediately
- [ ] Message length limit and unit configurable
- [ ] Auto-moderator word list editable with reset-to-default (FR-13a, FR-09a)
- [ ] Default placeholder image uploadable/replaceable (FR-13a)
- [ ] All parameter changes logged in audit log
- [ ] Parameter changes broadcast via RealtimeService to live components