# Requirements Traceability Matrix — ground-up-wall (Updated for Update 02)

## Purpose

This document maps all functional requirements (FR), non-functional requirements (NFR), and design requirements (DR) to the technical components that implement them. This ensures complete coverage and provides a reference for implementation and testing.

---

## Functional Requirements Traceability

### Photo Submission (FR-01 to FR-05)

| Requirement | Description | Components | Services | Verification |
|-------------|-------------|------------|----------|--------------|
| FR-01 | Any participant can submit photo without login | UploadComponent | PhotoWallService, StorageService | Test: Submit without auth |
| FR-02 | Upload form captures photo, message (configurable max length in characters or words, configurable prompt text), name, optional social handle, mandatory acknowledgment checkbox | UploadComponent | PhotoWallService | Test: Form validation |
| FR-02a | Data privacy notice (indefinite retention for social media, mandatory acknowledgment checkbox), warm tone (DR-04) | UploadComponent | PhotoWallService | Test: Privacy notice visible |
| FR-02b | Posting guidelines disclaimer on upload form and success page: re-submit advice, moderator editing notice, no rejection notifications | UploadComponent | PhotoWallService | Test: Disclaimer displayed |
| FR-03 | Submitted photos held in moderation queue | UploadComponent, ModerationComponent | PhotoWallService, Repository | Test: Pending status |
| FR-04 | Success message after submission | UploadComponent | PhotoWallService | Test: Success response |
| FR-05 | Upload page accessible via QR code and short URL | UploadComponent | - | Test: URL routing |

### Photo Moderation Panel (FR-06 to FR-10)

| Requirement | Description | Components | Services | Verification |
|-------------|-------------|------------|----------|--------------|
| FR-06 | Organiser login page on protected route | ModerationComponent, AuthComponent | PhotoWallService | Test: Protected route |
| FR-07 | Photo Moderators see moderation queue after login | ModerationComponent | PhotoWallService, Repository | Test: Queue display |
| FR-08 | Photo Moderators can approve or reject submissions (no notification on rejection) | ModerationComponent | PhotoWallService, Repository, AuditService | Test: Approve/reject |
| FR-09 | Photo Moderators can delete approved submissions AND edit content (message, name, social handle) of pending/approved submissions with audit trail | ModerationComponent | PhotoWallService, Repository, StorageService, AuditService | Test: Delete + edit approved |
| FR-09a | Auto-moderator content filter flags messages against configurable word list; visual indicator (highlighted/underlined) in moderation panel; advisory only; case-insensitive, Unicode, char substitution matching; ships with seeded PG-13 default word list | ModerationComponent | PhotoWallService, AutoModeratorService | Test: Flagged words highlighted |
| FR-10 | Approved submissions added to display rotation chronologically (oldest first) | DisplayComponent | PhotoWallService, Repository, RealtimeService | Test: Chronological order |

### Password Management (FR-11 to FR-12)

| Requirement | Description | Components | Services | Verification |
|-------------|-------------|------------|----------|--------------|
| FR-11 | Moderators and Admins can change own password | AuthComponent | PhotoWallService, Repository | Test: Change password |
| FR-12 | Password change requires current, new, and confirmation | AuthComponent | PhotoWallService, Repository | Test: Validation |

### Admin User Management (FR-13 to FR-16)

| Requirement | Description | Components | Services | Verification |
|-------------|-------------|------------|----------|--------------|
| FR-13 | Admin-only user management page for creating, managing, disabling, and deleting Photo Moderator AND Display Wall User accounts | AdminComponent | PhotoWallService, Repository, AuditService | Test: Admin-only access |
| FR-13a | System parameters configuration panel (train dwell time 3-60s, message prompt text, message length limit/unit, auto-moderator word list with seeded default, default placeholder image); persist to db; no restart needed; reset to default | AdminComponent | PhotoWallService, Repository, RealtimeService | Test: Configure params |
| FR-14 | Admins can create new Photo Moderator accounts with username and initial password | AdminComponent | PhotoWallService, Repository, AuditService | Test: Create moderator |
| FR-15 | Admins can reset passwords for moderators | AdminComponent | PhotoWallService, Repository, AuditService | Test: Reset password |
| FR-15a | Admins can disable moderator account (prevent login, preserve audit history) | AdminComponent | PhotoWallService, Repository, AuditService | Test: Disable moderator |
| FR-15b | Admins can delete moderator account with confirmation (preserve audit log references) | AdminComponent | PhotoWallService, Repository, AuditService | Test: Delete moderator |
| FR-15c | User management page shows active/disabled status | AdminComponent | PhotoWallService, Repository | Test: Status display |
| FR-16 | Initial Admin credentials set by developer in backend | Repository | - | Test: Manual setup |

### Display Wall (FR-17 to FR-24)

| Requirement | Description | Components | Services | Verification |
|-------------|-------------|------------|----------|--------------|
| FR-17 | Display wall shows moving SMRT train animation scrolling right to left | DisplayComponent | PhotoWallService | Code: `TrainDisplay.tsx`, `train.css`, `center_track.ts` |
| FR-18 | Train consists of cabins, each displaying photo + message + name + optional social handle | DisplayComponent | PhotoWallService | Code: `TrainCabin.tsx` |
| FR-19 | Configurable dwell time per cabin (default ~15s, range 3-60s, 1s increments) | DisplayComponent | PhotoWallService, Repository | Code: `train_playback_controller.ts`, `SystemParameters.tsx` |
| FR-20 | Transition between cabins uses smooth scroll animation — train physically moves left | DisplayComponent | PhotoWallService | Code: `TrainDisplay.tsx`, `center_track.ts`, `slide_duration.ts` |
| FR-21 | Cabin order is chronological (oldest first) | DisplayComponent | PhotoWallService, Repository | Code: `postgres_repository.getSubmissionsByStatus`, `train_view.ts` |
| FR-22 | New approved submissions added automatically in real-time (within 30s) | DisplayComponent | PhotoWallService, RealtimeService | Code: `events.ts` SSE, `use_train_playback.ts` |
| FR-23 | Branded waiting screen when no submissions approved | DisplayComponent | PhotoWallService | Code: `TrainDisplay.tsx` empty state |
| FR-24 | Display wall runs full-screen in browser on laptop/PC connected to TV via HDMI | DisplayComponent | - | Code: `train.css` fixed layout |
| FR-24a | Pause/play/jump-to-cabin controls on display wall (moderator/admin only); on refresh, restart from cabin 0 in playing state | DisplayComponent, AuthComponent | PhotoWallService, RealtimeService | Code: `TrainControls.tsx`, `train-command.ts`, `use_train_playback.ts` — see verification note |
| FR-24b | Display wall requires authentication (Display Wall User / Mod / Admin only); 403 for unauthenticated/participants; persisted auth model | DisplayComponent, AuthComponent | PhotoWallService, Repository | Code: `routes/display.tsx` |
| FR-24c | Display override controls (blank/placeholder/resume) from mod/admin panel; broadcast via RealtimeService; persisted state; auditable | ModerationComponent, AdminComponent, DisplayComponent | PhotoWallService, RealtimeService, Repository, AuditService | Code: `commandDisplayOverride`, `DisplayOverrideControls.tsx` |

---

## Non-Functional Requirements Traceability

### Performance (NFR-01 to NFR-04)

| Requirement | Description | Technical Strategy | Components | Verification |
|-------------|-------------|-------------------|------------|--------------|
| NFR-01 | Upload form responsive on mobile | Responsive CSS, mobile-first design | UploadComponent | Test: Mobile devices |
| NFR-02 | Image upload completes in reasonable time | Client-side compression, optimized upload | UploadComponent, StorageService | Test: Upload timing |
| NFR-03 | Display wall animates at 60fps | requestAnimationFrame, CSS transforms | DisplayComponent | Test: Performance profiling |
| NFR-04 | New submissions appear within 30 seconds | In-memory event emitter (Phase 1) / Supabase Realtime (Phase 2) | RealtimeService, DisplayComponent | Test: Real-time latency |

### Scalability (NFR-05 to NFR-06)

| Requirement | Description | Technical Strategy | Components | Verification |
|-------------|-------------|-------------------|------------|--------------|
| NFR-05 | Handle 200 concurrent users | Connection pooling, efficient queries | Repository, PhotoWallService | Test: Load testing |
| NFR-06 | Support 200 total submissions | Filesystem (Phase 1) / Supabase Storage 1GB (Phase 2) | StorageService | Test: Storage capacity |

### Usability (NFR-07 to NFR-09)

| Requirement | Description | Technical Strategy | Components | Verification |
|-------------|-------------|-------------------|------------|--------------|
| NFR-07 | Upload form completable in 3 taps | Minimal form fields, auto-focus | UploadComponent | Test: UX testing |
| NFR-08 | Display wall legible from across room | Large fonts (min 24px names, 18px messages), high contrast | DisplayComponent | Test: Visual inspection |
| NFR-09 | Moderation/admin panels simple for non-technical users | Clean UI, clear labels, intuitive workflow | ModerationComponent, AdminComponent | Test: User testing |

### Reliability (NFR-10 to NFR-12)

| Requirement | Description | Technical Strategy | Components | Verification |
|-------------|-------------|-------------------|------------|--------------|
| NFR-10 | System operational for full event duration | Error handling, graceful degradation | All services | Test: Uptime monitoring |
| NFR-11 | Display wall recovers from browser refresh | Load all approved submissions from server; train restarts from cabin 0 | DisplayComponent, RealtimeService | Test: Refresh recovery |
| NFR-12 | Supabase project kept active to prevent pausing | Monitoring, pre-event activation (Phase 2) | - | Test: Manual verification |

### Security (NFR-13 to NFR-15)

| Requirement | Description | Technical Strategy | Components | Verification |
|-------------|-------------|-------------------|------------|--------------|
| NFR-13 | Admin/moderation panels protected | Route guards, authentication | AuthComponent | Test: Access control |
| NFR-14 | Image uploads validated | File type/size validation | UploadComponent, StorageService | Test: Invalid uploads |
| NFR-15 | PII collected (name, photo, message, social handle); indefinite retention for social media; mandatory privacy acknowledgment checkbox (FR-02a) | Minimal data collection, privacy notice on form | UploadComponent, Repository | Test: Data audit |

### Accessibility (NFR-16)

| Requirement | Description | Technical Strategy | Components | Verification |
|-------------|-------------|-------------------|------------|--------------|
| NFR-16 | Upload form meets WCAG 2.1 AA | Proper labels, contrast, keyboard navigation | UploadComponent | Test: Accessibility audit |

### Audit & Accountability (NFR-22)

| Requirement | Description | Technical Strategy | Components | Verification |
|-------------|-------------|-------------------|------------|--------------|
| NFR-22 | Append-only audit log for moderator/admin actions; capture user ID, action type (including display override), target, old/new value, timestamp (UTC ms); filterable read-only view in Admin panel | Dedicated `audit_log` table, AuditService module, Admin UI with filtering | AuditService, AdminComponent, PhotoWallService, Repository | Test: Audit entry creation + integrity |

---

## Design Requirements Traceability

| Requirement | Description | Technical Strategy | Components | Verification |
|-------------|-------------|-------------------|------------|--------------|
| DR-01 | Realistic SMRT MRT train look (red/white) | CSS styling, SVG/CSS train graphics | DisplayComponent | Test: Visual design review |
| DR-02 | Singapore National Day branding (subtle) | Red/white color palette, national day motifs | DisplayComponent | Test: Visual design review |
| DR-03 | Festive and community-oriented feel | Appropriate typography, colors, spacing | All UI Components | Test: Visual design review |
| DR-04 | Warm, community-appropriate tone for all user-facing copy (privacy notice, disclaimer, success, errors) | Copywriting guidelines, DR-04 tone applied to all participant-facing text | UploadComponent, All components with user copy | Test: Copy review |

---

## Phase 2/3 Requirements Traceability

### Phase 2: Cloud Deployment (Deno Deploy + Supabase)

| Requirement | Description | Technical Strategy | Components | Verification |
|-------------|-------------|-------------------|------------|--------------|
| FR-25 | Environment-based configuration | .env files, environment detection | All services | Test: Config switching |
| NFR-17 | Switch environments with config only | Configuration-driven service selection | All services | Test: Environment switching |

> **Note**: FR-26 (run locally with Deno + Postgres) is implicitly satisfied by Phase 1 — Phase 1 builds the entire app against local Postgres, filesystem storage, and in-memory events. NFR-18 (repository pattern) and NFR-19 (storage abstraction) are Phase 1 design requirements — the abstract interfaces are defined and implemented locally in Phase 1, then re-implemented against Supabase in Phase 2.

### Cross-Phase Testing Strategy

The interface abstractions (Repository, StorageService, RealtimeService) create a natural seam for **contract testing**:

1. **Phase 1**: Write contract tests against each interface that verify:
   - All required methods exist with correct signatures
   - Local implementations (PostgresRepository, FileStorageService, MemoryRealtimeService) satisfy the contracts
   - Error cases are handled consistently (connection failures, invalid inputs, etc.)

2. **Phase 2**: Run the same contract tests against the Supabase implementations (SupabaseRepository, SupabaseStorageService, SupabaseRealtimeService). If all contract tests pass, the "no code changes needed" claim is validated automatically.

3. **Phase 3**: The InstagramService should have a test double (mock/fake) that implements the same interface, allowing the moderation pipeline to be tested independently of Instagram API availability.

### Phase 3: Instagram Integration

| Requirement | Description | Technical Strategy | Components | Verification |
|-------------|-------------|-------------------|------------|--------------|
| FR-27 | Admin configures Instagram hashtag | Hashtag configuration UI | AdminComponent | Test: Config UI |
| FR-28 | System fetches Instagram posts with hashtag | Instagram API integration | InstagramService (new) | Test: API integration |
| FR-29 | Instagram submissions enter moderation queue | Same moderation flow | ModerationComponent | Test: Queue integration |
| FR-30 | System indicates submission source | Source field in data model | ModerationComponent | Test: Source indicator |
| FR-31 | Instagram settings configurable | Admin panel or environment variables | AdminComponent | Test: Configuration |
| NFR-20 | Instagram fetching respects rate limits | Rate limiting, error handling | InstagramService (new) | Test: Rate limit handling |
| NFR-21 | Content source abstraction pattern | Interface-based content source abstraction | ContentSourceService (new) | Test: Interface compliance |

---

## Component Coverage Summary

| Component | FRs Covered | NFRs Covered | DRs Covered |
|-----------|-------------|--------------|-------------|
| UploadComponent | FR-01, FR-02, FR-02a, FR-02b, FR-03, FR-04, FR-05 | NFR-01, NFR-02, NFR-07, NFR-14, NFR-15, NFR-16 | DR-03, DR-04 |
| DisplayComponent | FR-10, FR-17, FR-18, FR-19, FR-20, FR-21, FR-22, FR-23, FR-24, FR-24a, FR-24b, FR-24c | NFR-03, NFR-04, NFR-08, NFR-11 | DR-01, DR-02, DR-03 |
| ModerationComponent | FR-03, FR-06, FR-07, FR-08, FR-09, FR-09a, FR-10, FR-24c | NFR-09 | - |
| AdminComponent | FR-13 (updated), FR-13a (updated), FR-14, FR-15, FR-15a, FR-15b, FR-15c, FR-24b, FR-24c | NFR-09, NFR-22 | - |
| AuthComponent | FR-06, FR-11, FR-12, FR-24a, FR-24b | NFR-13 | - |
| PhotoWallService | All FRs (orchestration) | NFR-05, NFR-10, NFR-17 | - |
| Repository | FR-03, FR-10, FR-13, FR-13a, FR-16, FR-19, FR-24b | NFR-05, NFR-18 | - |
| StorageService | FR-01, FR-02 | NFR-02, NFR-06, NFR-19 | - |
| RealtimeService | FR-22, FR-24a | NFR-04, NFR-11 | - |
| AuditService | FR-08, FR-09, FR-13, FR-13a, FR-14, FR-15, FR-15a, FR-15b | NFR-22 | - |
| AutoModeratorService | FR-09a | - | - |

---

## Verification Checklist

### All Requirements Covered

- [x] FR-01 to FR-24c: All mapped to components and services (31 Phase 1 FRs)
- [x] NFR-01 to NFR-16 + NFR-22: All mapped with technical strategies (19 Phase 1 NFRs)
- [x] DR-01 to DR-04: All mapped to components (4 DRs)
- [x] Phase 2 requirements (FR-25, NFR-17): All mapped
- [x] Phase 3 requirements (FR-27 to FR-31, NFR-20, NFR-21): All mapped

> **Note**: FR-26 (local-only requirement) is absorbed into Phase 1. NFR-18 (repository pattern) and NFR-19 (storage abstraction) are Phase 1 design requirements, built in Phase 1 to enable Phase 2 cloud deployment.

### Traceability Completeness

| Category | Total | Covered | Coverage |
|----------|-------|---------|----------|
| Functional Requirements (Phase 1) | 31 | 31 | 100% |
| Non-Functional Requirements (Phase 1) | 19 | 19 | 100% |
| Design Requirements | 4 | 4 | 100% |
| Phase 2 Requirements | 2 | 2 | 100% |
| Phase 3 Requirements | 8 | 8 | 100% |
| **Total** | **64** | **64** | **100%** |

---

## Implementation Priority

Based on the phased delivery plan:

### Phase 1 (Local MVP) — Implement First
- All FR-01 to FR-24c (31 FRs including Update 01 + Update 02)
- All NFR-01 to NFR-16 plus NFR-22 (19 NFRs)
- NFR-18 (repository pattern abstraction), NFR-19 (storage abstraction)
- All DR-01 to DR-04

### Phase 2 (Cloud Deployment) — Implement Second
- FR-25 (environment-based configuration)
- NFR-17 (environment switching)
- SupabaseRepository, SupabaseStorageService, SupabaseRealtimeService implementations

### Phase 3 (Instagram Integration) — Implement Last
- FR-27 to FR-31
- NFR-20, NFR-21