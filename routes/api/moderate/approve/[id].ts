import { toPublicError } from "../../../../lib/api/public_error.ts";
import { define } from "../../../../utils.ts";

export const handlers = define.handlers({
  async POST(ctx) {
    const id = ctx.params.id;
    const user = ctx.state.user!;
    try {
      const submission = await ctx.state.services.photoWall.approveSubmission(id, user.id);
      return ctx.json(submission);
    } catch (err) {
      return ctx.json({ error: toPublicError(err, "Approve failed") }, { status: 400 });
    }
  },
});
