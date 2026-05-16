# Requirements Traceability Matrix — ground-up-wall

## Purpose

This document maps all functional requirements (FR), non-functional requirements (NFR), and design requirements (DR) to the technical components that implement them. This ensures complete coverage and provides a reference for implementation and testing.

---

## Functional Requirements Traceability

### Photo Submission (FR-01 to FR-05)

| Requirement | Description | Components | Services | Verification |
|-------------|-------------|------------|----------|--------------|
| FR-01 | Any participant can submit photo without login | UploadComponent | PhotoWallService, StorageService | Test: Submit without auth |
| FR-02 | Upload form captures photo, message (max 50 chars), name, optional social handle | UploadComponent | PhotoWallService | Test: Form validation |
| FR-03 | Submitted photos held in moderation queue | UploadComponent, ModerationComponent | PhotoWallService, Repository | Test: Pending status |
| FR-04 | Success message after submission | UploadComponent | PhotoWallService | Test: Success response |
| FR-05 | Upload page accessible via QR code and short URL | UploadComponent | - | Test: URL routing |

### Photo Moderation Panel (FR-06 to FR-10)

| Requirement | Description | Components | Services | Verification |
|-------------|-------------|------------|----------|--------------|
| FR-06 | Organiser login page on protected route | ModerationComponent, AuthComponent | PhotoWallService | Test: Protected route |
| FR-07 | Photo Moderators see moderation queue after login | ModerationComponent | PhotoWallService, Repository | Test: Queue display |
| FR-08 | Photo Moderators can approve or reject submissions | ModerationComponent | PhotoWallService, Repository | Test: Approve/reject |
| FR-09 | Photo Moderators can delete approved submissions | ModerationComponent | PhotoWallService, Repository, StorageService | Test: Delete approved |
| FR-10 | Approved submissions added to display rotation chronologically | DisplayComponent | PhotoWallService, Repository, RealtimeService | Test: Chronological order |

### Password Management (FR-11 to FR-12)

| Requirement | Description | Components | Services | Verification |
|-------------|-------------|------------|----------|--------------|
| FR-11 | Moderators and Admins can change own password | AuthComponent | PhotoWallService, Repository | Test: Change password |
| FR-12 | Password change requires current, new, and confirmation | AuthComponent | PhotoWallService, Repository | Test: Validation |

### Admin User Management (FR-13 to FR-16)

| Requirement | Description | Components | Services | Verification |
|-------------|-------------|------------|----------|--------------|
| FR-13 | Admin-only user management page | AdminComponent | PhotoWallService | Test: Admin-only access |
| FR-14 | Admins can create new Photo Moderator accounts | AdminComponent | PhotoWallService, Repository | Test: Create moderator |
| FR-15 | Admins can reset passwords for moderators | AdminComponent | PhotoWallService, Repository | Test: Reset password |
| FR-16 | Initial Admin credentials set by developer in backend | Repository | - | Test: Manual setup |

### Display Wall (FR-17 to FR-24)

| Requirement | Description | Components | Services | Verification |
|-------------|-------------|------------|----------|--------------|
| FR-17 | Display wall shows moving SMRT train animation | DisplayComponent | PhotoWallService | Test: Animation renders |
| FR-18 | Train consists of cabins, each displaying one submission | DisplayComponent | PhotoWallService | Test: Cabin display |
| FR-19 | Display focuses on one cabin at a time (~15 seconds) | DisplayComponent | PhotoWallService | Test: Timing |
| FR-20 | Transition between cabins uses smooth scroll animation | DisplayComponent | PhotoWallService | Test: Smooth transition |
| FR-21 | Cabin order is chronological (oldest first) | DisplayComponent | PhotoWallService, Repository | Test: Chronological order |
| FR-22 | New approved submissions added automatically (real-time) | DisplayComponent | PhotoWallService, RealtimeService | Test: Real-time update |
| FR-23 | Waiting screen when no submissions exist | DisplayComponent | PhotoWallService | Test: Empty state |
| FR-24 | Display wall runs full-screen in browser | DisplayComponent | - | Test: Full-screen mode |

---

## Non-Functional Requirements Traceability

### Performance (NFR-01 to NFR-04)

| Requirement | Description | Technical Strategy | Components | Verification |
|-------------|-------------|-------------------|------------|--------------|
| NFR-01 | Upload form responsive on mobile | Responsive CSS, mobile-first design | UploadComponent | Test: Mobile devices |
| NFR-02 | Image upload completes in reasonable time | Client-side compression, optimized upload | UploadComponent, StorageService | Test: Upload timing |
| NFR-03 | Display wall animates at 60fps | requestAnimationFrame, CSS transforms | DisplayComponent | Test: Performance profiling |
| NFR-04 | New submissions appear within 30 seconds | Supabase Realtime (websockets) | RealtimeService, DisplayComponent | Test: Real-time latency |

### Scalability (NFR-05 to NFR-06)

| Requirement | Description | Technical Strategy | Components | Verification |
|-------------|-------------|-------------------|------------|--------------|
| NFR-05 | Handle 200 concurrent users | Supabase connection pooling, efficient queries | Repository, PhotoWallService | Test: Load testing |
| NFR-06 | Support 200 total submissions | Supabase Storage (1GB free tier) | StorageService | Test: Storage capacity |

### Usability (NFR-07 to NFR-09)

| Requirement | Description | Technical Strategy | Components | Verification |
|-------------|-------------|-------------------|------------|--------------|
| NFR-07 | Upload form completable in 3 taps | Minimal form fields, auto-focus | UploadComponent | Test: UX testing |
| NFR-08 | Display wall legible from across room | Large fonts, high contrast | DisplayComponent | Test: Visual inspection |
| NFR-09 | Moderation/admin panels simple for non-technical users | Clean UI, clear labels, intuitive workflow | ModerationComponent, AdminComponent | Test: User testing |

### Reliability (NFR-10 to NFR-12)

| Requirement | Description | Technical Strategy | Components | Verification |
|-------------|-------------|-------------------|------------|--------------|
| NFR-10 | System operational for full event duration | Error handling, graceful degradation | All services | Test: Uptime monitoring |
| NFR-11 | Display wall recovers from browser refresh | Local state persistence, reconnection logic | DisplayComponent, RealtimeService | Test: Refresh recovery |
| NFR-12 | Supabase project kept active to prevent pausing | Monitoring, pre-event activation | - | Test: Manual verification |

### Security (NFR-13 to NFR-15)

| Requirement | Description | Technical Strategy | Components | Verification |
|-------------|-------------|-------------------|------------|--------------|
| NFR-13 | Admin/moderation panels protected | Route guards, authentication | AuthComponent | Test: Access control |
| NFR-14 | Image uploads validated | File type/size validation | UploadComponent, StorageService | Test: Invalid uploads |
| NFR-15 | No personal data beyond name/social handle | Minimal data collection | UploadComponent, Repository | Test: Data audit |

### Accessibility (NFR-16)

| Requirement | Description | Technical Strategy | Components | Verification |
|-------------|-------------|-------------------|------------|--------------|
| NFR-16 | Upload form meets WCAG 2.1 AA | Proper labels, contrast, keyboard navigation | UploadComponent | Test: Accessibility audit |

---

## Design Requirements Traceability

| Requirement | Description | Technical Strategy | Components | Verification |
|-------------|-------------|-------------------|------------|--------------|
| DR-01 | Realistic SMRT MRT train look (red/white) | CSS styling, SVG/CSS train graphics | DisplayComponent | Test: Visual design review |
| DR-02 | Singapore National Day branding (subtle) | Red/white color palette, national day motifs | DisplayComponent | Test: Visual design review |
| DR-03 | Festive and community-oriented feel | Appropriate typography, colors, spacing | All UI Components | Test: Visual design review |

---

## Phase 2/3 Requirements Traceability

### Phase 2: Cloud Deployment (Deno Deploy + Supabase)

| Requirement | Description | Technical Strategy | Components | Verification |
|-------------|-------------|-------------------|------------|--------------|
| FR-25 | Environment-based configuration | .env files, environment detection | All services | Test: Config switching |
| NFR-17 | Switch environments with config only | Configuration-driven service selection | All services | Test: Environment switching |

> **Note**: FR-26 (run locally with Deno + Postgres) is implicitly satisfied by Phase 1 — Phase 1 builds the entire app against local Postgres, filesystem storage, and in-memory events. NFR-18 (repository pattern) and NFR-19 (storage abstraction) are Phase 1 design requirements — the abstract interfaces are defined and implemented locally in Phase 1, then re-implemented against Supabase in Phase 2.

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
| UploadComponent | FR-01, FR-02, FR-03, FR-04, FR-05 | NFR-01, NFR-02, NFR-07, NFR-14, NFR-16 | DR-03 |
| DisplayComponent | FR-17, FR-18, FR-19, FR-20, FR-21, FR-22, FR-23, FR-24 | NFR-03, NFR-04, NFR-08, NFR-11 | DR-01, DR-02, DR-03 |
| ModerationComponent | FR-06, FR-07, FR-08, FR-09, FR-10 | NFR-09 | - |
| AdminComponent | FR-13, FR-14, FR-15 | NFR-09 | - |
| AuthComponent | FR-11, FR-12 | NFR-13 | - |
| PhotoWallService | All FRs (orchestration) | NFR-05, NFR-10, NFR-17 | - |
| Repository | FR-03, FR-10, FR-16 | NFR-05, NFR-18 | - |
| StorageService | FR-01, FR-02 | NFR-02, NFR-06, NFR-19 | - |
| RealtimeService | FR-22 | NFR-04, NFR-11 | - |

---

## Verification Checklist

### All Requirements Covered

- [x] FR-01 to FR-24: All mapped to components and services
- [x] NFR-01 to NFR-16: All mapped with technical strategies
- [x] DR-01 to DR-03: All mapped to display components
- [x] Phase 2 requirements (FR-25, NFR-17): All mapped
- [x] Phase 3 requirements (FR-27 to FR-31, NFR-20, NFR-21): All mapped

> **Note**: FR-26 (local-only requirement) is absorbed into Phase 1. NFR-18 (repository pattern) and NFR-19 (storage abstraction) are Phase 1 design requirements, built in Phase 1 to enable Phase 2 cloud deployment.

### Traceability Completeness

| Category | Total | Covered | Coverage |
|----------|-------|---------|----------|
| Functional Requirements (Phase 1) | 24 | 24 | 100% |
| Non-Functional Requirements (Phase 1) | 18 | 18 | 100% |
| Design Requirements | 3 | 3 | 100% |
| Phase 2 Requirements | 2 | 2 | 100% |
| Phase 3 Requirements | 8 | 8 | 100% |
| **Total** | **55** | **55** | **100%** |

---

## Implementation Priority

Based on the phased delivery plan:

### Phase 1 (Local MVP) — Implement First
- All FR-01 to FR-24
- All NFR-01 to NFR-16
- NFR-18 (repository pattern abstraction), NFR-19 (storage abstraction)
- All DR-01 to DR-03

### Phase 2 (Cloud Deployment) — Implement Second
- FR-25 (environment-based configuration)
- NFR-17 (environment switching)
- SupabaseRepository, SupabaseStorageService, SupabaseRealtimeService implementations

### Phase 3 (Instagram Integration) — Implement Last
- FR-27 to FR-31
- NFR-20, NFR-21
