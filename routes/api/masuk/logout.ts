import { clearSessionCookieHeader, getSessionToken } from "../../../lib/cookies.ts";
import { define } from "../../../utils.ts";

export const handlers = define.handlers({
  POST(ctx) {
    const token = getSessionToken(ctx.req);
    if (token) void ctx.state.services.auth.logout(token);
    const headers = new Headers({ "Content-Type": "application/json" });
    headers.set("Set-Cookie", clearSessionCookieHeader());
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  },
});
