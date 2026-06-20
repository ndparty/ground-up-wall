import { sessionCookieHeader } from "../../../lib/cookies.ts";
import { clientKey, RateLimiter, tooManyRequests } from "../../../lib/security/rate_limit.ts";
import { define } from "../../../utils.ts";

// Per-IP login rate limit (NFR-23) — complements per-account lockout in AuthService.
const loginRateLimiter = new RateLimiter(10, 60_000);

export const handlers = define.handlers({
  async POST(ctx) {
    const limit = loginRateLimiter.check(clientKey(ctx.req, ctx.info));
    if (!limit.allowed) {
      return tooManyRequests(limit.retryAfterMs);
    }
    const { username, password } = await ctx.req.json();
    const result = await ctx.state.services.auth.login(username, password);
    if (!result.success || !result.token || !result.user) {
      return ctx.json({ error: result.error ?? "Invalid credentials" }, { status: 401 });
    }
    const headers = new Headers({ "Content-Type": "application/json" });
    headers.set("Set-Cookie", sessionCookieHeader(result.token));
    return new Response(JSON.stringify({ user: result.user }), { status: 200, headers });
  },
});
