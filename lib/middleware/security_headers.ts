import type { Middleware } from "fresh";
import type { State } from "../../utils.ts";

/** True in deployed (HTTPS) environments — enables HSTS and Secure cookies. */
export function isDeployedEnvironment(): boolean {
  return Boolean(Deno.env.get("DENO_DEPLOYMENT_ID"));
}

// The app relies heavily on inline `style=` attributes and Fresh island hydration,
// so style/script allow 'unsafe-inline'. img allows data:/blob: for upload previews.
// Tightening script-src with nonces is a future hardening step (NFR-23).
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
].join("; ");

/** NFR-23: apply baseline security response headers to every response. */
export const securityHeadersMiddleware: Middleware<State> = async (ctx) => {
  const res = await ctx.next();
  try {
    const h = res.headers;
    if (!h.has("content-security-policy")) {
      h.set("content-security-policy", CONTENT_SECURITY_POLICY);
    }
    h.set("x-content-type-options", "nosniff");
    h.set("x-frame-options", "DENY");
    h.set("referrer-policy", "same-origin");
    if (isDeployedEnvironment()) {
      h.set("strict-transport-security", "max-age=31536000; includeSubDomains");
    }
  } catch {
    // Some responses (e.g. immutable framework responses) may reject header
    // mutation; never let header hardening break the response.
  }
  return res;
};
