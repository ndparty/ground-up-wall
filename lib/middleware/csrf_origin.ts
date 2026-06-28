import type { Middleware } from "fresh";
import { getSessionToken } from "../cookies.ts";
import { isDeployedEnvironment } from "../deployed.ts";
import type { AuthState } from "./auth_guard.ts";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Public site origin for CSRF checks — uses proxy headers when deployed behind Caddy/Cloudflare. */
export function expectedRequestOrigin(req: Request, url: URL): string {
  if (!isDeployedEnvironment()) return url.origin;

  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    req.headers.get("host")?.trim();
  if (proto && host) return `${proto}://${host}`;

  return url.origin;
}

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
// deno-lint-ignore require-await
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
  const expected = expectedRequestOrigin(ctx.req, url);
  const actual = requestOrigin(ctx.req);
  if (!actual || actual !== expected) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return ctx.next();
};
