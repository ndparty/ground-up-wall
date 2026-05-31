# Requirements Update 02 — ground-up-wall

**Date**: 2026-06-01
**Source**: PR #3 review feedback (Liwei, 3rd meeting 25 May 2026 + follow-up clarifications)

---

## Summary of Changes

This document defines the deltas to apply to `requirements.md`. Each entry specifies whether it is an **Addition**, **Modification**, or **Clarification** and references the affected section/FR/NFR/DR.

| # | Type | Affected | Description | Phase |
|---|------|----------|-------------|-------|
| 1 | Modification | FR-02 | Message length limit configurable (characters or words) | Phase 1 |
| 2 | Modification | FR-02a | Data retained indefinitely for social media; mandatory acknowledgment checkbox | Phase 1 |
| 3 | Modification | FR-02b | Posting-guidelines rejection framing; re-submit advice; moderator editing notice | Phase 1 |
| 4 | Extension | FR-09a | Ship seeded PG-13 default word list | Phase 1 |
| 5 | Modification | FR-24b | Replace visibility toggle with Display Wall User account; remove participant wall viewing | Phase 1 |
| 6 | Addition | FR-24c | Blank screen / placeholder image controls from mod/admin panel | Phase 1 |
| 7 | Modification | FR-13, FR-13a | Admin manages Display Wall accounts; system params: message length, default placeholder | Phase 1 |
| 8 | Modification | DR-04 | Align warm-tone example copy with indefinite retention for social media | Phase 1 |
| 9 | Modification | Persona Model | Add Display Wall User role; remove Participant wall viewing | Phase 1 |
| 10 | Modification | NFR-15 | Note indefinite retention and social posting purpose | Phase 1 |
| 11 | Modification | NFR-22 | Add audit action types for display override commands | Phase 1 |
| 12 | Modification | §6 | Update R-06 (PII/PDPA) for indefinite retention | Phase 1 |
| 13 | Modification | §7 | Phase 1 scope expanded to include Update 02 items | Phase 1 |

---

## 1. Functional Requirements — Modifications & Additions

### 1.1 Photo Submission (Participant Upload)

**FR-02 — Modification (Configurable Message Length):**
Update the message field specification:

- **FR-02 (updated)**: The upload form must capture:
  - Photo (image file)
  - Short message — with a configurable maximum length and a configurable prompt text displayed as the input placeholder
  - Submitter's name
  - Optional social handle
- The maximum message length shall be configurable by an Admin via the system parameters panel (see §1.4). The Admin can select the unit of measurement: **characters** or **words**. Default: 50 characters.
- The prompt text shall be configurable by an Admin via the system parameters panel. The default prompt text shall be: *"What does National Day mean to you?"*
- When the unit is set to "characters", the limit counts Unicode code points. When set to "words", the limit counts space-separated tokens. The upload form shall display a live counter showing remaining capacity in the selected unit.

**FR-02a — Modification (Data Privacy Notice + Mandatory Acknowledgment):**
Replace the existing FR-02a text:

- **FR-02a (updated)**: The upload form shall display a concise data privacy notice before submission, informing participants:
  - That their name, message, photo, and optional social handle will be displayed on the photowall during the event
  - That submission data (including photos) will be **retained indefinitely** by the organisers for social media use — if an Instagram handle is provided, the content may be posted on social media with tagging to their handle
  - A link or reference to contact an organiser for questions
- The privacy notice language shall follow the warm, community-appropriate tone defined in DR-04.
- The upload form shall include a **mandatory acknowledgment checkbox** that the participant must check before the submit button is enabled. The checkbox label shall state that the participant has read and understood the privacy notice and posting guidelines.

**FR-02b — Modification (Posting Guidelines Disclaimer):**
Replace the existing FR-02b text:

- **FR-02b (updated)**: The upload form and success page shall include a posting guidelines disclaimer informing participants:
  - That if their submission does not appear on the display wall within a reasonable time, it may have been rejected because it did not conform to the posting guidelines
  - That participants are encouraged to review the posting guidelines and re-submit if they believe their original submission was rejected
  - That moderators may edit submission content (message, name, social handle) to bring it into conformance with posting guidelines
- The disclaimer shall NOT imply that rejection notifications will be sent.
- The disclaimer tone shall follow DR-04 (warm, community-appropriate).

---

### 1.2 Photo Moderation Panel

**FR-09a — Extension (Seeded Default Word List):**
Add to the existing FR-09a:

- The system shall ship with a **seeded default word list** containing typical profanity and explicit terms appropriate for a PG-13 audience. This list serves as the starting point for the auto-moderator filter.
- The seeded list is fully editable by Admins via the system parameters panel.
- The "Reset to default" action for the auto-moderator word list shall restore the seeded default list.

---

### 1.4 Admin User Management

**FR-13 — Modification (Display Wall Account Management):**
Extend the user management page:

- **FR-13 (updated)**: An Admin-only user management page exists for creating, managing, disabling, and deleting **Photo Moderator** and **Display Wall User** accounts.
- Admins can create, disable, and delete Display Wall accounts using the same pattern as moderator accounts (username + password, with disable/delete support).
- The user management page shall display the role (Photo Moderator or Display Wall User) and active/disabled status of each account.

**FR-13a — Extension (Additional System Parameters):**
Add these parameters to the existing system parameters panel:

- **Message length limit**: The maximum length for the upload form message field. Default: 50.
- **Message length unit**: The unit of measurement for the message length limit — `characters` or `words`. Default: `characters`.
- **Default placeholder image**: An image uploaded by the Admin to be used as the display wall placeholder (see FR-24c). The image shall be stored in system config / filesystem storage. The Admin can replace or remove the default placeholder at any time.
- Changes to message length parameters shall take effect without requiring a server restart (via RealtimeService broadcast or polling).

---

### 1.5 Display Wall (TV Screen)

**FR-24b — Modification (Display Wall Access Model):**
Replace the existing FR-24b (visibility toggle) with:

- **FR-24b (revised)**: The display wall route shall require authentication. Access is restricted to accounts with the **Display Wall User**, **Photo Moderator**, or **Admin** role. Unauthenticated users and Participants **cannot** access the display wall route — they shall receive a 403 response with the message: "Access not allowed. Please refer to the organiser's screen instead."
- The Display Wall User is a dedicated account type for the TV/display device. Admins create and manage these accounts via the user management page (see FR-13 updated).
- Photo Moderators and Admins retain full access to the display wall for preview and control purposes (train controls remain available when logged in as mod/admin).
- The Display Wall User account does not inherit Participant upload capabilities — it can only view the train animation.

**FR-24c — Addition (Display Override Controls):**
- From the **moderation panel** or **admin panel**, Photo Moderators and Admins can command all connected display wall sessions to show one of the following states:
  - **(a) Blank/black screen** — the display wall renders a solid black screen, hiding the train animation
  - **(b) Placeholder image** — the display wall renders the system-wide default placeholder image (configured via FR-13a), or a per-action override image selected at the time of the command
  - **(c) Resume normal display** — the display wall returns to the train animation from its current position
- The display override state shall be broadcast to all connected display wall sessions via RealtimeService.
- Display override commands shall be auditable (see NFR-22 updated action types).
- The display override state shall be persisted in the database so that new display wall sessions connecting after the command also show the correct state.

---

## Persona Model — Modification

Replace the existing 3-persona hierarchy with a **4-role model**:

```
Admin → inherits → Photo Moderator → inherits → Participant (base, upload only)
Display Wall User (TV account — view train display only; admin-created; separate from inherit chain)
```

**Key changes**:
- Participant capabilities reduced: upload photo + view success page only; **no display wall viewing**
- Display Wall User is a new role type for the TV/display device — can view the train animation but cannot upload, moderate, or administer
- Admin gains the ability to create/manage/disable/delete Display Wall accounts (extending FR-13/FR-14 pattern)

---

## 2. Non-Functional Requirements — Modifications

**NFR-15 — Modification (Indefinite Retention Notice):**
Update the existing note on NFR-15:

> **NOTE**: The system collects name, photo, message, and optional social handle, which constitute personal data (PII) under applicable privacy regulations. Submission data is retained indefinitely for organiser social media use — participants are informed of this via FR-02a. If an Instagram handle is provided, content may be posted on social media with tagging. A data privacy notice with mandatory acknowledgment shall be displayed on the upload form (see FR-02a).

**NFR-22 — Modification (Additional Audit Action Types):**
Add the following action types to the NFR-22 audit log:

- `blank_display` — Mod/Admin blanked the display wall
- `show_placeholder` — Mod/Admin showed a placeholder image on the display wall
- `resume_display` — Mod/Admin resumed normal train animation
- `set_default_placeholder` — Admin set/replaced the default placeholder image
- `create_display_wall_user` — Admin created a Display Wall User account
- `disable_display_wall_user` — Admin disabled a Display Wall User account
- `delete_display_wall_user` — Admin deleted a Display Wall User account

---

## 3. Design & Branding Requirements — Modifications

**DR-04 — Modification (Updated Example Copy):**
Replace the existing warm-tone example:

- Old: *"We'll display your name and photo on the photowall during the party! Your info won't be stored after the event."*
- New: *"We'll display your name and photo on the photowall during the party! Your photo and info may also be shared on our social media after the event — if you've shared your Instagram handle, we might tag you too!"*

The replacement reflects the confirmed indefinite retention policy for social media use.

---

## 6. Open Questions / Risks — Modifications

| # | Item | Notes |
|---|------|-------|
| R-06 | PII and data privacy (updated) | Name, photo, and social handle constitute PII. Data is retained **indefinitely** for social media posting purposes. A data privacy notice with **mandatory acknowledgment checkbox** (FR-02a) informs participants of this. Singapore PDPA compliance should be reviewed given indefinite retention — consider whether explicit consent (checkbox) satisfies requirements or whether a separate privacy policy document is needed. |
| R-09 | Display Wall User credential management | Display Wall User accounts are admin-created. The TV device must remain logged in for the event duration. If the browser session expires or the device loses power, the organiser must re-enter Display Wall credentials. Consider whether a "remember me" / extended session option is needed for Display Wall accounts specifically. |

---

## 7. Phased Delivery Plan — Update

### Phase 1: MVP — Local Deno Application (Updated)

**Goal**: Core functionality running entirely locally on the developer's machine, including the original feature set AND the Update 01 + Update 02 enhancements.

**Included Requirements (Updated)**:
- **Original**: FR-01 through FR-24, NFR-01 through NFR-16, DR-01 through DR-03
- **Update 01 additions**: FR-02a, FR-02b, FR-08 (clarified), FR-09 (extended), FR-09a, FR-13 (extended), FR-13a, FR-15a, FR-15b, FR-15c, FR-19 (updated), FR-24a, FR-24b, NFR-22, DR-04
- **Update 02 modifications**: FR-02 (configurable length), FR-02a (indefinite retention + checkbox), FR-02b (posting guidelines), FR-09a (seeded word list), FR-13 (Display Wall accounts), FR-13a (length params + placeholder), FR-24b (revised — auth-only access), FR-24c (new — display override), NFR-15 (updated), NFR-22 (new action types), DR-04 (updated copy), Persona Model (4 roles)

**Testable Deliverable (Updated)**: Fully functional photowall system running on localhost with Deno + Postgres + filesystem storage. All features — upload (with configurable message length, privacy acknowledgment checkbox), moderation (with editing, auto-flagging with seeded default word list), admin panels (user management for moderators and display wall accounts, system parameters, audit log, display override controls), display wall (auth-only access, configurable timing, pause/play/jump, blank/placeholder support), password management — work end-to-end without internet connectivity or cloud accounts.

**Phase 1 Exit Criteria (Updated)**:
1. All FR-01 to FR-24 pass end-to-end testing against local Postgres + filesystem storage
2. All Update 01 FRs pass acceptance testing
3. All Update 02 FRs (FR-02 updated, FR-02a updated, FR-02b updated, FR-09a extended, FR-13 updated, FR-13a extended, FR-24b revised, FR-24c new) pass acceptance testing
4. NFR-03 (60fps animation) confirmed on target laptop/display hardware
5. NFR-04 (real-time updates within 30s) verified with local real-time mechanism
6. NFR-22 (audit log) verified — all auditable actions (including Update 02 display override types) produce correct log entries
7. Display Wall User login and display-only access verified end-to-end
8. Organiser sign-off on upload, moderation, admin panels, and display workflows
9. Contract tests written for Repository, StorageService, and RealtimeService interfaces (reusable in Phase 2)

---

## Architecture Evolution Strategy — Update

| Concern | Phase 1 (with Update 01) | Phase 1 (with Update 02) | Phase 2 | Phase 3 |
|---------|--------------------------|--------------------------|---------|---------|
| User Roles | Participant, Photo Mod, Admin | Participant (upload only), Photo Mod, Admin, **Display Wall User** | Same as Phase 1 | Same as Phase 1 |
| Display Access | Visibility toggle (admin) | **Auth-required** (Display Wall User / Mod / Admin only) | Same as Phase 1 | Same as Phase 1 |
| Display Override | Not present | **Blank / placeholder / resume** controls (from mod/admin panel) | Same as Phase 1 | Same as Phase 1 |
| Storage | Local filesystem | Local filesystem + **placeholder image storage** | Supabase Storage | Same as Phase 2 |
| Config | Env vars + db-backed system params | Same + **message length/unit, default placeholder, seeded word list** | Environment-based switching | Same as Phase 2 + Instagram settings |

---

## 8. Change Log — Update

| Date | Change |
|------|--------|
| 2026-06-01 | **Update 02**: Applied PR #3 review feedback (Liwei, 25 May meeting + follow-up clarifications). Modified: configurable message length with character/word unit selection (FR-02 update), indefinite data retention with mandatory privacy acknowledgment checkbox (FR-02a update), posting-guidelines disclaimer with re-submit advice and moderator editing notice (FR-02b update), seeded PG-13 default word list (FR-09a extension), Display Wall User authentication model replacing visibility toggle (FR-24b revision + persona model change to 4 roles), display override controls for blank/placeholder from mod/admin panel (FR-24c new), Display Wall account management in admin (FR-13/FR-13a extension), warm-tone example copy updated for social media retention (DR-04 update). Added R-09 (Display Wall credential management). Updated Phase 1 scope and exit criteria. |
