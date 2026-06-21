import { define } from "../../../utils.ts";

function canViewDisplay(role: string | undefined): boolean {
  return role === "display_wall" || role === "moderator" || role === "admin";
}

export const handlers = define.handlers({
  async GET(ctx) {
    const user = ctx.state.user;
    if (!user || !canViewDisplay(user.role)) {
      return ctx.json({ error: "Forbidden" }, { status: 403 });
    }
    const state = await ctx.state.services.photoWall.getResolvedDisplayOverrideState();
    if (!state || state.type === "normal") {
      return ctx.json({ type: "normal" });
    }
    return ctx.json({ type: state.type, imageUrl: state.imageUrl });
  },
});
