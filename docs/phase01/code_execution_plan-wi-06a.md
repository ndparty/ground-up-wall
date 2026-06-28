# Code Execution Plan: ground-up-wall

| Field          | Value                                              |
| -------------- | -------------------------------------------------- |
| Document Type  | Code Execution Plan                                |
| Epic Work Item | `WI-06a`                                           |
| Tech Spec      | `ground-up-wall/docs/phase01/epic_plan-phase01.md` |
| Version        | 1.0                                                |
| Author         | Developer                                          |

---

> This document is the **single source of truth** for implementation sequencing of WI-06a (Admin:
> User Management).

---

## Pre-Conditions

- [ ] WI-01 merged to `main` (Foundation — schema, Repository, auth interfaces)
- [ ] WI-02 merged to `main` (Auth — login, session, role guards, admin role check)
- [ ] Migration has been run (tables exist)
- [ ] Branch created from `main`: `wi-06a-admin-users`
- [ ] ⚠️ This work item can be developed **in parallel** with WI-06b and WI-06c

---

> ⚠️ **Single Source of Truth** — This document is the authoritative sequencing guide for WI-06a.

---

## 1. ground-up-wall

### 1.1 Admin Route Shell with Admin-Only Guard

**Commit message:** `WI-06a: create admin panel route shell with admin-only access guard`

#### Files Changed

| File                          | Change | Description                                               |
| ----------------------------- | ------ | --------------------------------------------------------- |
| `routes/admin/index.tsx`      | New    | Admin panel main page — navigation hub for admin features |
| `routes/admin/_middleware.ts` | New    | Admin route middleware — requires admin role              |

#### Implementation Details

1. **Create `routes/admin/_middleware.ts`:**
   ```typescript
   import { MiddlewareHandlerContext } from "$fresh/server.ts";
   import { AuthState } from "../../lib/middleware/auth_guard.ts";
   import { requireRole } from "../../lib/middleware/auth_guard.ts";

   // Admin-only access for all /admin/* routes
   export const handler = [requireRole("admin")];
   ```

2. **Create `routes/admin/index.tsx`:**
   - Admin panel hub page with navigation links to:
     - User Management (WI-06a)
     - System Parameters (WI-06b)
     - Audit Log (WI-06c)
   - Simple card-based layout

#### Unit Tests

| Test File                    | Test Method                     | Verifies                           |
| ---------------------------- | ------------------------------- | ---------------------------------- |
| `routes/admin/index_test.ts` | `testAdminRouteBlocksModerator` | Moderator gets 403 on /admin route |
| `routes/admin/index_test.ts` | `testAdminRouteAllowsAdmin`     | Admin can access /admin route      |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] `/admin` accessible only by Admin role
- [ ] Moderator gets 403 on `/admin/*`

---

### 1.2 User Management Page — List All Accounts

**Commit message:**
`WI-06a: implement user management page listing Photo Moderator and Display Wall accounts`

#### Files Changed

| File                              | Change | Description                                                    |
| --------------------------------- | ------ | -------------------------------------------------------------- |
| `routes/admin/users.tsx`          | New    | User management page — list all accounts with status           |
| `islands/UserManagement.tsx`      | New    | Client island — user table with actions                        |
| `routes/api/admin/users/index.ts` | New    | GET /api/admin/users — list all moderator + display wall users |

#### Implementation Details

1. **Create `routes/api/admin/users/index.ts`:**
   - GET handler, requires admin role
   - Returns combined list of Photo Moderator and Display Wall User accounts
   - Each entry: `{ id, username, role, disabled, created_at }`
   - Excludes password hashes

2. **Create `routes/admin/users.tsx`:** renders UserManagement island

3. **Create `islands/UserManagement.tsx`:**
   - Fetches user list from `/api/admin/users`
   - Table with columns: Username, Role (Photo Moderator / Display Wall), Status (Active/Disabled),
     Created, Actions
   - Actions per row: Reset Password, Disable/Enable, Delete
   - Role shown as badge/tag for visual clarity
   - Status shown with active/green or disabled/red indicator

#### Unit Tests

| Test File                         | Test Method              | Verifies                                   |
| --------------------------------- | ------------------------ | ------------------------------------------ |
| `islands/UserManagement_test.tsx` | `testShowsUserList`      | Users render in table with correct columns |
| `islands/UserManagement_test.tsx` | `testShowsRoleAndStatus` | Role and status badges render correctly    |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] User list shows all moderator and Display Wall accounts (FR-15c)
- [ ] Status (active/disabled) and role displayed for each account

---

### 1.3 Create and Disable/Enable Accounts

**Commit message:**
`WI-06a: implement create, disable, and enable for moderator and Display Wall accounts`

#### Files Changed

| File                                      | Change   | Description                                                             |
| ----------------------------------------- | -------- | ----------------------------------------------------------------------- |
| `routes/api/admin/users/create.ts`        | New      | POST /api/admin/users/create — create moderator or Display Wall account |
| `routes/api/admin/users/toggle-status.ts` | New      | POST /api/admin/users/toggle-status — disable or enable an account      |
| `islands/UserManagement.tsx`              | Modified | Add create account form, disable/enable buttons                         |

#### Implementation Details

1. **Create `routes/api/admin/users/create.ts`:**
   - POST handler, requires admin role
   - Accepts `{ username, password, role: 'moderator' | 'display_wall' }`
   - Validates: username unique, password non-empty
   - Calls `photoWallService.createModerator()` or `photoWallService.createDisplayWallUser()`
   - Logs creation in audit log
   - Returns 201 on success, 409 on duplicate username

2. **Create `routes/api/admin/users/toggle-status.ts`:**
   - POST handler, requires admin role
   - Accepts `{ userId, action: 'disable' | 'enable', role: 'moderator' | 'display_wall' }`
   - Calls appropriate service method (`disableModerator`/`enableModerator` or
     `disableDisplayWallUser`)
   - Logs action in audit log

3. **Modify `islands/UserManagement.tsx`:**
   - Add "Create Account" form at top: username, password, role selector, create button
   - Add "Disable"/"Enable" toggle button per row
   - Confirmation dialog for disabling
   - Success/error feedback

#### Unit Tests

| Test File                                      | Test Method                   | Verifies                                 |
| ---------------------------------------------- | ----------------------------- | ---------------------------------------- |
| `routes/api/admin/users/create_test.ts`        | `testCreateModerator`         | Creating a moderator account returns 201 |
| `routes/api/admin/users/create_test.ts`        | `testCreateDuplicateUsername` | Duplicate username returns 409           |
| `routes/api/admin/users/create_test.ts`        | `testCreateDisplayWallUser`   | Creating a Display Wall User returns 201 |
| `routes/api/admin/users/toggle-status_test.ts` | `testDisableModerator`        | Disabling a moderator prevents login     |
| `routes/api/admin/users/toggle-status_test.ts` | `testEnableModerator`         | Enabling a moderator restores login      |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Create moderator account works (FR-14)
- [ ] Create Display Wall User account works (FR-13/FR-16)
- [ ] Disable account prevents login (FR-15a)
- [ ] Enable account restores login
- [ ] Duplicate username returns error (FR-09)
- [ ] Audit log entries created for all actions

---

### 1.4 Reset Password and Delete Account

**Commit message:**
`WI-06a: implement reset password and delete account for moderator and Display Wall accounts`

#### Files Changed

| File                                       | Change   | Description                                                   |
| ------------------------------------------ | -------- | ------------------------------------------------------------- |
| `routes/api/admin/users/reset-password.ts` | New      | POST /api/admin/users/reset-password — reset account password |
| `routes/api/admin/users/delete.ts`         | New      | POST /api/admin/users/delete — delete an account              |
| `islands/UserManagement.tsx`               | Modified | Add reset password dialog, delete with confirmation           |

#### Implementation Details

1. **Create `routes/api/admin/users/reset-password.ts`:**
   - POST handler, requires admin role
   - Accepts `{ userId, newPassword, role }`
   - Calls appropriate service method
   - Logs in audit log

2. **Create `routes/api/admin/users/delete.ts`:**
   - POST handler, requires admin role
   - Accepts `{ userId, role }`
   - Requires confirmation (client sends confirmed=true after dialog)
   - Calls appropriate service method
   - Preserves audit log references (does NOT cascade delete audit entries)
   - Logs deletion in audit log

3. **Modify `islands/UserManagement.tsx`:**
   - "Reset Password" button opens inline form for new password
   - "Delete" button opens confirmation dialog before sending delete request
   - Success/error feedback

#### Unit Tests

| Test File                                       | Test Method                  | Verifies                                                       |
| ----------------------------------------------- | ---------------------------- | -------------------------------------------------------------- |
| `routes/api/admin/users/reset-password_test.ts` | `testResetModeratorPassword` | Password reset updates password and logs audit                 |
| `routes/api/admin/users/delete_test.ts`         | `testDeleteModerator`        | Deleting moderator removes account but preserves audit entries |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Reset password works for moderator accounts (FR-15)
- [ ] Delete account with confirmation removes account (FR-15b)
- [ ] Audit log entries retain reference to deleted account's ID (FR-15b)
- [ ] All actions logged in audit log

---

## Post-Implementation Checklist

- [ ] All chunks verified — each compiles, passes tests, and meets ≥80% coverage
- [ ] No regressions in existing functionality
- [ ] Post-implementation checks executed and signed off
- [ ] Admin can view list of moderator accounts with status (FR-15c)
- [ ] Admin can create moderator accounts (FR-14)
- [ ] Admin can create Display Wall User accounts (FR-13)
- [ ] Admin can disable/enable moderator accounts (FR-15a)
- [ ] Admin can delete moderator accounts with confirmation (FR-15b)
- [ ] Admin can reset moderator passwords (FR-15)
- [ ] Audit log captures all user management actions
