# Requirements Document — ground-up-wall

## Intent Analysis

- **User Request**: Build a photowall webapp for a Singapore National Day community party event
- **Request Type**: New Project (Greenfield)
- **Scope Estimate**: Multiple Components (upload app, display wall, admin panel, backend)
- **Complexity Estimate**: Moderate
- **Tech Stack**: Deno Fresh + Deno Deploy + Supabase (Postgres + Storage)

---

## Persona Model

The system serves three personas with a hierarchical permission model:

```
Admin → inherits → Photo Moderator → inherits → Participant
```

| Persona | Capabilities |
|---------|-------------|
| **Participant** | View display wall, submit photo (no login required) |
| **Photo Moderator** | All Participant capabilities + log in, moderate submissions, delete approved content, change own password |
| **Admin** | All Photo Moderator capabilities + create/manage moderator accounts (initial admin credentials set by developer in backend) |

---

## 1. Functional Requirements

### 1.1 Photo Submission (Participant Upload)

- **FR-01**: Any participant with the app link can submit a photo without login or registration
- **FR-02**: The upload form must capture:
  - Photo (image file)
  - Short message (max 50 characters)
  - Submitter's name
  - Optional social handle
- **FR-03**: Submitted photos are held in a moderation queue and do NOT appear on the display wall until approved by a Photo Moderator or Admin
- **FR-04**: After submitting, the participant sees a simple success message confirming their submission was received
- **FR-05**: The upload page must be accessible via both a QR code (displayed at the event) and a short URL

### 1.2 Photo Moderation Panel

- **FR-06**: A separate organiser login page exists, accessible via a protected route — access requires a username and password
- **FR-07**: After login, Photo Moderators see the moderation queue of pending submissions
- **FR-08**: Photo Moderators can approve or reject each submission from the moderation panel
- **FR-09**: Photo Moderators can delete any previously approved submission from the wall
- **FR-10**: Approved submissions are added to the display wall rotation in chronological order (oldest first)

### 1.3 Password Management

- **FR-11**: Photo Moderators and Admins can change their own password after logging in
- **FR-12**: Changing a password requires the current password, a new password, and confirmation of the new password

### 1.4 Admin User Management

- **FR-13**: An Admin-only user management page exists for creating and managing Photo Moderator accounts
- **FR-14**: Admins can create new Photo Moderator accounts by providing a username and initial password
- **FR-15**: Admins can reset passwords for existing Photo Moderator accounts
- **FR-16**: The initial Admin account credentials are set by the developer in the backend (not self-service)

### 1.5 Display Wall (TV Screen)

- **FR-17**: The display wall shows a moving SMRT MRT train animation scrolling from right to left
- **FR-18**: The train consists of multiple cabins; each cabin displays one approved submission (photo + message + name + optional social handle)
- **FR-19**: The display focuses on one cabin at a time, with each cabin visible for approximately 15 seconds before transitioning
- **FR-20**: Transition between cabins uses a smooth scroll animation — the train physically moves left to bring the next cabin into focus
- **FR-21**: Cabin display order is chronological — oldest approved submissions first, newest appended to the end of the train
- **FR-22**: New approved submissions are added to the wall rotation automatically after moderation approval (real-time or near real-time, no manual refresh required)
- **FR-23**: When no submissions have been approved yet, the display shows a branded waiting screen with Singapore National Day theme
- **FR-24**: The display wall is designed to run full-screen in a browser on a laptop/PC connected to a TV via HDMI

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
- **NFR-15**: No personal data beyond name and optional social handle is collected; no authentication required for participants

### 2.6 Accessibility

- **NFR-16**: Upload form must meet basic WCAG 2.1 AA accessibility standards (labels, contrast, keyboard navigation)

---

## 3. Design & Branding Requirements

- **DR-01**: The train visual style is a realistic SMRT MRT train look — red/white Singapore metro aesthetic
- **DR-02**: Singapore National Day branding elements (red/white colour palette, national day motifs) are present but subtle — they complement the submitted photos without overpowering them
- **DR-03**: The overall visual feel should be festive and community-oriented, appropriate for a National Day party event

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
- Analytics or reporting dashboard
- Social media sharing integration

---

## 6. Open Questions / Risks

| # | Item | Notes |
|---|------|-------|
| R-01 | Image compression | Mobile photos can be large; client-side compression before upload recommended to stay within Supabase storage limits |
| R-02 | Admin panel access method | RESOLVED: Password-based login with username and password (not secret URL) |
| R-03 | Real-time mechanism | Supabase Realtime (websockets) is available on free tier — preferred approach for live wall updates |
| R-04 | QR code generation | Static QR code pointing to the app URL — can be generated externally before the event |

---

## 7. Phased Delivery Plan

This project will be delivered in three phases, each producing a testable, working product. The architecture is designed to evolve without major rewrites between phases.

### Phase 1: MVP — Local Deno Application
**Goal**: Core functionality running entirely locally on the developer's machine — participants upload photos manually, Photo Moderators moderate, Admin manages users, display wall shows approved submissions. Demos are run from the local machine with no cloud dependencies.

**Included Requirements**:
- **Functional**: FR-01 through FR-24 (all core features, implemented with local backends)
- **Non-Functional**: NFR-01 through NFR-16
- **Design**: DR-01, DR-02, DR-03
- **Abstraction pattern**: Repository, StorageService, and RealtimeService interfaces with local implementations (Postgres, filesystem, in-memory event emitter)

**Testable Deliverable**: Fully functional photowall system running on localhost with Deno + Postgres + filesystem storage. All features (upload, moderation, admin, display wall, password management) work end-to-end without internet connectivity or cloud accounts.

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

| Concern | Phase 1 | Phase 2 | Phase 3 |
|---------|---------|---------|---------|
| Database | Local Postgres (via abstracted Repository interface) | Supabase Postgres (SupabaseRepository impl) | Same as Phase 2 |
| Storage | Local filesystem (via abstracted StorageService interface) | Supabase Storage (SupabaseStorageService impl) | Same as Phase 2 |
| Realtime | In-memory event emitter (via abstracted RealtimeService interface) | Supabase Realtime (SupabaseRealtimeService impl) | Same as Phase 2 |
| Config | Environment variables (local.env) | Environment-based switching (local.env / production.env) | Same as Phase 2 + Instagram settings |
| User Roles | Participant, Photo Moderator, Admin | Same as Phase 1 | Same as Phase 1 |
| Content Sources | Manual upload only | Same as Phase 1 | Content source abstraction + Instagram |
| Deployment | Local Deno (demo from laptop) | Deno Deploy | Same as Phase 2 |

### Phase Dependencies

- **Phase 2 depends on the abstraction interfaces built in Phase 1.** Phase 1 must design and implement Repository, StorageService, and RealtimeService interfaces with local implementations. Phase 2 then adds Supabase-specific implementations for each interface.
- **Phase 3 depends on the moderation queue and display wall from Phase 1 being stable.** Instagram submissions flow through the same moderation pipeline. Phase 3 may leverage the content source abstraction pattern established in Phase 2.
- Each phase delivers an independently testable and deployable product.

---

## 8. Change Log

| Date | Change |
|------|--------|
| 2026-05-17 | Reordered phased delivery plan: Phase 1 is now local-only MVP (no cloud dependency), Phase 2 adds cloud deployment (Deno Deploy + Supabase), Phase 3 remains Instagram integration. FR-26 (local-only requirement) implicitly satisfied by Phase 1. NFR-18 and NFR-19 (abstraction patterns) are now Phase 1 design requirements rather than Phase 2 additions. Architecture evolution table updated to reflect local-first progression. |
| 2026-05-11 | Restructured FRs to align with 3-persona model: split "Organiser Admin Panel" into Photo Moderation Panel (1.2), Password Management (1.3), Admin User Management (1.4). Renumbered FRs (was 18, now 24 Phase 1 FRs). Added FR-11 through FR-16 for password management and user management. Updated Phase 1 to include all 24 FRs. Updated Phase 2/3 FR numbering (was FR-19/FR-20, now FR-25/FR-26; was FR-21/FR-25, now FR-27/FR-31). Added Persona Model section. Updated Architecture Evolution table. Updated Phased Delivery Plan descriptions. |
