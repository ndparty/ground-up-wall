# Requirements Update 08 — Security remediation (waves 3–6)

**Date**: 2026-06-21\
**Source**: Security hardening remediation plan — upload pipeline, auth/storage gates, audit
pagination, CSP/CSRF, session hardening.

---

## Summary of Changes

| #  | Type        | ID  | Description                                                                                                                                 |
| -- | ----------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | Fix         | H3  | Upload normalize throws on decode failure; rejects images > 4096×4096 px                                                                    |
| 2  | Fix         | M8  | `rejectSubmission` deletes stored image (same as delete)                                                                                    |
| 3  | Fix         | M7  | Auth gate on `/submissions/*` and `/overrides/*` static serve (401)                                                                         |
| 4  | Enhancement | M2  | Minimum password length 12 on create/reset/change                                                                                           |
| 5  | Enhancement | M5  | Audit log API pagination `{ entries, total }` + admin UI pages                                                                              |
| 6  | Fix         | M6  | `toPublicError()` whitelists safe API error messages                                                                                        |
| 7  | Fix         | M13 | Parameter reset rejects unknown config keys                                                                                                 |
| 8  | Fix         | M12 | `assertStoragePathSafe` on storage upload/delete                                                                                            |
| 9  | Fix         | L5  | Generic “Could not create user” on duplicate username                                                                                       |
| 10 | Enhancement | CSP | Per-request CSP nonce; `_app` styles moved to `/app.css`; all inline `style=` attrs migrated to CSS classes (strict `style-src` nonce-only) |
| 11 | Fix         | L1  | Display QR via `img` data URL (no inline SVG HTML)                                                                                          |
| 12 | Fix         | —   | Display API `_middleware` role gate; train-command keeps stricter check                                                                     |
| 13 | Fix         | —   | CSRF Origin/Referer check on mutating `/api/*` with session cookie                                                                          |
| 14 | Enhancement | —   | Login invalidates other sessions; stale role invalidates session                                                                            |
| 15 | Enhancement | —   | `safeError()` for server logs; seed fallback password warning                                                                               |

---

## Manual verification

- Upload invalid/corrupt image → 400, not stored raw
- Reject pending submission → image file removed from disk
- Unauthenticated GET `/submissions/...jpg` → 401; placeholders still public
- Admin audit log paginates; create user duplicate → generic error
- Display QR renders; mutating API from foreign origin with session → 403
