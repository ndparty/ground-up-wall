import { define } from "../../../../utils.ts";

export const handlers = define.handlers({
  async POST(ctx) {
    const id = ctx.params.id;
    const user = ctx.state.user!;
    try {
      await ctx.state.services.photoWall.deleteSubmission(id, user.id);
      return ctx.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      return ctx.json({ error: message }, { status: 400 });
    }
  },
});
