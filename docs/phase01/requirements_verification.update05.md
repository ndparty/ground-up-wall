# Phase 1 Requirements Verification — Update 05 (+ 06 polish)

**Date**: 2026-06-21\
**Method**: Code trace + manual organiser sign-off (2026-06-21).

**Legend**: Satisfied | Partial | Not satisfied

---

## Update 05 — Generator, QR, Killswitch, 1:1 Cabin

| ID     | Status    | Code evidence                                                                           | Notes                                                             |
| ------ | --------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| FR-05  | Satisfied | `lib/qr/qr_code.ts`, `TrainDisplay.tsx` top bar, recurring QR cabin                     | Browser-generated QR from `location.origin`; top base-URL bar     |
| FR-13b | Satisfied | `lib/middleware/access_gate.ts`, `lib/defaults/app_defaults.ts`, `SystemParameters.tsx` | `system_killswitch_enabled` + `uploads_enabled` gate routes       |
| FR-18  | Satisfied | `TrainCabin.tsx`, `lib/image/cabin_image.ts`, `static/train.css`                        | 1:1 photo window, constant info panel, clean chrome               |
| FR-20a | Satisfied | `train_playback_controller.ts`                                                          | Off-screen mutation by construction — right-edge emission only    |
| FR-21  | Satisfied | `train_playback_controller.ts`                                                          | Canonical id list walked forward with wraparound                  |
| FR-22  | Satisfied | `train_playback_controller.ts`, `photo_wall_service.ts`, `use_train_playback.ts`        | Server-authoritative generator + ephemeral FIFO queue; N=2 window |
| FR-22a | Satisfied | `train_playback_controller.ts`, `TrainCabin.tsx`, `qr_cabin_interval` param             | Recurring join-the-wall QR cabin                                  |

**Manual verification (Update 05)**: PASSED — generator lockstep, QR interval, killswitch, uploads
toggle, 1:1 photos confirmed on target hardware.

---

## Update 06 — Post-verification polish

| Area                   | Status    | Evidence                                                              |
| ---------------------- | --------- | --------------------------------------------------------------------- |
| Ephemeral jump routing | Satisfied | `tape_helpers.ts`, `train_playback_controller.ts`, `TrainDisplay.tsx` |
| Moderation gallery     | Satisfied | `ApprovedWallList.tsx`, `routes/moderate/approved.tsx`                |
| Safe SSE               | Satisfied | `lib/sse/create_event_stream.ts`                                      |
| HEIC decode            | Satisfied | `decode_upload_image.ts`                                              |
| Train controls layout  | Satisfied | `static/train.css` — `box-sizing` + moderate wrap                     |
| Copy refresh           | Satisfied | `e1b73bc` — Ground-Up Photowall, NDGUP consent                        |

**Manual verification (Update 06)**: PASSED — jump with ephemerals, gallery, train controls panel
layout, upload consent flow.

See also: [`requirements.update05.md`](../update_logs/requirements.update05.md),
[`requirements.update06.md`](../update_logs/requirements.update06.md).
