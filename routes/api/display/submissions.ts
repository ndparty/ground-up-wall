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
    await ctx.state.services.photoWall.ensurePlaybackInitialized();
    const submissions = await ctx.state.services.photoWall.getApprovedSubmissions();
    const playback = ctx.state.services.photoWall.getTrainPlaybackState();
    return ctx.json({
      submissions,
      dwellTimeSeconds: playback.dwellSeconds,
      playback: {
        isPlaying: playback.isPlaying,
        currentCabin: playback.currentCabin,
        dwellSeconds: playback.dwellSeconds,
        lastTransitionAt: playback.lastTransitionAt,
      },
    });
  },
});
