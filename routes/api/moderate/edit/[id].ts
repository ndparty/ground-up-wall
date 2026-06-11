import type { SubmissionEditData } from "../../../../lib/types.ts";
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
      const message = err instanceof Error ? err.message : "Edit failed";
      return ctx.json({ error: message }, { status: 400 });
    }
  },
});
