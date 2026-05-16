# Traceability Matrix — ground-up-wall

Maps Functional Requirements (FRs) and Non-Functional Requirements (NFRs) to User Stories (US).

---

## Functional Requirements Traceability

### Phase 1 — MVP

| FR | Description | User Stories |
|:--:|-------------|:------------:|
| FR-01 | Submit photo without login or registration | US-01, US-02 |
| FR-02 | Capture photo, message (max 50 chars), name, optional social handle | US-01 |
| FR-03 | Photos held in moderation queue until approved by Photo Moderator or Admin | US-01, US-04 |
| FR-04 | Success confirmation message after submission | US-01 |
| FR-05 | Accessible via QR code and short URL | US-02 |
| FR-06 | Separate organiser login page with username and password | US-03 |
| FR-07 | Moderation queue of pending submissions after login | US-04 |
| FR-08 | Approve or reject submissions | US-05 |
| FR-09 | Delete previously approved submissions | US-06 |
| FR-10 | Approved submissions added chronologically (oldest first) | US-05, US-07 |
| FR-11 | Photo Moderators and Admins can change their own password | US-11 |
| FR-12 | Password change requires current password, new password, confirmation | US-11 |
| FR-13 | Admin-only user management page for Photo Moderator accounts | US-09, US-10 |
| FR-14 | Admins create Moderator accounts with username and initial password | US-09 |
| FR-15 | Admins can reset passwords for existing Moderators | US-10 |
| FR-16 | Initial Admin credentials set by developer in backend | US-09 (implied) |
| FR-17 | Moving SMRT MRT train animation scrolling right to left | US-07 |
| FR-18 | Cabins display photo + message + name + optional social handle | US-07 |
| FR-19 | Each cabin visible ~15 seconds before transitioning | US-07 |
| FR-20 | Smooth scroll animation — train moves left to next cabin | US-07 |
| FR-21 | Chronological cabin order (oldest first) | US-07 |
| FR-22 | New approved submissions added in real-time within 30 seconds | US-08 |
| FR-23 | Branded waiting screen when no submissions approved | US-07 |
| FR-24 | Full-screen browser display for HDMI-connected TV | US-07 |

### Phase 2 — Local Development (Not yet covered)

| FR | Description | User Stories |
|:--:|-------------|:------------:|
| FR-25 | Environment-based configuration (local.env, production.env) | _Not yet covered_ |
| FR-26 | Run locally with Deno + Postgres without Supabase/Deno Deploy | _Not yet covered_ |

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
| NFR-15 | No personal data beyond name and social handle; no auth for participants | US-02, US-NFR-03 |
| NFR-16 | WCAG 2.1 AA accessibility (labels, contrast, keyboard nav) | US-NFR-01 |
| NFR-17 | Environment-only configuration switches (no code changes) | _Not yet covered (Phase 2)_ |
| NFR-18 | Repository pattern for data access abstraction | _Not yet covered (Phase 2)_ |
| NFR-19 | Storage abstraction layer (local vs Supabase) | _Not yet covered (Phase 2)_ |
| NFR-20 | Instagram fetching respects rate limits, graceful error handling | _Not yet covered (Phase 3)_ |
| NFR-21 | Content source abstraction pattern | _Not yet covered (Phase 3)_ |

---

## Coverage Summary

| Category | Total | Covered | Coverage % | Notes |
|----------|:-----:|:-------:|:----------:|-------|
| FRs (Phase 1) | 24 | 24 | **100%** | All Phase 1 requirements covered |
| FRs (Phase 2) | 2 | 0 | **0%** | Phase 2 — stories to be created separately |
| FRs (Phase 3) | 5 | 0 | **0%** | Phase 3 — stories to be created separately |
| NFRs (Phase 1) | 16 | 16 | **100%** | All Phase 1 NFRs covered |
| NFRs (Phase 2) | 3 | 0 | **0%** | Phase 2 — abstraction layer stories pending |
| NFRs (Phase 3) | 2 | 0 | **0%** | Phase 3 — Instagram stories pending |
| **Total (All)** | 52 | 40 | **77%** | Phase 2 & 3 stories expected for later |

---

## Update Log

| Date | Change |
|------|--------|
| 2026-05-11 | Updated FR numbering to match restructured requirements.md: FR-01–FR-05 unchanged, FR-06–FR-10 for Photo Moderation Panel, new FR-11–FR-16 for Password Management + Admin User Management, old FR-11–FR-18 renumbered to FR-17–FR-24, Phase 2 FRs now FR-25/FR-26, Phase 3 FRs now FR-27–FR-31. Phase 1 FR count increased from 18 to 24. |