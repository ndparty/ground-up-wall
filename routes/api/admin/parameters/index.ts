import { define } from "../../../../utils.ts";

export const handlers = define.handlers({
  async GET(ctx) {
    const parameters = await ctx.state.services.photoWall.getSystemParameters();
    return ctx.json(parameters);
  },
});
