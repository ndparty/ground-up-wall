import type { Context, Middleware } from "fresh";
import type { AuthUser } from "../services/auth_service.ts";
import type { User } from "../types.ts";
import { getSessionToken } from "../cookies.ts";
import type { AppState } from "../di.ts";

export interface AuthState {
  user: AuthUser | null;
  services: AppState;
}

export function requireRole(...roles: User["role"][]): Middleware<AuthState> {
  return async (ctx: Context<AuthState>) => {
    const token = getSessionToken(ctx.req);
    const user = ctx.state.services.auth.getCurrentUser(token);
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

export function requireAuth(): Middleware<AuthState> {
  return requireRole("admin", "moderator", "display_wall");
}
