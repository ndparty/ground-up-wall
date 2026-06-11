import { getSessionToken } from "../../../lib/cookies.ts";
import { define } from "../../../utils.ts";

export const handlers = define.handlers({
  GET(ctx) {
    const token = getSessionToken(ctx.req);
    const user = ctx.state.services.auth.getCurrentUser(token);
    if (!user) {
      return ctx.json({ user: null }, { status: 401 });
    }
    return ctx.json({ user });
  },
});
