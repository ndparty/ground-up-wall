# Requirements Update 05 — ground-up-wall

**Date**: 2026-06-21 **Source**: Display polish pass — generator model, 1:1 photo + cabin restyle,
in-app QR, top base-URL bar, event killswitch + uploads toggle.

---

## Summary of Changes

| # | Type     | Affected             | Description                                                                                       |
| - | -------- | -------------------- | ------------------------------------------------------------------------------------------------- |
| 1 | Rework   | FR-22, FR-21, FR-20a | Server-authoritative generator + ephemeral FIFO queue replaces the client ring/overlay model      |
| 2 | Addition | FR-22a, FR-05        | Recurring in-app QR "join the wall" cabin + top base-URL bar (browser-generated from base origin) |
| 3 | Addition | FR-13b               | Event killswitch + public-uploads toggle                                                          |
| 4 | Rework   | FR-18                | Square (1:1) cabin photo, constant-height info panel, clean cabin chrome                          |

---

## 1. Generator model (FR-22 / FR-21 / FR-20a)

The display is now driven by a **server-authoritative generator** with an **ephemeral FIFO queue**:

- The canonical sequence is the ordered list of approved submission **ids** (chronological), walked
  forward with wraparound.
- Each dwell tick the generator emits ONE cabin at the **right edge** of a fixed-length window: the
  front of the FIFO queue (a just-approved preview or a QR cabin) if present, otherwise the next
  sequential canonical cabin.
- The full window is broadcast to all display sessions every tick, so they stay in **lockstep** and
  refresh/late-join restores exactly (FR-24a / NFR-11).
- FR-20a (off-screen mutation invariant) is now satisfied **by construction**: cabins only enter at
  the right edge and leave past the left edge — there is no in-place node-list surgery inside the
  visible band. This removes the earlier ring-splice / synthetic-node glitch.
- Cabins are **id-based**, so deleting an approved post never renumbers or corrupts cabins currently
  on screen (it keeps its snapshot until it scrolls off).
- The visible window is reduced to `N = 2` (5 cabins) plus a 2-cabin preload buffer.

**Implementation (code is source of truth):**

- Server generator: `lib/train/train_playback_controller.ts` (canonical id list, FIFO queue,
  `qr_cabin_interval`, per-tick right-edge emission, jump regeneration); wired in
  `lib/services/photo_wall_service.ts`; broadcast via `train:command` / `train:playback_state` and
  the `/api/display/submissions` window.
- Client renderer: `lib/train/train_view.ts` (tape/window model + pure jump-collapse math),
  `lib/train/use_train_playback.ts`, `islands/TrainDisplay.tsx`. Constants in
  `lib/train/train_view_constants.ts`.

## 2. In-app QR cabin + top base-URL bar (FR-22a / FR-05)

- A recurring QR cabin appears every `qr_cabin_interval` cabin advances (default 15; `0` disables),
  enqueued server-side (skipped if one is already queued) and dwelling at center like any cabin.
- The QR is generated **in the browser** from `location.origin` (`lib/qr/qr_code.ts`,
  `qrcode-generator`) as a system-themed SVG — no external artifact or network round-trip.
- The display shows a fixed top bar with the auto-detected base URL as **plain text** plus a short
  invitation to post.

## 3. Event killswitch + public-uploads toggle (FR-13b)

Two admin system parameters gate dynamic routes via `lib/middleware/access_gate.ts`:

- `system_killswitch_enabled` (default `false`): disables everything except `/login` and `/admin` (+
  their APIs). Blocked HTML routes show an "offline" page; blocked APIs return 503.
- `uploads_enabled` (default `true`): when off, disables only the public upload page and submission
  endpoint (503 / "uploads are closed"); the display wall and moderation keep running.

## 4. Cabin visuals (FR-18)

- Photo shown in a **square (1:1)** window; `CABIN_PHOTO_ASPECT = 1` drives both the client preview
  crop and server normalization (`lib/image/cabin_image.ts`).
- The message/name/handle panel is a **constant height** so cabins are uniform.
- Cabin chrome cleaned up: nothing overlaid on the photo, the red livery stripe sits in the roof
  band, and the bogies read clearly as wheels (`islands/TrainCabin.tsx`, `static/train.css`).

---

**Verification**: Manual organiser sign-off PASSED (2026-06-21). See
[`requirements_verification.update05.md`](../phase01/requirements_verification.update05.md) and
[`requirements.update06.md`](requirements.update06.md) for post-verification polish.
