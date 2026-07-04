# Code Execution Plan: ground-up-wall

| Field          | Value                                              |
| -------------- | -------------------------------------------------- |
| Document Type  | Code Execution Plan                                |
| Epic Work Item | `WI-02`                                            |
| Tech Spec      | `ground-up-wall/docs/phase01/epic_plan-phase01.md` |
| Version        | 1.0                                                |
| Author         | Developer                                          |

---

A Code Execution Plan describes _how to implement_ the changes defined in a work item.

> This document is the **single source of truth** for implementation sequencing of WI-02 (Auth
> System). Do not duplicate content from the epic plan — reference it via `epic_plan-phase01.md`.

---

## Pre-Conditions

- [ ] WI-01 merged to `main` (Foundation — project scaffold, DB schema, Repository interface,
      PostgresRepository)
- [ ] PostgreSQL running on `localhost:5432` with `ground_up_wall_dev` database created
- [ ] Migration from WI-01 has been run (tables exist)
- [ ] Branch created from `main`: `wi-02-auth`

---

> ⚠️ **Single Source of Truth** — This document is the authoritative sequencing guide for WI-02.

---

## 1. ground-up-wall

### 1.1 Login Routes and Auth API Endpoint

**Commit message:**
`WI-02: implement login routes with password verification and session token generation`

#### Files Changed

| File                                | Change | Description                                                               |
| ----------------------------------- | ------ | ------------------------------------------------------------------------- |
| `routes/api/auth/login.ts`          | New    | POST /api/auth/login — authenticate user, create session, return token    |
| `routes/api/auth/logout.ts`         | New    | POST /api/auth/logout — invalidate session                                |
| `routes/login.tsx`                  | New    | Login page UI (username + password form)                                  |
| `lib/services/auth_service.ts`      | New    | AuthService — password verification, session management, token generation |
| `lib/services/auth_service_test.ts` | New    | Tests for AuthService                                                     |

#### Implementation Details

1. **Create `lib/services/auth_service.ts`:**
   - `login(username, password)`: fetch user from Repository by username, verify password with
     bcrypt, check `disabled` flag, generate opaque session token, return AuthResult with user info
     and token
   - `logout(token)`: remove session from store
   - `getCurrentUser(token)`: lookup token in session store, return user or null
   - `isAuthenticated(token)`: check if token exists and is not expired
   - `hasRole(token, role)`: check user's role from session
   - Session store: in-memory `Map<string, { user: User; expires: Date }>` for Phase 1
   - Token generation: use `crypto.randomUUID()` for opaque tokens

2. **Create `routes/api/auth/login.ts`:**
   ```typescript
   import { Handlers } from "$fresh/server.ts";
   import { AuthService } from "../../lib/services/auth_service.ts";

   export const handler: Handlers = {
     async POST(req) {
       const { username, password } = await req.json();
       const authService = /* get from DI context */;
       const result = await authService.login(username, password);
       if (!result.success) {
         return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
       }
       // Set session cookie
       const headers = new Headers();
       headers.set("Set-Cookie", `session=${result.token}; HttpOnly; Path=/; Max-Age=86400`);
       return new Response(JSON.stringify({ user: result.user }), { status: 200, headers });
     }
   };
   ```

3. **Create `routes/login.tsx`** — simple login form with username/password fields, submit to
   `/api/auth/login`, handle error display, redirect on success.

4. **Create `routes/api/auth/logout.ts`** — clear session cookie, call `authService.logout()`.

#### Unit Tests

| Test File                           | Test Method                      | Verifies                                                       |
| ----------------------------------- | -------------------------------- | -------------------------------------------------------------- |
| `lib/services/auth_service_test.ts` | `testSuccessfulLogin`            | Valid username+password returns AuthResult with user and token |
| `lib/services/auth_service_test.ts` | `testFailedLoginWrongPassword`   | Wrong password returns error with "Invalid credentials"        |
| `lib/services/auth_service_test.ts` | `testFailedLoginNonexistentUser` | Non-existent username returns error                            |
| `lib/services/auth_service_test.ts` | `testLoginDisabledAccount`       | Disabled account login returns "Account disabled" error        |
| `lib/services/auth_service_test.ts` | `testLogoutInvalidatesToken`     | After logout, the token is no longer valid                     |
| `lib/services/auth_service_test.ts` | `testHasRole`                    | `hasRole` checks the user's role from the session              |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Login page renders at `/login`
- [ ] Valid credentials return 200 with user info and set-cookie header
- [ ] Invalid credentials return 401 with "Invalid credentials"
- [ ] Disabled account login returns 401 with "Account disabled"

---

### 1.2 Role-Based Access Control and Protected Route Guards

**Commit message:**
`WI-02: implement role-based access control with protected route guards and middleware`

#### Files Changed

| File                                | Change | Description                                                       |
| ----------------------------------- | ------ | ----------------------------------------------------------------- |
| `lib/middleware/auth_guard.ts`      | New    | Middleware/guard function for protecting routes by role           |
| `routes/api/_middleware.ts`         | New    | API route middleware — extracts session, attaches user to context |
| `lib/middleware/auth_guard_test.ts` | New    | Tests for auth guard logic                                        |

#### Implementation Details

1. **Create `lib/middleware/auth_guard.ts`:**
   ```typescript
   import { MiddlewareHandlerContext } from "$fresh/server.ts";

   export interface AuthState {
     user?: {
       id: string;
       username: string;
       role: 'admin' | 'moderator' | 'display_wall';
     };
   }

   export function requireRole(...roles: string[]) {
     return async (req: Request, ctx: MiddlewareHandlerContext<AuthState>) => {
       const session = /* read session cookie from request */;
       const authService = /* get from DI context */;
       const user = await authService.getCurrentUser(session);
       if (!user) {
         return new Response("Unauthorized", { status: 401 });
       }
       if (!roles.includes(user.role)) {
         return new Response("Forbidden", { status: 403 });
       }
       ctx.state.user = user;
       return await ctx.next();
     };
   }
   ```

2. **Create `routes/api/_middleware.ts`** — session extraction middleware for all `/api/*` routes:
   - Parse `Cookie` header for `session` token
   - Call `authService.getCurrentUser(token)` to validate
   - Attach user to `ctx.state` if valid
   - If no valid session, set `ctx.state.user = null` (API handlers decide auth requirements
     per-route)

3. **Route guard patterns** (to be used in subsequent WIs):
   - Admin-only: `requireRole('admin')`
   - Moderator+Admin: `requireRole('moderator', 'admin')`
   - Any authenticated (including Display Wall User):
     `requireRole('moderator', 'admin', 'display_wall')`

#### Unit Tests

| Test File                           | Test Method                           | Verifies                                      |
| ----------------------------------- | ------------------------------------- | --------------------------------------------- |
| `lib/middleware/auth_guard_test.ts` | `testRequireAdminAllowsAdmin`         | Admin role passes admin-only guard            |
| `lib/middleware/auth_guard_test.ts` | `testRequireAdminBlocksModerator`     | Moderator role is blocked by admin-only guard |
| `lib/middleware/auth_guard_test.ts` | `testRequireAnyAuthAllowsDisplayWall` | Display Wall User passes any-auth guard       |
| `lib/middleware/auth_guard_test.ts` | `testNoSessionReturnsUnauthorized`    | Missing cookie returns 401                    |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Admin-only route blocks moderator with 403
- [ ] Any-authenticated route allows all 3 roles
- [ ] Missing/invalid cookie returns 401

---

### 1.3 Password Change Functionality

**Commit message:**
`WI-02: implement password change with current password verification and audit logging`

#### Files Changed

| File                                 | Change   | Description                                                    |
| ------------------------------------ | -------- | -------------------------------------------------------------- |
| `routes/api/auth/change-password.ts` | New      | POST /api/auth/change-password — change own password           |
| `routes/change-password.tsx`         | New      | Change password page (current password, new password, confirm) |
| `lib/services/auth_service.ts`       | Modified | Add `changePassword` method                                    |

#### Implementation Details

1. **Add to `lib/services/auth_service.ts`:**
   ```typescript
   async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
     const user = await this.repository.authenticateUser(userId);
     if (!user || !await bcrypt.compare(currentPassword, user.password_hash)) {
       throw new Error("Current password is incorrect");
     }
     const newHash = await bcrypt.hash(newPassword);
     await this.repository.updateUserPassword(userId, newHash);
     await this.auditService.logAction({
       moderator_id: userId,
       action_type: 'change_password',
       target_type: 'user',
       target_id: userId,
       old_value: null,
       new_value: null
     });
   }
   ```

2. **Create `routes/api/auth/change-password.ts`:**
   - Requires authentication (middleware)
   - Accepts `{ currentPassword, newPassword, confirmPassword }`
   - Validates `newPassword === confirmPassword`
   - Calls `authService.changePassword()`
   - Returns success or error

3. **Create `routes/change-password.tsx`** — form with 3 fields, error/success display.

#### Unit Tests

| Test File                           | Test Method                      | Verifies                                         |
| ----------------------------------- | -------------------------------- | ------------------------------------------------ |
| `lib/services/auth_service_test.ts` | `testChangePasswordSuccess`      | Correct current password updates to new password |
| `lib/services/auth_service_test.ts` | `testChangePasswordWrongCurrent` | Wrong current password throws error              |
| `lib/services/auth_service_test.ts` | `testChangePasswordAuditLogged`  | Password change is logged in audit log           |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Changing password with correct current password works
- [ ] Wrong current password returns error
- [ ] Audit log entry is created for password change

---

### 1.4 Auth Context Provider and Application Integration

**Commit message:** `WI-02: integrate auth context into application layout with session persistence`

#### Files Changed

| File                          | Change   | Description                                                        |
| ----------------------------- | -------- | ------------------------------------------------------------------ |
| `routes/_app.tsx`             | Modified | Add auth state provider, inject AuthContext for all routes         |
| `lib/context/auth_context.ts` | New      | Preact context for auth state — current user, login/logout methods |
| `islands/AuthStatus.tsx`      | New      | Island component showing logged-in user + logout button in header  |
| `routes/index.tsx`            | Modified | Redirect root `/` to `/upload` (home is upload page)               |

#### Implementation Details

1. **Create `lib/context/auth_context.ts`:**
   ```typescript
   import { createContext } from "preact";
   import { useContext } from "preact/hooks";

   export interface AuthContextType {
     user: { id: string; username: string; role: string } | null;
     login: (username: string, password: string) => Promise<AuthResult>;
     logout: () => Promise<void>;
     isAuthenticated: boolean;
     hasRole: (role: string) => boolean;
   }

   export const AuthContext = createContext<AuthContextType | null>(null);
   export function useAuth() {
     return useContext(AuthContext)!;
   }
   ```

2. **Modify `routes/_app.tsx`** to wrap content with AuthProvider that:
   - Checks for existing session cookie on page load
   - Provides `login`, `logout`, `user`, `isAuthenticated`, `hasRole` via context

3. **Create `islands/AuthStatus.tsx`:**
   - Client-side island that reads auth context
   - Shows user greeting + logout button when authenticated
   - Shows login link when not authenticated

#### Unit Tests

| Test File                     | Test Method                         | Verifies                                         |
| ----------------------------- | ----------------------------------- | ------------------------------------------------ |
| `islands/AuthStatus_test.tsx` | `testShowsLoginWhenUnauthenticated` | Logged-out state shows login link                |
| `islands/AuthStatus_test.tsx` | `testShowsUserWhenAuthenticated`    | Logged-in state shows username and logout button |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Root `/` redirects to `/upload`
- [ ] Auth status island shows correctly in both states
- [ ] Login/logout cycle works end-to-end via UI

---

## Post-Implementation Checklist

- [ ] All chunks verified — each compiles, passes tests, and meets ≥80% coverage
- [ ] No regressions in existing functionality
- [ ] Post-implementation checks executed and signed off
- [ ] Login/logout cycle works end-to-end for all 3 authenticated roles
- [ ] Disabled accounts cannot log in
- [ ] Protected route guards correctly enforce role-based access
- [ ] Password change works with validation and audit logging
- [ ] Auth state is available via context in all routes
