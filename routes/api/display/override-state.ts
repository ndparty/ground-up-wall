import { define } from "../../../utils.ts";

export const handlers = define.handlers({
  async GET(ctx) {
    const state = await ctx.state.services.photoWall.getResolvedDisplayOverrideState();
    if (!state || state.type === "normal") {
      return ctx.json({ type: "normal" });
    }
    return ctx.json({ type: state.type, imageUrl: state.imageUrl });
  },
});
