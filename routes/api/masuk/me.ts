import { define } from "../../../utils.ts";

export const handlers = define.handlers({
  GET(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.json({ user: null }, { status: 401 });
    }
    return ctx.json({ user });
  },
});
