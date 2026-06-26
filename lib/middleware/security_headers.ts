import type { Middleware } from "fresh";
import type { State } from "../../utils.ts";
import { isDeployedEnvironment } from "../deployed.ts";

export { isDeployedEnvironment } from "../deployed.ts";

function buildContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob:",
    `style-src 'self' 'nonce-${nonce}'`,
    // Fresh island hydration still injects inline scripts; nonce wiring is a follow-up.
    "script-src 'self' 'unsafe-inline'",
    "worker-src 'self' blob:",
    "connect-src 'self'",
  ].join("; ");
}

/** NFR-23: apply baseline security response headers to every response. */
export const securityHeadersMiddleware: Middleware<State> = async (ctx) => {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  ctx.state.cspNonce = nonce;
  const res = await ctx.next();
  try {
    const h = res.headers;
    if (!h.has("content-security-policy")) {
      h.set("content-security-policy", buildContentSecurityPolicy(nonce));
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
