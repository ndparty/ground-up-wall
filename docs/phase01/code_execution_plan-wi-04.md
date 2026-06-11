# Code Execution Plan: ground-up-wall

| Field | Value |
|-------|-------|
| Document Type | Code Execution Plan |
| Epic Work Item | `WI-04` |
| Tech Spec | `ground-up-wall/docs/phase01/epic_plan-phase01.md` |
| Version | 1.0 |
| Author | Developer |

---

> This document is the **single source of truth** for implementation sequencing of WI-04 (Moderation Flow).

---

## Pre-Conditions

- [ ] WI-01 merged to `main` (Foundation — scaffold, schema, all services)
- [ ] WI-02 merged to `main` (Auth — login, session, role guards, auth context)
- [ ] WI-03 merged to `main` (Upload — submissions exist in database)
- [ ] Migration has been run (all 4 tables exist)
- [ ] Branch created from `main`: `wi-04-moderation`

---

> ⚠️ **Single Source of Truth** — This document is the authoritative sequencing guide for WI-04.

---

## 1. ground-up-wall

### 1.1 Moderation Queue Page — Pending Submissions View

**Commit message:** `WI-04: create moderation queue page showing pending submissions with flagged indicators`

#### Files Changed

| File | Change | Description |
|------|--------|-------------|
| `routes/moderate.tsx` | New | Moderation queue page — list pending submissions |
| `islands/ModerationQueue.tsx` | New | Client island — renders pending submission cards with details |
| `routes/api/moderate/pending.ts` | New | GET /api/moderate/pending — fetch pending submissions |
| `routes/api/_middleware.ts` | Modified | Add moderator/admin auth check for /api/moderate/* routes |

#### Implementation Details

1. **Create `routes/api/moderate/pending.ts`:**
   - GET handler, requires moderator or admin role
   - Calls `photoWallService.getPendingSubmissions()`
   - Returns array of submissions with: id, image_url, message, submitter_name, social_handle, created_at, is_flagged, flagged_words

2. **Create `routes/moderate.tsx`:**
   - Requires authentication with moderator or admin role
   - Renders the `ModerationQueue` island
   - Fetches pending submissions on page load

3. **Create `islands/ModerationQueue.tsx`:**
   - Fetches pending submissions from `/api/moderate/pending`
   - Displays each submission as a card showing: photo thumbnail, message text, submitter name, social handle (if present), submission time
   - **Flagged submissions**: show a visual indicator (e.g. warning icon + yellow background) and **highlight flagged words** in the message text (e.g. red underline or highlight)
   - If no pending submissions, show "No pending submissions" message
   - Real-time subscription to `submission_created` event via RealtimeService to add new submissions to the queue without refresh

#### Unit Tests

| Test File | Test Method | Verifies |
|-----------|-------------|----------|
| `islands/ModerationQueue_test.tsx` | `testShowsPendingSubmissions` | Pending submissions render as cards |
| `islands/ModerationQueue_test.tsx` | `testShowsEmptyState` | No pending submissions shows empty message |
| `islands/ModerationQueue_test.tsx` | `testFlaggedWordHighlighting` | Flagged words are visually highlighted in message |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Moderation page is accessible at `/moderate` (authentication required)
- [ ] Pending submissions display with correct details
- [ ] Flagged submissions show visual indicators
- [ ] New submissions appear in the queue in real-time

---

### 1.2 Approve and Reject Actions

**Commit message:** `WI-04: implement approve/reject actions for moderation with audit logging`

#### Files Changed

| File | Change | Description |
|------|--------|-------------|
| `routes/api/moderate/approve.ts` | New | POST /api/moderate/approve/:id — approve a submission |
| `routes/api/moderate/reject.ts` | New | POST /api/moderate/reject/:id — reject a submission |
| `islands/ModerationQueue.tsx` | Modified | Add approve/reject buttons with confirmation for reject |

#### Implementation Details

1. **Create `routes/api/moderate/approve.ts`:**
   - POST handler, requires moderator/admin role
   - Reads `id` from URL params
   - Calls `photoWallService.approveSubmission(id, moderatorId)`
   - Returns 200 on success

2. **Create `routes/api/moderate/reject.ts`:**
   - POST handler, requires moderator/admin role
   - Reads `id` from URL params
   - Calls `photoWallService.rejectSubmission(id, moderatorId)`
   - Returns 200 on success
   - Note: no notification sent to submitter

3. **Modify `islands/ModerationQueue.tsx`**: Add "Approve" and "Reject" buttons to each submission card:
   - Approve: immediate action, removes card from queue with animation
   - Reject: show confirmation dialog ("Are you sure?"), on confirm remove from queue
   - On success, the submission is removed from the pending list in real-time
   - On error, show error message on the card

#### Unit Tests

| Test File | Test Method | Verifies |
|-----------|-------------|----------|
| `routes/api/moderate/approve_test.ts` | `testApproveSubmission` | Approving a pending submission returns 200 and changes status |
| `routes/api/moderate/approve_test.ts` | `testApproveAlreadyApproved` | Approving an already-approved submission returns error |
| `routes/api/moderate/reject_test.ts` | `testRejectSubmission` | Rejecting a pending submission returns 200 and changes status |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Approve button changes submission status to "approved"
- [ ] Reject button with confirmation changes status to "rejected" (no notification)
- [ ] Audit log entries created for approve and reject actions
- [ ] Approved submission published to display wall via RealtimeService

---

### 1.3 Edit Submission Content

**Commit message:** `WI-04: implement edit submission content with audit trail and edited indicator`

#### Files Changed

| File | Change | Description |
|------|--------|-------------|
| `routes/api/moderate/edit.ts` | New | POST /api/moderate/edit/:id — edit submission content |
| `islands/ModerationQueue.tsx` | Modified | Add edit button + inline edit form to submission cards |
| `lib/services/photo_wall_service.ts` | Modified | Ensure editSubmission flow works with audit |

#### Implementation Details

1. **Create `routes/api/moderate/edit.ts`:**
   - POST handler, requires moderator/admin role
   - Accepts `{ message?, submitter_name?, social_handle? }` (partial update)
   - Calls `photoWallService.editSubmission(id, data, moderatorId)`
   - Returns updated submission with `edited_by`, `edited_at`, `edit_count`
   - Original values preserved in audit log

2. **Modify `islands/ModerationQueue.tsx`**:
   - Add "Edit" button on each submission card
   - When clicked, show inline edit form for message, name, social handle
   - On save, send edit to API and update the card
   - Show "Edited by [moderator name]" indicator on previously edited submissions
   - Show edit count if > 0

#### Unit Tests

| Test File | Test Method | Verifies |
|-----------|-------------|----------|
| `routes/api/moderate/edit_test.ts` | `testEditPendingSubmission` | Editing a pending submission saves changes and logs audit |
| `routes/api/moderate/edit_test.ts` | `testEditApprovedSubmission` | Editing an approved submission updates display wall content |
| `routes/api/moderate/edit_test.ts` | `testEditAuditPreservesOldValues` | Audit log contains old values before edit |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Editing pending submission updates content without changing status
- [ ] Editing approved submission updates content on display (no re-approval needed)
- [ ] Audit log preserves original values
- [ ] Edited indicator shows on previously edited submissions

---

### 1.4 Delete Approved Submission

**Commit message:** `WI-04: implement delete approved submission with confirmation and audit logging`

#### Files Changed

| File | Change | Description |
|------|--------|-------------|
| `routes/api/moderate/delete.ts` | New | POST /api/moderate/delete/:id — delete a submission |
| `islands/ModerationQueue.tsx` | Modified | Add delete button for approved submissions with confirmation dialog |

#### Implementation Details

1. **Create `routes/api/moderate/delete.ts`:**
   - POST handler, requires moderator/admin role
   - Calls `photoWallService.deleteSubmission(id, moderatorId)`
   - Deletes submission record and associated image from storage
   - Logs deletion in audit log
   - Publishes `submission_deleted` event to display wall
   - Returns 200 on success

2. **Modify `islands/ModerationQueue.tsx`**: Add approved submissions section below pending queue:
   - Shows list of approved submissions with "Delete" button
   - Delete requires confirmation dialog

#### Unit Tests

| Test File | Test Method | Verifies |
|-----------|-------------|----------|
| `routes/api/moderate/delete_test.ts` | `testDeleteApprovedSubmission` | Deleting removes record and image, logs audit |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Delete with confirmation removes submission from display wall
- [ ] Associated image deleted from storage
- [ ] Audit log entry created for deletion

---

### 1.5 Display Override Commands from Moderation Panel

**Commit message:** `WI-04: add display override controls (blank/placeholder/resume) to moderation panel`

#### Files Changed

| File | Change | Description |
|------|--------|-------------|
| `routes/api/moderate/display-override.ts` | New | POST /api/moderate/display-override — command display wall override |
| `islands/DisplayOverrideControls.tsx` | New | Island — blank/placeholder/resume buttons in moderation panel |
| `routes/moderate.tsx` | Modified | Add DisplayOverrideControls to moderation page |

#### Implementation Details

1. **Create `routes/api/moderate/display-override.ts`:**
   - POST handler, requires moderator/admin role
   - Accepts `{ type: 'blank' | 'placeholder' | 'resume', image?: File }`
   - Calls `photoWallService.commandDisplayOverride(type, moderatorId, image)`
   - Returns 200 on success

2. **Create `islands/DisplayOverrideControls.tsx`:**
   - Shows three buttons: "Blank Screen", "Show Placeholder", "Resume Display"
   - Available only to logged-in Moderators and Admins
   - "Show Placeholder": if clicked without per-action override image, uses system default placeholder
   - Confirmation for "Blank Screen" (to prevent accidental blanking)
   - Success/error feedback after each command

#### Unit Tests

| Test File | Test Method | Verifies |
|-----------|-------------|----------|
| `routes/api/moderate/display-override_test.ts` | `testBlankDisplay` | Blank command broadcasts event and logs audit |
| `routes/api/moderate/display-override_test.ts` | `testResumeDisplay` | Resume command returns display to normal |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Blank screen button broadcast command via RealtimeService
- [ ] Placeholder button shows system default or per-action image
- [ ] Resume button returns display to train animation
- [ ] All display override actions logged in audit log

---

## Post-Implementation Checklist

- [ ] All chunks verified — each compiles, passes tests, and meets ≥80% coverage
- [ ] No regressions in existing functionality
- [ ] Post-implementation checks executed and signed off
- [ ] Moderator can log in and view pending submissions (FR-06, FR-07)
- [ ] Approve/reject works correctly (FR-08) — no notification sent on reject
- [ ] Edit submission content works with audit trail (FR-09)
- [ ] Edited indicator and moderator name shown on edited submissions (FR-09)
- [ ] Delete approved submission removes from wall (FR-06 via FR-10)
- [ ] Auto-moderator flagged words visually highlighted in UI (FR-09a)
- [ ] Display override controls available (FR-24c, moderation panel side)
- [ ] Real-time updates work for new submissions appearing in queue