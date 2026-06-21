# Requirements Update 06 — ground-up-wall

**Date**: 2026-06-21\
**Source**: Post–Update 05 verification polish — train jump reliability, moderation UX, SSE safety,
upload decode, and copy refresh.

---

## Summary of Changes

| # | Type        | Affected         | Description                                                                                                    |
| - | ----------- | ---------------- | -------------------------------------------------------------------------------------------------------------- |
| 1 | Fix         | FR-24a           | Ephemeral-aware jump routing: canonical forward targeting, path ephemerals force rebuild, client overlay merge |
| 2 | Enhancement | FR-07, FR-09     | Approved gallery (`/moderate/approved`), searchable paginated approved list, pending SSE append order          |
| 3 | Fix         | NFR reliability  | Shared `createSseResponse` guards SSE send after client disconnect (display, moderate, upload-config)          |
| 4 | Fix         | FR-02            | HEIC decode skips hanging `createImageBitmap`; fit-text floor lowered for long cabin messages                  |
| 5 | UX          | FR-24c           | Blank display override is immediate (no confirmation dialog)                                                   |
| 6 | UX          | FR-24a           | Train controls jump field auto-syncs from SSE; pauses on manual edit, resumes after 30s idle                   |
| 7 | UX          | Moderation UI    | Train controls panel contained within parent on `/moderate` (box-sizing + wrap)                                |
| 8 | Copy        | FR-02a, branding | Ground-Up Photowall rebrand; NDGUP consent text; privacy notice refresh (commit `e1b73bc`)                     |

---

## 1. Train jump with ephemerals (FR-24a)

- `findForwardCanonicalPostInTape` and `hasEphemeralOnPathToSlot` in `lib/train/tape_helpers.ts`
- `jump()` skips in-chain simulation when ephemerals sit between center and canonical target
- `TrainDisplay.tsx` merges `currentSteps` with animation window for non-inChain jumps
- `TrainControls.tsx` auto-syncs jump input from `currentCabin` via SSE

## 2. Moderation UX

- `ApprovedWallList.tsx` — client search, pagination (25/50/100/200/all), lazy thumbnails
- `/moderate/approved` gallery route; Gallery link in `AuthStatus.tsx`
- Pending submissions append (not prepend) on SSE in `ModerationQueue.tsx`

## 3. Safe SSE

- `lib/sse/create_event_stream.ts` — guarded enqueue; applied to display/moderate/upload-config
  event routes

## 4. Upload and display polish

- HEIC: `heic-to/csp` import in `decode_upload_image.ts`; CSP `worker-src 'self' blob:` (Update 07)
- Fit text: `MIN_REM` 0.5 in `use_fit_text.ts`
- Blank override: no confirm in `DisplayOverrideControls.tsx` / `AdminDisplayOverride.tsx`

## 5. Manual verification

**Status**: PASSED (2026-06-21, organiser sign-off) — includes Update 05 generator, QR cabin,
killswitch, 1:1 cabin, and Update 06 polish above.
