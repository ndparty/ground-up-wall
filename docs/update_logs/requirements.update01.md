# Requirements Update 01 — ground-up-wall

**Date**: 2026-05-21
**Source**: Organiser discussion (Paul, Sharon, Liwei)

---

## Summary of Changes

This document defines the deltas to apply to `requirements.md`. Each entry specifies whether it is an **Addition**, **Modification**, or **Clarification** and references the affected section/FR/NFR/DR.

| # | Type | Affected | Description | Phase |
|---|------|----------|-------------|-------|
| 1 | Modification | FR-02 | Add configurable prompt text for message field | Phase 1 |
| 2 | Addition | §1.1 | Data privacy notice on upload form | Phase 1 |
| 3 | Addition | §1.1 | Disclaimer on submission rejection flow | Phase 1 |
| 4 | Clarification | FR-08 | No notification sent on rejection | Phase 1 |
| 5 | Extension | FR-09 | Moderator can edit submission content | Phase 1 |
| 6 | Modification | FR-19 | Default dwell time 15s, configurable by admin | Phase 1 |
| 7 | Addition | §1.5 | Pause/play/jump train controls (admin) | Phase 1 |
| 8 | Addition | §1.5 | Display wall visibility toggle (admin) | Phase 1 |
| 9 | Extension | FR-13, FR-14, FR-15 | Admin can disable/delete moderator accounts | Phase 1 |
| 10 | Addition | §1.2 | Auto-moderator / profanity flagging | Phase 1 |
| 11 | Addition | §1.2, §2 | Audit log for moderator actions | Phase 1 |
| 12 | Addition | §1.4 | System parameters configuration panel (admin) | Phase 1 |
| 13 | Addition | §3 | DR-04: Warm tone for user-facing copy | Phase 1 |
| 14 | Addition | §6 | New risk: PII and data privacy | Phase 1 |
| 15 | Modification | §7 | Phase 1 scope expanded to include Update 01 items | Phase 1 |

---

## 1. Functional Requirements — Modifications & Additions

### 1.1 Photo Submission (Participant Upload)

**FR-02 — Modification:**
Replace the existing bullet list with:

- **FR-02 (updated)**: The upload form must capture:
  - Photo (image file)
  - Short message (max 50 characters) — with a configurable prompt text displayed as the input placeholder (e.g. "What does National Day mean to you?")
  - Submitter's name
  - Optional social handle
- The prompt text shall be configurable by an Admin via the system parameters panel (see §1.4).
- The default prompt text shall be: *"What does National Day mean to you?"*

**FR-02a — Addition (Data Privacy Notice):**
- The upload form shall display a concise data privacy notice before submission, informing participants:
  - That their name, message, and optional social handle will be displayed on the photowall during the event
  - That their data will not be retained beyond the event duration
  - A link or reference to contact an organiser for questions
- The privacy notice language shall follow the warm, community-appropriate tone defined in DR-04.

**FR-02b — Addition (Rejection Disclaimer):**
- The upload form and success page shall include a disclaimer stating that if a submission does not appear on the display wall within a reasonable time, the participant may approach a Photo Moderator or organiser in person for clarification.
- The disclaimer shall NOT imply that rejection notifications will be sent.

**FR-08 — Clarification:**
No change to the requirement text. Add the following note:
> **NOTE**: Rejected submissions shall NOT trigger any notification to the participant. Participants are directed to approach a moderator in person if they wish to query a rejection (see FR-02b disclaimer).

---

### 1.2 Photo Moderation Panel

**FR-09 — Extension (Post Editing):**
Add after the existing bullet:

- **FR-09 (extended)**: Photo Moderators can also edit the content (message, name, social handle) of any pending submission before approval, or any approved submission on the wall.
- Original values shall be preserved in the audit log (see NFR-22).
- Edited submissions shall display the updated content on the display wall without requiring re-approval.
- The moderation panel shall clearly indicate when a submission has been edited and display the moderator who made the edit.

**FR-09a — Addition (Auto-Moderator / Profanity Flagging):**
- The system shall include an automated content filter that checks submission messages against a configurable word list.
- Flagged submissions shall display a visual indicator in the moderation panel — flagged words shall be highlighted (e.g. underlined or highlighted background) so the moderator can review before approving.
- The flagging shall be advisory only: the moderator retains full discretion to approve or reject flagged submissions.
- The word list shall be configurable by an Admin via the system parameters panel.
- The content filter must handle the following inputs correctly:
  - Case-insensitive matching
  - Unicode characters
  - Variants with deliberate misspellings (basic character substitution, e.g. `@` for `a`)
- **NOTE**: The backend flagging (detection + database flag) and the visual highlighting (squiggly underline / inline annotation in the UI) are both included in Phase 1.

---

### 1.4 Admin User Management

**FR-13 — Extension (Disable/Delete Moderator Accounts):**
Extend the requirements to include:

- **FR-13 (extended)**: An Admin-only user management page exists for creating, managing, disabling, and deleting Photo Moderator accounts.
- **FR-14** (unchanged): Admins can create new Photo Moderator accounts by providing a username and initial password.
- **FR-15** (unchanged): Admins can reset passwords for existing Photo Moderator accounts.
- **FR-15a — Addition**: Admins can disable a Photo Moderator account (preventing login without deleting the account or its audit history).
- **FR-15b — Addition**: Admins can permanently delete a Photo Moderator account (with confirmation). Deletion shall preserve audit log references (the log retains the moderator ID even after account deletion).
- **FR-15c — Addition**: The user management page shall display the active/disabled status of each moderator account.

**FR-13a — Addition (System Parameters Configuration Panel):**
- An Admin-only system parameters page shall exist for viewing and modifying configurable system parameters.
- The following parameters shall be configurable:
  - **Train dwell time**: The duration (in seconds) each cabin is visible on the display wall before transitioning. Default: 15s. Range: 3s–60s.
  - **Message prompt text**: The placeholder/prompt shown in the upload form message field.
  - **Auto-moderator word list**: The list of flagged words for the profanity filter, editable as a comma-separated or line-separated list.
- The parameters panel shall persist changes immediately to the database.
- Changes to dwell time and prompt text shall take effect without requiring a server restart (via RealtimeService broadcast or polling).
- All parameters shall have a "Reset to default" option.

---

### 1.5 Display Wall (TV Screen)

**FR-19 — Modification (Configurable Dwell Time):**
Update FR-19 text:

- **FR-19 (updated)**: The display focuses on one cabin at a time, with each cabin visible for a configurable duration before transitioning. The default dwell time is approximately 15 seconds. An Admin may change this value via the system parameters panel (range: 3–60 seconds, configurable in 1-second increments).

**FR-24a — Addition (Pause/Play/Jump Controls):**
- The display wall page shall include pause, play, and jump-to-cabin controls. These controls shall be visible only to logged-in Photo Moderators and Admins.
- When paused, the train shall freeze on the current cabin. Newly approved submissions may still be appended to the train (but the display will not advance to show them until play resumes).
- The jump control shall allow entering a valid cabin number (1-based, within the current train length). The display wall shall smoothly scroll to the specified cabin. If the entered index exceeds the current train length, it shall be clamped to the last cabin.
- The pause/play/jump state shall not be persisted across browser refresh on the display wall in Phase 1. On refresh, the train shall restart from the first cabin (cabin 0) in playing state. Refresh resilience may be added in a future iteration.

**FR-24b — Addition (Display Wall Visibility Toggle):**
- The Admin panel shall include a toggle control to enable or disable participant access to the display wall route for non-logged-in users.
- When disabled, the display wall route shall show a simple message: "Access not allowed. Please refer to the organiser's screen instead."
- The default state shall be enabled. This restriction applies only to Participants (unauthenticated users) — logged-in Photo Moderators and Admins can always access the display wall regardless of the toggle setting.
- This setting shall be persisted in the database and survive server restart.

---

## 2. Non-Functional Requirements — Additions

### 2.7 Audit & Accountability

**NFR-22 — Addition (Audit Log):**
- The system shall maintain an audit log recording all moderator and admin actions that affect submissions, user accounts, or system configuration.
- The audit log shall capture at minimum:
  - Moderator/Admin username (or ID)
  - Action type (e.g. `approve`, `reject`, `delete`, `edit`, `create_moderator`, `disable_moderator`, `delete_moderator`, `change_config`)
  - Target type (e.g. `submission`, `moderator`, `system_config`)
  - Target identifier (e.g. submission ID, moderator ID, config key)
  - Old value (for edits and configuration changes — may be null for non-edit actions)
  - New value (for edits and configuration changes — may be null for delete actions)
  - Timestamp (UTC, with millisecond precision)
- The audit log shall be append-only. No deletion or modification of audit log entries is permitted by any user role.
- The audit log shall be accessible from the Admin panel in a read-only view.
- The audit log view shall support filtering by: moderator, action type, date range, and target type.
- The audit log shall NOT be publicly accessible.

### 2.5 Security — NFR-15 Update

**NFR-15 — Clarification Update:**
Add a note to NFR-15:

> **NOTE**: The system collects name and optional social handle, which constitute personal data (PII) under applicable privacy regulations. A data privacy notice shall be displayed on the upload form (see FR-02a). No authentication is required for participants.

---

## 3. Design & Branding Requirements — Additions

**DR-04 — Addition (Warm Tone for User-Facing Copy):**
- All user-facing notices, disclaimers, and privacy messaging shall be written in a warm, community-appropriate tone consistent with the Singapore National Day party theme.
- Copy shall be clear, concise, and approachable — not legalistic or clinical.
- Specific copy elements covered by this requirement:
  - Data privacy notice (FR-02a)
  - Rejection disclaimer (FR-02b)
  - Upload success message (FR-04)
  - Error messages and validation feedback
  - Any system-generated messages directed at participants
- Example tone: *"We'll display your name and photo on the photowall during the party! Your info won't be stored after the event."* rather than *"By submitting, you consent to data processing."*

---

## 6. Open Questions / Risks — Additions

| # | Item | Notes |
|---|------|-------|
| R-06 | PII and data privacy | Name and social handle constitute PII (noted by Sharon). A data privacy notice (FR-02a) is added in this update. Consider whether a brief privacy policy page or reference to organisers' existing privacy notice is needed. Further research on Singapore PDPA requirements recommended. |
| R-07 | Display wall refresh resilience | In Phase 1, pause/play/jump state is not persisted across browser refresh (see FR-24a). If the display wall browser refreshes during a paused state, the train resumes from cabin 0 in playing state. This may cause a brief interruption. Refresh resilience may be added as a low-effort enhancement if time permits. |
| R-08 | Auto-moderator word list accuracy | The auto-moderator uses a configurable word list. False positives and false negatives are possible. Moderators retain final approval discretion. The word list should be reviewed before the event to balance safety vs. over-filtering. |

---

## 7. Phased Delivery Plan — Update

### Phase 1: MVP — Local Deno Application (Updated)

**Goal**: Core functionality running entirely locally on the developer's machine, including the original feature set AND the Update 01 enhancements. Demos are run from the local machine with no cloud dependencies.

**Included Requirements (Updated)**:
- **Original**: FR-01 through FR-24, NFR-01 through NFR-16, DR-01 through DR-03
- **Update 01 additions**: All items listed in the Summary of Changes table above
- **New/Modified FRs**: FR-02 (updated), FR-02a, FR-02b, FR-08 (clarified), FR-09 (extended), FR-09a, FR-13 (extended), FR-13a, FR-15a, FR-15b, FR-15c, FR-19 (updated), FR-24a, FR-24b
- **New NFRs**: NFR-22
- **New DRs**: DR-04
- **Abstraction pattern**: Repository, StorageService, and RealtimeService interfaces with local implementations (Postgres, filesystem, in-memory event emitter)

**Testable Deliverable (Updated)**: Fully functional photowall system running on localhost with Deno + Postgres + filesystem storage. All features — upload, moderation (with editing and auto-flagging), admin panels (user management, system parameters, audit log, train controls), display wall (with configurable timing, pause/play/jump, visibility toggle), password management — work end-to-end without internet connectivity or cloud accounts.

**Phase 1 Exit Criteria (Updated)**:
1. All FR-01 to FR-24 pass end-to-end testing against local Postgres + filesystem storage
2. All Update 01 FRs (FR-02a, FR-02b, FR-09a, FR-13a, FR-15a/b/c, FR-24a, FR-24b) pass acceptance testing
3. NFR-03 (60fps animation) confirmed on target laptop/display hardware
4. NFR-04 (real-time updates within 30s) verified with local real-time mechanism
5. NFR-22 (audit log) verified — all auditable actions produce correct log entries
6. Organiser sign-off on upload, moderation, admin panels, and display workflows
7. Contract tests written for Repository, StorageService, and RealtimeService interfaces (reusable in Phase 2)

### Phase 2: Cloud Deployment (Deno Deploy + Supabase) — Unchanged

No changes from original `requirements.md`. FR-25, NFR-17 remain as specified.

### Phase 3: Instagram Integration — Unchanged

No changes from original `requirements.md`. FR-27 through FR-31, NFR-20, NFR-21 remain as specified.

---

## Architecture Evolution Strategy — Update

| Concern | Phase 1 (original) | Phase 1 (with Update 01) | Phase 2 | Phase 3 |
|---------|-------------------|--------------------------|---------|---------|
| Database | Local Postgres | Local Postgres + `system_config` table + `audit_log` table | Supabase Postgres | Same as Phase 2 |
| Storage | Local filesystem | Local filesystem (unchanged) | Supabase Storage | Same as Phase 2 |
| Realtime | In-memory event emitter | In-memory event emitter (extended for train commands) | Supabase Realtime | Same as Phase 2 |
| Config | Environment variables | Environment variables + db-backed system params | Environment-based switching | Same as Phase 2 + Instagram settings |
| User Roles | Participant, Photo Mod, Admin | Same roles + ability to disable/delete mod accounts | Same as Phase 1 | Same as Phase 1 |
| Content Sources | Manual upload only | Manual upload only + auto-moderator filter | Same as Phase 1 | Content source abstraction + Instagram |
| Audit | Not present | `AuditService` module + `audit_log` table | Same (migrate to Supabase) | Same as Phase 2 |
| Deployment | Local Deno (demo from laptop) | Local Deno | Deno Deploy | Same as Phase 2 |
| Train Controls | None | Configurable dwell time + pause/play/jump + visibility toggle | Same | Same |

---

## 8. Change Log — Update

| Date | Change |
|------|--------|
| 2026-05-21 | **Update 01**: Applied organiser discussion outcomes (Paul, Sharon, Liwei). Added: configurable prompt text (FR-02 update), data privacy notice (FR-02a), rejection disclaimer (FR-02b), post editing by moderator (FR-09 extension), auto-moderator with visual flagging (FR-09a), disable/delete moderator accounts (FR-13/15 extension), system parameters panel (FR-13a), configurable dwell time (FR-19 update), pause/play/jump controls (FR-24a), display wall visibility toggle (FR-24b), audit log (NFR-22), warm tone DR (DR-04). All Update 01 items assigned to Phase 1. Total Phase 1 scope estimate: ~25–30h implementation effort. Jump refresh resilience deferred as low-priority post-launch enhancement. |