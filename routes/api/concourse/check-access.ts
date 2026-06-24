import { define } from "../../../utils.ts";

export const handlers = define.handlers({
  GET(ctx) {
    const user = ctx.state.user;
    if (
      !user ||
      (user.role !== "display_wall" && user.role !== "moderator" && user.role !== "admin")
    ) {
      return ctx.json({ allowed: false, role: user?.role ?? null });
    }
    return ctx.json({ allowed: true, role: user.role });
  },
});
