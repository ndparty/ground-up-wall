import type { Context, Middleware } from "fresh";
import type { AuthUser } from "../services/auth_service.ts";
import type { User } from "../types.ts";
import { getSessionToken } from "../cookies.ts";
import type { AppState } from "../di.ts";
import { loginPageRedirect, roleHomeRedirect } from "../auth/login_redirect.ts";

export interface AuthState {
  user: AuthUser | null;
  services: AppState;
}

function jsonAuthError(status: 401 | 403, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function requireRole(...roles: User["role"][]): Middleware<AuthState> {
  return async (ctx: Context<AuthState>) => {
    const token = getSessionToken(ctx.req);
    const user = await ctx.state.services.auth.resolveCurrentUser(token);
    if (!user) {
      return jsonAuthError(401, "Unauthorized");
    }
    if (!roles.includes(user.role)) {
      return jsonAuthError(403, "Forbidden");
    }
    ctx.state.user = user;
    return await ctx.next();
  };
}

/** HTML page routes: redirect to /login or role home instead of JSON errors. */
export function requireRolePage(...roles: User["role"][]): Middleware<AuthState> {
  return async (ctx: Context<AuthState>) => {
    const user = ctx.state.user;
    if (!user) {
      return loginPageRedirect(ctx.req);
    }
    if (!roles.includes(user.role)) {
      return roleHomeRedirect(ctx.req, user.role);
    }
    return await ctx.next();
  };
}

export function requireAuth(): Middleware<AuthState> {
  return requireRole("admin", "moderator", "display_wall");
}
