import { define } from "../../../../utils.ts";

export const handlers = define.handlers({
  async POST(ctx) {
    const id = ctx.params.id;
    const user = ctx.state.user!;
    try {
      const submission = await ctx.state.services.photoWall.rejectSubmission(id, user.id);
      return ctx.json(submission);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Reject failed";
      return ctx.json({ error: message }, { status: 400 });
    }
  },
});
