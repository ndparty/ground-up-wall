# Requirements Update 07 — ground-up-wall

**Date**: 2026-06-21\
**Source**: Phase 01 code-traced audit — display ops (reload/panic), HEIC CSP fix, delete-all
waiting screen, playback snapshot clarification.

---

## Summary of Changes

| # | Type        | Affected             | Description                                                                                                          |
| - | ----------- | -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1 | Enhancement | FR-24c (ops)         | **Reload display** — rebuild server tape at cabin 1; preserve override; audit `reload_display`; SSE `display_reload` |
| 2 | Enhancement | FR-24c (ops)         | **Panic** — immediate blank SSE, reset tape at cabin 1, stay blank until Resume; audit `panic_display`               |
| 3 | Fix         | FR-02, NFR-23        | HEIC preview uses `heic-to/csp` import; CSP `worker-src 'self' blob:` (no `unsafe-eval`)                             |
| 4 | Fix         | FR-23                | Deleting the last approved submission clears client window + publishes empty playback (waiting screen)               |
| 5 | Clarify     | FR-24a, NFR-11, R-07 | Playback snapshot persisted in `system_config.train_playback_state`; restored on process restart when valid          |

---

## 1. Reload display (moderator/admin)

From **Display override** panel (`DisplayOverrideControls.tsx`, `AdminDisplayOverride.tsx`):

- Confirms with the moderator before sending (admin panel same confirm text).
- Server: `PhotoWallService.reloadDisplay()` — `resetToFreshState(1)` from current approved list;
  **does not change** persisted override state (blank stays blank).
- Broadcast: `display:reload` → SSE event `display_reload`; clients call `syncPlaybackFromServer()`
  and reset animation state.
- Audit: action type `reload_display`.

## 2. Panic (moderator/admin)

- No confirmation dialog (same as blank override UX).
- Server: `PhotoWallService.panicDisplay()` — publishes blank override SSE **first**, then persists
  blank override if not already blank, rebuilds tape at cabin 1, keeps override paused.
- Stays blank until moderator/admin sends **Resume display**.
- Audit: action type `panic_display`.

## 3. HEIC under strict CSP (FR-02 / NFR-23)

- Client: `import("heic-to/csp")` in `decode_upload_image.ts` (libheif build without dynamic eval).
- CSP: `worker-src 'self' blob:` in `security_headers.ts` (required for blob workers).
- Do **not** add `'unsafe-eval'` to `script-src`.

## 4. Delete-all → waiting screen (FR-23)

When the last approved submission is deleted:

- Server publishes empty playback window after `syncPlaybackCabinCount()`.
- Client `removeSubmissionFromView()` clears `window` when `canonical` becomes empty so `hasCabins`
  is false and the FR-23 waiting screen renders without manual refresh.

Partial deletes (other approved posts remain) still use soft removal per FR-22 (on-screen cabins
scroll off naturally).

## 5. Playback snapshot persistence (FR-24a / NFR-11 / R-07)

**Clarification (code behavior, Update 07):** In addition to in-memory controller state, the server
persists a JSON snapshot to `system_config.train_playback_state` on each playback publish. On
`ensurePlaybackInitialized()`, if the snapshot is valid against the current approved id list,
playback restores from it — including after a **server process restart**. Invalid or missing
snapshots fall back to fresh initialization at cabin 1 in playing state.

Browser refresh behavior unchanged: restore approved list, override state (DB), and current server
playback via `/api/display/submissions` + SSE.

---

## Manual verification

- [ ] Reload display with train playing — restarts at cabin 1; override preserved if blank
- [ ] Panic — immediate blank; Resume restores train from cabin 1
- [ ] Chrome HEIC upload — preview and submit succeed; no CSP eval errors
- [ ] Delete last approved post — display shows waiting screen without refresh
