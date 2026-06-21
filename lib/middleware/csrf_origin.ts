import type { Middleware } from "fresh";
import { getSessionToken } from "../cookies.ts";
import type { AuthState } from "./auth_guard.ts";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function requestOrigin(req: Request): string | null {
  const origin = req.headers.get("origin");
  if (origin) return origin;
  const referer = req.headers.get("referer");
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

/** Reject cross-site mutating API requests that carry a session cookie (CSRF). */
export const csrfOriginMiddleware: Middleware<AuthState> = async (ctx) => {
  if (SAFE_METHODS.has(ctx.req.method)) {
    return ctx.next();
  }
  const url = new URL(ctx.req.url);
  if (!url.pathname.startsWith("/api/")) {
    return ctx.next();
  }
  if (!getSessionToken(ctx.req)) {
    return ctx.next();
  }
  const expected = url.origin;
  const actual = requestOrigin(ctx.req);
  if (!actual || actual !== expected) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return ctx.next();
};
