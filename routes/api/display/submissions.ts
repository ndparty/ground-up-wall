import { parseDwellTime } from "../../../lib/train/display_helpers.ts";
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
    const submissions = await ctx.state.services.photoWall.getApprovedSubmissions();
    const dwellConfig = await ctx.state.services.photoWall.getSystemParameters();
    const dwell = dwellConfig.find((c) => c.key === "train_dwell_time");
    return ctx.json({
      submissions,
      dwellTimeSeconds: parseDwellTime(dwell?.value ?? dwell?.default_value),
    });
  },
});
