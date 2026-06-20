# Requirements Update 04 — ground-up-wall

**Date**: 2026-06-20
**Source**: Post-Update-03 hardening pass — display invariant (FR-20a) and public-surface cybersecurity (NFR-23)

---

## Summary of Changes

| # | Type | Affected | Description |
|---|------|----------|-------------|
| 1 | Addition | FR-20a | Off-screen node-list mutation invariant for the display train |
| 2 | Addition | NFR-23 | Public-surface cybersecurity hardening (headers, rate limiting, login lockout, admin-toggleable proof-of-work) |

---

## 1. Functional Requirements

### FR-20a — Addition (Off-screen node-list mutation invariant)

- **FR-20a**: Any temporary mutation of the train's cabin list — the ephemeral insertion/removal used to preview a newly approved submission ahead of the current cabin (FR-22), and the collapse/restore used during a jump (FR-24a) — shall occur strictly **outside** the visible window (the centered cabin and the K cabins on each side). Such mutations shall never change the identity, content, or on-screen position of any cabin currently within the visible band. A previewed submission shall scroll in from beyond the right edge and its preview shall be retired only after it has passed beyond the left edge.
- **Exception**: when the total number of approved cabins is less than or equal to the visible slot count (2K+1), the entire ring is on-screen and an append is unavoidably visible; in that case the submission is appended chronologically with no ephemeral surgery.

**Implementation note (code is source of truth):** `lib/train/train_view.ts` — `applyEphemeralInsert` anchors the preview at slot +K (rendering it at +K+1, just outside the band); `walkBaseNextSkippingCollapsed` and `getRenderWindow`/`getJumpRenderWindow` skip an active insert's base-ring position so it renders only at its splice slot; `updateEphemeralVisibility` evicts an insert only after it has been seen and crossed the left edge (signed effective slot < -K). Jump collapse already keeps the first K and last K cabins and only collapses strictly between V+K and T-K.

---

## 2. Non-Functional Requirements

### NFR-23 — Addition (Public-surface cybersecurity hardening)

The application is exposed to the public internet (participant upload is unauthenticated). The system shall harden its public surface:

- **Security response headers** on all responses: `Content-Security-Policy` (restrict script/style/img sources), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, and `Strict-Transport-Security` in deployed (HTTPS) environments.
- **Session cookie hardening**: `HttpOnly` and `SameSite` always; `Secure` in deployed environments.
- **Request body-size guard**: reject oversized requests on the public upload endpoint before buffering the body.
- **Rate limiting**: per-IP limits on the public upload endpoint and the login endpoint.
- **Login brute-force protection**: temporary lockout/throttle after repeated failed attempts (keyed by username + IP), with failures recorded in the audit log.
- **Admin-toggleable proof-of-work (PoW) challenge** gating BOTH public upload and login: when the `pow_challenge_enabled` system parameter is on, clients must solve a server-issued PoW challenge and present the token; the server verifies it as a cheap, early no-op (before reading the request body, before bcrypt) so failed/missing tokens are rejected without significant server work. Nonces are single-use. When the flag is off, the challenge is skipped.

**Constraints**: implemented within free-tier / no third-party services (C-06); rate-limit, lockout, and PoW nonce stores are in-memory (single-instance in Phase 1) and reset on restart.

---

## Documents Updated
- `docs/ai-dlc/inception/requirements/requirements.md` — FR-20a added; NFR-23 added; FR-02a/FR-02/FR-24a/NFR-07/NFR-11 reworded (see Update 04 change log entry).
- `docs/ai-dlc/inception/application-design/requirements-traceability.md` — FR-20a + NFR-23 rows.
- `docs/phase01/requirements_verification.update03.md` — status updates.

---

## Change Log

| Date | Change |
|------|--------|
| 2026-06-20 | **Update 04**: Added FR-20a (off-screen node-list mutation invariant) and NFR-23 (public-surface cybersecurity hardening). Reworded FR-02a (validate-on-submit), FR-02 (default prompt), FR-24a/NFR-11 (refresh restores server playback position), and NFR-07 (single-screen completion). |
