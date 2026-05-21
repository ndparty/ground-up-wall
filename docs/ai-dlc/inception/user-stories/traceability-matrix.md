# Traceability Matrix — ground-up-wall

Maps Functional Requirements (FRs) and Non-Functional Requirements (NFRs) to User Stories (US).

---

## Functional Requirements Traceability

### Phase 1 — MVP (Original Core)

| FR | Description | User Stories |
|:--:|-------------|:------------:|
| FR-01 | Submit photo without login or registration | US-01, US-02 |
| FR-02 | Capture photo, message (max 50 chars), name, optional social handle | US-01 |
| FR-02a | Data privacy notice on upload form | US-02a |
| FR-02b | Rejection disclaimer on upload form and success page | US-02a |
| FR-03 | Photos held in moderation queue until approved | US-01, US-04 |
| FR-04 | Success confirmation message after submission | US-01 |
| FR-05 | Accessible via QR code and short URL | US-02 |
| FR-06 | Separate organiser login page with username and password | US-03 |
| FR-07 | Moderation queue of pending submissions after login | US-04 |
| FR-08 | Approve or reject submissions (no notification on reject) | US-05 |
| FR-09 | Delete and edit approved submissions (edit with audit) | US-05, US-06 |
| FR-09a | Auto-moderator filter with visual flagging | US-12 |
| FR-10 | Approved submissions added chronologically (oldest first) | US-05, US-07 |
| FR-11 | Photo Moderators and Admins can change own password | US-11 |
| FR-12 | Password change requires current, new, confirmation | US-11 |
| FR-13 | Admin-only user management page (extended: create, disable, delete) | US-09, US-10, US-18 |
| FR-13a | System parameters configuration panel | US-14 |
| FR-14 | Admins create Moderator accounts with username and initial password | US-09 |
| FR-15 | Admins can reset passwords for existing Moderators | US-10 |
| FR-15a | Admins can disable moderator accounts | US-18 |
| FR-15b | Admins can delete moderator accounts (preserves audit) | US-18 |
| FR-15c | User management page shows active/disabled status | US-10, US-18 |
| FR-16 | Initial Admin credentials set by developer in backend | US-09 (implied) |
| FR-17 | Moving SMRT MRT train animation scrolling right to left | US-07 |
| FR-18 | Cabins display photo + message + name + optional social handle | US-07 |
| FR-19 | Configurable dwell time per cabin (default ~15s, range 3-60s) | US-07 |
| FR-20 | Smooth scroll animation — train moves left to next cabin | US-07 |
| FR-21 | Chronological cabin order (oldest first) | US-07 |
| FR-22 | New approved submissions added in real-time within 30 seconds | US-08 |
| FR-23 | Branded waiting screen when no submissions approved | US-07 |
| FR-24 | Full-screen browser display for HDMI-connected TV | US-07 |
| FR-24a | Pause/play/jump controls on display wall (moderator/admin only) | US-15 |
| FR-24b | Display wall visibility toggle in admin panel for non-logged-in users (admin only, moderators bypass) | US-16 |

### Phase 2 — Cloud Deployment (Not yet covered)

| FR | Description | User Stories |
|:--:|-------------|:------------:|
| FR-25 | Environment-based configuration (local.env, production.env) | _Not yet covered_ |

### Phase 3 — Instagram Integration (Not yet covered)

| FR | Description | User Stories |
|:--:|-------------|:------------:|
| FR-27 | Configure Instagram hashtag from admin panel | _Not yet covered_ |
| FR-28 | Periodically fetch public Instagram posts by hashtag | _Not yet covered_ |
| FR-29 | Instagram submissions enter moderation queue | _Not yet covered_ |
| FR-30 | Indicate submission source in moderation panel | _Not yet covered_ |
| FR-31 | Instagram settings configurable from admin panel or env vars | _Not yet covered_ |

---

## Non-Functional Requirements Traceability

| NFR | Description | User Stories |
|:---:|-------------|:------------:|
| NFR-01 | Responsive on mobile devices | US-NFR-01 |
| NFR-02 | Image upload completes in reasonable time on 4G/WiFi | US-NFR-04 |
| NFR-03 | Smooth animation at 60fps on modern laptop browser | US-NFR-02 |
| NFR-04 | New approved submissions appear within 30 seconds | US-08, US-05 |
| NFR-05 | Handle 200 concurrent users (peak) | US-NFR-04 |
| NFR-06 | Support up to 200 total submissions | US-NFR-02 |
| NFR-07 | Upload completable in 3 taps/steps | US-NFR-01 |
| NFR-08 | Legible from across room on TV (large fonts, high contrast) | US-NFR-01 |
| NFR-09 | Moderation and admin panels usable without training | US-04, US-05 |
| NFR-10 | Operational for full event duration (6–8 hours) | US-NFR-04 |
| NFR-11 | Display wall recovers from browser refresh without losing state | US-08 |
| NFR-12 | Supabase project kept active before event | US-NFR-04 |
| NFR-13 | Admin and moderation panels not publicly accessible | US-NFR-03 |
| NFR-14 | Image upload validation (file type and size limits) | US-NFR-03 |
| NFR-15 | No personal data beyond name and social handle; data privacy notice | US-02, US-02a, US-NFR-03 |
| NFR-16 | WCAG 2.1 AA accessibility (labels, contrast, keyboard nav) | US-NFR-01 |
| NFR-17 | Environment-only configuration switches (no code changes) | _Not yet covered (Phase 2)_ |
| NFR-18 | Repository pattern for data access abstraction | _Covered by Phase 1 architecture (interfaces defined in Phase 1, Supabase impl in Phase 2)_ |
| NFR-19 | Storage abstraction layer (local vs Supabase) | _Covered by Phase 1 architecture (interfaces defined in Phase 1, Supabase impl in Phase 2)_ |
| NFR-20 | Instagram fetching respects rate limits, graceful error handling | _Not yet covered (Phase 3)_ |
| NFR-21 | Content source abstraction pattern | _Not yet covered (Phase 3)_ |
| NFR-22 | Audit log for moderator/admin actions (append-only, filterable) | US-17, US-NFR-05 |

---

## Coverage Summary

| Category | Total | Covered | Coverage % | Notes |
|----------|:-----:|:-------:|:----------:|-------|
| FRs (Phase 1) | 30 | 30 | **100%** | Includes original 24 + Update 01: FR-02a, FR-02b, FR-09a, FR-13a, FR-15a, FR-15b, FR-15c, FR-24a, FR-24b; FR-19, FR-09, FR-13 updated |
| FRs (Phase 2) | 1 | 0 | **0%** | Phase 2 (FR-25 for env config) — stories to be created separately |
| FRs (Phase 3) | 5 | 0 | **0%** | Phase 3 — stories to be created separately |
| NFRs (Phase 1) | 19 | 19 | **100%** | Includes NFR-18, NFR-19 (Phase 1 abstraction interfaces) + NFR-22 (Update 01 audit log) |
| NFRs (Phase 2) | 1 | 0 | **0%** | Phase 2 (NFR-17 for env switching) — stories pending |
| NFRs (Phase 3) | 2 | 0 | **0%** | Phase 3 — Instagram stories pending |
| **Total (All)** | 58 | 49 | **84%** | 30 Phase 1 FRs + 19 Phase 1 NFRs = 49 covered; 9 Phase 2/3 pending |

---

## Update Log

| Date | Change |
|------|--------|
| 2026-05-21 | **Update 01**: Applied Update 01 requirements cascade. Added FR-02a, FR-02b, FR-09a, FR-13a, FR-15a, FR-15b, FR-15c, FR-24a, FR-24b. Updated FR-02 (prompt text), FR-09 (edit), FR-13 (disable/delete), FR-19 (configurable dwell). Added NFR-22 (audit log). Added stories US-02a, US-12, US-14, US-15, US-16, US-17, US-18, US-NFR-05. Phase 1 FR count: 24 → 30. Phase 1 NFR count: 18 → 19. |
| 2026-05-17 | Reordered phased delivery to match requirements.md update: Phase 1 = local MVP (all abstractions built here), Phase 2 = cloud deployment (FR-25 only, FR-26 folded into Phase 1), Phase 3 = Instagram integration. Updated NFR-18/19 to be Phase 1 design requirements. Updated coverage counts. |
| 2026-05-11 | Updated FR numbering to match restructured requirements.md: FR-01–FR-05 unchanged, FR-06–FR-10 for Photo Moderation Panel, new FR-11–FR-16 for Password Management + Admin User Management, old FR-11–FR-18 renumbered to FR-17–FR-24, Phase 2 FRs now FR-25/FR-26, Phase 3 FRs now FR-27–FR-31. Phase 1 FR count increased from 18 to 24. |