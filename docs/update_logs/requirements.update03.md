# Requirements Update 03 — ground-up-wall

**Date**: 2026-06-20 **Source**: Post-WI-07 train architecture refactor, playback bug fixes, and
integration hardening

---

## Summary of Changes

Implementation architecture deltas (no new user-facing FRs unless noted). Runtime code in
`lib/train/` and `islands/TrainDisplay.tsx` is the source of truth.

| # | Type           | Affected        | Description                                                                                                      |
| - | -------------- | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1 | Implementation | Display train   | K-buffer forward-only jump model (`train_view.ts`) replaces chain-relinking `jumpToCabin()` for display playback |
| 2 | Implementation | Display train   | Single proportional CSS slide per advance/jump (`slideDurationMs`: 800ms at 1 step, 2400ms at 9 steps)           |
| 3 | Implementation | Display train   | Virtualized render window: normal `K` left + `2K+2` right; jump mode adds K-left + path + K-right of target      |
| 4 | Implementation | Display train   | Ephemeral inserts: newly approved submissions appear ahead of current cabin within K slots                       |
| 5 | Implementation | Display train   | Jump preload: animation path cabins + K ring slots after target                                                  |
| 6 | Implementation | Playback        | Server `TrainPlaybackController` + client `use_train_playback`; SSE `train_playback_state` authoritative sync    |
| 7 | Implementation | FR-24a / FR-24c | Pause/resume and override: server timer pauses during blank/placeholder; resume recenters on frozen cabin        |
| 8 | Implementation | Dev infra       | Local Postgres `sslmode=disable` for loopback; file-backed dev sessions in `.dev/sessions.json`                  |
| 9 | Clarification  | FR-17 / DR-01   | Cabin-card train UI (not full metro carriage silhouette) — aesthetic via red/white styling                       |

---

## Train View Architecture (Update 03)

### Forward-only movement

- Base ring: circular doubly-linked list (`lib/train/chain.ts`) ordered oldest-first.
- All visible movement is right-to-left via `effectiveNextId` / `stepEffectiveNext`; never `prev`.
- Temporary chain surgery: **collapse** (jump) and **ephemeral insert** (new approval), not pointer
  relinking for jumps.

### K-buffer jump (K = 4)

- `computeJumpAnimationPath(from, to, length)` — canonical 1-based path with V+K / T−K buffers.
- `shouldCollapseJump` / `computeCollapsedIndices` — hide intermediate cabins on long forward arcs.
- Always animate (no `forwardDistance > n/2` instant snap).
- Golden paths (n=40, K=4): 8→20, 20→8, 10→9, 40→3 — see `lib/train/train_view_test.ts`.

### Animation orchestrator (`islands/TrainDisplay.tsx`)

- One CSS `translateX` transition per advance or jump (`lib/train/center_track.ts`,
  `lib/train/slide_duration.ts`).
- Jump preload via `cabinsForJumpPreload()` — path + K cabins after target.
- `useLayoutEffect` recenters on cabin change; override resume snaps from server + recenters.

### Playback sync

- Server: `TrainPlaybackController` schedules dwell advances; publishes `train:command` +
  `train:playback_state`.
- Client: `use_train_playback` gates advances on `isPlaying`; clears pending queue on pause.
- Override: `pauseForOverride()` / `resumeFromOverride()` freeze/resume dwell timer without
  advancing cabin.

---

## Documents Updated

- `docs/ai-dlc/inception/application-design/component-methods.md` — jump/playback spec
- `docs/ai-dlc/inception/application-design/components.md` — DisplayComponent responsibilities
- `docs/ai-dlc/inception/application-design/requirements-traceability.md` — FR-17–FR-24c
  verification paths
- `docs/phase01/requirements_verification.update03.md` — code-traced verification report

---

## Change Log

| Date       | Change                                                                                                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-20 | **Update 03**: K-buffer train view, single-slide animation, playback SSE sync, override timer freeze, jump preload tail, dev Postgres TLS fix, session persistence. Code-traced verification report added. |
