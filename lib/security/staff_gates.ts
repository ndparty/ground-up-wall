import type { Context } from "fresh";
import type { AuthUser } from "../services/auth_service.ts";
import type { User } from "../types.ts";
import type { AuthState } from "../middleware/auth_guard.ts";

const STAFF_ROLES = new Set<User["role"]>(["admin", "moderator"]);

export function isStaffUser(user: AuthUser | User | null | undefined): boolean {
  return user?.role !== undefined && STAFF_ROLES.has(user.role);
}

export function isStaffRequest(ctx: Context<AuthState>): boolean {
  return isStaffUser(ctx.state.user);
}

/** SSE connection ceiling: higher for admin/moderator staff workflows. */
export function maxSseConnectionsForUser(user: AuthUser | null | undefined): number {
  return isStaffUser(user) ? 100 : 50;
}
