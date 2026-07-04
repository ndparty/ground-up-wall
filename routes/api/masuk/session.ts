import { sessionCookieHeader } from "../../../lib/cookies.ts";
import { clientKey, tooManyRequests } from "../../../lib/security/rate_limit.ts";
import { loginRateLimiter } from "../../../lib/security/login_gate.ts";
import { verifyPowToken } from "../../../lib/security/pow_challenge_store.ts";
import { securityGatesDisabled } from "../../../lib/security/gate_mode.ts";
import { define } from "../../../utils.ts";

export const handlers = define.handlers({
  async POST(ctx) {
    const gatesOn = !securityGatesDisabled();
    // Proof-of-work gate (NFR-23) — when enabled, verified before rate-limit, lockout, and bcrypt.
    if (gatesOn && await ctx.state.services.photoWall.isPowChallengeEnabled()) {
      const ok = await verifyPowToken(ctx.req.headers.get("x-pow"));
      if (!ok) {
        return ctx.json({ error: "Proof-of-work required", powRequired: true }, { status: 428 });
      }
    }
    if (gatesOn) {
      const limit = loginRateLimiter.check(clientKey(ctx.req, ctx.info));
      if (!limit.allowed) {
        return tooManyRequests(limit.retryAfterMs);
      }
    }
    const { username, password } = await ctx.req.json();
    const result = await ctx.state.services.auth.login(
      username,
      password,
      clientKey(ctx.req, ctx.info),
    );
    if (!result.success || !result.token || !result.user) {
      return ctx.json({ error: result.error ?? "Invalid credentials" }, { status: 401 });
    }
    const headers = new Headers({ "Content-Type": "application/json" });
    headers.set("Set-Cookie", sessionCookieHeader(result.token));
    return new Response(JSON.stringify({ user: result.user }), { status: 200, headers });
  },
});
