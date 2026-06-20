# Requirements Document — ground-up-wall

## Intent Analysis

- **User Request**: Build a photowall webapp for a Singapore National Day community party event
- **Request Type**: New Project (Greenfield)
- **Scope Estimate**: Multiple Components (upload app, display wall, admin panel, backend)
- **Complexity Estimate**: Moderate
- **Tech Stack**: Deno Fresh + Postgres (Phase 1 local; Phase 2 with Deno Deploy + Supabase)

---

## Persona Model

The system serves four roles. Three follow a hierarchical permission model; the fourth (Display Wall User) is a separate role for the TV display device.

```
Admin → inherits → Photo Moderator → inherits → Participant (base, upload only)
Display Wall User (TV account — view train display only; admin-created; separate from inherit chain)
```

| Persona | Capabilities |
|---------|-------------|
| **Participant** | Submit photo (no login required) |
| **Photo Moderator** | All Participant capabilities + log in, moderate submissions, delete approved content, edit submission content, view display wall, control train playback (pause/play/jump), command display override (blank/placeholder/resume), change own password |
| **Admin** | All Photo Moderator capabilities + create/manage/disable/delete moderator and Display Wall accounts, configure system parameters, view audit log, upload default placeholder image (initial admin credentials set by developer in backend) |
| **Display Wall User** | Log in to display wall route, view train animation (no upload, moderation, or admin capabilities; admin-created account) |

---

## 1. Functional Requirements

### 1.1 Photo Submission (Participant Upload)

- **FR-01**: Any participant with the app link can submit a photo without login or registration
- **FR-02**: The upload form must capture:
  - Photo (image file)
  - Short message — with a configurable maximum length and a configurable prompt text displayed as the input placeholder
  - Submitter's name
  - Optional social handle
- The maximum message length shall be configurable by an Admin via the system parameters panel (see §1.4 below). The Admin can select the unit of measurement: **characters** or **words**. Default: 50 characters. When the unit is "characters", the limit counts Unicode code points. When set to "words", the limit counts space-separated tokens. The upload form shall display a live counter showing remaining capacity in the selected unit.
- The prompt text shall be configurable by an Admin via the system parameters panel. The default prompt text shall be: *"What does National Day mean to you?"*
- **FR-02a**: The upload form shall display a concise data privacy notice before submission, informing participants that their name, message, photo, and optional social handle will be displayed on the photowall during the event, and that submission data (including photos) will be retained indefinitely by the organisers for social media use — if an Instagram handle is provided, the content may be posted on social media with tagging to their handle. The notice shall include a reference for contacting an organiser with questions. The tone shall follow DR-04 (warm, community-appropriate). The upload form shall include a **mandatory acknowledgment checkbox** that the participant must check before the submit button is enabled. The checkbox label shall state that the participant has read and understood the privacy notice and posting guidelines.
- **FR-02b**: The upload form and success page shall include a posting guidelines disclaimer informing participants that if their submission does not appear on the display wall within a reasonable time, it may have been rejected because it did not conform to the posting guidelines. Participants are encouraged to review the posting guidelines and re-submit. The disclaimer shall also state that moderators may edit submission content (message, name, social handle) to bring it into conformance with posting guidelines. The disclaimer shall NOT imply that rejection notifications will be sent. The disclaimer tone shall follow DR-04 (warm, community-appropriate).
- **FR-03**: Submitted photos are held in a moderation queue and do NOT appear on the display wall until approved by a Photo Moderator or Admin
- **FR-04**: After submitting, the participant sees a simple success message confirming their submission was received
- **FR-05**: The upload page must be accessible via both a QR code (displayed at the event) and a short URL

### 1.2 Photo Moderation Panel

- **FR-06**: A separate organiser login page exists, accessible via a protected route — access requires a username and password
- **FR-07**: After login, Photo Moderators see the moderation queue of pending submissions
- **FR-08**: Photo Moderators can approve or reject each submission from the moderation panel
  > **NOTE**: Rejected submissions shall NOT trigger any notification to the participant. Participants are encouraged to review the posting guidelines and re-submit (see FR-02b).
- **FR-09**: Photo Moderators can delete any previously approved submission from the wall, and can also edit the content (message, name, social handle) of any pending submission before approval or any approved submission on the wall
  - Original values shall be preserved in the audit log (see NFR-22)
  - Edited submissions shall display the updated content on the display wall without requiring re-approval
  - The moderation panel shall clearly indicate when a submission has been edited and display the moderator who made the edit
- **FR-09a**: The system shall include an automated content filter that checks submission messages against a configurable word list. Flagged submissions shall display a visual indicator in the moderation panel — flagged words shall be highlighted (e.g. underlined or highlighted background) so the moderator can review before approving. The flagging shall be advisory only; the moderator retains full discretion to approve or reject flagged submissions. The word list shall be configurable by an Admin via the system parameters panel. The content filter must handle: case-insensitive matching, Unicode characters, and basic character substitutions (e.g. `@` for `a`). The system shall ship with a **seeded default word list** containing typical profanity and explicit terms appropriate for a PG-13 audience. The "Reset to default" action for the word list shall restore this seeded list.
- **FR-10**: Approved submissions are added to the display wall rotation in chronological order (oldest first)

### 1.3 Password Management

- **FR-11**: Photo Moderators and Admins can change their own password after logging in
- **FR-12**: Changing a password requires the current password, a new password, and confirmation of the new password

### 1.4 Admin User Management

- **FR-13**: An Admin-only user management page exists for creating, managing, disabling, and deleting **Photo Moderator** and **Display Wall User** accounts. The page shall display the role (Photo Moderator or Display Wall User) and active/disabled status of each account
- **FR-14**: Admins can create new Photo Moderator accounts by providing a username and initial password
- **FR-15**: Admins can reset passwords for existing Photo Moderator accounts
- **FR-15a**: Admins can disable a Photo Moderator account (preventing login without deleting the account or its audit history)
- **FR-15b**: Admins can permanently delete a Photo Moderator account (with confirmation). Deletion shall preserve audit log references (the log retains the moderator ID even after account deletion)
- **FR-15c**: The user management page shall display the active/disabled status of each moderator account
- **FR-16**: The initial Admin account credentials are set by the developer in the backend (not self-service)
- **FR-13a**: An Admin-only system parameters page shall exist for viewing and modifying configurable system parameters:
  - **Train dwell time**: The duration (in seconds) each cabin is visible on the display wall before transitioning. Default: 15s. Range: 3s–60s.
  - **Message prompt text**: The placeholder/prompt shown in the upload form message field
  - **Message length limit**: The maximum length for the upload form message field. Default: 50.
  - **Message length unit**: The unit of measurement for the message length limit — `characters` or `words`. Default: `characters`.
  - **Auto-moderator word list**: The list of flagged words for the profanity filter, editable as a comma-separated or line-separated list. Ships with a seeded PG-13 default list.
  - **Default placeholder image**: An image uploaded by the Admin to be used as the display wall placeholder when the display override is set to "placeholder" (see FR-24c). The Admin can replace or remove the default placeholder at any time.
  - The parameters panel shall persist changes immediately to the database and take effect without requiring a server restart (via RealtimeService broadcast or polling). All parameters shall have a "Reset to default" option.

### 1.5 Display Wall (TV Screen)

- **FR-17**: The display wall shows a moving SMRT MRT train animation scrolling from right to left
- **FR-18**: The train consists of multiple cabins; each cabin displays one approved submission (photo + message + name + optional social handle)
- **FR-19**: The display focuses on one cabin at a time, with each cabin visible for a configurable duration before transitioning. The default dwell time is approximately 15 seconds. An Admin may change this value via the system parameters panel (range: 3–60 seconds, configurable in 1-second increments).
- **FR-20**: Transition between cabins uses a smooth scroll animation — the train physically moves left to bring the next cabin into focus
- **FR-21**: Cabin display order is chronological — oldest approved submissions first, newest appended to the end of the train
- **FR-22**: New approved submissions are added to the wall rotation automatically after moderation approval (real-time or near real-time, no manual refresh required)
- **FR-23**: When no submissions have been approved yet, the display shows a branded waiting screen with Singapore National Day theme
- **FR-24**: The display wall is designed to run full-screen in a browser on a laptop/PC connected to a TV via HDMI
- **FR-24a**: The display wall page shall include pause, play, and jump-to-cabin controls. These controls shall be visible only to logged-in Photo Moderators and Admins. When paused, the train shall freeze on the current cabin. Newly approved submissions may still be appended to the train (but the display will not advance to show them until play resumes). The jump control shall allow entering a valid cabin number (1-based, within the current train length), and the display wall shall smoothly scroll to the specified cabin. If the entered index exceeds the current train length, it shall be clamped to the last cabin. The pause/play/jump state shall not be persisted across browser refresh on the display wall in Phase 1 (on refresh, the train restarts from cabin 0 in playing state). Refresh resilience may be added in a future iteration.
- **FR-24b**: The display wall route shall require authentication. Access is restricted to accounts with the Display Wall User, Photo Moderator, or Admin role. Unauthenticated users and Participants cannot access the display wall route — they shall receive a 403 response with the message: "Access not allowed. Please refer to the organiser's screen instead." The Display Wall User is a dedicated account type for the TV/display device; Admins create and manage these accounts via the user management page (see FR-13). Photo Moderators and Admins retain full access for preview and control purposes. The Display Wall User account does not inherit Participant upload capabilities — it can only view the train animation.
- **FR-24c**: From the moderation panel or admin panel, Photo Moderators and Admins can command all connected display wall sessions to show one of the following states: (a) blank/black screen — hiding the train animation; (b) placeholder image — the system-wide default placeholder image configured via FR-13a, or a per-action override image selected at the time of the command; (c) resume normal display — the train animation returns from its current position. The display override state shall be broadcast to all connected display wall sessions via RealtimeService. Display override commands shall be auditable (see NFR-22). The display override state shall be persisted in the database so that new display wall sessions connecting after the command also show the correct state.

---

## 2. Non-Functional Requirements

### 2.1 Performance

- **NFR-01**: The upload form must be responsive and usable on mobile devices (participants will submit from their phones)
- **NFR-02**: Image upload should complete within a reasonable time on typical 4G/WiFi connections
- **NFR-03**: The display wall must animate smoothly at the target frame rate without jank (targeting 60fps on a modern laptop browser)
- **NFR-04**: New approved submissions should appear in the display rotation within 30 seconds of approval

### 2.2 Scalability

- **NFR-05**: System must handle up to 200 concurrent users (participants uploading) during peak event activity
- **NFR-06**: System must support up to 200 total submissions over the event duration (half-day afternoon + early evening)

### 2.3 Usability

- **NFR-07**: The upload form must be completable in 3 taps/steps or fewer on a mobile device
- **NFR-08**: The display wall must be legible from across a room on a standard TV screen (large fonts, high contrast)
- **NFR-09**: The moderation and admin panels must be simple enough for a non-technical organiser to use without training

### 2.4 Reliability

- **NFR-10**: The system must remain operational for the full event duration (approx. 6–8 hours including setup)
- **NFR-11**: The display wall must recover gracefully from a browser refresh without losing state
- **NFR-12**: Supabase project must be kept active in the week before the event to prevent free-tier pausing

### 2.5 Security

- **NFR-13**: The admin and moderation panels must be protected — not publicly accessible via the main app URL
- **NFR-14**: Image uploads must be validated (file type and size limits) to prevent abuse
- **NFR-15**: No personal data beyond name, photo, message, and optional social handle is collected; no authentication required for participants
  > **NOTE**: The system collects name, photo, message, and optional social handle, which constitute personal data (PII) under applicable privacy regulations. Submission data is retained indefinitely for organiser social media use — participants are informed of this via FR-02a. If an Instagram handle is provided, content may be posted on social media with tagging. A data privacy notice with mandatory acknowledgment shall be displayed on the upload form (see FR-02a).

### 2.6 Accessibility

- **NFR-16**: Upload form must meet basic WCAG 2.1 AA accessibility standards (labels, contrast, keyboard navigation)

### 2.7 Audit & Accountability

- **NFR-22**: The system shall maintain an audit log recording all moderator and admin actions that affect submissions, user accounts, display override state, or system configuration. The audit log shall capture at minimum: moderator/admin username (or ID), action type (e.g. `approve`, `reject`, `delete`, `edit`, `create_moderator`, `disable_moderator`, `delete_moderator`, `change_config`, `blank_display`, `show_placeholder`, `resume_display`, `set_default_placeholder`, `create_display_wall_user`, `disable_display_wall_user`, `delete_display_wall_user`), target type (e.g. `submission`, `moderator`, `display_wall_user`, `system_config`, `display_override`), target identifier, old value, new value, and timestamp (UTC, with millisecond precision). The audit log shall be append-only — no deletion or modification of entries is permitted by any user role. The audit log shall be accessible from the Admin panel in a read-only view with filtering by moderator, action type, date range, and target type. The audit log shall NOT be publicly accessible.

---

## 3. Design & Branding Requirements

- **DR-01**: The train visual style is a realistic SMRT MRT train look — red/white Singapore metro aesthetic
- **DR-02**: Singapore National Day branding elements (red/white colour palette, national day motifs) are present but subtle — they complement the submitted photos without overpowering them
- **DR-03**: The overall visual feel should be festive and community-oriented, appropriate for a National Day party event
- **DR-04**: All user-facing notices, disclaimers, and privacy messaging shall be written in a warm, community-appropriate tone consistent with the Singapore National Day party theme. Copy shall be clear, concise, and approachable — not legalistic or clinical. Specific copy elements covered: data privacy notice (FR-02a), posting guidelines disclaimer (FR-02b), upload success message (FR-04), error messages and validation feedback, and any system-generated messages directed at participants. Example tone: *"We'll display your name and photo on the photowall during the party! Your photo and info may also be shared on our social media after the event — if you've shared your Instagram handle, we might tag you too!"*

---

## 4. Constraints & Assumptions

- **C-01**: Hosting is free-tier only — Deno Deploy (app) + Supabase (Postgres + Storage)
- **C-02**: Supabase free tier storage limit is 1GB — sufficient for up to ~200 photos at typical mobile photo sizes (compressed)
- **C-03**: Internet connectivity at the venue is reliable WiFi
- **C-04**: The display device is a laptop/PC running a modern browser (Chrome/Firefox) connected to a TV via HDMI
- **C-05**: Event duration is approximately half-day (afternoon) with possible extension into early evening for a film showing
- **C-06**: No budget for paid services, third-party moderation tools, or CDN

---

## 5. Out of Scope

- Push notifications to participants when their cabin is on display
- Multi-event support (this is a single-event app)
- Offline mode
- Native mobile app (web only)
- Analytics or reporting dashboard (beyond the audit log)
- Social media sharing integration

---

## 6. Open Questions / Risks

| # | Item | Notes |
|---|------|-------|
| R-01 | Image compression | Mobile photos can be large; client-side compression before upload recommended to stay within Supabase storage limits |
| R-02 | Admin panel access method | RESOLVED: Password-based login with username and password (not secret URL) |
| R-03 | Real-time mechanism | Supabase Realtime (websockets) is available on free tier — preferred approach for live wall updates |
| R-04 | QR code generation | Static QR code pointing to the app URL — can be generated externally before the event |
| R-05 | Instagram API feasibility | Instagram's public hashtag API (Basic Display API) has been restricted since 2020. Phase 3 may require Meta's Graph API with Business Verification, App Review, and an Instagram Business/Creator account — timeline uncertain for a single-event app. A fallback (manual CSV import) should be considered. |
| R-06 | PII and data privacy | Name, photo, and social handle constitute PII. Data is retained indefinitely for social media posting purposes. A data privacy notice with mandatory acknowledgment checkbox (FR-02a) informs participants of this. Singapore PDPA compliance should be reviewed given indefinite retention — consider whether explicit consent (checkbox) satisfies requirements or whether a separate privacy policy document is needed. |
| R-09 | Display Wall User credential management | Display Wall User accounts are admin-created. The TV device must remain logged in for the event duration. If the browser session expires or the device loses power, the organiser must re-enter Display Wall credentials. Consider whether a "remember me" / extended session option is needed for Display Wall accounts specifically. |
| R-07 | Display wall refresh resilience | In Phase 1, pause/play/jump state is not persisted across browser refresh (see FR-24a). If the display wall browser refreshes during a paused state, the train resumes from cabin 0 in playing state. This may cause a brief interruption. Refresh resilience may be added as a low-effort enhancement if time permits. |
| R-08 | Auto-moderator word list accuracy | The auto-moderator uses a configurable word list. False positives and false negatives are possible. Moderators retain final approval discretion. The word list should be reviewed before the event to balance safety vs. over-filtering. |

---

## 7. Phased Delivery Plan

This project will be delivered in three phases, each producing a testable, working product. The architecture is designed to evolve without major rewrites between phases.

### Phase 1: MVP — Local Deno Application (Updated)

**Goal**: Core functionality running entirely locally on the developer's machine — including all original features AND the Update 01 enhancements. Demos are run from the local machine with no cloud dependencies.

**Included Requirements**:
- **Functional**: FR-01 through FR-24 (original core), plus Update 01 (FR-02a, FR-02b, FR-09 extended, FR-09a, FR-13 extended, FR-13a, FR-15a, FR-15b, FR-15c, FR-19 updated, FR-24a, FR-24b), plus Update 02 (FR-02 updated, FR-02a updated, FR-02b updated, FR-09a extended, FR-13 updated, FR-13a extended, FR-24b revised, FR-24c new)
- **Non-Functional**: NFR-01 through NFR-16, plus NFR-22 (updated with display override action types)
- **Design**: DR-01, DR-02, DR-03, DR-04 (updated)
- **Roles**: 4 roles (Participant, Photo Moderator, Admin, Display Wall User)
- **Abstraction pattern**: Repository, StorageService, and RealtimeService interfaces with local implementations (Postgres, filesystem, in-memory event emitter)

**Testable Deliverable**: Fully functional photowall system running on localhost with Deno + Postgres + filesystem storage. All features — upload (with configurable message length, privacy acknowledgment checkbox), moderation (with editing, auto-flagging with seeded default word list), admin panels (user management for moderators and Display Wall accounts, system parameters, audit log, display override controls), display wall (auth-only access via Display Wall User/mod/admin, configurable timing, pause/play/jump, blank/placeholder support), password management — work end-to-end without internet connectivity or cloud accounts.

**Phase 1 Exit Criteria**:
1. All FR-01 to FR-24 pass end-to-end testing against local Postgres + filesystem storage
2. All Update 01 FRs pass acceptance testing
3. All Update 02 FRs (FR-02 updated, FR-02a updated, FR-02b updated, FR-09a extended, FR-13 updated, FR-13a extended, FR-24b revised, FR-24c new) pass acceptance testing
4. NFR-03 (60fps animation) confirmed on target laptop/display hardware
5. NFR-04 (real-time updates within 30s) verified with local real-time mechanism
6. NFR-22 (audit log) verified — all auditable actions (including display override types) produce correct log entries
7. Display Wall User login and display-only access verified end-to-end
8. Organiser sign-off on upload, moderation, admin panels, and display workflows
9. All user stories pass their Gherkin acceptance criteria
10. Contract tests written for Repository, StorageService, and RealtimeService interfaces (reusable in Phase 2)

### Phase 2: Cloud Deployment (Deno Deploy + Supabase)

**Goal**: Deploy the Phase 1 application to Deno Deploy with Supabase as the backend, using environment-based configuration to switch between local and production environments seamlessly.

**New Requirements**:
- **FR-25**: The system shall support environment-based configuration (local.env, production.env) for database connection, storage backend, and deployment target.
- **NFR-17**: Switching between local and production environments shall require only configuration changes (environment variables), with no code modifications.

**New Implementations (reusing Phase 1 abstraction interfaces)**:
- SupabaseRepository (implements Repository interface against Supabase Postgres)
- SupabaseStorageService (implements StorageService interface against Supabase Storage)
- SupabaseRealtimeService (implements RealtimeService interface against Supabase Realtime)

**Testable Deliverable**: The same application deployed to Deno Deploy + Supabase, with documented environment variables for switching between local development and production deployment. No code changes needed — only config changes.

### Phase 3: Instagram Integration

**Goal**: Aggregate photos and messages from Instagram using a configurable hashtag, automatically including them in the display wall rotation.

**New/Modified Requirements**:
- **FR-27**: The admin panel shall allow Admins to configure an Instagram hashtag for content aggregation.
- **FR-28**: The system shall periodically fetch public Instagram posts containing the configured hashtag.
- **FR-29**: Instagram-sourced submissions shall enter the moderation queue (same as manual uploads) before appearing on the display wall.
- **FR-30**: The system shall indicate the source of each submission (manual upload vs. Instagram) in the moderation panel.
- **FR-31**: The Instagram connectivity settings (hashtag, API credentials if required) shall be configurable from the admin panel or via environment variables.
- **NFR-20**: Instagram content fetching shall respect rate limits and handle API errors gracefully without affecting the rest of the system.
- **NFR-21**: The system shall use a content source abstraction pattern, allowing future integration of additional sources (e.g., Twitter/X, Facebook).

**Testable Deliverable**: Working Instagram integration that fetches hashtag-based content, feeds it into the moderation queue, and displays approved posts on the train wall.

### Architecture Evolution Strategy

| Concern | Phase 1 (original) | Phase 1 (with Update 01) | Phase 2 | Phase 3 |
|---------|-------------------|--------------------------|---------|---------|
| Database | Local Postgres | Local Postgres + `system_config` table + `audit_log` table | Supabase Postgres | Same as Phase 2 |
| Storage | Local filesystem | Local filesystem (unchanged) | Supabase Storage | Same as Phase 2 |
| Realtime | In-memory event emitter | In-memory event emitter (extended for train commands) | Supabase Realtime | Same as Phase 2 |
| Config | Environment variables | Environment variables + db-backed system params | Environment-based switching | Same as Phase 2 + Instagram settings |
| User Roles | Participant, Photo Moderator, Admin | Same roles + ability to disable/delete mod accounts | Participant (upload only), Photo Mod, Admin, **Display Wall User** | Same as Phase 1 |
| Content Sources | Manual upload only | Manual upload only + auto-moderator filter | Same as Phase 1 | Content source abstraction + Instagram |
| Audit | Not present | `AuditService` module + `audit_log` table | Same (migrate to Supabase) | Same as Phase 2 |
| Deployment | Local Deno (demo from laptop) | Local Deno | Deno Deploy | Same as Phase 2 |
| Train Controls | None | Configurable dwell time + pause/play/jump + visibility toggle | Same + **display override** (blank/placeholder/resume) + **auth-required access** | Same |

### Phase Dependencies

- **Phase 2 depends on the abstraction interfaces built in Phase 1.** Phase 1 must design and implement Repository, StorageService, and RealtimeService interfaces with local implementations. Phase 2 then adds Supabase-specific implementations for each interface.
- **Phase 3 depends on the moderation queue and display wall from Phase 1 being stable.** Instagram submissions flow through the same moderation pipeline. Phase 3 may leverage the content source abstraction pattern established in Phase 2.
- Each phase delivers an independently testable and deployable product.

---

## 8. Change Log

| Date | Change |
|------|--------|
| 2026-05-21 | **Update 01**: Applied organiser discussion outcomes (Paul, Sharon, Liwei). Added: configurable prompt text (FR-02 update), data privacy notice (FR-02a), rejection disclaimer (FR-02b), post editing by moderator (FR-09 extension), auto-moderator with visual flagging (FR-09a), disable/delete moderator accounts (FR-13/15 extension), system parameters panel (FR-13a), configurable dwell time (FR-19 update), pause/play/jump controls (FR-24a), display wall visibility toggle (FR-24b), audit log (NFR-22), warm tone DR (DR-04). Updated Open Questions with R-06, R-07, R-08. Updated Phase 1 scope to include all Update 01 items. Updated Architecture Evolution Strategy table. Total Phase 1 scope estimate: ~25–30h implementation effort. Jump refresh resilience deferred as low-priority post-launch enhancement. |
| 2026-06-01 | **Update 02**: Applied PR #3 review feedback (Liwei, 25 May meeting + follow-up). Modified: configurable message length with character/word unit selection (FR-02), indefinite data retention with mandatory privacy acknowledgment checkbox (FR-02a), posting-guidelines disclaimer with re-submit advice and moderator editing notice (FR-02b), seeded PG-13 default word list (FR-09a), Display Wall User auth model replacing visibility toggle (FR-24b revision + 4-role persona model), display override controls for blank/placeholder from mod/admin panel (FR-24c new), Display Wall account management (FR-13/FR-13a extension), warm-tone example copy updated for social media retention (DR-04), expanded NFR-22 audit action types. Added R-09 (Display Wall credential management). Updated Phase 1 scope and exit criteria. |
| 2026-06-20 | **Update 03**: K-buffer train view, single-slide animation, playback SSE sync, override timer freeze, jump preload. Implementation architecture documented; code-traced verification in `docs/phase01/requirements_verification.update03.md`. |
| 2026-05-17 | Reordered phased delivery plan: Phase 1 is now local-only MVP (no cloud dependency), Phase 2 adds cloud deployment (Deno Deploy + Supabase), Phase 3 remains Instagram integration. FR-26 (local-only requirement) implicitly satisfied by Phase 1. NFR-18 and NFR-19 (abstraction patterns) are now Phase 1 design requirements rather than Phase 2 additions. Architecture evolution table updated to reflect local-first progression. |
| 2026-05-11 | Restructured FRs to align with 3-persona model: split "Organiser Admin Panel" into Photo Moderation Panel (1.2), Password Management (1.3), Admin User Management (1.4). Renumbered FRs (was 18, now 24 Phase 1 FRs). Added FR-11 through FR-16 for password management and user management. Updated Phase 1 to include all 24 FRs. Updated Phase 2/3 FR numbering (was FR-19/FR-20, now FR-25/FR-26; was FR-21/FR-25, now FR-27/FR-31). Added Persona Model section. Updated Architecture Evolution table. Updated Phased Delivery Plan descriptions. |