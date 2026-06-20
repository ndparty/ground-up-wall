# Phase 1 Requirements Verification — Update 03

**Date**: 2026-06-20  
**Method**: Code trace only (routes → services → islands/lib). Tests, comments, and documentation are not used as evidence.

**Legend**: Satisfied | Partial | Not satisfied | Not verifiable in code

---

## Functional Requirements

| ID | Status | Code evidence | Notes |
|----|--------|---------------|-------|
| FR-01 | Satisfied | `routes/upload.tsx`, `routes/api/submissions/index.ts`, `photo_wall_service.submitPublicSubmission` | Public upload without auth |
| FR-02 | Partial | `islands/UploadForm.tsx`, `lib/upload_config.ts`, `lib/validation/message_length.ts`, `scripts/seed.ts` | Configurable prompt/limit/unit + counter. **Gap:** code fallback prompt is `"Share your National Day moment!"`; seed DB default is `"What does National Day mean to you?"` |
| FR-02a | Partial | `lib/copy/privacy_notice.ts`, `islands/UploadForm.tsx`, `lib/api/submission_request.ts` | Notice + server `acknowledged` required. **Gap:** submit button only `disabled={loading}` — not gated on checkbox until submit validation |
| FR-02b | Partial | `lib/copy/disclaimers.ts`, `islands/UploadForm.tsx` | Re-submit + moderator-edit notice. **Gap:** no explicit “we will not notify you of rejection” wording |
| FR-03 | Satisfied | `db/schema.sql` (pending default), `postgres_repository.createSubmission`, `routes/api/display/submissions.ts` | Pending excluded from display |
| FR-04 | Satisfied | `islands/UploadForm.tsx` success UI | Confirmation message |
| FR-05 | Partial | `routes/index.tsx` → `/upload`, `routes/upload.tsx` | Short URL routable; QR is external artifact |
| FR-06 | Satisfied | `routes/login.tsx`, `auth_service.login`, `routes/moderate.tsx` | Protected organiser login |
| FR-07 | Satisfied | `ModerationQueue.tsx`, `routes/api/moderate/pending.ts` | Pending queue after login |
| FR-08 | Satisfied | `ModerationQueue.tsx`, `photo_wall_service.rejectSubmission` | No participant notification path |
| FR-09 | Partial | `ModerationQueue.tsx`, `photo_wall_service.editSubmission/deleteSubmission` | Edit/delete + audit old values. **Gap:** `edited_by` shows moderator ID not username |
| FR-09a | Partial | `auto_moderator_service_impl.ts`, `photo_wall_service`, `ModerationQueue.tsx`, `scripts/seed.ts` | Filter + highlight + seeded list. **Gap:** highlight may miss substitution-normalized spans |
| FR-10 | Satisfied | `postgres_repository` ORDER BY created_at ASC, `approveSubmission` | Chronological rotation |
| FR-11 | Satisfied | `ChangePasswordForm.tsx`, `auth_service.changePassword` | Self-service password change |
| FR-12 | Satisfied | `ChangePasswordForm.tsx`, `routes/api/auth/change-password.ts` | Current + new + confirm |
| FR-13 | Satisfied | `UserManagement.tsx`, `routes/admin/users.tsx`, admin middleware | Admin-only user CRUD listing |
| FR-14 | Satisfied | `UserManagement.tsx`, `createModerator` | Create moderator |
| FR-15 | Satisfied | `UserManagement.tsx`, `resetModeratorPassword` | Reset passwords |
| FR-15a | Satisfied | `toggle-status.ts`, `disableModerator`, `auth_service.login` | Disable blocks login |
| FR-15b | Satisfied | `delete.ts`, `deleteModerator` | Delete with audit retention |
| FR-15c | Satisfied | `UserManagement.tsx` Active/Disabled column | Status visible |
| FR-16 | Satisfied | `scripts/seed.ts`, `createUser` | Developer-seeded admin |
| FR-13a | Partial | `SystemParameters.tsx`, parameter APIs, `photo_wall_service` | All params editable + reset. **Gaps:** upload form doesn’t live-reload config; no placeholder remove; placeholder upload audits as `change_config` not `set_default_placeholder` |
| FR-17 | Partial | `TrainDisplay.tsx`, `train.css`, `center_track.ts` | RTL scroll + red/white cabins. **Gap:** cabin cards, not full SMRT train silhouette |
| FR-18 | Satisfied | `TrainCabin.tsx` | Photo + message + name + handle |
| FR-19 | Satisfied | `train_playback_controller.ts`, `clampDwellSeconds`, `SystemParameters.tsx` | 3–60s configurable dwell |
| FR-20 | Satisfied | `TrainDisplay.tsx`, `center_track.slideTo`, `slide_duration.ts` | Smooth horizontal scroll |
| FR-21 | Satisfied | `postgres_repository`, `train_view.ts` / `chain.ts` | Oldest-first order |
| FR-22 | Satisfied | `routes/api/display/events.ts`, `use_train_playback.ts` | SSE append on approve |
| FR-23 | Partial | `TrainDisplay.tsx` empty state, `train.css` | Logo + gradient waiting screen |
| FR-24 | Satisfied | `TrainDisplay.tsx`, `train.css` fixed fullscreen | TV-oriented layout |
| FR-24a | Partial | `TrainControls.tsx`, `train-command.ts`, `train_playback_controller.ts`, `use_train_playback.ts` | Pause/play/jump for mod/admin; pause freezes; jump clamped. **Spec flag:** refresh bootstraps server `currentCabin`/`isPlaying` — conflicts with Phase 1 “restart cabin 0 playing” text |
| FR-24b | Satisfied | `routes/display.tsx` 403 message, display API role gates | Auth-only display |
| FR-24c | Partial | `DisplayOverrideControls.tsx`, `AdminDisplayOverride.tsx`, `commandDisplayOverride` | Blank/placeholder/resume + DB + SSE. **Gap:** mod panel lacks per-action placeholder upload (admin has it) |

---

## Non-Functional Requirements

| ID | Status | Code evidence | Notes |
|----|--------|---------------|-------|
| NFR-01 | Partial | `_app.tsx` viewport, `UploadForm.tsx` layout | Mobile-capable; limited mobile CSS |
| NFR-02 | Partial | `lib/image/compress.ts`, `normalize_upload_image.ts` | Compression pipeline; upload timing not measurable in code |
| NFR-03 | Not verifiable | `train.css`, `center_track.ts` transforms | 60fps needs runtime profiling |
| NFR-04 | Not verifiable | SSE on approve | 30s SLA needs measurement |
| NFR-05 | Not verifiable | Standard Fresh app | No load-shedding for 200 users in code |
| NFR-06 | Partial | Postgres schema | No explicit 200 cap in code |
| NFR-07 | Partial | `UploadForm.tsx` | More than 3 taps (photo + fields + checkbox + submit) |
| NFR-08 | Satisfied | `train.css` typography, `TrainCabin.tsx` | Large high-contrast TV text |
| NFR-09 | Not verifiable | Admin/moderation islands | Subjective usability |
| NFR-10 | Not verifiable | `session_store.ts`, in-memory services | No 6–8h uptime watchdog |
| NFR-11 | Partial | `TrainDisplay` bootstrap, override DB state | Override persists; playback restored from server memory on refresh — tension with FR-24a |
| NFR-12 | Not verifiable | Local Postgres in `di.ts` | Phase 2 Supabase ops concern |
| NFR-13 | Satisfied | Moderation/admin middleware | Protected routes |
| NFR-14 | Satisfied | `submission_request.ts`, `upload_image_types.ts` | Type + size validation |
| NFR-15 | Satisfied | Public submit API, privacy copy, limited fields | PII notice + acknowledgment |
| NFR-16 | Partial | Form labels, some ARIA | Full WCAG AA not demonstrable from trace |
| NFR-22 | Partial | `audit_service_impl`, `AuditLogView.tsx`, `photo_wall_service` audit calls | Append-only + filters. **Gaps:** moderator_id not username; missing `set_default_placeholder` action type |

---

## Design Requirements

| ID | Status | Code evidence | Notes |
|----|--------|---------------|-------|
| DR-01 | Partial | `train.css` red/white cabins | Color aesthetic; not full SMRT exterior |
| DR-02 | Partial | `_app.tsx` branding, `sg-flag.svg`, logos | Subtle ND palette |
| DR-03 | Partial | Copy + festive gradients | Community tone |
| DR-04 | Satisfied | `lib/copy/*.ts`, form messages | Warm approachable copy |

---

## Spec violations requiring product decision

These are explicit requirement text vs observed runtime behavior. Code is primary unless you direct a behavior change:

1. **FR-02a** — Checkbox does not disable submit button (validation on submit only).
2. **FR-24a vs NFR-11** — Refresh restores server playback position instead of “cabin 0 playing.”
3. **FR-02** — Fallback prompt text differs from spec default when DB param unset in client path.

## Partial implementations (acceptable or backlog)

- **FR-09** — Editor shown as ID not username.
- **FR-13a** — No live upload-config refresh; no placeholder remove.
- **FR-24c** — Moderation panel placeholder upload (admin only).
- **FR-17 / DR-01** — Cabin-card train vs realistic SMRT body.

## Not verifiable from static code

NFR-03, NFR-04, NFR-05, NFR-09, NFR-10, NFR-12 — require runtime measurement or Phase 2 ops.

---

## Update 03 implementation verified in code

| Item | Status | Evidence |
|------|--------|----------|
| K-buffer jump path | Satisfied | `train_view.computeJumpAnimationPath`, tests |
| Single proportional slide | Satisfied | `TrainDisplay.slideToElement`, `slide_duration.ts` |
| Jump preload K-after-target | Satisfied | `cabinsForJumpPreload`, `TrainDisplay` preload block |
| Pause/resume gating | Satisfied | `use_train_playback` + orchestrator `isPlayingRef` |
| Override timer freeze | Satisfied | `pauseForOverride` / `resumeFromOverride` |
| Override resume recenter | Satisfied | `TrainDisplay` override transition effect |
| SSE playback state sync | Satisfied | `publishPlaybackState`, `train_playback_state` SSE |
