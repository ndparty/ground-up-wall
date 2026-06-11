import { sessionCookieHeader } from "../../../lib/cookies.ts";
import { define } from "../../../utils.ts";

export const handlers = define.handlers({
  async POST(ctx) {
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
