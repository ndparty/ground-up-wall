# Requirements Update 09 — Fit-text probe fix and page login redirects

**Date**: 2026-06-23\
**Source**: Display/upload fit-text debugging; page auth UX for protected HTML routes.

---

## Summary of Changes

| # | Type        | ID / Area        | Description                                                                                                                                                                                                                   |
| - | ----------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | Fix         | FR-18 (display)  | Fit-text measurement probe moved inside `.train-cabin__message-wrap` as zero-footprint overlay (`message-fit-probe`); rem steps quantized to match `static/fit-text.css`; probe class no longer stripped during binary search |
| 2 | Enhancement | FR-24b (revised) | Protected **HTML** routes redirect unauthenticated users to `/login` and wrong-role users to their role home (`/display` or `/moderate`); **API** routes unchanged (JSON 401/403)                                             |
| 3 | Fix         | —                | PR #15 review: remove unused `fireScheduled` destructure in `resetToFreshState` test                                                                                                                                          |

---

## 1. Fit-text probe (train cabin messages)

- Probe appended inside `.train-cabin__message-wrap` only (not as flex sibling in
  `.train-cabin__body`).
- CSS in `static/fit-text.css` and nonce baseline in `routes/_app.tsx`:
  `position: absolute; inset: 0; visibility: hidden`.
- `setFitRem` removes only `fit-text-NNN` size classes (not `message-fit-probe`).
- Binary search uses 5-centi-rem steps aligned with CSS (`fit-text-50` … `fit-text-300`).
- Concurrent `runFitText` calls serialised via generation token; all probes removed on cleanup.

## 2. Page login redirects

| Route                             | Not logged in | Wrong role                |
| --------------------------------- | ------------- | ------------------------- |
| `/display`                        | → `/login`    | → role home               |
| `/moderate`, `/moderate/approved` | → `/login`    | → role home               |
| `/change-password`                | → `/login`    | any authenticated role OK |
| `/admin/*`                        | → `/login`    | → role home               |

Helpers: `loginPageRedirect`, `roleHomeRedirect`, `requireRolePage` in `lib/auth/login_redirect.ts`
and `lib/middleware/auth_guard.ts`.

## Manual verification

- Display — short message: one line, large font filling message area; no duplicate probe text.
- Upload preview — same fit-text behaviour as display cabin.
- Logged out: `/display`, `/moderate`, `/admin` → `/login`.
- Logged in as `display`, visit `/moderate` → `/display`; as `moderator`, visit `/admin` →
  `/moderate`.
- `deno test -P` — full suite passes.
