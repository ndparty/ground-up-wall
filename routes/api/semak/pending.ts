import { define } from "../../../utils.ts";

export const handlers = define.handlers({
  async GET(ctx) {
    const submissions = await ctx.state.services.photoWall.getPendingSubmissions();
    return ctx.json(submissions);
  },
});
