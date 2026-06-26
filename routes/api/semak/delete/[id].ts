import { toPublicError } from "../../../../lib/api/public_error.ts";
import { define } from "../../../../utils.ts";

export const handlers = define.handlers({
  async POST(ctx) {
    const id = ctx.params.id;
    const user = ctx.state.user!;
    try {
      await ctx.state.services.photoWall.deleteSubmission(id, user.id);
      return ctx.json({ ok: true });
    } catch (err) {
      return ctx.json({ error: toPublicError(err, "Delete failed") }, { status: 400 });
    }
  },
});
