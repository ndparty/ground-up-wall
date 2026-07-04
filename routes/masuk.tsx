import { page } from "fresh";
import LoginForm from "../islands/LoginForm.tsx";
import { loginRedirectPath } from "../lib/auth/login_redirect.ts";
import { sessionCookieHeader } from "../lib/cookies.ts";
import { clientKey } from "../lib/security/rate_limit.ts";
import { loginRateLimiter } from "../lib/security/login_gate.ts";
import { securityGatesDisabled } from "../lib/security/gate_mode.ts";
import { define } from "../utils.ts";

function stripCredentialQueryParams(url: URL): URL | null {
  if (!url.searchParams.has("username") && !url.searchParams.has("password")) {
    return null;
  }
  url.searchParams.delete("username");
  url.searchParams.delete("password");
  return url;
}

export const handlers = define.handlers({
  GET(ctx) {
    const url = new URL(ctx.req.url);
    const cleaned = stripCredentialQueryParams(url);
    if (cleaned) {
      const target = cleaned.pathname + (cleaned.search || "");
      return Response.redirect(new URL(target, cleaned.origin), 302);
    }

    const error = url.searchParams.get("error") === "invalid" ? "Invalid credentials" : undefined;
    return page({ error });
  },
  async POST(ctx) {
    const gatesOn = !securityGatesDisabled();

    // NFR-23 parity with /api/masuk/session: this no-JS fallback must not offer a
    // cheaper brute-force path than the JSON endpoint.
    if (gatesOn && await ctx.state.services.photoWall.isPowChallengeEnabled()) {
      // Proof-of-work cannot be solved without JavaScript; keep the gate closed here.
      return page({
        error: "JavaScript is required to sign in while the security challenge is enabled.",
      });
    }

    const key = clientKey(ctx.req, ctx.info);
    if (gatesOn) {
      const limit = loginRateLimiter.check(key);
      if (!limit.allowed) {
        return page({ error: "Too many attempts. Please wait a minute and try again." });
      }
    }

    const form = await ctx.req.formData();
    const username = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");
    const result = await ctx.state.services.auth.login(username, password, key);

    if (!result.success || !result.token || !result.user) {
      return page({ error: result.error ?? "Invalid credentials" });
    }

    const headers = new Headers();
    headers.set("Location", loginRedirectPath(result.user.role));
    headers.set("Set-Cookie", sessionCookieHeader(result.token));
    return new Response(null, { status: 302, headers });
  },
});

export default define.page<typeof handlers>(function LoginPage({ data }) {
  return (
    <div class="page page--narrow">
      <h2 class="heading-brand">Sign in</h2>
      <LoginForm initialError={data.error} />
    </div>
  );
});
