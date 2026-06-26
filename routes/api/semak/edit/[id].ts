import type { SubmissionEditData } from "../../../../lib/types.ts";
import { toPublicError } from "../../../../lib/api/public_error.ts";
import { define } from "../../../../utils.ts";

export const handlers = define.handlers({
  async POST(ctx) {
    const id = ctx.params.id;
    const user = ctx.state.user!;
    const body = await ctx.req.json() as SubmissionEditData;
    try {
      const submission = await ctx.state.services.photoWall.editSubmission(id, body, user.id);
      return ctx.json(submission);
    } catch (err) {
      return ctx.json({ error: toPublicError(err, "Edit failed") }, { status: 400 });
    }
  },
});
