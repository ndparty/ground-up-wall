import { define } from "../../../../utils.ts";

export const handlers = define.handlers({
  async POST(ctx) {
    const admin = ctx.state.user!;
    await ctx.state.services.photoWall.clearDefaultPlaceholder(admin.id);
    return ctx.json({ ok: true });
  },
});
