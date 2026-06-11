import type { Middleware } from "fresh";
import { getSessionToken } from "../cookies.ts";
import type { AuthState } from "./auth_guard.ts";

export const sessionMiddleware: Middleware<AuthState> = async (ctx) => {
  const token = getSessionToken(ctx.req);
  ctx.state.user = ctx.state.services.auth.getCurrentUser(token);
  return await ctx.next();
};
