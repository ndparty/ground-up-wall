import { define } from "../../../utils.ts";

export const handlers = define.handlers({
  async GET(ctx) {
    await ctx.state.services.photoWall.ensurePlaybackInitialized();
    const submissions = await ctx.state.services.photoWall.getApprovedSubmissions();
    const playback = ctx.state.services.photoWall.getTrainPlaybackState();
    const publicParticipantUrl = await ctx.state.services.photoWall.getPublicParticipantUrl();
    return ctx.json({
      submissions,
      dwellTimeSeconds: playback.dwellSeconds,
      playback: {
        isPlaying: playback.isPlaying,
        currentCabin: playback.currentCabin,
        dwellSeconds: playback.dwellSeconds,
        lastTransitionAt: playback.lastTransitionAt,
        window: playback.window,
      },
      publicParticipantUrl,
    });
  },
});
