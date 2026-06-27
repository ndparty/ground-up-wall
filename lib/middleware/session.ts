import type { Middleware } from "fresh";
import { getSessionToken, sessionCookieHeader } from "../cookies.ts";
import type { AuthState } from "./auth_guard.ts";

export const sessionMiddleware: Middleware<AuthState> = async (ctx) => {
  const token = getSessionToken(ctx.req);
  const { user, sessionRefreshed } = await ctx.state.services.auth.resolveCurrentUser(token);
  ctx.state.user = user;
  const response = await ctx.next();
  if (!sessionRefreshed || !token) return response;

  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", sessionCookieHeader(token));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
