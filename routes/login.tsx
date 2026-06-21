import { page } from "fresh";
import LoginForm from "../islands/LoginForm.tsx";
import { loginRedirectPath } from "../lib/auth/login_redirect.ts";
import { sessionCookieHeader } from "../lib/cookies.ts";
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
    const form = await ctx.req.formData();
    const username = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");
    const result = await ctx.state.services.auth.login(username, password);

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
    <div style="max-width: 400px; margin: 3rem auto; padding: 0 1rem;">
      <h2 style="color: #ef3340;">Sign in</h2>
      <LoginForm initialError={data.error} />
    </div>
  );
});
