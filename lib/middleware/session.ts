import type { Middleware } from "fresh";
import { getSessionToken } from "../cookies.ts";
import type { AuthState } from "./auth_guard.ts";

export const sessionMiddleware: Middleware<AuthState> = async (ctx) => {
  const token = getSessionToken(ctx.req);
  ctx.state.user = await ctx.state.services.auth.resolveCurrentUser(token);
  return await ctx.next();
};
